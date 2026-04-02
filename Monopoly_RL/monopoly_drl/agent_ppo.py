"""
PPO Agent (Section V-A-1 and V-B).

Implements actor-critic PPO with clipped surrogate objective and
truncated GAE advantage estimation, as described in the paper.

Hybrid mode: BUY_PROPERTY and ACCEPT_TRADE are handled by fixed rules,
             all other actions go through the actor network.
"""

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from collections import deque
from typing import List, Tuple, Optional
import random

from .networks import ActorNetwork, CriticNetwork
from .actions import ActionType, OFFSETS, ACTION_SPACE_SIZE
from .constants import TRADE_CASH_LEVELS, PROPERTY_IDS, COLOR_GROUPS, JAIL_BAIL, NUM_PLAYERS


# ── Hybrid fixed-policy decisions ─────────────────────────────────────────────

def fixed_buy_decision(env, pid: int) -> bool:
    player = env.players[pid]
    sq     = player.position
    if sq not in env.properties:
        return False
    prop = env.properties[sq]
    if prop.owner is not None or not player.can_afford(prop.price):
        return False

    # Always buy if it completes a monopoly
    color = prop.color
    group = COLOR_GROUPS.get(color, [])
    if group:
        owned = sum(1 for s in group if env.properties[s].owner == pid)
        if owned + 1 == len(group):
            return True

    # Relax buffer from $200 to $100 to be more aggressive
    return player.cash >= prop.price + 100


def fixed_accept_trade_decision(env, pid: int) -> bool:
    offer = next(
        (o for o in env.pending_trades.values() if o.to_player == pid), None
    )
    if offer is None:
        return False

    # Accept if it gives us a monopoly
    if offer.offered_prop:  # we are receiving a property
        color = offer.offered_prop.color
        group = COLOR_GROUPS.get(color, [])
        if group:
            owned_after = sum(1 for s in group
                              if env.properties[s].owner == pid
                              or env.properties[s] == offer.offered_prop)
            if owned_after == len(group):
                return True

    # Accept at parity OR better (was strictly > 0, now >= 0)
    nwo = offer.net_worth()
    return -nwo >= 0

# ── Experience buffer ─────────────────────────────────────────────────────────

class PPOBuffer:
    """Stores a single rollout trajectory for PPO updates."""

    def __init__(self):
        self.states    = []
        self.actions   = []
        self.log_probs = []
        self.rewards   = []
        self.values    = []
        self.dones     = []

    def store(self, state, action, log_prob, reward, value, done):
        self.states.append(state)
        self.actions.append(action)
        self.log_probs.append(log_prob)
        self.rewards.append(reward)
        self.values.append(value)
        self.dones.append(done)

    def clear(self):
        self.__init__()

    def __len__(self):
        return len(self.states)


# ── PPO Agent ─────────────────────────────────────────────────────────────────

