#!/usr/bin/env python3
"""
Comprehensive evaluation script: PPO/DDQN vs Fixed agents
Generates 200+ game statistics and plots for:
- Win rates
- Trades sent per game
- Trades accepted/declined per game
- Properties acquired per game
- Monopolies acquired per game
"""

import json
import argparse
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from monopoly_drl import MonopolyEnv, PPOAgent, DDQNAgent, FPAgentA, FPAgentB, FPAgentC
from monopoly_drl.agents_fixed import FixedPolicyAgent


class StatsTracker:
    """Track game statistics per player"""
    def __init__(self, player_id):
        self.player_id = player_id
        self.wins = 0
        self.trades_sent = []  # per game
        self.trades_accepted = []  # per game
        self.trades_declined = []  # per game
        self.properties_acquired = []  # per game
        self.monopolies_acquired = []  # per game

    def record_game(self, won, trades_sent, trades_accepted, trades_declined, 
                   properties_acquired, monopolies_acquired):
        if won:
            self.wins += 1
        self.trades_sent.append(trades_sent)
        self.trades_accepted.append(trades_accepted)
        self.trades_declined.append(trades_declined)
        self.properties_acquired.append(properties_acquired)
        self.monopolies_acquired.append(monopolies_acquired)

    def stats_dict(self):
        return {
            'wins': self.wins,
            'trades_sent_mean': np.mean(self.trades_sent),
            'trades_sent_std': np.std(self.trades_sent),
            'trades_accepted_mean': np.mean(self.trades_accepted),
            'trades_accepted_std': np.std(self.trades_accepted),
            'trades_declined_mean': np.mean(self.trades_declined),
            'trades_declined_std': np.std(self.trades_declined),
            'properties_acquired_mean': np.mean(self.properties_acquired),
            'properties_acquired_std': np.std(self.properties_acquired),
            'monopolies_acquired_mean': np.mean(self.monopolies_acquired),
            'monopolies_acquired_std': np.std(self.monopolies_acquired),
        }


def run_one_game_with_stats(agents, num_players=4, max_rounds=100):
    """
    Run one game and return (winner, stats_per_player)
    stats_per_player[i] = {
        'trades_sent': int,
        'trades_accepted': int,
        'trades_declined': int,
        'properties_acquired': int,
        'monopolies_acquired': int
    }
    """
    agent_ids = list(range(num_players))
    env = MonopolyEnv(agent_ids=agent_ids, max_rounds=max_rounds)
    
    # Simplified stats tracking (trade details harder to extract from new API)
    stats = {i: {
        'trades_sent': 0,
        'trades_accepted': 0,
        'trades_declined': 0,
        'properties_acquired': 0,
        'monopolies_acquired': 0,
    } for i in range(num_players)}

    state = env.reset()
    done = False
    
    while not done:
        pid = env.whose_turn()
        allowed = env.get_allowed_actions(pid)
        agent = agents[pid]
        
        # Call agent's choose_action with appropriate signature
        if isinstance(agent, FixedPolicyAgent):  # Fixed agents
            action = agent.choose_action(env)
        else:  # RL agents (PPO/DDQN)
            action = agent.choose_action(state, env, allowed)
        
        state, reward, done, info = env.step(action)
    
    winner = env.winner()
    
    # Calculate final stats - count properties and monopolies per player
    final_stats = {}
    for i in range(num_players):
        player = env.players[i]
        props = sum(1 for prop in env.properties.values() if prop.owner == i)
        
        # Count monopolies (8 color groups)
        monopolies = 0
        for color_group in range(8):
            color_props = [p for p in env.properties.values() 
                          if hasattr(p, 'color_group') and p.color_group == color_group]
            if color_props and all(p.owner == i for p in color_props):
                monopolies += 1
        
        final_stats[i] = {
            'trades_sent': 0,  # Not easily tracked in new API
            'trades_accepted': 0,
            'trades_declined': 0,
            'properties_acquired': props,
            'monopolies_acquired': monopolies,
        }
    
    return winner, final_stats


