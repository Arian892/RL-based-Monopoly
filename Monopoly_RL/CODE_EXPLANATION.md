# Monopoly Hybrid DRL — Complete Code Explanation

Based on: *"Decision Making in Monopoly Using a Hybrid Deep Reinforcement Learning Approach"*
Bonjour et al., IEEE TETCI, Vol. 6, No. 6, December 2022.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [state.py](#2-statepy)
3. [actions.py](#3-actionspy)
4. [env.py](#4-envpy)
5. [networks.py](#5-networkspy)
6. [agent_ppo.py](#6-agent_ppopy)
7. [agent_ddqn.py](#7-agent_ddqnpy)
8. [agents_fixed.py](#8-agents_fixedpy)
9. [train.py](#9-trainpy)
10. [How Everything Connects](#10-how-everything-connects)

---

## 1. Project Structure

```
monopoly_drl/
├── constants.py      # Board layout, property prices, rent tables
├── state.py          # Player/Property classes + 240-dim state vector
├── actions.py        # 2953-dim action space definition
├── env.py            # Full game simulator and rules engine
├── networks.py       # Neural network architectures
├── agent_ppo.py      # PPO agent + hybrid fixed rules
├── agent_ddqn.py     # DDQN agent + replay buffer
├── agents_fixed.py   # FP-A, FP-B, FP-C baseline opponents
└── train.py          # Training and evaluation loops

train_and_save.py     # CLI script: train a model and save weights
play_game.py          # CLI script: simulate a game and log it
```

The flow when training is:
```
train.py → runs episodes in env.py → agents choose actions from actions.py
         → state observed via state.py → networks learn via agent_ppo/ddqn
```

---

## 2. `state.py`

This file defines two data classes (`Player` and `Property`) that hold all live game state, and one function (`build_state_vector`) that converts that state into a number array the neural networks can read.

---

### `Property` class

Represents one purchasable square on the board. Created once at game start and mutated as the game progresses.

```python
self.square_id  # which board square this is (e.g. 1 = Mediterranean Ave)
self.price      # purchase price
self.mortgage_v # mortgage value (always half the purchase price)
self.color      # "brown", "red", "railroad", "utility", etc.
self.owner      # None = bank owns it, 0/1/2/3 = player index
self.mortgaged  # True if mortgaged, generates no rent
self.houses     # 0 = no houses, 1-4 = houses, 5 = hotel (sentinel value)
self.is_monopoly # True if owner holds the full colour group
```

**`calculate_net_worth()`** — equation 3 from the paper. Calculates how much this property contributes to its owner's total wealth:

```
net_worth = (price - mortgage_value) × bonus + house_value
```

Where `bonus` is 2.0 for monopoly properties and 1.5 for non-monopoly. The mortgage value is only subtracted if the property is currently mortgaged. House value adds the house price for each house built, or all four house prices plus the hotel price for a hotel. This formula reflects that a monopoly property is worth more than a standalone one because it generates higher rent.

**`get_rent()`** — calculates rent owed when a player lands here. The logic differs by property type:

- **Real estate, no houses** — base rent from the rent table. Doubled if owner has a monopoly.
- **Real estate with houses** — uses the corresponding index in the rent table (1 house = index 1, hotel = index 5).
- **Railroad** — depends on how many railroads the owner holds total: 1=$25, 2=$50, 3=$100, 4=$200.
- **Utility** — a multiplier of the dice roll. One utility = 4×, two utilities = 10×.
- **Mortgaged** — always returns 0, no rent collected.

---

### `Player` class

Represents one player. Also created once at game start and mutated throughout.

```python
self.cash       # current cash, starts at $1500
self.position   # current board square (0-39)
self.in_jail    # whether currently in jail
self.jail_turns # how many turns spent in jail (max 3 before forced bail)
self.gooj_card  # True if holding a Get Out of Jail Free card
self.bankrupt   # True if eliminated
self.properties # list of Property objects currently owned
```

**`net_worth()`** — equation 2 from the paper. Total wealth = cash + sum of all owned property net worths. This is what determines the winner when the round limit is hit, and feeds into the reward function during training.

**Helper methods:**
- `num_monopolies()` — counts how many complete colour groups the player owns.
- `railroads_owned()` / `utilities_owned()` — counts for rent calculation.
- `can_afford(amount)` — simple cash check, used everywhere before deducting money.

---

### `build_state_vector()`

Converts all live game state into a flat 240-dimensional numpy array that the neural networks consume. This is called every step.

**Layout:**

```
[0:16]   — Player features (4 players × 4 features each)
[16:240] — Property features (28 properties × 8 features each)
```

**Player features (16 dims total):**
The agent's own player always comes first, then the other three in order. For each player:
```
position / 39.0      # normalised to [0, 1]
cash / 5000.0        # normalised, capped at 1.0
float(in_jail)       # 0.0 or 1.0
float(gooj_card)     # 0.0 or 1.0
```
Putting the agent first means the network always sees its own info at the same position regardless of which player id it is.

**Property features (224 dims total):**
For each of the 28 properties in board order:
```
owner_onehot[5]      # one-hot: all zeros = bank, index 0-3 = player who owns it
mortgaged            # 0.0 or 1.0
is_monopoly          # 0.0 or 1.0
houses / 5.0         # 0.0 = no houses, 1.0 = hotel (normalised)
```

The one-hot ownership encoding is important — a single integer like `owner=2` would imply a false ordinal relationship between players. One-hot treats each player as independent.

The assert at the end (`assert idx == 240`) catches any bug that would silently produce a wrong-sized vector, which would cause a cryptic crash deep in the network instead.

---

## 3. `actions.py`

This file defines and indexes every possible action in the game as a unique integer from 0 to 2952. Neural networks output one score per action, so every decision needs a number.

---

### Why a flat numbered list?

The network produces a vector of 2953 scores. At inference time, illegal actions are masked to `-inf` and the highest remaining score is chosen. This requires every possible action — including very rare ones like exchange trades — to have a fixed slot in that vector.

---

### `ActionType` enum (actions 0–8)

Simple decisions with no property attached:

```python
DO_NOTHING       = 0  # no-op, used as fallback
END_TURN         = 1  # commit to ending pre-roll or post-roll phase
ROLL_DICE        = 2  # roll and move
BUY_PROPERTY     = 3  # buy the property you just landed on
USE_GOOJ_CARD    = 4  # use Get Out of Jail Free card
PAY_BAIL         = 5  # pay $50 to leave jail
DECLARE_BANKRUPT = 6  # give up
ACCEPT_TRADE     = 7  # accept incoming trade offer
DECLINE_TRADE    = 8  # reject incoming trade offer
```

---

### `OFFSETS` dictionary

This is the spine of the whole file. It marks where each section of the action space starts:

```python
OFFSETS = {
    "binary":        0,    # 9 actions  (0-8)
    "mortgage":      9,    # 28 actions (9-36)
    "unmortgage":   37,    # 28 actions (37-64)
    "improve_house": 65,   # 22 actions (65-86)
    "improve_hotel": 87,   # 22 actions (87-108)
    "sell_house":   109,   # 22 actions (109-130)
    "sell_hotel":   131,   # 22 actions (131-152)
    "sell_prop":    153,   # 28 actions (153-180)
    "buy_trade":    181,   # 252 actions (181-432)
    "sell_trade":   433,   # 252 actions (433-684)
    "exch_trade":   685,   # 2268 actions (685-2952)
}
```

To encode any property action: `action = OFFSETS[section] + local_index`.
To decode: `local_index = action - OFFSETS[section]`.

Improve/sell sections have 22 slots (not 28) because only real estate properties can have houses — railroads and utilities are excluded.

---

### Property actions (9–180)

Each slot maps to one property by position in `PROPERTY_IDS` (the sorted list of all 28 buyable squares). For example, to mortgage Baltic Avenue (square 3, which is at index 1 in `PROPERTY_IDS`):
```
action = OFFSETS["mortgage"] + 1 = 10
```

---

### Trade actions (181–2952)

Each trade action encodes three things in one integer: which player, which property, and what price level.

**Buy/Sell trades (252 actions each):**

Formula:
```
action = OFFSETS[section] + (target_player_idx × 28 × 3) + (property_idx × 3) + price_idx
```

- `target_player_idx` — 0, 1, or 2 (the three other players in order)
- `property_idx` — 0–27 (position in PROPERTY_IDS)
- `price_idx` — 0 = 0.75× market, 1 = 1.0× market, 2 = 1.25× market

To decode, reverse with integer division and modulo.

**Exchange trades (2268 actions):**

Encodes two properties — one to offer and one to request:
```
action = OFFSETS["exch_trade"] + (target_idx × 28 × 27) + (offer_idx × 27) + req_idx
```

There are only 27 slots for the requested property because you can't request the same property you're offering. When decoding, if the raw remainder index >= the offer index, add 1 to skip over the "self" slot.

---

### `action_to_description()`

Reverse-lookup function. Given any integer 0–2952, determines which section it falls in, decodes the local index, and returns a human-readable string. Used in the game log.

---

## 4. `env.py`

The game engine. Holds all state, enforces all rules, and drives the turn structure. Everything else either reads from or writes to this.

---

### State it holds

```python
self.players           # list of 4 Player objects
self.properties        # dict: square_id → Property object
self.turn_order        # shuffled list e.g. [2, 0, 3, 1]
self.current_turn_idx  # index into turn_order for the active player
self.phase             # "pre_roll", "post_roll", or "out_of_turn"
self.has_rolled        # whether active player has rolled this turn
self.pending_trades    # dict: sender_pid → TradeOffer
self.out_of_turn_pids  # list of players still to act in out-of-turn
self.round             # full rounds elapsed
self.done              # game over flag
```

---

### Turn structure

Every turn follows this exact sequence — the phase field enforces it:

```
PRE_ROLL → POST_ROLL → OUT_OF_TURN → next player's PRE_ROLL
```

- **PRE_ROLL** — active player can build, mortgage, trade, escape jail, then calls END_TURN to proceed.
- **POST_ROLL** — active player must roll, then handles landing (buy or not), then calls END_TURN.
- **OUT_OF_TURN** — every other non-bankrupt player gets one action each (usually trade offers or END_TURN). Once all are done, `_next_player()` is called.

---

### `reset()`

Wipes everything and starts fresh. Creates new Player and Property objects, shuffles turn order, sets phase to PRE_ROLL. Returns the initial state vector for player 0.

---

### `whose_turn()`

The single most important method for external callers. Returns the `player_id` of whoever should act right now:
- During PRE_ROLL and POST_ROLL: `turn_order[current_turn_idx]`
- During OUT_OF_TURN: first player still in `out_of_turn_pids`

Both `train.py` and `play_game.py` call this every loop iteration to know who to ask for an action.

---

### `step(action_idx)`

Main entry point. Called with one action integer. Sequence:

1. Calls `whose_turn()` to identify the acting player.
2. Calls `_apply_action(pid, action_idx, info)` to execute it.
3. Calls `_compute_reward()` to produce the training signal.
4. Calls `_check_game_over()`.
5. Returns `(new_state_vector, reward, done, info)`.

---

### `get_allowed_actions(pid)`

Returns the list of valid action integers for a player right now. This is the gatekeeper — the neural net only ever sees and samples from this list, so invalid actions are never chosen.

Gating logic by phase:

| Phase | Who can act | What's allowed |
|---|---|---|
| PRE_ROLL | Active player | END_TURN, mortgage, build, trade, jail escape |
| POST_ROLL (before roll) | Active player | ROLL_DICE, jail escape |
| POST_ROLL (after roll) | Active player | BUY_PROPERTY (if applicable), mortgage, END_TURN |
| OUT_OF_TURN | Each other player in sequence | END_TURN, trade offers, trade responses |

---

### `_apply_action(pid, action_idx, info)`

The dispatch function. Checks which section of the action space the integer falls into using OFFSETS comparisons, then calls the appropriate handler:

- **0–8** → routes to `_handle_end_turn`, `_do_roll`, `_do_buy`, trade responses, jail actions, bankruptcy
- **9–36** → mortgage: sets `mortgaged=True`, adds `mortgage_v` to cash
- **37–64** → unmortgage: pays `mortgage_v × 1.1`, sets `mortgaged=False`
- **65–86** → improve house: checks monopoly and house count, deducts house price, increments `prop.houses`
- **87–108** → improve hotel: requires exactly 4 houses, sets `prop.houses = 5`
- **109–130 / 131–152** → sell house/hotel: reverses above, returns half price
- **153–180** → sell to bank: removes from player, returns to bank at mortgage value
- **181–432** → buy trade: decodes target/property/price, creates TradeOffer in `pending_trades`
- **433–684** → sell trade: same, reversed direction
- **685+** → exchange trade: decodes two properties, creates exchange TradeOffer

---

### `_handle_end_turn(pid)`

The phase state machine. Every time a player calls END_TURN:

```
PRE_ROLL  + active player  → switch to POST_ROLL, set has_rolled = False
POST_ROLL + active player  → switch to OUT_OF_TURN, populate out_of_turn_pids
OUT_OF_TURN + any player   → remove from out_of_turn_pids
                              if list empty → call _next_player()
```

---

### `_next_player()`

Advances `current_turn_idx` to the next non-bankrupt player in `turn_order`. Uses `len(turn_order)` as the modulus (not `NUM_PLAYERS`) so it works correctly with 2, 3, or 4 player games. If the index wraps back past 0, `self.round` increments. Then resets phase to PRE_ROLL and clears pending trades.

---

### `_do_roll(pid, info)`

Rolls two dice and moves the player. Jail handling first:
- Doubles → escape jail
- Third turn in jail → forced bail payment, then move
- Otherwise → stay in jail, turn ends

If not in jail, checks if the player passed Go (position wraps, adds $200), then calls `_handle_landing()`.

---

### `_handle_landing(pid, dice_total, info)`

Checks the square and applies consequences:
- Go To Jail square → teleport to square 10, set `in_jail = True`
- Income Tax → deduct $200
- Luxury Tax → deduct $100
- Unowned property → sets `can_buy = True` in info, BUY_PROPERTY becomes available
- Owned by another player → calculate rent, deduct from payer, add to owner. If payer hits $0, call `_do_bankrupt()`
- Chance / Community Chest / Free Parking / Go → nothing (cards handled in play_game.py for display only)

---

### `_do_bankrupt(pid)`

Eliminates a player:
- Sets `bankrupt = True`
- Zeroes cash
- Returns all properties to bank (clears owner, houses, mortgage)
- Calls `_update_monopolies()` since ownership changed

---

### `_do_accept_trade(pid)`

Finds the pending TradeOffer directed at `pid`, exchanges cash and properties simultaneously between sender and recipient, then calls `_update_monopolies()`.

---

### `_update_monopolies()`

Called any time ownership changes. Loops every colour group, checks if all properties share the same non-None owner. If yes, sets `is_monopoly = True` on all of them. This flag enables building and doubles base rent.

---

### `_compute_reward(pid)`

Equation 4 from the paper. Gives a continuous training signal throughout the game:

```
reward = net_worth(pid) / sum(net_worth of all other active players)
```

Returns a value between 0 and 1. Wealthier relative to opponents = higher reward. At game end, returns 1.0 for the winner and -1.0 for the loser (when only one player remains).

---

### `_check_game_over()`

Sets `self.done = True` if fewer than 2 non-bankrupt players remain, or if `self.round >= self.max_rounds`. The winner is determined by `winner()`, which returns the surviving player or the richest player by net worth if the round limit was hit.

---

## 5. `networks.py`

Three neural networks. All take the 240-dim state vector as input. None of them know about Monopoly rules — they just map numbers to numbers.

---

### `ActorNetwork` (PPO)

Maps state → action log-probabilities.

```
240 → Linear(256) → ReLU → Linear(256) → ReLU → Linear(128) → ReLU → Linear(2953)
```

The final 2953 logits have illegal actions set to `-inf` before `log_softmax`, ensuring those actions always get zero probability regardless of what the network learned. Output is log-probabilities for numerical stability in the PPO loss.

**`get_action(state, allowed_actions)`** — builds the mask, runs forward pass, samples from the distribution using `torch.multinomial`, returns both the chosen action and its log-probability. The log-probability is stored in the buffer for the PPO ratio calculation later.

---

### `CriticNetwork` (PPO)

Maps state → scalar value estimate V(s).

Same architecture as the actor but the final layer outputs a single number. This is the critic's estimate of "how good is this position overall for the agent." Used to compute the advantage: `advantage = actual_return - V(s)`.

Both actor and critic are trained together with a shared Adam optimizer.

---

### `DDQNNetwork` (DDQN)

Maps state → Q-value for every action. Uses a **dueling architecture**:

```
240 → Linear(256) → ReLU → Linear(256) → ReLU
                                         ├── Value stream:     Linear(128) → ReLU → Linear(1)
                                         └── Advantage stream: Linear(128) → ReLU → Linear(2953)
```

Combined as:
```
Q(s, a) = V(s) + A(s, a) - mean(A(s, *))
```

The intuition: V(s) captures how good this board state is overall, A(s, a) captures how much better or worse each specific action is. Subtracting the mean advantage prevents V and A from drifting arbitrarily (you could add any constant to V and subtract it from A and get identical Q-values, so the mean-subtraction pins them).

**`get_action(state, allowed_actions, epsilon)`** — ε-greedy selection. With probability ε picks a random allowed action (exploration). Otherwise masks illegal actions to `-inf` and picks the highest Q-value allowed action (exploitation).

---

## 6. `agent_ppo.py`

Implements the full PPO algorithm and the hybrid fixed-rule logic. This is the primary agent from the paper.

---

### `fixed_buy_decision()` and `fixed_accept_trade_decision()`

These two standalone functions are the entire "hybrid" component. Called before the neural network gets to act.

**`fixed_buy_decision(env, pid)`** — buy if:
1. Buying this property completes a colour group monopoly AND the player can afford it, OR
2. The player has at least $200 more than the property price

This replaces what would be a rarely-encountered state-action pair (buying is infrequent) that the network would struggle to learn correctly.

**`fixed_accept_trade_decision(env, pid)`** — accept if:
1. Accepting gives us a new monopoly (we gain the final property in a colour group), OR
2. Net worth of what we receive minus net worth of what we give is positive (equation 5 from the paper)

---

### `PPOBuffer`

Simple trajectory store. Lists of `(state, action, log_prob, reward, value, done)` tuples accumulated over one rollout. Cleared after every PPO update.

---

### `PPOAgent.__init__()`

Sets up both networks and the shared optimizer. Key hyperparameters:

| Parameter | Value | Meaning |
|---|---|---|
| `lr` | 3e-4 | Learning rate |
| `gamma` | 0.99 | Discount factor for future rewards |
| `lam` | 0.95 | GAE lambda — trades off bias vs variance in advantage |
| `clip_eps` | 0.2 | Max allowed policy change per update step |
| `entropy_coef` | 0.01 | Bonus for diverse action distribution (exploration) |
| `value_coef` | 0.5 | Weight of critic loss relative to actor loss |
| `n_steps` | 512 | Steps collected before each update |
| `n_epochs` | 4 | Passes over collected data per update |
| `win_loss_bonus` | 0.0 | Terminal bonus (c=0 for PPO per the paper) |

In hybrid mode, `fixed_action_mask` permanently marks BUY_PROPERTY and ACCEPT_TRADE so they're stripped from the allowed list before the network sees it.

---

### `choose_action(state, env, allowed_actions)`

Called every time it's the agent's turn. Flow:

```
1. Hybrid check → BUY_PROPERTY available?
     → fixed_buy_decision() → yes: return BUY immediately
2. Hybrid check → incoming trade pending?
     → fixed_accept_trade_decision() → return ACCEPT or DECLINE immediately
3. Filter out fixed-policy actions from allowed list
4. ActorNetwork samples an action + log_prob
5. CriticNetwork estimates V(s)
6. Return (action, log_prob, value)
```

---

### `update()`

The PPO learning step. Runs after every `n_steps` steps.

**Step 1 — GAE advantage computation** (`_compute_gae()`):

Walks backward through the stored trajectory:
```
delta_t = r_t + γ × V(s_{t+1}) × (1 - done) - V(s_t)
gae_t   = delta_t + γ × λ × (1 - done) × gae_{t+1}
```

This blends immediate TD error with long-term returns. Lambda closer to 1 = more like Monte Carlo (low bias, high variance). Lambda closer to 0 = more like TD(0) (high bias, low variance). 0.95 is the standard middle ground.

Advantages are then normalised to zero mean and unit variance to stabilize training across games with very different reward scales.

**Step 2 — Returns**: `returns = advantages + values`. These are the critic's targets.

**Step 3 — n_epochs mini-batch updates**:

For each epoch, shuffle data and process in batches of `batch_size`:

*Actor loss* — clipped surrogate objective (the core of PPO):
```
ratio = exp(log_prob_new - log_prob_old)
L_clip = -min(ratio × advantage, clip(ratio, 1-ε, 1+ε) × advantage)
```
The ratio measures how much the policy changed from when the data was collected. The clip prevents it from changing too drastically — without this, policy gradient methods can take destructively large steps.

*Critic loss* — mean squared error between predicted V(s) and actual returns.

*Entropy bonus* — rewards having a spread-out action distribution:
```
entropy = -sum(prob × log_prob)
```

*Total loss*:
```
loss = actor_loss + 0.5 × critic_loss - 0.01 × entropy
```

Gradients are clipped to `max_grad_norm = 0.5` before the optimizer step to prevent exploding gradients.

**Step 4** — clear buffer, return stats dict.

---

### `save()` / `load()`

Save and load both actor and critic weights as a single `.pt` checkpoint file. `train_and_save.py` calls save, `play_game.py` calls load.

---

## 7. `agent_ddqn.py`

Implements Double DQN with experience replay and a target network. The alternative algorithm to PPO from the paper.

---

### `ReplayBuffer`

A fixed-size circular queue (deque with `maxlen`). Stores individual `(state, action, reward, next_state, done)` transitions. When the buffer is full, the oldest transitions are automatically dropped.

**`push()`** — adds one transition.

**`sample(batch_size)`** — randomly samples `batch_size` transitions from anywhere in the buffer (not just recent ones). Returns them as PyTorch tensors ready for the network. This random sampling breaks the temporal correlation between consecutive steps, which is what makes experience replay work — correlated samples cause the network to overfit to recent behaviour.

---

### `DDQNAgent.__init__()`

Sets up two copies of `DDQNNetwork` — the online net and the target net — plus the replay buffer and optimizer. Key hyperparameters:

| Parameter | Value | Meaning |
|---|---|---|
| `lr` | 1e-4 | Learning rate |
| `gamma` | 0.99 | Discount factor |
| `epsilon_start` | 1.0 | Start fully random |
| `epsilon_end` | 0.05 | Never go below 5% random |
| `epsilon_decay` | 0.9995 | Exponential decay per step |
| `buffer_capacity` | 50,000 | Max transitions stored |
| `target_update_freq` | 1,000 | Steps between target net hard updates |
| `win_loss_bonus` | 10.0 | Terminal bonus c=10 (paper Experiment 1) |

The target network starts as an exact copy of the online network (`load_state_dict`). It stays frozen until a hard update. This separation is the key stability trick in DDQN — without it, the network is chasing a moving target that it's simultaneously updating, causing oscillations.

---

### `choose_action(state, env, allowed_actions)`

Same hybrid interception pattern as PPO:

```
1. Hybrid check → BUY_PROPERTY → fixed_buy_decision()
2. Hybrid check → incoming trade → fixed_accept_trade_decision()
3. Strip fixed actions from allowed list
4. online_net.get_action(state, nn_allowed, epsilon) → ε-greedy
```

ε-greedy: with probability ε choose a random allowed action (exploration), otherwise choose the highest Q-value allowed action (exploitation).

---

### `store_transition(state, action, reward, next_state, done)`

Pushes one experience into the replay buffer. Also:
- Increments `step_count`
- Decays epsilon: `epsilon = max(epsilon_end, epsilon × epsilon_decay)`

Epsilon decay means the agent explores heavily early in training and shifts toward exploiting learned knowledge as training progresses.

---

### `add_win_loss(won)`

Modifies the reward of the most recently stored transition by adding `+win_loss_bonus` (win) or `-win_loss_bonus` (loss). This gives a large sparse signal at game end — the paper found c=10 necessary for DDQN to learn reliably since the dense in-game reward alone isn't strong enough without the on-policy advantage estimates that PPO has.

---

### `update()`

Called after every step (unlike PPO which waits for a full rollout). Returns early if the buffer has fewer than `batch_size` transitions (can't sample yet).

**DDQN target calculation** — the Double DQN fix for overestimation bias:

```python
# Standard DQN (biased):
next_q = target_net(next_states).max(1)

# Double DQN (unbiased):
next_actions = online_net(next_states).argmax(1)   # online selects which action
next_q       = target_net(next_states)[next_actions] # target evaluates it
```

Using the online net to select the action and the target net to evaluate it breaks the positive feedback loop that causes standard DQN to overestimate Q-values.

**Loss** — Smooth L1 (Huber loss) between current Q-values and targets:
```
targets  = rewards + γ × next_q × (1 - done)
loss     = SmoothL1(online_q, targets)
```

Smooth L1 is less sensitive to outliers than MSE — important in Monopoly where rewards can occasionally be very large (landing on Boardwalk with a hotel).

**Target network hard update** — every `target_update_freq` steps, copy all weights from online to target:
```python
target_net.load_state_dict(online_net.state_dict())
```

---

### `save()` / `load()`

Saves both online and target network weights. On load, epsilon is reset to `epsilon_end` (inference mode — no exploration).

---

## 8. `agents_fixed.py`

The three rule-based opponent agents used during training and evaluation. They don't learn — they follow handcrafted decision trees. The paper uses them as the benchmark opponents.

---

### `FixedPolicyAgent` base class

All three agents inherit from this. The key concept is the **priority order** — a ranked list of all 28 property square indices from most to least desirable. This order affects which properties to mortgage last (keep the high-priority ones) and which trades to pursue first.

---

### `choose_action(env)`

The decision tree, executed in strict priority order every call:

```
1. Incoming trade pending?
     → _should_accept_trade() → ACCEPT or DECLINE

2. In jail?
     → USE_GOOJ_CARD if available
     → PAY_BAIL if affordable

3. BUY_PROPERTY in allowed?
     → _should_buy() → BUY or skip

4. Can build houses/hotels?
     → _best_build_action() → build on best available monopoly

5. Should make a trade offer?
     → _make_trade_offer() → send offer targeting a monopoly

6. Cash below $200?
     → _maybe_mortgage() → mortgage lowest-priority property

7. ROLL_DICE in allowed?
     → roll

8. Default: END_TURN
```

The ordering matters — building is attempted before trading, and both before mortgaging, reflecting a sensible Monopoly strategy.

---

### `_should_buy(player, prop, env)`

Returns True if:
- Buying this property completes a colour group monopoly AND the player can afford it, OR
- The player has at least $200 more than the property price

The $200 buffer prevents the agent from spending all its cash on a property and then being unable to pay rent on the next roll.

---

### `_should_accept_trade(offer, env)`

Returns True if:
- Accepting gives the agent a new complete monopoly, OR
- The net worth of what is received exceeds what is given (`-offer.net_worth() > 0`)

Note the sign convention: `offer.net_worth()` is calculated from the sender's perspective (positive = good for sender). So a positive return value means good for the sender, which means bad for the recipient — hence the negation.

---

### `_best_build_action(allowed, env)`

Loops through `REAL_ESTATE_IDS` in order, checks if any improve_house or improve_hotel action is allowed and affordable (with $200 cash buffer). Returns the first one found. Because it iterates in property index order, cheaper properties tend to get houses first, which is a reasonable default.

---

### `_make_trade_offer(allowed, env)`

Looks for a colour group where the agent owns at least one property and another player owns the remaining property needed for a monopoly. If found, sends a buy offer at 1.0× market price. Only targets railroad groups (other groups are handled implicitly). Returns None if no such opportunity exists.

---

### `_maybe_mortgage(allowed, env)`

Only triggers if cash is below $200. Iterates through `priority_order` in **reverse** (lowest priority first) and mortgages the first eligible non-monopoly property it finds. Monopoly properties are protected because mortgaging one of them breaks the monopoly and prevents building.

---

### The three concrete agents

**`FPAgentA`** — equal priority to all properties. Priority order is just `PROPERTY_IDS` as-is. No strategic preference — mortgages whatever is cheapest first.

**`FPAgentB`** — based on tournament strategies that favour passive income. Priority order:
```
HIGH:  Railroads (5, 15, 25, 35) + Park Place (37) + Boardwalk (39)
MID:   All other real estate
LOW:   Utilities (12, 28)
```
Keeps railroads and dark blues, mortgages utilities first.

**`FPAgentC`** — based on the statistically most-landed-on properties in Monopoly. Priority order:
```
HIGH:  Railroads + Orange group (16, 18, 19) + Light blue group (6, 8, 9)
MID:   All other real estate
LOW:   Utilities
```
The orange and light blue groups are statistically the most profitable in real Monopoly because of their position relative to Jail — players frequently land on them after being released.

---

## 9. `train.py`

Orchestrates the training loop and evaluation. Uses the environment and agents, doesn't know about neural network internals.

---

### `run_episode(env, learning_agent, fp_agents, agent_pid, is_ppo, update_online)`

Runs one complete game. The loop:

```python
while not done and step_count < max_steps:
    pid     = env.whose_turn()
    allowed = env.get_allowed_actions(pid)
    action  = agents_map[pid].choose_action(...)
    env.step(action)
```

One action per iteration. The env's phase machine handles whose turn it is — `run_episode` just asks and applies.

**When `pid == agent_pid` (learning agent's turn):**

For PPO:
- `choose_action()` returns `(action, log_prob, value)`
- Store all five in the PPOBuffer
- If buffer reaches `n_steps`, call `agent.update()`

For DDQN:
- `choose_action()` returns just `action`
- `store_transition(prev_state, prev_action, reward, next_state, done)` after each step
- Call `agent.update()` after every step

**When it's a fixed-policy agent's turn:**
- `agent.choose_action(env)` returns an action
- Validate it's in the allowed list, fall back to END_TURN if not
- Apply with `env.step(action)` — no learning happens

**At game end:**
- Determine winner with `env.winner()`
- Call `add_win_loss(won)` to apply the terminal bonus to the last stored reward

---

### `train(learning_agent, is_ppo, hybrid, n_games, log_every)`

Main training loop. Calls `run_episode()` `n_games` times. Tracks wins in a rolling window and prints win rate every `log_every` games. Returns a history dict with win rates and rewards for plotting.

The `max_steps` guard inside `run_episode` (calculated as `max_rounds × num_players × 30`) ensures no game can loop forever even if the phase machine has an edge case.

---

### `evaluate(learning_agent, is_ppo, n_games, n_runs)`

Runs `n_runs` evaluation sessions of `n_games` each with `update_online=False`. Epsilon is set to zero for DDQN. Reports mean and standard deviation of win rates across runs, which matches the paper's evaluation methodology.

---

## 10. How Everything Connects

Here is the complete data flow from training start to a single action being applied:

```
train.py: train()
  └── for each game: run_episode()
        └── loop:
              env.whose_turn()          → which player acts
              env.get_allowed_actions() → valid action integers
                    │
                    ├── PPOAgent.choose_action()
                    │     ├── fixed_buy_decision()         [hybrid only]
                    │     ├── fixed_accept_trade_decision() [hybrid only]
                    │     └── ActorNetwork.forward()        [masked softmax]
                    │           └── CriticNetwork.forward() [V(s) estimate]
                    │
                    └── DDQNAgent.choose_action()
                          ├── fixed_buy_decision()          [hybrid only]
                          ├── fixed_accept_trade_decision() [hybrid only]
                          └── DDQNNetwork.get_action()       [ε-greedy]

              env.step(action)
                └── _apply_action()     [dispatch by OFFSETS]
                      ├── _do_roll()   → _handle_landing() → rent / buy / jail
                      ├── _do_buy()
                      ├── _do_bankrupt()
                      ├── _do_accept_trade()
                      ├── mortgage / build / trade offer handlers
                      └── _handle_end_turn() → _next_player()

              state = build_state_vector()  [240-dim numpy array]
              reward = _compute_reward()    [net worth ratio]

        └── agent.update()
              PPO:  _compute_gae() → clipped surrogate loss → optimizer step
              DDQN: replay buffer sample → DDQN targets → Huber loss → optimizer step
```

**Summary of what each file is responsible for:**

| File | Responsibility |
|---|---|
| `state.py` | What information exists (Player, Property data + state vector) |
| `actions.py` | What decisions are possible (the numbered action space) |
| `env.py` | What the rules are (game engine, phase machine, reward) |
| `networks.py` | How the agent thinks (neural network architectures) |
| `agent_ppo.py` | How PPO learns (on-policy, clipped surrogate, GAE) |
| `agent_ddqn.py` | How DDQN learns (off-policy, replay buffer, target network) |
| `agents_fixed.py` | How rule-based opponents decide (priority-ordered heuristics) |
| `train.py` | How training is orchestrated (episode loop, logging, evaluation) |
