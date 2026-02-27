import { boardCells } from "../data/boardData";

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

export async function fetchAIMoveDummy(gameState) {
  const { players, currentPlayer, ownership, houses, mortgaged } = gameState;

  const player = players[currentPlayer];

  // Simulate backend delay
  await new Promise(res => setTimeout(res, 800));

  // ===================================================
  // 🚔 JAIL DECISION (BACKEND CONTROLLED)
  // ===================================================
  if (player.inJail) {
    const preRollActions = [];

    // 1️⃣ Decide jail action
    if (player.jailFreeCard) {
      preRollActions.push({ type: "jailUseCard" });
    } 
    else if (player.money >= 100) {
      preRollActions.push({ type: "jailPay" });
    } 
    else {
      // Cannot pay → stay → end turn
      preRollActions.push({ type: "jailStay" });

      return {
        preRollActions,
        roll: null,
        postRollActions: [{ type: "endTurn" }]
      };
    }

    // 2️⃣ If freed (paid or used card) → continue turn normally

    const roll = {
      d1: randomInt(6) + 1,
      d2: randomInt(6) + 1
    };

    const landingPos =
      (player.position + roll.d1 + roll.d2) % 40;

    const landingCell = boardCells[landingPos];

    const postRollActions = [];

    if (
      ["property", "railroad", "utility"].includes(landingCell.type) &&
      ownership[landingCell.id] === undefined &&
      player.money > landingCell.price + 200
    ) {
      postRollActions.push({
        type: "buy",
        cellId: landingCell.id
      });
    }

    postRollActions.push({ type: "endTurn" });

    return {
      preRollActions,
      roll,
      postRollActions
    };
  }

  // ===================================================
  // 🏗 PRE-ROLL ACTIONS (NORMAL TURN)
  // ===================================================
  const preRollActions = [];

  const ownedProperties = Object.entries(ownership)
    .filter(([cellId, owner]) => owner === currentPlayer)
    .map(([cellId]) => Number(cellId))
    .filter(cellId => boardCells[cellId].type === "property");

  const groupedByColor = {};

  ownedProperties.forEach(cellId => {
    const color = boardCells[cellId].color;
    if (!groupedByColor[color]) groupedByColor[color] = [];
    groupedByColor[color].push(cellId);
  });

  Object.values(groupedByColor).forEach(group => {
    const fullSet = group.every(cellId =>
      ownership[cellId] === currentPlayer
    );

    if (fullSet) {
      group.forEach(cellId => {
        const currentHouses = houses[cellId] || 0;

        if (
          currentHouses < 5 &&
          player.money > boardCells[cellId].houseCost + 200
        ) {
          preRollActions.push({
            type: "build",
            cellId
          });
        }
      });
    }
  });

  // Mortgage if low money
  if (player.money < 200) {
    const mortgageCandidates = ownedProperties.filter(
      cellId =>
        !mortgaged[cellId] &&
        (houses[cellId] || 0) === 0
    );

    if (mortgageCandidates.length > 0) {
      preRollActions.push({
        type: "mortgage",
        cellId:
          mortgageCandidates[randomInt(mortgageCandidates.length)]
      });
    }
  }

  // ===================================================
  // 🎲 ROLL
  // ===================================================
  const roll = {
    // d1 : 0 ,
    // d2 : 2
    d1: randomInt(6) + 1,
    d2: randomInt(6) + 1
  };

  const landingPos =
    (player.position + roll.d1 + roll.d2) % 40;

  const landingCell = boardCells[landingPos];

  // ===================================================
  // 📍 POST-ROLL ACTIONS
  // ===================================================
  const postRollActions = [];

  if (
    ["property", "railroad", "utility"].includes(landingCell.type) &&
    ownership[landingCell.id] === undefined &&
    player.money > landingCell.price + 200
  ) {
    postRollActions.push({
      type: "buy",
      cellId: landingCell.id
    });
  }

  postRollActions.push({ type: "endTurn" });

  return {
    preRollActions,
    roll,
    postRollActions
  };
}
