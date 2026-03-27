"""
Fixed-policy baseline agents (Section VI-B).

FP-A: Equal priority to all properties
FP-B: High priority to railroads + Boardwalk/Park Place, low utility priority
FP-C: High priority to railroads + orange/light-blue color groups

All agents:
  - Try to achieve monopolies
  - Make/accept smart trades
  - Build houses/hotels on monopolies
  - Mortgage low-priority properties for cash
"""

import random
from typing import List, Optional

from .constants import (
    PROPERTY_IDS, REAL_ESTATE_IDS, COLOR_GROUPS, PROPERTIES,
    RAILROAD_IDS, UTILITY_IDS, NUM_PLAYERS, JAIL_BAIL
)
from .actions import ActionType, OFFSETS, TRADE_CASH_LEVELS
from .env import MonopolyEnv, TradeOffer


class FixedPolicyAgent:
    """Base class for all fixed-policy agents."""

    def __init__(self, player_id: int, priority_order: List[int] = None):
        self.player_id     = player_id
        self.priority_order = priority_order or PROPERTY_IDS  # highest priority first

    def choose_action(self, env: MonopolyEnv) -> int:
        allowed  = env.get_allowed_actions(self.player_id)
        player   = env.players[self.player_id]
        props    = env.properties

        # --- Accept / reject incoming trade ---
        pending = next(
            (o for o in env.pending_trades.values() if o.to_player == self.player_id),
            None
        )
        if pending:
            if self._should_accept_trade(pending, env):
                return int(ActionType.ACCEPT_TRADE)
            return int(ActionType.DECLINE_TRADE)

        # --- Jail escape ---
        if player.in_jail:
            if int(ActionType.USE_GOOJ_CARD) in allowed:
                return int(ActionType.USE_GOOJ_CARD)
            if int(ActionType.PAY_BAIL) in allowed:
                return int(ActionType.PAY_BAIL)

        # --- Buy property (post-roll) ---
        if int(ActionType.BUY_PROPERTY) in allowed:
            sq = player.position
            if sq in props and props[sq].owner is None:
                if self._should_buy(player, props[sq], env):
                    return int(ActionType.BUY_PROPERTY)

        # --- Build houses/hotels ---
        best_build = self._best_build_action(allowed, env)
        if best_build is not None:
            return best_build

        # --- Make a trade offer ---
        trade_action = self._make_trade_offer(allowed, env)
        if trade_action is not None:
            return trade_action

        # --- Mortgage low-priority properties for cash ---
        mort_action = self._maybe_mortgage(allowed, env)
        if mort_action is not None:
            return mort_action

        # --- Roll dice ---
        if int(ActionType.ROLL_DICE) in allowed:
            return int(ActionType.ROLL_DICE)

        return int(ActionType.END_TURN)

    # ── Decision logic ────────────────────────────────────────────────────────

    def _should_buy(self, player, prop, env) -> bool:
        """Buy if it creates a monopoly (affordably) or agent has cash to spare."""
        if not player.can_afford(prop.price):
            return False
        color   = prop.color
        group   = COLOR_GROUPS[color]
        owned   = sum(1 for s in group if env.properties[s].owner == self.player_id)
        if owned + 1 == len(group):  # completes monopoly
            return True
        return player.cash >= prop.price + 200  # keep $200 buffer

    def _should_accept_trade(self, offer: TradeOffer, env: MonopolyEnv) -> bool:
        """
        Accept if:
        1. Trade gives us a new monopoly, OR
        2. Net worth of the offer is positive
        (Paper equation 5 + monopoly check)
        """
        pid = self.player_id
        # Check if accepting creates a monopoly
        if offer.requested_prop:
            color = offer.requested_prop.color
            group = COLOR_GROUPS[color]
            owned_after = [s for s in group
                           if env.properties[s].owner == pid
                           or env.properties[s] == offer.offered_prop]
            # We'd gain requested_prop
            if offer.requested_prop in [env.properties[s] for s in group]:
                would_own = sum(1 for s in group if env.properties[s].owner == pid)
                if offer.requested_prop.owner == offer.from_player:
                    would_own += 1  # we gain it
                if would_own == len(group):
                    return True

        # Net worth check (eq. 5)
        nwo = offer.net_worth()  # positive = offer is in our favour as recipient
        return -nwo > 0  # we receive more than we give

    def _best_build_action(self, allowed, env) -> Optional[int]:
        """Build a house/hotel on highest-priority monopoly property."""
        player = env.players[self.player_id]
        for i, sq in enumerate(REAL_ESTATE_IDS):
            action = OFFSETS["improve_house"] + i
            if action in allowed:
                prop = env.properties[sq]
                if prop.owner == self.player_id and player.can_afford(prop.data["house_price"] + 200):
                    return action
            action = OFFSETS["improve_hotel"] + i
            if action in allowed:
                prop = env.properties[sq]
                if prop.owner == self.player_id and player.can_afford(prop.data["house_price"] + 200):
                    return action
        return None

    def _make_trade_offer(self, allowed, env) -> Optional[int]:
        """
        Offer to trade low-value property we own for one that gives us a monopoly.
        """
        pid    = self.player_id
        others = [i for i in range(NUM_PLAYERS) if i != pid]
        player = env.players[pid]

        for color, group in COLOR_GROUPS.items():
            owned = [s for s in group if env.properties[s].owner == pid]
            if not owned:
                continue
            need  = [s for s in group if env.properties[s].owner not in (pid, None)]
            if len(owned) + len(need) < len(group):
                continue  # can't complete with one trade
            for needed_sq in need:
                needed_prop  = env.properties[needed_sq]
                target       = needed_prop.owner
                t_idx        = [i for i in range(NUM_PLAYERS) if i != pid].index(target)
                prop_idx     = PROPERTY_IDS.index(needed_sq)
                # Offer at market price
                cash_idx = 1  # 1.0x price
                if color == "railroad":
                    action = (OFFSETS["buy_trade"] +
                              t_idx * len(PROPERTY_IDS) * len(TRADE_CASH_LEVELS) +
                              prop_idx * len(TRADE_CASH_LEVELS) + cash_idx)
                    if action in allowed:
                        return action
        return None

    def _maybe_mortgage(self, allowed, env) -> Optional[int]:
        """Mortgage lowest-priority non-monopoly property if cash is low."""
        player = env.players[self.player_id]
        if player.cash >= 200:
            return None
        # Reverse priority: mortgage lowest-priority first
        for sq in reversed(self.priority_order):
            prop = env.properties.get(sq)
            if prop is None:
                continue
            idx    = PROPERTY_IDS.index(sq)
            action = OFFSETS["mortgage"] + idx
            if action in allowed and not prop.is_monopoly:
                return action
        return None


