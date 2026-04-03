"""
Run paper-aligned Monopoly DRL experiments.

Covers Step 9 protocol:
- PPO: train 2000 games, test c in {0,1,10,20,50,100}, compare hybrid vs standard
- DDQN: train 10000 games, test c in {0,1,10,20,50,100}, compare hybrid vs standard

Outputs a JSON report with:
- Final/best training win-rates for each condition
- Best c for each algorithm/mode
- Trend checks (hybrid > standard, faster convergence)

Usage examples:
  python run_paper_experiments.py --algo ppo --games 2000
  python run_paper_experiments.py --algo ddqn --games 10000
  python run_paper_experiments.py --algo both --ppo-games 2000 --ddqn-games 10000
  python run_paper_experiments.py --quick
"""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Tuple

from monopoly_drl import train_ppo, train_ddqn


DEFAULT_C_VALUES = [0, 1, 10, 20, 50, 100]


@dataclass
class ExperimentResult:
    algo: str
    hybrid: bool
    c_value: float
    games: int
    final_win_rate: float
    best_win_rate: float
    first_hit_50: int | None
    elapsed_sec: float


def _first_game_reaching_threshold(history: Dict, threshold: float = 50.0) -> int | None:
    games = history.get("games", [])
    win_rates = history.get("win_rates", [])
    for game_num, wr in zip(games, win_rates):
        if wr >= threshold:
            return int(game_num)
    return None


def _extract_metrics(history: Dict) -> Tuple[float, float, int | None]:
    win_rates = history.get("win_rates", [])
    if not win_rates:
        return 0.0, 0.0, None
    final_wr = float(win_rates[-1])
    best_wr = float(max(win_rates))
    first50 = _first_game_reaching_threshold(history, threshold=50.0)
    return final_wr, best_wr, first50


def _run_one(
    algo: str,
    hybrid: bool,
    c_value: float,
    games: int,
    log_every: int,
    max_rounds: int,
    max_steps_factor: int,
) -> ExperimentResult:
    t0 = time.time()
    if algo == "ppo":
        _, history = train_ppo(
            hybrid=hybrid,
            player_id=0,
            n_games=games,
            log_every=log_every,
            max_rounds=max_rounds,
            max_steps_factor=max_steps_factor,
            win_loss_bonus=float(c_value),
        )
    else:
        _, history = train_ddqn(
            hybrid=hybrid,
            player_id=0,
            n_games=games,
            log_every=log_every,
            max_rounds=max_rounds,
            max_steps_factor=max_steps_factor,
            win_loss_bonus=float(c_value),
        )

    elapsed = time.time() - t0
    final_wr, best_wr, first50 = _extract_metrics(history)
    return ExperimentResult(
        algo=algo,
        hybrid=hybrid,
        c_value=float(c_value),
        games=int(games),
        final_win_rate=final_wr,
        best_win_rate=best_wr,
        first_hit_50=first50,
        elapsed_sec=float(elapsed),
    )


def _summarize(results: List[ExperimentResult]) -> Dict:
    by_key: Dict[str, List[ExperimentResult]] = {}
    for r in results:
        key = f"{r.algo}_{'hybrid' if r.hybrid else 'standard'}"
        by_key.setdefault(key, []).append(r)

    summary = {"groups": {}, "trend_checks": {}}

    for key, rows in by_key.items():
        rows_sorted = sorted(rows, key=lambda x: x.c_value)
        best = max(rows_sorted, key=lambda x: x.final_win_rate)
        summary["groups"][key] = {
            "best_c": best.c_value,
            "best_final_win_rate": best.final_win_rate,
            "best_peak_win_rate": best.best_win_rate,
            "rows": [asdict(r) for r in rows_sorted],
        }

    # Trend checks among best-c configurations
    for algo in ["ppo", "ddqn"]:
        h_key = f"{algo}_hybrid"
        s_key = f"{algo}_standard"
        if h_key in summary["groups"] and s_key in summary["groups"]:
            h = summary["groups"][h_key]
            s = summary["groups"][s_key]
            summary["trend_checks"][algo] = {
                "hybrid_beats_standard_final": h["best_final_win_rate"] > s["best_final_win_rate"],
                "hybrid_beats_standard_peak": h["best_peak_win_rate"] > s["best_peak_win_rate"],
                "hybrid_best_c": h["best_c"],
                "standard_best_c": s["best_c"],
                "hybrid_final": h["best_final_win_rate"],
                "standard_final": s["best_final_win_rate"],
            }

    return summary