class PPOAgent:
    """
    Actor-critic PPO agent, with optional hybrid mode.
    
    Parameters mirror Appendix B-A of the paper.
    """

    def __init__(
        self,
        player_id: int,
        hybrid: bool = False,
        lr: float = 3e-4,
        gamma: float = 0.99,
        lam: float = 0.95,       # GAE lambda
        clip_eps: float = 0.2,
        entropy_coef: float = 0.05,
        value_coef: float = 0.5,
        max_grad_norm: float = 0.5,
        n_steps: int = 1024,      # steps per rollout
        n_epochs: int = 4,       # PPO update epochs
        batch_size: int = 64,
        hidden_dim: int = 256,
        win_loss_bonus: float = 0.0,  # constant c in paper (c=0 for PPO)
    ):
        self.player_id     = player_id
        self.hybrid        = hybrid
        self.gamma         = gamma
        self.lam           = lam
        self.clip_eps      = clip_eps
        self.entropy_coef  = entropy_coef
        self.value_coef    = value_coef
        self.max_grad_norm = max_grad_norm
        self.n_steps       = n_steps
        self.n_epochs      = n_epochs
        self.batch_size    = batch_size
        self.win_loss_bonus = win_loss_bonus

        self.actor  = ActorNetwork(hidden_dim)
        self.critic = CriticNetwork(hidden_dim)
        self.opt    = optim.Adam(
            list(self.actor.parameters()) + list(self.critic.parameters()), lr=lr
        )

        self.buffer   = PPOBuffer()
        self.step_count = 0

        # Mask actions permanently handled by fixed policy (hybrid only)
        self.fixed_action_mask = torch.zeros(ACTION_SPACE_SIZE, dtype=torch.bool)
        if hybrid:
            self.fixed_action_mask[int(ActionType.BUY_PROPERTY)] = True
            self.fixed_action_mask[int(ActionType.ACCEPT_TRADE)]  = True

    # ── Action selection ──────────────────────────────────────────────────────

    def choose_action(self, state: np.ndarray, env, allowed_actions: List[int]):
        """
        Choose an action. In hybrid mode, intercept BUY and ACCEPT_TRADE.
        """
        pid = self.player_id

        # Hybrid: handle buy property
        if self.hybrid and int(ActionType.BUY_PROPERTY) in allowed_actions:
            if fixed_buy_decision(env, pid):
                return int(ActionType.BUY_PROPERTY), 0.0, 0.0

        # Hybrid: handle trade acceptance
        if self.hybrid:
            pending = next(
                (o for o in env.pending_trades.values() if o.to_player == pid),
                None
            )
            if pending is not None:
                if fixed_accept_trade_decision(env, pid):
                    return int(ActionType.ACCEPT_TRADE), 0.0, 0.0
                else:
                    return int(ActionType.DECLINE_TRADE), 0.0, 0.0

        # Filter out fixed-policy actions from neural net consideration
        nn_allowed = [a for a in allowed_actions
                      if not self.fixed_action_mask[a]]
        if not nn_allowed:
            nn_allowed = [int(ActionType.DO_NOTHING)]

        state_t  = torch.FloatTensor(state).unsqueeze(0)
        value    = self.critic(state_t).item()
        action, log_prob = self.actor.get_action(state, nn_allowed)
        return action, log_prob, value

    # ── Store experience ──────────────────────────────────────────────────────

    def store(self, state, action, log_prob, reward, value, done):
        self.buffer.store(state, action, log_prob, reward, value, done)
        self.step_count += 1

    def add_win_loss(self, won: bool):
        """Add terminal win/loss bonus (c=0 for PPO, but kept for generality)."""
        if self.win_loss_bonus != 0 and len(self.buffer.rewards) > 0:
            self.buffer.rewards[-1] += self.win_loss_bonus * (1.0 if won else -1.0)

    # ── PPO update ────────────────────────────────────────────────────────────

    def update(self):
        """Run PPO update over the current buffer."""
        if len(self.buffer) == 0:
            return {}

        # Convert to tensors
        states    = torch.FloatTensor(np.array(self.buffer.states))
        actions   = torch.LongTensor(self.buffer.actions)
        old_lps   = torch.FloatTensor(self.buffer.log_probs)
        rewards   = self.buffer.rewards
        values    = self.buffer.values
        dones     = self.buffer.dones

        # Compute GAE advantages
        advantages = self._compute_gae(rewards, values, dones)
        returns    = advantages + torch.FloatTensor(values)
        if len(advantages) > 1:
            advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
        else:
            advantages = advantages - advantages.mean()

        # Build full log-prob masks (all actions allowed in training)
        all_mask = torch.ones(len(states), ACTION_SPACE_SIZE, dtype=torch.bool)

        stats = {"actor_loss": 0.0, "critic_loss": 0.0, "entropy": 0.0}
        n_batches = 0

        for _ in range(self.n_epochs):
            indices = torch.randperm(len(states))
            for start in range(0, len(states), self.batch_size):
                idx = indices[start:start + self.batch_size]
                if len(idx) < 2:
                    continue

                sb  = states[idx]
                ab  = actions[idx]
                olp = old_lps[idx]
                adv = advantages[idx]
                ret = returns[idx]

                log_probs_all = self.actor(sb, all_mask[idx])
                new_lps  = log_probs_all.gather(1, ab.unsqueeze(1)).squeeze(1)
                entropy  = -(log_probs_all.exp() * log_probs_all).sum(dim=-1).mean()

                ratio        = (new_lps - olp).exp()
                surr1        = ratio * adv
                surr2        = torch.clamp(ratio, 1 - self.clip_eps, 1 + self.clip_eps) * adv
                actor_loss   = -torch.min(surr1, surr2).mean()

                values_pred  = self.critic(sb)
                critic_loss  = nn.MSELoss()(values_pred, ret)

                loss = actor_loss + self.value_coef * critic_loss - self.entropy_coef * entropy

                self.opt.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(
                    list(self.actor.parameters()) + list(self.critic.parameters()),
                    self.max_grad_norm
                )
                self.opt.step()

                stats["actor_loss"]  += actor_loss.item()
                stats["critic_loss"] += critic_loss.item()
                stats["entropy"]     += entropy.item()
                n_batches += 1

        self.buffer.clear()
        if n_batches > 0:
            return {k: v / n_batches for k, v in stats.items()}
        return stats

    def _compute_gae(self, rewards, values, dones) -> torch.Tensor:
        advantages = torch.zeros(len(rewards))
        gae = 0.0
        for t in reversed(range(len(rewards))):
            next_value = values[t + 1] if t + 1 < len(values) else 0.0
            delta = rewards[t] + self.gamma * next_value * (1 - dones[t]) - values[t]
            gae   = delta + self.gamma * self.lam * (1 - dones[t]) * gae
            advantages[t] = gae
        return advantages

    def save(self, path: str):
        torch.save({
            "actor":  self.actor.state_dict(),
            "critic": self.critic.state_dict(),
        }, path)

    def load(self, path: str):
        ckpt = torch.load(path, map_location="cpu")
        self.actor.load_state_dict(ckpt["actor"])
        self.critic.load_state_dict(ckpt["critic"])
