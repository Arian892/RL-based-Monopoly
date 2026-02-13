// src/data/chanceCards.js

export const chanceCards = [
  // =========================
  // 🚶 MOVEMENT
  // =========================
  {
    text: "Advance 3 spaces.",
    effect: { type: "move", steps: 3 },
  },

  // =========================
  // 💰 SIMPLE MONEY
  // =========================
  {
    text: "You found hidden gold while traveling.",
    effect: { type: "money", amount: 200 },
  },

  // =========================
  // 👥 PLAYER INTERACTIONS
  // =========================
  {
    text: "You receive 20 Gold from each player.",
    effect: { type: "collectFromAll", amount: 20 },
  },

  // =========================
  // 🚔 JAIL
  // =========================
  {
    text: "Go to Jail. Do not pass Start.",
    effect: { type: "jail" },
  },

  // =========================
  // 🎁 BONUS
  // =========================
  {
    text: "Bank error in your favor. Collect 100 Gold.",
    effect: { type: "money", amount: 100 },
  },

  // =========================
  // 🚶 MOVEMENT
  // =========================
  {
    text: "Go back 2 spaces.",
    effect: { type: "move", steps: -2 },
  },

  // =========================
  // 👥 PLAYER INTERACTIONS
  // =========================
  {
    text: "You treat everyone. Pay 10 Gold to each player.",
    effect: { type: "payAll", amount: 10 },
  },

  // =========================
  // 🏠 PROPERTY-BASED
  // =========================
  {
    text: "Property repairs! Pay 25 Gold per house you own.",
    effect: { type: "payPerHouse", amount: 25 },
  },

  // =========================
  // 💰 SIMPLE MONEY
  // =========================
  {
    text: "Your investments paid off.",
    effect: { type: "money", amount: 150 },
  },

  // =========================
  // 🚔 JAIL
  // =========================
  {
    text: "Get Out of Jail Free.",
    effect: { type: "jailFree" },
  },

  // =========================
  // 🚶 MOVEMENT
  // =========================
  {
    text: "Go directly to Start.",
    effect: { type: "goto", position: 0 },
  },

  // =========================
  // 💰 SIMPLE MONEY
  // =========================
  {
    text: "Unexpected repairs drained your funds.",
    effect: { type: "money", amount: -150 },
  },

  // =========================
  // 🏠 PROPERTY-BASED
  // =========================
  {
    text: "Property repairs! Pay 25 Gold per house you own.",
    effect: { type: "payPerHouse", amount: 25 },
  },

  // =========================
  // 🎁 BONUS
  // =========================
  {
    text: "Charity donation. Lose 50 Gold.",
    effect: { type: "money", amount: -50 },
  },

  // =========================
  // 💰 SIMPLE MONEY
  // =========================
  {
    text: "You paid a city fine.",
    effect: { type: "money", amount: -100 },
  },
];
