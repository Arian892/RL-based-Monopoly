"""
Neural network architectures for PPO (actor-critic) and DDQN agents.
State dim = 240, Action dim = ACTION_SPACE_SIZE
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from .actions import ACTION_SPACE_SIZE

STATE_DIM = 240


class ActorNetwork(nn.Module):
    """
    PPO Actor: maps state → action probability distribution.
    Outputs logits over ACTION_SPACE_SIZE actions.
    """
    def __init__(self, hidden_dim: int = 256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(STATE_DIM, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, ACTION_SPACE_SIZE),
        )

    def forward(self, state: torch.Tensor, mask: torch.Tensor = None) -> torch.Tensor:
        """
        Args:
            state : (batch, STATE_DIM)
            mask  : (batch, ACTION_SPACE_SIZE) bool tensor, True = allowed
        Returns:
            log_probs : (batch, ACTION_SPACE_SIZE)
        """
        logits = self.net(state)
        if mask is not None:
            logits = logits.masked_fill(~mask, float('-inf'))
        return F.log_softmax(logits, dim=-1)

    def get_action(self, state: np.ndarray, allowed_actions: list):
        """Sample an action given allowed actions."""
        state_t  = torch.FloatTensor(state).unsqueeze(0)
        mask     = torch.zeros(1, ACTION_SPACE_SIZE, dtype=torch.bool)
        mask[0, allowed_actions] = True
        with torch.no_grad():
            log_probs = self.forward(state_t, mask)
        probs    = log_probs.exp().squeeze(0)
        action   = torch.multinomial(probs, 1).item()
        log_prob = log_probs[0, action].item()
        return action, log_prob


class CriticNetwork(nn.Module):
    """PPO Critic: maps state → scalar value estimate V(s)."""
    def __init__(self, hidden_dim: int = 256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(STATE_DIM, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, state: torch.Tensor) -> torch.Tensor:
        return self.net(state).squeeze(-1)


class DDQNNetwork(nn.Module):
    """
    Double DQN network: maps state → Q-values for all actions.
    Uses dueling architecture for stability.
    """
    def __init__(self, hidden_dim: int = 256):
        super().__init__()
        self.feature = nn.Sequential(
            nn.Linear(STATE_DIM, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
        )
        # Value stream
        self.value_stream = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
        )
        # Advantage stream
        self.adv_stream = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, ACTION_SPACE_SIZE),
        )

    def forward(self, state: torch.Tensor) -> torch.Tensor:
        feat  = self.feature(state)
        value = self.value_stream(feat)
        adv   = self.adv_stream(feat)
        # Dueling: Q = V + (A - mean(A))
        return value + (adv - adv.mean(dim=-1, keepdim=True))

    def get_action(self, state: np.ndarray, allowed_actions: list, epsilon: float = 0.0):
        """ε-greedy action selection with action masking."""
        if random.random() < epsilon:
            return random.choice(allowed_actions)
        state_t = torch.FloatTensor(state).unsqueeze(0)
        with torch.no_grad():
            q_values = self.forward(state_t).squeeze(0)
        # Mask illegal actions
        mask = torch.full((ACTION_SPACE_SIZE,), float('-inf'))
        mask[allowed_actions] = 0.0
        q_masked = q_values + mask
        return q_masked.argmax().item()


import random  # noqa – needed by DDQNNetwork.get_action
