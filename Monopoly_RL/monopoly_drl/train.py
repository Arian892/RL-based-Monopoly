"""
Training loop (Section VII).

Trains one learning agent (PPO or DDQN, standard or hybrid) against
three fixed-policy opponents. Logs win rates every 100 games.
"""

import random
import numpy as np
from typing import List, Dict
from collections import defaultdict

from .env import MonopolyEnv
from .agents_fixed import FPAgentA, FPAgentB, FPAgentC, FixedPolicyAgent
from .actions import ActionType
from .constants import NUM_PLAYERS


def run_episode(env: MonopolyEnv,
                learning_agent,
                fp_agents: List[FixedPolicyAgent],
                agent_pid: int,
                is_ppo: bool,
                update_online: bool = True,
                max_steps_factor: int = 30) -> Dict:
    """
    Run one complete game. The learning agent occupies position agent_pid,
    fixed-policy agents fill the other three slots.

    Uses env.whose_turn() to determine who acts each step, and
    env.step(action) with the new single-argument signature.
    """
    state = env.reset()
    done  = False
    total_reward = 0.0
    steps        = 0
    update_stats = {}

    # Map player_id → agent object
    agents_map = {fp.player_id: fp for fp in fp_agents}
    agents_map[agent_pid] = learning_agent

    prev_state  = state
    prev_action = None

    max_steps = env.max_rounds * NUM_PLAYERS * max_steps_factor
    step_count = 0

    while not done and step_count < max_steps:
        step_count += 1
        # Ask env who should act right now
        pid = env.whose_turn()

        # Skip bankrupt players
        if env.players[pid].bankrupt:
            env._advance_turn()
            continue

        # Get allowed actions for whoever's turn it is
        allowed = env.get_allowed_actions(pid)
        if not allowed:
            allowed = [int(ActionType.END_TURN)]

        if pid == agent_pid:
            # ── Learning agent ──────────────────────────────────────────
            if is_ppo:
                action, log_prob, value = learning_agent.choose_action(state, env, allowed)
            else:
                action = learning_agent.choose_action(state, env, allowed)
                log_prob, value = 0.0, 0.0

            next_state, reward, done, info = env.step(action)
            total_reward += reward
            steps        += 1

            if update_online:
                if is_ppo:
                    learning_agent.store(prev_state, action, log_prob, reward, value, done)
                    if len(learning_agent.buffer) >= learning_agent.n_steps:
                        update_stats = learning_agent.update()
                else:
                    next_pid = env.whose_turn()
                    next_allowed = env.get_allowed_actions(next_pid)
                    learning_agent.store_transition(state, action,
                                                    reward, next_state, done,
                                                    next_allowed)
                    update_stats = learning_agent.update()

            prev_state  = next_state
            prev_action = action
            state       = next_state

        else:
            # ── Fixed-policy agent ──────────────────────────────────────
            agent  = agents_map.get(pid)
            action = agent.choose_action(env) if agent else int(ActionType.END_TURN)
            if action not in allowed:
                action = int(ActionType.END_TURN) if int(ActionType.END_TURN) in allowed else allowed[0]

            next_state, _, done, _ = env.step(action)
            state = next_state

    # ── Game over ───────────────────────────────────────────────────────
    winner = env.winner()
    won    = (winner == agent_pid)

    if update_online:
        if is_ppo:
            learning_agent.add_win_loss(won)
            if len(learning_agent.buffer) > 0:
                update_stats.update(learning_agent.update())
        else:
            learning_agent.add_win_loss(won)

    return {"won": won, "reward": total_reward, "steps": steps, "stats": update_stats}


def train(
    learning_agent,
    is_ppo: bool,
    hybrid: bool,
    n_games: int = 2000,
    log_every: int = 50,
    seed: int = 42,
    max_rounds: int = 300,
    max_steps_factor: int = 30,
) -> Dict:
    """
    Main training function.

    Returns:
        history: dict with win_rates (list per log_every games) and other metrics
    """
    random.seed(seed)
    np.random.seed(seed)

    agent_pid = learning_agent.player_id
    env       = MonopolyEnv(agent_ids=[agent_pid], max_rounds=max_rounds)

    # Create fixed-policy opponents with the remaining player IDs
    other_pids = [i for i in range(NUM_PLAYERS) if i != agent_pid]
    fp_classes = [FPAgentA, FPAgentB, FPAgentC]
    fp_agents  = [fp_classes[i](other_pids[i]) for i in range(3)]

    history = defaultdict(list)
    wins_window = 0
    window_games = 0

    print(f"\n{'='*60}")
    print(f"Training {'Hybrid' if hybrid else 'Standard'} "
          f"{'PPO' if is_ppo else 'DDQN'} agent (player {agent_pid})")
    print(f"Total games: {n_games}  |  Log every: {log_every}")
    print(f"{'='*60}")

    for game_num in range(1, n_games + 1):
        # Randomise turn order by shuffling player IDs before each game
        result = run_episode(
            env,
            learning_agent,
            fp_agents,
            agent_pid,
            is_ppo,
            max_steps_factor=max_steps_factor,
        )

        if result["won"]:
            wins_window += 1
        window_games += 1

        if game_num % log_every == 0:
            win_rate = wins_window / window_games * 100
            history["win_rates"].append(win_rate)
            history["games"].append(game_num)
            history["rewards"].append(result["reward"])

            eps_str = (f"  ε={learning_agent.epsilon:.3f}"
                       if hasattr(learning_agent, "epsilon") else "")
            print(f"  Game {game_num:5d} | Win rate (last {log_every}): "
                  f"{win_rate:5.1f}%{eps_str}")

            wins_window  = 0
            window_games = 0

    return dict(history)


# ── Evaluation ────────────────────────────────────────────────────────────────

def evaluate(
    learning_agent,
    is_ppo: bool,
    n_games: int = 2000,
    n_runs: int = 5,
    seed: int = 0,
    max_rounds: int = 300,
    max_steps_factor: int = 30,
) -> Dict:
    """
    Evaluate a trained agent over n_runs × n_games.
    Sets epsilon=0 for DDQN automatically.
    """
    if hasattr(learning_agent, "epsilon"):
        learning_agent.epsilon = 0.0

    agent_pid = learning_agent.player_id
    env       = MonopolyEnv(agent_ids=[agent_pid], max_rounds=max_rounds)
    other_pids = [i for i in range(NUM_PLAYERS) if i != agent_pid]
    fp_agents  = [FPAgentA(other_pids[0]),
                  FPAgentB(other_pids[1]),
                  FPAgentC(other_pids[2])]

    all_wins = []
    for run in range(n_runs):
        random.seed(seed + run)
        np.random.seed(seed + run)
        wins = 0
        for _ in range(n_games):
            result = run_episode(
                env,
                learning_agent,
                fp_agents,
                agent_pid,
                is_ppo,
                update_online=False,
                max_steps_factor=max_steps_factor,
            )
            if result["won"]:
                wins += 1
        rate = wins / n_games * 100
        all_wins.append(rate)
        print(f"  Run {run+1}/{n_runs}:  win rate = {rate:.1f}%")

    mean = float(np.mean(all_wins))
    std  = float(np.std(all_wins))
    print(f"\n  Overall win rate: {mean:.2f}% ± {std:.2f}%")
    return {"win_rates": all_wins, "mean": mean, "std": std}