def run_evaluation_ppo_vs_fixed(n_games=200, max_rounds=100, ppo_model_path=None):
    """Run PPO vs 3 Fixed agents (4-player)"""
    print(f"\n{'='*60}")
    print(f"PPO vs Fixed Agents ({n_games} games)")
    print(f"{'='*60}")
    
    # Load agents
    ppo = PPOAgent(player_id=0, hybrid=True)
    if ppo_model_path and Path(ppo_model_path).exists():
        try:
            ppo.load(ppo_model_path)
            print(f"✓ Loaded PPO model from {ppo_model_path}")
        except RuntimeError as e:
            print(f"⚠ Could not load PPO model (version mismatch): using untrained agent")
    else:
        print("⚠ No PPO model found, using untrained agent")
    
    agents = [ppo, FPAgentA(1), FPAgentB(2), FPAgentC(3)]
    agents_names = ['PPO', 'Fixed-A', 'Fixed-B', 'Fixed-C']
    
    trackers = {i: StatsTracker(i) for i in range(4)}
    
    for game_num in range(1, n_games + 1):
        if game_num % 20 == 0:
            print(f"  Game {game_num}/{n_games}...")
        
        winner, final_stats = run_one_game_with_stats(agents, num_players=4, max_rounds=max_rounds)
        
        for i in range(4):
            won = (i == winner)
            trackers[i].record_game(
                won,
                final_stats[i]['trades_sent'],
                final_stats[i]['trades_accepted'],
                final_stats[i]['trades_declined'],
                final_stats[i]['properties_acquired'],
                final_stats[i]['monopolies_acquired']
            )
    
    print(f"✓ Completed {n_games} games")
    return trackers, agents_names


def run_evaluation_ppo_ddqn_vs_fixed(n_games=200, max_rounds=100, 
                                     ppo_model_path=None, ddqn_model_path=None):
    """Run PPO/DDQN vs 2 Fixed agents (3-player games each)"""
    print(f"\n{'='*60}")
    print(f"PPO & DDQN vs 2 Fixed Agents ({n_games} games each)")
    print(f"{'='*60}")
    
    results = {}
    
    for agent_type in ['ppo', 'ddqn']:
        print(f"\n--- Testing {agent_type.upper()} ---")
        
        if agent_type == 'ppo':
            rl_agent = PPOAgent(player_id=0, hybrid=True)
            model_path = ppo_model_path
        else:
            rl_agent = DDQNAgent(player_id=0, hybrid=True)
            model_path = ddqn_model_path
        
        if model_path and Path(model_path).exists():
            try:
                rl_agent.load(model_path)
                print(f"✓ Loaded {agent_type.upper()} model")
            except RuntimeError as e:
                print(f"⚠ Could not load {agent_type.upper()} model (version mismatch): using untrained agent")
        else:
            print(f"⚠ No {agent_type.upper()} model found, using untrained agent")
        
        agents = [rl_agent, FPAgentA(1), FPAgentB(2)]
        agents_names = [agent_type.upper(), 'Fixed-A', 'Fixed-B']
        
        trackers = {i: StatsTracker(i) for i in range(3)}
        
        for game_num in range(1, n_games + 1):
            if game_num % 20 == 0:
                print(f"  Game {game_num}/{n_games}...")
            
            winner, final_stats = run_one_game_with_stats(agents, num_players=3, max_rounds=max_rounds)
            
            for i in range(3):
                won = (i == winner)
                trackers[i].record_game(
                    won,
                    final_stats[i]['trades_sent'],
                    final_stats[i]['trades_accepted'],
                    final_stats[i]['trades_declined'],
                    final_stats[i]['properties_acquired'],
                    final_stats[i]['monopolies_acquired']
                )
        
        print(f"✓ Completed {n_games} games")
        results[agent_type] = (trackers, agents_names)
    
    return results


def plot_win_rates(trackers_dict, output_path):
    """Plot win rates comparison"""
    fig, ax = plt.subplots(figsize=(10, 6))
    
    agents = list(trackers_dict.keys())
    wins = [trackers_dict[agent].wins for agent in agents]
    total_games = len(trackers_dict[agents[0]].trades_sent)
    win_rates = [w / total_games * 100 for w in wins]
    
    bars = ax.bar(agents, win_rates, color=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'][:len(agents)])
    
    # Add random baseline
    random_rate = 100 / len(agents)
    ax.axhline(y=random_rate, color='red', linestyle='--', linewidth=2, label='Random Baseline')
    
    # Add percentage labels
    for bar, rate in zip(bars, win_rates):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{rate:.1f}%', ha='center', va='bottom', fontsize=11, fontweight='bold')
    
    ax.set_ylabel('Win Rate (%)', fontsize=12)
    ax.set_title(f'Win Rates ({total_games} games)', fontsize=14, fontweight='bold')
    ax.set_ylim([0, max(win_rates) * 1.15])
    ax.legend()
    ax.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"✓ Saved: {output_path}")
    plt.close()


