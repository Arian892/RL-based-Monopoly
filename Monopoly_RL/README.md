# Monopoly Hybrid DRL

Implementation of **"Decision Making in Monopoly Using a Hybrid Deep Reinforcement Learning Approach"** (Bonjour et al., IEEE TETCI 2022).

---

## What's implemented

| Paper component | File |
|---|---|
| 240-dim state space (§IV-A) | `monopoly_drl/state.py` |
| 2922-dim action space (§IV-B) | `monopoly_drl/actions.py` |
| Dense + sparse reward (§IV-C, eq. 2-4) | `monopoly_drl/env.py` |
| Full 4-player simulator with 3 phases (§VI-A) | `monopoly_drl/env.py` |
| Fixed-policy agents FP-A, FP-B, FP-C (§VI-B) | `monopoly_drl/agents_fixed.py` |
| PPO actor-critic agent (§V-A-1) | `monopoly_drl/agent_ppo.py` |
| DDQN agent with dueling arch (§V-A-2) | `monopoly_drl/agent_ddqn.py` |
| Hybrid fixed + DRL decisions (§V-B, eq. 5) | `monopoly_drl/agent_ppo.py`, `agent_ddqn.py` |
| Training loop & evaluation (§VII) | `monopoly_drl/train.py` |

---

## Installation

```bash
pip install -r requirements.txt
```

---

## Quick Start

```python
from monopoly_drl import train_ppo, train_ddqn, evaluate_agent

# Train hybrid PPO agent (paper's best result: 91% win rate after 2000 games)
agent, history = train_ppo(hybrid=True, n_games=2000)

# Evaluate
results = evaluate_agent(agent, is_ppo=True, n_games=2000, n_runs=5)
print(f"Win rate: {results['mean']:.1f}%")
```

---

## Experiments

Run the example script to reproduce paper experiments:

```bash
# Environment sanity check only (instant)
python example.py --mode env

# PPO experiment: standard vs hybrid (quick: 200 games ~1-2 min)
python example.py --mode ppo --games 200

# DDQN experiment
python example.py --mode ddqn --games 2000

# Both PPO and DDQN
python example.py --mode both --games 2000
```

Full replication (paper settings):
- PPO: `--games 2000`
- DDQN: `--games 10000`

---

## Architecture

### State Space (240 dims)
- **16 dims** — 4 players × [position/39, cash/5000, in_jail, has_gooj_card]
- **224 dims** — 28 properties × [owner_onehot(5), mortgaged, is_monopoly, improvement_fraction]

### Action Space (2922 dims)
| Category | Size |
|---|---|
| Binary actions (roll, buy, end turn…) | 9 |
| Mortgage / Unmortgage | 56 |
| Build / Sell houses & hotels | 88 |
| Sell property to bank | 28 |
| Buy/Sell trade offers | 504 |
| Exchange trade offers | 2268 |

### Hybrid approach
The two rarest actions use **hand-coded rules** instead of the neural net:

- **BUY_PROPERTY** → buy if it creates a monopoly, or if cash ≥ price + $200
- **ACCEPT_TRADE** → accept if it creates a monopoly, or net worth of offer > 0 (eq. 5)

All other actions are handled by the PPO / DDQN network.

### Reward (eq. 4)
```
r_x = nw_x / sum(nw_y for y ≠ x active players)
```
Plus a sparse win/loss bonus `c` at game end (c=0 for PPO, c=10 for DDQN).

---

## Results (paper)

| Agent | Win rate vs fixed-policy |
|---|---|
| Standard PPO | 69.95% |
| **Hybrid PPO** | **91.65%** |
| Standard DDQN | 47.41% |
| Hybrid DDQN | 76.91% |

---

## File structure

```
monopoly_drl/
├── monopoly_drl/
│   ├── __init__.py       # Public API
│   ├── constants.py      # Board, prices, color groups
│   ├── state.py          # Player/Property classes + state vector
│   ├── actions.py        # Action space indexing (2922 dims)
│   ├── env.py            # Full game simulator
│   ├── agents_fixed.py   # FP-A, FP-B, FP-C baselines
│   ├── networks.py       # Actor, Critic, DDQN neural networks
│   ├── agent_ppo.py      # PPO agent (standard + hybrid)
│   ├── agent_ddqn.py     # DDQN agent (standard + hybrid)
│   └── train.py          # Training & evaluation loops
├── example.py            # Experiment runner
├── requirements.txt
└── README.md
```
