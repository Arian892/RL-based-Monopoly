"""
Evaluate a trained agent against fixed-policy agents and plot
win rates over many games.

Example:
  ./venv/bin/python evaluate_monopolies.py \
    --algo ppo \
    --model models/ppo_model.pt \
    --games 100 \
    --max-rounds 100 \
        --out win_rates_100.png
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from monopoly_drl.env import MonopolyEnv
from monopoly_drl.actions import ActionType
from monopoly_drl.constants import NUM_PLAYERS
from monopoly_drl.agent_ppo import PPOAgent
from monopoly_drl.agent_ddqn import DDQNAgent
from monopoly_drl.agents_fixed import FPAgentA, FPAgentB, FPAgentC


def run_one_game(env: MonopolyEnv, learned_agent, fp_agents: dict[int, object], is_ppo: bool, max_steps_factor: int):
    state = env.reset()
    done = False
    max_steps = env.max_rounds * NUM_PLAYERS * max_steps_factor
    step_count = 0

    while not done and step_count < max_steps:
        step_count += 1
        pid = env.whose_turn()

        if env.players[pid].bankrupt:
            env._advance_turn()
            continue

        allowed = env.get_allowed_actions(pid)
        if not allowed:
            allowed = [int(ActionType.END_TURN)]

        if pid == learned_agent.player_id:
            if is_ppo:
                action, _, _ = learned_agent.choose_action(state, env, allowed)
            else:
                action = learned_agent.choose_action(state, env, allowed)
        else:
            action = fp_agents[pid].choose_action(env)
            if action not in allowed:
                action = int(ActionType.END_TURN) if int(ActionType.END_TURN) in allowed else allowed[0]

        state, _, done, _ = env.step(action)

    return env.winner()


def plot_win_rates(win_rates, labels, title, out_path: Path):
    fig, ax = plt.subplots(figsize=(9, 5.8))
    x = np.arange(len(labels))
    colors = ["#4C72B0", "#DD8452", "#55A868", "#C44E52"]

    bars = ax.bar(x, win_rates, color=colors, edgecolor="white", width=0.78)
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.set_ylabel("Win Rate (%)")
    ax.set_title(title)

    baseline = 100.0 / len(labels)
    ax.axhline(baseline, linestyle="--", linewidth=1.2, color="gray", label="Random baseline")
    ax.legend(loc="upper right")

    for bar, val in zip(bars, win_rates):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            val + 0.6,
            f"{val:.1f}%",
            ha="center",
            va="bottom",
            fontsize=10,
            fontweight="bold",
        )

    ax.set_ylim(0, max(55.0, float(max(win_rates)) + 8.0))
    fig.tight_layout()

    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description="Plot win rates over multiple games")
    parser.add_argument("--algo", choices=["ppo", "ddqn"], default="ppo")
    parser.add_argument("--model", type=str, default=None,
                        help="Path to trained model (.pt). If omitted, uses untrained weights.")
    parser.add_argument("--games", type=int, default=100)
    parser.add_argument("--max-rounds", type=int, default=100)
    parser.add_argument("--max-steps-factor", type=int, default=20)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=str, default="win_rates_100.png")
    parser.add_argument("--json", type=str, default="win_rates_100.json")
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)

    learned_pid = 0
    if args.algo == "ppo":
        learned_agent = PPOAgent(player_id=learned_pid, hybrid=True)
        is_ppo = True
    else:
        learned_agent = DDQNAgent(player_id=learned_pid, hybrid=True)
        is_ppo = False

    if args.model:
        model_path = Path(args.model)
        if model_path.exists():
            learned_agent.load(str(model_path))
            print(f"Loaded model: {model_path}")
        else:
            print(f"Model not found: {model_path}. Running with untrained weights.")

    if hasattr(learned_agent, "epsilon"):
        learned_agent.epsilon = 0.0

    env = MonopolyEnv(agent_ids=[learned_pid], max_rounds=args.max_rounds)
    fp_agents = {1: FPAgentA(1), 2: FPAgentB(2), 3: FPAgentC(3)}

    win_counts = [0, 0, 0, 0]
    for game_idx in range(1, args.games + 1):
        winner = run_one_game(env, learned_agent, fp_agents, is_ppo, args.max_steps_factor)
        win_counts[winner] += 1
        if game_idx % max(1, args.games // 10) == 0:
            print(f"Completed {game_idx}/{args.games} games")

    win_rates = (np.array(win_counts, dtype=np.float32) / float(args.games)) * 100.0

    algo_tag = "PPO" if is_ppo else "DDQN"
    labels = [f"P0 ({algo_tag}:working_model)", "P1 (Fixed-A)", "P2 (Fixed-B)", "P3 (Fixed-C)"]
    title = f"Win Rates — {args.games} games"

    out_path = Path(args.out)
    plot_win_rates(win_rates, labels, title, out_path)

    stats = {
        "meta": {
            "algo": args.algo,
            "model": args.model,
            "games": args.games,
            "max_rounds": args.max_rounds,
            "max_steps_factor": args.max_steps_factor,
            "seed": args.seed,
            "plot": str(out_path),
        },
        "win_counts": {
            labels[i]: int(win_counts[i]) for i in range(4)
        },
        "win_rates": {
            labels[i]: float(win_rates[i]) for i in range(4)
        },
    }

    json_path = Path(args.json)
    json_path.write_text(json.dumps(stats, indent=2))

    print(f"Saved plot: {out_path}")
    print(f"Saved stats: {json_path}")


if __name__ == "__main__":
    main()