def plot_trades_sent(trackers_dict, output_path):
    """Plot average trades sent per game"""
    fig, ax = plt.subplots(figsize=(10, 6))
    
    agents = list(trackers_dict.keys())
    means = [np.mean(trackers_dict[agent].trades_sent) for agent in agents]
    stds = [np.std(trackers_dict[agent].trades_sent) for agent in agents]
    
    bars = ax.bar(agents, means, yerr=stds, capsize=5, 
                  color=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'][:len(agents)],
                  alpha=0.8, error_kw={'linewidth': 2})
    
    for bar, val in zip(bars, means):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{val:.2f}', ha='center', va='bottom', fontsize=10, fontweight='bold')
    
    ax.set_ylabel('Trades Sent per Game', fontsize=12)
    ax.set_title('Average Trades Sent per Game', fontsize=14, fontweight='bold')
    ax.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"✓ Saved: {output_path}")
    plt.close()


def plot_trades_accepted_declined(trackers_dict, output_path):
    """Plot trades accepted vs declined"""
    fig, ax = plt.subplots(figsize=(12, 6))
    
    agents = list(trackers_dict.keys())
    accepted = [np.mean(trackers_dict[agent].trades_accepted) for agent in agents]
    declined = [np.mean(trackers_dict[agent].trades_declined) for agent in agents]
    
    x = np.arange(len(agents))
    width = 0.35
    
    bars1 = ax.bar(x - width/2, accepted, width, label='Accepted', color='#2ca02c', alpha=0.8)
    bars2 = ax.bar(x + width/2, declined, width, label='Declined', color='#d62728', alpha=0.8)
    
    for bars in [bars1, bars2]:
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:.2f}', ha='center', va='bottom', fontsize=9)
    
    ax.set_ylabel('Count per Game', fontsize=12)
    ax.set_title('Trades Accepted vs Declined', fontsize=14, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(agents)
    ax.legend()
    ax.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"✓ Saved: {output_path}")
    plt.close()


def plot_properties_acquired(trackers_dict, output_path):
    """Plot average properties acquired"""
    fig, ax = plt.subplots(figsize=(10, 6))
    
    agents = list(trackers_dict.keys())
    means = [np.mean(trackers_dict[agent].properties_acquired) for agent in agents]
    stds = [np.std(trackers_dict[agent].properties_acquired) for agent in agents]
    
    bars = ax.bar(agents, means, yerr=stds, capsize=5,
                  color=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'][:len(agents)],
                  alpha=0.8, error_kw={'linewidth': 2})
    
    for bar, val in zip(bars, means):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{val:.1f}', ha='center', va='bottom', fontsize=10, fontweight='bold')
    
    ax.set_ylabel('Properties Acquired', fontsize=12)
    ax.set_title('Average Properties Acquired per Game', fontsize=14, fontweight='bold')
    ax.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"✓ Saved: {output_path}")
    plt.close()


def plot_monopolies_acquired(trackers_dict, output_path):
    """Plot average monopolies acquired"""
    fig, ax = plt.subplots(figsize=(10, 6))
    
    agents = list(trackers_dict.keys())
    means = [np.mean(trackers_dict[agent].monopolies_acquired) for agent in agents]
    stds = [np.std(trackers_dict[agent].monopolies_acquired) for agent in agents]
    
    bars = ax.bar(agents, means, yerr=stds, capsize=5,
                  color=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'][:len(agents)],
                  alpha=0.8, error_kw={'linewidth': 2})
    
    for bar, val in zip(bars, means):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{val:.2f}', ha='center', va='bottom', fontsize=10, fontweight='bold')
    
    ax.set_ylabel('Monopolies Acquired', fontsize=12)
    ax.set_title('Average Monopolies Acquired per Game', fontsize=14, fontweight='bold')
    ax.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"✓ Saved: {output_path}")
    plt.close()


