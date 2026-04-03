"""
Run repeated Monopoly simulations and report model win rate.

Example:
    python evaluate_winrate.py --model models/ppo_model.pt --algo ppo --players 3 --games 100 --seed 42
"""

import argparse
import os
import random
from statistics import mean

import numpy as np
import torch

from monopoly_drl.env import MonopolyEnv
from monopoly_drl.agent_ppo import PPOAgent
from monopoly_drl.agent_ddqn import DDQNAgent
from monopoly_drl.agents_fixed import FPAgentA, FPAgentB, FPAgentC
from monopoly_drl.actions import ActionType
from monopoly_drl.constants import NUM_PLAYERS


def build_agents(algo: str, model_path: str, n_players: int):
    trained_pid = 0

    if algo == "ppo":
        trained_agent = PPOAgent(player_id=trained_pid, hybrid=True)
    else:
        trained_agent = DDQNAgent(player_id=trained_pid, hybrid=True)

    if not model_path or not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model not found: {model_path}. Pass a valid --model path (e.g. models/ppo_model.pt)."
        )
    trained_agent.load(model_path)

    if hasattr(trained_agent, "epsilon"):
        trained_agent.epsilon = 0.0

    fp_classes = [FPAgentA, FPAgentB, FPAgentC]
    other_pids = list(range(1, n_players))
    fp_agents = {
        other_pids[i]: fp_classes[i % 3](other_pids[i])
        for i in range(len(other_pids))
    }

    pnames = {trained_pid: "Player 1 (AI★)"}
    for pid in other_pids:
        pnames[pid] = f"Player {pid + 1}"

    agents_map = {trained_pid: trained_agent}
    agents_map.update(fp_agents)

    return trained_pid, trained_agent, agents_map, pnames


def play_one_game(
    algo: str,
    trained_pid: int,
    trained_agent,
    agents_map: dict,
    pnames: dict,
    n_players: int,
    max_rounds: int,
    step_limit: int,
    game_seed: int | None,
):
    if game_seed is not None:
        random.seed(game_seed)
        np.random.seed(game_seed)

    env = MonopolyEnv(agent_ids=[trained_pid], max_rounds=max_rounds)
    env.reset()

    env._pnames = pnames
    env._pnames_rev = {v: k for k, v in pnames.items()}

    for pid in range(n_players, NUM_PLAYERS):
        env.players[pid].bankrupt = True

    env.turn_order = [p for p in env.turn_order if p < n_players]
    env.current_turn_idx = 0

    steps = 0
    while not env.done and steps < step_limit:
        steps += 1

        pid = env.whose_turn()

        if env.players[pid].bankrupt:
            env._advance_turn()
            continue

        allowed = env.get_allowed_actions(pid)
        if not allowed:
            allowed = [int(ActionType.END_TURN)]

        if pid == trained_pid:
            state = env._get_state(pid)
            if algo == "ppo":
                with torch.no_grad():
                    action, _, _ = trained_agent.choose_action(state, env, allowed)
            else:
                action = trained_agent.choose_action(state, env, allowed)
        else:
            agent = agents_map[pid]
            action = agent.choose_action(env)
            if action not in allowed:
                action = int(ActionType.END_TURN) if int(ActionType.END_TURN) in allowed else allowed[0]

        env.step(action)

    winner = env.winner()
    if winner is None or winner >= n_players:
        winner = max(range(n_players), key=lambda p: env.players[p].net_worth())

    return {
        "winner": winner,
        "steps": steps,
        "round": env.round + 1,
        "model_bankrupt": env.players[trained_pid].bankrupt,
    }


def evaluate(args):
    trained_pid, trained_agent, agents_map, pnames = build_agents(args.algo, args.model, args.players)

    wins = 0
    results = []

    for game_idx in range(args.games):
        game_seed = args.seed + game_idx if args.seed is not None else None
        result = play_one_game(
            algo=args.algo,
            trained_pid=trained_pid,
            trained_agent=trained_agent,
            agents_map=agents_map,
            pnames=pnames,
            n_players=args.players,
            max_rounds=args.max_rounds,
            step_limit=args.step_limit,
            game_seed=game_seed,
        )

        won = result["winner"] == trained_pid
        wins += int(won)
        results.append(result)

        if args.progress_every > 0 and (game_idx + 1) % args.progress_every == 0:
            print(f"Game {game_idx + 1}/{args.games} | cumulative win rate: {wins / (game_idx + 1) * 100:.2f}%")

    win_rate = wins / args.games * 100.0
    avg_rounds = mean(r["round"] for r in results)
    avg_steps = mean(r["steps"] for r in results)
    bankrupt_count = sum(1 for r in results if r["model_bankrupt"])

    print("\n" + "=" * 64)
    print("MODEL EVALUATION SUMMARY")
    print("=" * 64)
    print(f"Model path         : {args.model}")
    print(f"Algorithm          : {args.algo.upper()} (hybrid=True)")
    print(f"Players            : {args.players}")
    print(f"Games              : {args.games}")
    print(f"Wins               : {wins}")
    print(f"Win rate           : {win_rate:.2f}%")
    print(f"Average rounds     : {avg_rounds:.2f}")
    print(f"Average steps      : {avg_steps:.2f}")
    print(f"Model bankruptcies : {bankrupt_count}/{args.games}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Monopoly model by repeated full games")
    parser.add_argument("--model", type=str, required=True, help="Path to model weights")
    parser.add_argument("--algo", choices=["ppo", "ddqn"], default="ppo")
    parser.add_argument("--players", type=int, default=3, help="Number of active players (2-4)")
    parser.add_argument("--games", type=int, default=100, help="Number of games to simulate")
    parser.add_argument("--seed", type=int, default=42, help="Base seed (per-game seed = seed + idx)")
    parser.add_argument("--max-rounds", type=int, default=200, help="Environment max rounds per game")
    parser.add_argument("--step-limit", type=int, default=10000, help="Hard safety cap on actions per game")
    parser.add_argument("--progress-every", type=int, default=10, help="Print progress every N games (0 disables)")
    args = parser.parse_args()

    if not 2 <= args.players <= 4:
        raise ValueError("--players must be between 2 and 4")

    evaluate(args)