# ── Concrete agents ───────────────────────────────────────────────────────────

class FPAgentA(FixedPolicyAgent):
    """Equal priority to all properties."""
    def __init__(self, player_id: int):
        super().__init__(player_id, priority_order=PROPERTY_IDS)


class FPAgentB(FixedPolicyAgent):
    """
    High priority: railroads + Park Place (37) + Boardwalk (39).
    Low priority: utilities (12, 28).
    """
    def __init__(self, player_id: int):
        high  = RAILROAD_IDS + [37, 39]
        mid   = [p for p in PROPERTY_IDS if p not in high and p not in UTILITY_IDS]
        low   = UTILITY_IDS
        order = high + mid + low
        super().__init__(player_id, priority_order=order)


class FPAgentC(FixedPolicyAgent):
    """
    High priority: railroads + orange group (16,18,19) + light-blue (6,8,9).
    """
    def __init__(self, player_id: int):
        orange    = COLOR_GROUPS["orange"]
        lightblue = COLOR_GROUPS["lightblue"]
        high  = RAILROAD_IDS + orange + lightblue
        mid   = [p for p in PROPERTY_IDS if p not in high and p not in UTILITY_IDS]
        order = high + mid + UTILITY_IDS
        super().__init__(player_id, priority_order=order)


FP_AGENT_CLASSES = [FPAgentA, FPAgentB, FPAgentC]