def _run_algo(
    algo: str,
    games: int,
    c_values: List[float],
    log_every: int,
    max_rounds: int,
    max_steps_factor: int,
) -> List[ExperimentResult]:
    out: List[ExperimentResult] = []
    for hybrid in [False, True]:
        for c in c_values:
            print(
                f"\n[RUN] algo={algo.upper()} mode={'hybrid' if hybrid else 'standard'} "
                f"c={c} games={games}"
            )
            result = _run_one(
                algo,
                hybrid,
                c,
                games,
                log_every,
                max_rounds,
                max_steps_factor,
            )
            print(
                f"  -> final={result.final_win_rate:.2f}% "
                f"peak={result.best_win_rate:.2f}% first50={result.first_hit_50} "
                f"time={result.elapsed_sec:.1f}s"
            )
            out.append(result)
    return out


def main():
    parser = argparse.ArgumentParser(description="Run paper-aligned Monopoly DRL experiments")
    parser.add_argument("--algo", choices=["ppo", "ddqn", "both"], default="both")
    parser.add_argument("--games", type=int, default=None,
                        help="If set, overrides both PPO and DDQN game counts")
    parser.add_argument("--ppo-games", type=int, default=2000)
    parser.add_argument("--ddqn-games", type=int, default=10000)
    parser.add_argument("--c-values", type=float, nargs="*", default=DEFAULT_C_VALUES)
    parser.add_argument("--log-every", type=int, default=100)
    parser.add_argument("--max-rounds", type=int, default=300,
                        help="Environment round cap per game (default: 300)")
    parser.add_argument("--max-steps-factor", type=int, default=30,
                        help="Max step budget multiplier per round (default: 30)")
    parser.add_argument("--quick", action="store_true",
                        help="Quick sanity mode: 200 PPO games, 1000 DDQN games, c={0,10}")
    parser.add_argument("--out", type=str, default="paper_experiment_report.json")
    args = parser.parse_args()

    if args.quick:
        args.ppo_games = 5
        args.ddqn_games = 20
        args.c_values = [0, 10]
        args.max_rounds = 30
        args.max_steps_factor = 8

    if args.games is not None:
        args.ppo_games = args.games
        args.ddqn_games = args.games

    results: List[ExperimentResult] = []

    if args.algo in ("ppo", "both"):
        results.extend(
            _run_algo(
                "ppo",
                args.ppo_games,
                args.c_values,
                args.log_every,
                args.max_rounds,
                args.max_steps_factor,
            )
        )

    if args.algo in ("ddqn", "both"):
        results.extend(
            _run_algo(
                "ddqn",
                args.ddqn_games,
                args.c_values,
                args.log_every,
                args.max_rounds,
                args.max_steps_factor,
            )
        )

    summary = _summarize(results)
    report = {
        "meta": {
            "algo": args.algo,
            "ppo_games": args.ppo_games,
            "ddqn_games": args.ddqn_games,
            "c_values": args.c_values,
            "log_every": args.log_every,
            "max_rounds": args.max_rounds,
            "max_steps_factor": args.max_steps_factor,
            "quick": args.quick,
        },
        "summary": summary,
        "raw_results": [asdict(r) for r in results],
    }

    out_path = Path(args.out)
    out_path.write_text(json.dumps(report, indent=2))
    print(f"\nSaved report: {out_path}")


if __name__ == "__main__":
    main()
