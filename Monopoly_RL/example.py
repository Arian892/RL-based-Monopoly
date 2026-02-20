"""
Example script: reproduce the key experiments from the paper.

Run with:
    python example.py [--mode ppo|ddqn|both] [--games N] [--hybrid]

Quick demo (100 games, should complete in ~1-2 minutes):
    python example.py --mode ppo --games 100
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from monopoly_drl import train_ppo, train_ddqn, evaluate_agent
from monopoly_drl.env import MonopolyEnv
from monopoly_drl.actions import action_to_description, ACTION_SPACE_SIZE
from monopoly_drl.state import build_state_vector


def demo_env():
    """Show that the environment runs and the state/action spaces are correct."""
    print("\n── Environment Sanity Check ─────────────────────────────────")
    env   = MonopolyEnv()
    state = env.reset()
    print(f"  State vector shape : {state.shape}  (expected: (240,))")
    print(f"  Action space size  : {ACTION_SPACE_SIZE}  (expected: ~2922)")

    allowed = env.get_allowed_actions(0)
    print(f"  Initial allowed actions for player 0: {len(allowed)}")
    print(f"  Example actions: {[action_to_description(a) for a in allowed[:5]]}")

    # Take a few random steps
    for step in range(10):
        player = env.turn_order[env.current_turn_idx]
        acts   = env.get_allowed_actions(player)
        if not acts:
            break
        import random
        a = random.choice(acts)
        state, reward, done, info = env.step(player, a)
        if done:
            break
    print(f"  Ran 10 steps OK. Done={done}, Round={env.round}")


def run_ppo_experiment(n_games: int = 500):
    print("\n── PPO Training Experiment ──────────────────────────────────")

    print("\n[1/2] Standard PPO Agent")
    std_agent, std_history = train_ppo(
        hybrid=False, player_id=0, n_games=n_games, log_every=max(1, n_games // 10)
    )

    print("\n[2/2] Hybrid PPO Agent")
    hyb_agent, hyb_history = train_ppo(
        hybrid=True, player_id=0, n_games=n_games, log_every=max(1, n_games // 10)
    )

    print("\n── Evaluation ───────────────────────────────────────────────")
    n_eval = min(200, n_games // 5)

    print("\nStandard PPO (eval):")
    std_results = evaluate_agent(std_agent, is_ppo=True, n_games=n_eval, n_runs=2)

    print("\nHybrid PPO (eval):")
    hyb_results = evaluate_agent(hyb_agent, is_ppo=True, n_games=n_eval, n_runs=2)

    print("\n── Summary ──────────────────────────────────────────────────")
    print(f"  Standard PPO win rate: {std_results['mean']:.1f}% ± {std_results['std']:.1f}%")
    print(f"  Hybrid PPO win rate  : {hyb_results['mean']:.1f}% ± {hyb_results['std']:.1f}%")
    print(f"  Improvement          : {hyb_results['mean'] - std_results['mean']:+.1f}%")

    return std_agent, hyb_agent, std_history, hyb_history


def run_ddqn_experiment(n_games: int = 2000):
    print("\n── DDQN Training Experiment ─────────────────────────────────")

    print("\n[1/2] Standard DDQN Agent")
    std_agent, std_history = train_ddqn(
        hybrid=False, player_id=0, n_games=n_games, log_every=max(1, n_games // 10)
    )

    print("\n[2/2] Hybrid DDQN Agent")
    hyb_agent, hyb_history = train_ddqn(
        hybrid=True, player_id=0, n_games=n_games, log_every=max(1, n_games // 10)
    )

    print("\n── Evaluation ───────────────────────────────────────────────")
    n_eval = min(200, n_games // 5)

    print("\nStandard DDQN (eval):")
    std_results = evaluate_agent(std_agent, is_ppo=False, n_games=n_eval, n_runs=2)

    print("\nHybrid DDQN (eval):")
    hyb_results = evaluate_agent(hyb_agent, is_ppo=False, n_games=n_eval, n_runs=2)

    print("\n── Summary ──────────────────────────────────────────────────")
    print(f"  Standard DDQN win rate: {std_results['mean']:.1f}% ± {std_results['std']:.1f}%")
    print(f"  Hybrid DDQN win rate  : {hyb_results['mean']:.1f}% ± {hyb_results['std']:.1f}%")
    print(f"  Improvement           : {hyb_results['mean'] - std_results['mean']:+.1f}%")

    return std_agent, hyb_agent


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Monopoly Hybrid DRL experiments")
    parser.add_argument("--mode",  choices=["env", "ppo", "ddqn", "both"],
                        default="env", help="Which experiment to run")
    parser.add_argument("--games", type=int, default=100,
                        help="Number of training games (default: 100 for quick demo)")
    args = parser.parse_args()

    demo_env()

    if args.mode in ("ppo", "both"):
        run_ppo_experiment(n_games=args.games)

    if args.mode in ("ddqn", "both"):
        run_ddqn_experiment(n_games=args.games)

    if args.mode == "env":
        print("\nRun with --mode ppo or --mode ddqn to train agents.")
        print("Example (quick ~2min run):")
        print("  python example.py --mode ppo --games 200")