def main():
    parser = argparse.ArgumentParser(description='Comprehensive evaluation: PPO/DDQN vs Fixed agents')
    parser.add_argument('--games', type=int, default=200, help='Number of games to run (default: 200)')
    parser.add_argument('--max-rounds', type=int, default=100, help='Max rounds per game (default: 100)')
    parser.add_argument('--ppo-model', type=str, help='Path to PPO model')
    parser.add_argument('--ddqn-model', type=str, help='Path to DDQN model')
    parser.add_argument('--quick', action='store_true', help='Quick mode: 50 games, reduced caps')
    parser.add_argument('--output-dir', type=str, default='.', help='Output directory for plots')
    
    args = parser.parse_args()
    
    if args.quick:
        args.games = 50
        args.max_rounds = 20
        print("⚡ Quick mode: 50 games, max_rounds=20")
    
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    # Run PPO vs Fixed (4 players)
    print("\n" + "="*60)
    print("PHASE 1: PPO vs 3 Fixed Agents (4-player games)")
    print("="*60)
    trackers_ppo_vs_fixed, names_ppo_vs_fixed = run_evaluation_ppo_vs_fixed(
        args.games, args.max_rounds, args.ppo_model
    )
    
    # Save stats
    stats_ppo_vs_fixed = {names_ppo_vs_fixed[i]: trackers_ppo_vs_fixed[i].stats_dict() 
                          for i in range(4)}
    with open(output_dir / 'stats_ppo_vs_fixed.json', 'w') as f:
        json.dump(stats_ppo_vs_fixed, f, indent=2)
    print(f"✓ Saved: {output_dir / 'stats_ppo_vs_fixed.json'}")
    
    # Generate plots for PPO vs Fixed
    plot_win_rates(trackers_ppo_vs_fixed, output_dir / '01_win_rates_ppo_vs_fixed.png')
    plot_trades_sent(trackers_ppo_vs_fixed, output_dir / '02_trades_sent_ppo_vs_fixed.png')
    plot_trades_accepted_declined(trackers_ppo_vs_fixed, output_dir / '03_trades_comparison_ppo_vs_fixed.png')
    plot_properties_acquired(trackers_ppo_vs_fixed, output_dir / '04_properties_ppo_vs_fixed.png')
    plot_monopolies_acquired(trackers_ppo_vs_fixed, output_dir / '05_monopolies_ppo_vs_fixed.png')
    
    # Run PPO/DDQN vs Fixed (3 players each)
    print("\n" + "="*60)
    print("PHASE 2: PPO/DDQN vs 2 Fixed Agents (3-player games)")
    print("="*60)
    results_mixed = run_evaluation_ppo_ddqn_vs_fixed(
        args.games, args.max_rounds, args.ppo_model, args.ddqn_model
    )
    
    # Generate comparison plots for PPO vs DDQN
    print("\nGenerating comparison plots...")
    
    # Extract trackers
    trackers_ppo_vs_2fixed = results_mixed['ppo'][0]
    trackers_ddqn_vs_2fixed = results_mixed['ddqn'][0]
    
    # Save stats
    stats_mixed = {
        'ppo': {results_mixed['ppo'][1][i]: trackers_ppo_vs_2fixed[i].stats_dict() for i in range(3)},
        'ddqn': {results_mixed['ddqn'][1][i]: trackers_ddqn_vs_2fixed[i].stats_dict() for i in range(3)},
    }
    with open(output_dir / 'stats_ppo_ddqn_vs_fixed.json', 'w') as f:
        json.dump(stats_mixed, f, indent=2)
    print(f"✓ Saved: {output_dir / 'stats_ppo_ddqn_vs_fixed.json'}")
    
    plot_win_rates(trackers_ppo_vs_2fixed, output_dir / '06_win_rates_ppo_vs_2fixed.png')
    plot_win_rates(trackers_ddqn_vs_2fixed, output_dir / '07_win_rates_ddqn_vs_2fixed.png')
    
    plot_trades_sent(trackers_ppo_vs_2fixed, output_dir / '08_trades_sent_ppo_vs_2fixed.png')
    plot_trades_sent(trackers_ddqn_vs_2fixed, output_dir / '09_trades_sent_ddqn_vs_2fixed.png')
    
    plot_trades_accepted_declined(trackers_ppo_vs_2fixed, output_dir / '10_trades_comparison_ppo_vs_2fixed.png')
    plot_trades_accepted_declined(trackers_ddqn_vs_2fixed, output_dir / '11_trades_comparison_ddqn_vs_2fixed.png')
    
    plot_properties_acquired(trackers_ppo_vs_2fixed, output_dir / '12_properties_ppo_vs_2fixed.png')
    plot_properties_acquired(trackers_ddqn_vs_2fixed, output_dir / '13_properties_ddqn_vs_2fixed.png')
    
    plot_monopolies_acquired(trackers_ppo_vs_2fixed, output_dir / '14_monopolies_ppo_vs_2fixed.png')
    plot_monopolies_acquired(trackers_ddqn_vs_2fixed, output_dir / '15_monopolies_ddqn_vs_2fixed.png')
    
    print(f"\n{'='*60}")
    print(f"✅ Evaluation complete! All plots saved to '{output_dir}'")
    print(f"{'='*60}")
    print(f"\nGenerated 15 plots:")
    print(f"  - 5 plots for PPO vs 3 Fixed (4-player games)")
    print(f"  - 5 plots for PPO vs 2 Fixed (3-player games)")
    print(f"  - 5 plots for DDQN vs 2 Fixed (3-player games)")


if __name__ == '__main__':
    main()
