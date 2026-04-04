import { useContext, useState, useEffect } from "react";
import { GameContext } from "../context/GameContext";
import { boardCells } from "../data/boardData";
import { useRef } from "react";

import Board from "../components/Board";
import PlayerHUD from "../components/PlayerHUD";
import Dice from "../components/Dice";
import PropertyModal from "../components/PropertyModal";
import MortgageModal from "../components/MortgageModal";
import BankruptcyModal from "../components/BankruptcyModal";
import WinnerModal from "../components/WinnerModal";
import TradeModal from "../components/TradeModal"; 
import TradeReviewModal from "../components/TradeReviewModal"
import { chanceCards } from "../data/chanceCards";
import ChanceModal from "../components/ChanceModal";
import { executeAIAction } from "../services/aiExecutor";
import { fetchAIPredict } from "../services/aiBackendService";
import { decodeAction } from "../utils/actionDecoder";
import GameLog from "../components/GameLog";
import "../styles/game.css";

export default function GamePage() {
  const {
    players,
    setPlayers,
    currentPlayer,
    setCurrentPlayer,
    ownership,
    setOwnership,
    updateMoney,

    mortgaged,
    mortgageProperty,
    unmortgageProperty,
    bankruptPlayers,
    declareBankruptcy,
    houses,
    buildHouse,
   sellHouse,

   sendToJail,
  releaseFromJail,
  decrementJailTurn,

  } = useContext(GameContext);

  const [dice, setDice] = useState([1, 1]);
  const [rolling, setRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const hasLoggedFirstTurn = useRef(false);

  // visual positions for smooth movement
  const [displayPositions, setDisplayPositions] = useState(
  players.map(p => p.position)
);


  // active cell after movement
  const [activeCell, setActiveCell] = useState(null);

  // + / - money animation
  const [moneyEffect, setMoneyEffect] = useState(null);
  const [showMortgage,setShowMortgage]= useState(false) ; 
  const [showBankruptcy, setShowBankruptcy] = useState(false);
// ==========================
// 🔄 TRADE STATE
// ==========================
const [showTrade, setShowTrade] = useState(false);
const [tradeWith, setTradeWith] = useState(null);

const [tradeOffer, setTradeOffer] = useState({
  giveProperties: [],
  giveMoney: 0,
  takeProperties: [],
  takeMoney: 0,
});

const [pendingTrade, setPendingTrade] = useState(null);
const [chanceIndex, setChanceIndex] = useState(0);
const [chanceCard, setChanceCard] = useState(null);


const isAI = (players[currentPlayer]?.type || "").toLowerCase() === "ai";

const [isAITurn, setIsAITurn] = useState(false);
const [gameLog, setGameLog] = useState([]);

function addLog(message) {
  setGameLog(prev => [
    ...prev,
    {
      id: Date.now() + Math.random(),
      text: message
    }
  ]);
}



const activePlayerIndexes = players
  .map((_, idx) => idx)
  .filter(idx => !bankruptPlayers.includes(idx));

const winner =
  activePlayerIndexes.length === 1
    ? players[activePlayerIndexes[0]]
    : null;


useEffect(() => {
  if (players.length === 0) return;

  const player = players[currentPlayer];
  if (!player) return;

  // 🛑 Prevent duplicate log in StrictMode
  if (!hasLoggedFirstTurn.current) {
    hasLoggedFirstTurn.current = true;
  } else if (currentPlayer === 0 && gameLog.length === 0) {
    return;
  }

  addLog("━━━━━━━━━━━━━━━━━━━━");
  const playerType = (player.type || "").toLowerCase();
  addLog(`🎲 ${player.name} (${playerType.toUpperCase() || "UNKNOWN"}) turn started`);

  if (playerType === "ai" && !winner && !isAITurn) {
    runAITurn();
  }
}, [currentPlayer]);

useEffect(() => {
  if (!pendingTrade) return;

  const recipient = players[pendingTrade.to];
  if (!recipient || (recipient.type || "").toLowerCase() !== "ai") return;

  let cancelled = false;

  async function resolveAITrade() {
    addLog(
      `🤖 ${recipient.name} is evaluating trade offer from ${players[pendingTrade.from]?.name || `Player ${pendingTrade.from + 1}`}`
    );

    try {
      const decision = await fetchAIPredict({
        players,
        currentPlayer: pendingTrade.to,
        ownership,
        houses,
        mortgaged,
        tradeAvailable: true,
        tradeOffer: pendingTrade.offer,
        propertyBuyAvailable: false,
      });

      if (cancelled) return;

      addLog(
        `🧠 Trade decision: action=${decision.action}, source=${decision.decision_source}, model=${decision.model_path}`
      );

      if (decision.action === 7) {
        addLog(`🤝 ${recipient.name} accepted the trade`);
        applyTrade(pendingTrade);
      } else {
        addLog(`❌ ${recipient.name} rejected the trade`);
        setPendingTrade(null);
      }
    } catch (error) {
      if (cancelled) return;
      addLog(`❌ Trade evaluation failed: ${error.message}`);
      setPendingTrade(null);
    }
  }

  resolveAITrade();

  return () => {
    cancelled = true;
  };
}, [pendingTrade, players, ownership, houses, mortgaged]);
    

  // keep displayPositions synced with real positions
  useEffect(() => {
    setDisplayPositions(players.map((p) => p.position));
  }, [players]);

  // ==========================
  // 🎲 ROLL DICE & MOVE PLAYER
  // ==========================
  function rollDice() {
      if (isAITurn) return;  // 🛑 BLOCK AI TURN
    if ((players[currentPlayer]?.type || "").toLowerCase() === "ai") return; // 🛑 BLOCK AI PLAYER
     if (players[currentPlayer]?.inJail) return;
     if (rolling || hasRolled || players.length === 0) return;

  setRolling(true);

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const steps = d1 + d2;
  // const d1 = 0
  // const d2 = 2
  // const steps = d1 + d2 

  setDice([d1, d2]);
  addLog(
  `🎲 ${players[currentPlayer].name} rolled ${d1} + ${d2} = ${steps}`
);

  let stepCount = 0;
  let currentPos = displayPositions[currentPlayer];
  let passedStart = false;

  const interval = setInterval(() => {
    currentPos = (currentPos + 1) % 40;

    if (currentPos === 0) {
      passedStart = true;
    }

    setDisplayPositions(prev => {
      const updated = [...prev];
      updated[currentPlayer] = currentPos;
      return updated;
    });

    stepCount++;

    if (stepCount >= steps) {
      clearInterval(interval);

      const updatedPlayers = players.map((p, i) => {
        if (i !== currentPlayer) return p;

        return {
          ...p,
          position: currentPos,
          money: p.money + (passedStart ? 200 : 0),
        };
      });

      setPlayers(updatedPlayers);

      if (passedStart) {
        setMoneyEffect({ player: currentPlayer, amount: 200 });
      }

      const landedCell = boardCells[currentPos];

      addLog(
  `📍 ${players[currentPlayer].name} landed on ${boardCells[currentPos].name}`
);
      handleCellAction(landedCell);


      setRolling(false);
      setHasRolled(true);
    }
  }, 300);
}

function handleCellAction(cell, options = { silent: false ,position : null}) {
  if (!cell) return;

  const owner = ownership[cell.id];

  // ==========================
  // 🚔 GO TO JAIL
  // ==========================
  if (cell.type === "goto_jail") {
    
    sendToJail(currentPlayer);
    addLog(`🚔 ${players[currentPlayer].name} was sent to Jail`);
    return;
  }

  // ==========================
  // 🏠 BUYABLE CELLS
  // ==========================
  if (["property", "railroad", "utility"].includes(cell.type)) {

    if (owner === undefined) {
      if (!options.silent) {
        setActiveCell(cell);
      }
      return;
    }

    if (mortgaged[cell.id]) return;

    if (owner !== currentPlayer) {
      let rent = 0;

      if (cell.type === "property") {
        const houseCount = houses?.[cell.id] ?? 0;
        const rentIndex = Math.min(houseCount, cell.rent.length - 1);
        rent = cell.rent[rentIndex];
      }

      if (cell.type === "railroad") {
        const ownedRails = Object.entries(ownership).filter(
          ([cellId, playerId]) =>
            Number(playerId) === owner &&
            boardCells[Number(cellId)]?.type === "railroad" &&
            !mortgaged[cellId]
        ).length;

        if (ownedRails > 0) {
          rent = cell.rent[ownedRails - 1];
        }
      }

      if (cell.type === "utility") {
        const ownedUtilities = Object.entries(ownership).filter(
          ([cellId, playerId]) =>
            Number(playerId) === owner &&
            boardCells[Number(cellId)]?.type === "utility" &&
            !mortgaged[cellId]
        ).length;

        const diceTotal = dice[0] + dice[1];
        const multiplier =
          ownedUtilities === 2
            ? cell.rentMultiplier.two
            : cell.rentMultiplier.one;

        rent = diceTotal * multiplier;
      }

      if (Number.isFinite(rent) && rent > 0) {
        updateMoney(currentPlayer, -rent);
        updateMoney(owner, rent);
        addLog(
  `💰 ${players[currentPlayer].name} paid ${rent} gold to ${players[owner].name}`
);
        setMoneyEffect({
          player: currentPlayer,
          amount: -rent,
        });
      }
    }

    return;
  }

  // ==========================
  // 🎴 CHANCE (FIXED)
  // ==========================
  if (cell.type === "chance") {
    const card = chanceCards[chanceIndex];
    setChanceIndex(prev => (prev + 1) % chanceCards.length);

    if (options.silent) {
      // 🔥 AI → auto apply
      applyChance(card,options.position);
    } else {
      // 👤 Human → show modal
      setChanceCard(card);
    }

    return;
  }

  // ==========================
  // 💰 TAX
  // ==========================
  if (cell.type === "tax") {
    updateMoney(currentPlayer, -cell.amount);
    setMoneyEffect({
      player: currentPlayer,
      amount: -cell.amount,
    });
    addLog(
  `🏛 ${players[currentPlayer].name} paid ${cell.amount} gold in tax`
);
    return;
  }
}

  // ==========================
  // 🏠 BUY / SKIP PROPERTY
  // ==========================
  function buyProperty() {
    if (!activeCell) return;
    
    addLog(
  `🏠 ${players[currentPlayer].name} bought ${activeCell.name} for ${activeCell.price} gold`
);
    setOwnership((prev) => ({
      ...prev,
      [activeCell.id]: currentPlayer,
    }));

    updateMoney(currentPlayer, -activeCell.price);
    setMoneyEffect({ player: currentPlayer, amount: -activeCell.price });

    setActiveCell(null);
  }

  function skipProperty() {
    setActiveCell(null);
  }

  // ==========================
  // 🔚 END TURN
  // ==========================
 function endTurn() {
  if (!hasRolled) return;
  addLog(`🔄 ${players[currentPlayer].name} ended their turn`);

  let next = currentPlayer;
  do {
    next = (next + 1) % players.length;
  } while (bankruptPlayers.includes(next));

  setHasRolled(false);
  setCurrentPlayer(next);
}

function ownsFullColorSet(cell) {
  if (!cell.color) return false;

  const sameColorCells = boardCells.filter(
    c => c.color === cell.color && c.type === "property"
  );

  return sameColorCells.every(
    c => ownership[c.id] === currentPlayer
  );
}

function canBuildHere(cell) {
  if (!ownsFullColorSet(cell)) return false;

  const sameColorCells = boardCells.filter(
    c => c.color === cell.color && c.type === "property"
  );

  const counts = sameColorCells.map(
    c => houses[c.id] || 0
  );

  const min = Math.min(...counts);
  return (houses[cell.id] || 0) === min;
}

function canSellHere(cell) {
  if (!ownsFullColorSet(cell)) return false;

  const sameColorCells = boardCells.filter(
    c => c.color === cell.color && c.type === "property"
  );

  const counts = sameColorCells.map(
    c => houses[c.id] || 0
  );

  const max = Math.max(...counts);
  return (houses[cell.id] || 0) === max && max > 0;
}

function handleConfirmTrade() {
  if (tradeWith === null) return;

  const normalizedOffer = {
    giveProperties: tradeOffer.giveProperties || [],
    takeProperties: tradeOffer.takeProperties || [],
    giveMoney: Number(tradeOffer.giveMoney) || 0,
    takeMoney: Number(tradeOffer.takeMoney) || 0,
  };

  setPendingTrade({
    from: currentPlayer,
    to: tradeWith,
    offer: normalizedOffer,
  });

  // close trade builder
  setShowTrade(false);
}


function applyTrade(trade) {
  const { from, to, offer } = trade;
  const giveMoney = Number(offer.giveMoney) || 0;
  const takeMoney = Number(offer.takeMoney) || 0;

  const fromMoney = players[from]?.money ?? 0;
  const toMoney = players[to]?.money ?? 0;

  if (giveMoney > fromMoney) {
    addLog(
      `❌ Trade cancelled: ${players[from]?.name || `Player ${from + 1}`} cannot pay ${giveMoney} gold`
    );
    setPendingTrade(null);
    return;
  }

  if (takeMoney > toMoney) {
    addLog(
      `❌ Trade cancelled: ${players[to]?.name || `Player ${to + 1}`} cannot pay ${takeMoney} gold`
    );
    setPendingTrade(null);
    return;
  }

  // 1️⃣ Transfer properties
  setOwnership(prev => {
    const updated = { ...prev };

    offer.giveProperties.forEach(cellId => {
      updated[cellId] = to;
    });

    offer.takeProperties.forEach(cellId => {
      updated[cellId] = from;
    });

    return updated;
  });

  // 2️⃣ Transfer money
  if (giveMoney > 0) {
    updateMoney(from, -giveMoney);
    updateMoney(to, giveMoney);
  }

  if (takeMoney > 0) {
    updateMoney(to, -takeMoney);
    updateMoney(from, takeMoney);
  }

  // 3️⃣ Cleanup
  setPendingTrade(null);
  setTradeWith(null);
  setTradeOffer({
    giveProperties: [],
    takeProperties: [],
    giveMoney: 0,
    takeMoney: 0,
  });
}

  function movePlayerTo(targetPosition, options = { awardStart: true }) {
  const currentPos = players[currentPlayer].position;
  let passedStart = false;

  if (options.awardStart) {
    if (targetPosition < currentPos) {
      passedStart = true;
    }
  }

  setPlayers(prev =>
    prev.map((p, idx) =>
      idx === currentPlayer
        ? {
            ...p,
            position: targetPosition,
            money: p.money + (passedStart ? 200 : 0),
          }
        : p
    )
  );

  if (passedStart) {
    setMoneyEffect({
      player: currentPlayer,
      amount: 200,
    });
  }

  // 🔥 CRITICAL: trigger actual cell logic
  handleCellAction(boardCells[targetPosition], {
  silent: (players[currentPlayer]?.type || "").toLowerCase() === "ai"
});

}

function applyChance(card , basePosition = null) {
  addLog(
  `🎴 ${players[currentPlayer].name} drew: ${card.text}`
);

  const { effect } = card;

  // =========================
  // 💰 MONEY (SELF)
  // =========================
  if (effect.type === "money") {
    updateMoney(currentPlayer, effect.amount);

    setMoneyEffect({
      player: currentPlayer,
      amount: effect.amount,
    });

    setChanceCard(null);
    return;
  }

  // =========================
  // 🚶 MOVE BY STEPS
  // =========================
  if (effect.type === "move") {

    const currentPos =
    basePosition !== null
      ? basePosition
      : players[currentPlayer].position;

  const newPos =
    (currentPos + effect.steps + 40) % 40;

    movePlayerTo(newPos);
    setChanceCard(null);
    return;
  }

  // =========================
  // 📍 GOTO POSITION
  // =========================
  if (effect.type === "goto") {
    movePlayerTo(effect.position, { awardStart: false });
    setChanceCard(null);
    return;
  }
// =========================
// 🚔 GO TO JAIL (FROM CHANCE)
// =========================
if (effect.type === "jail") {

  sendToJail(currentPlayer);
  setChanceCard(null);
  setHasRolled(true); // turn consumed



  return;
}

// =========================
// 🎟 JAIL FREE CARD
// =========================
if (effect.type === "jailFree") {
  setPlayers(prev =>
    prev.map((p, idx) =>
      idx === currentPlayer
        ? { ...p, jailFreeCard: true }
        : p
    )
  );
  setChanceCard(null);
  return;
}


  // =========================
  // 👥 COLLECT FROM ALL
  // =========================
  if (effect.type === "collectFromAll") {
    let totalCollected = 0;

    players.forEach((_, idx) => {
      if (idx !== currentPlayer && !bankruptPlayers.includes(idx)) {
        updateMoney(idx, -effect.amount);
        updateMoney(currentPlayer, effect.amount);

        setMoneyEffect({
          player: idx,
          amount: -effect.amount,
        });

        totalCollected += effect.amount;
      }
    });

    if (totalCollected > 0) {
      setMoneyEffect({
        player: currentPlayer,
        amount: totalCollected,
      });
    }

    setChanceCard(null);
    return;
  }

  // =========================
  // 👥 PAY ALL
  // =========================
  if (effect.type === "payAll") {
    let totalPaid = 0;

    players.forEach((_, idx) => {
      if (idx !== currentPlayer && !bankruptPlayers.includes(idx)) {
        updateMoney(idx, effect.amount);
        updateMoney(currentPlayer, -effect.amount);

        setMoneyEffect({
          player: idx,
          amount: effect.amount,
        });

        totalPaid += effect.amount;
      }
    });

    if (totalPaid > 0) {
      setMoneyEffect({
        player: currentPlayer,
        amount: -totalPaid,
      });
    }

    setChanceCard(null);
    return;
  }

  // =========================
// 🏠 PAY PER HOUSE (FIXED)
// =========================
if (effect.type === "payPerHouse") {
  const totalHouses = Object.entries(houses || {}).reduce(
    (sum, [cellId, count]) => {
      // count ONLY houses owned by current player
      if (ownership[cellId] === currentPlayer) {
        return sum + count;
      }
      return sum;
    },
    0
  );

  const total = totalHouses * effect.amount;

  if (total > 0) {
    updateMoney(currentPlayer, -total);
    setMoneyEffect({
      player: currentPlayer,
      amount: -total,
    });
  }

  setChanceCard(null);
  return;
}

}



function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



async function rollDiceFromBackend(d1, d2) {
  // if (players[currentPlayer]?.inJail) return;

  setRolling(true);
  setDice([d1, d2]);

  addLog(
  `🤖 ${players[currentPlayer].name} rolled ${d1} + ${d2} = ${d1 + d2}`
);

  const steps = d1 + d2;

  let stepCount = 0;
  let currentPos = players[currentPlayer].position ;
  let passedStart = false;

  await new Promise(resolve => {
    const interval = setInterval(() => {

      currentPos = (currentPos + 1) % 40;

      if (currentPos === 0) {
        passedStart = true;
      }

      // 🔹 Animate movement
      setDisplayPositions(prev => {
        const updated = [...prev];
        updated[currentPlayer] = currentPos;
        return updated;
      });

      stepCount++;

      if (stepCount >= steps) {
        clearInterval(interval);

        // 🔹 Update real player state
        setPlayers(prev =>
          prev.map((p, i) =>
            i === currentPlayer
              ? {
                  ...p,
                  position: currentPos,
                  money: p.money + (passedStart ? 200 : 0),
                }
              : p
          )
        );

        if (passedStart) {
          setMoneyEffect({
            player: currentPlayer,
            amount: 200,
          });
        }

        addLog(
  `📍 ${players[currentPlayer].name} landed on ${boardCells[currentPos].name}`
);

        // 🔹 Trigger landing logic
        handleCellAction(
          boardCells[currentPos],
          { silent: true , position : currentPos} // AI mode
        );

        setRolling(false);
        setHasRolled(true);

        resolve();
      }

    }, 300); // same animation speed as human roll
  });
}


async function runAITurn() {
  if (isAITurn) return ; 
  setIsAITurn(true);

  const gameState = {
    players,
    currentPlayer,
    ownership,
    houses,
    mortgaged,
    tradeAvailable: Boolean(pendingTrade && pendingTrade.to === currentPlayer),
    propertyBuyAvailable: false,
  };

  try {
    const player = players[currentPlayer];

    if (player?.inJail) {
      let jailAction = null;

      if (player.jailFreeCard) {
        jailAction = { type: "jailUseCard" };
      } else if (player.money >= 100) {
        jailAction = { type: "jailPay" };
      } else {
        jailAction = { type: "jailStay" };
      }

      await executeAIAction({
        action: jailAction,
        currentPlayer,
        players,
        buildHouse,
        sellHouse,
        mortgageProperty,
        unmortgageProperty,
        setOwnership,
        updateMoney,
        releaseFromJail,
        decrementJailTurn,
        endTurn,
        delay,
        addLog,
      });

      if (jailAction.type === "jailStay") {
        await executeAIAction({
          action: { type: "endTurn" },
          currentPlayer,
          players,
          buildHouse,
          sellHouse,
          mortgageProperty,
          unmortgageProperty,
          setOwnership,
          updateMoney,
          releaseFromJail,
          decrementJailTurn,
          endTurn,
          delay,
          addLog,
        });
        setIsAITurn(false);
        return;
      }
    }

    // 🔹 ROLL
    let landingCellId = null;
    {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const startPos = players[currentPlayer].position;
    landingCellId = (startPos + d1 + d2) % 40;
    await rollDiceFromBackend(d1, d2);
    }

    // 🔹 POST-ROLL ACTIONS (BACKEND-MAPPED FIRST)
    const landingCell =
      landingCellId !== null ? boardCells[landingCellId] : null;
    const propertyBuyAvailable = Boolean(
      landingCell &&
        ["property", "railroad", "utility"].includes(landingCell.type) &&
        ownership[landingCell.id] === undefined
    );

    if (landingCell) {
      const ownerId = ownership[landingCell.id];
      const ownerName =
        ownerId === undefined ? "none" : players?.[ownerId]?.name || `Player ${Number(ownerId) + 1}`;

      addLog(
        `📌 AI landing context: ${landingCell.name} | type=${landingCell.type} | owner=${ownerName} | buyAvailable=${propertyBuyAvailable}`
      );
    }

    addLog("🌐 Requesting backend prediction...");

    let backendPrediction;
    try {
      backendPrediction = await fetchAIPredict({
        ...gameState,
        propertyBuyAvailable,
      });
    } catch (error) {
      addLog(`❌ Backend prediction failed: ${error.message}`);
      addLog("🔄 Falling back to end turn");
      await executeAIAction({
        action: { type: "endTurn" },
        currentPlayer,
        players,
        buildHouse,
        sellHouse,
        mortgageProperty,
        unmortgageProperty,
        setOwnership,
        updateMoney,
        releaseFromJail,
        decrementJailTurn,
        endTurn,
        delay,
        addLog,
      });
      return;
    }

    addLog("🌐 Backend prediction received");

    addLog(
      `🧠 Backend model: ${backendPrediction.model_path} (${backendPrediction.model_algo || "unknown"})`
    );
    addLog(
      `📥 Backend action received: ${backendPrediction.action}`
    );
    addLog(
      `🧠 Backend decision: action=${backendPrediction.action}, source=${backendPrediction.decision_source}, model=${backendPrediction.model_path}`
    );

    const mappedPostRollActions = [];
    const decoded = decodeAction(backendPrediction.action);
    const otherPlayers = players
      .map((_, idx) => idx)
      .filter((idx) => idx !== currentPlayer && !bankruptPlayers.includes(idx));

    function resolveTradeTarget(otherPlayerSlot) {
      if (otherPlayers.length === 0) return currentPlayer;
      const slot = Number.isFinite(otherPlayerSlot)
        ? Math.abs(otherPlayerSlot) % otherPlayers.length
        : 0;
      return otherPlayers[slot];
    }

    function getTradablePropertyIds(playerIdx) {
      return Object.entries(ownership)
        .filter(([cellId, owner]) => Number(owner) === playerIdx)
        .map(([cellId]) => Number(cellId))
        .filter((cellId) => {
          const cell = boardCells[cellId];
          if (!cell) return false;
          if (!["property", "railroad", "utility"].includes(cell.type)) return false;
          if (mortgaged[cellId]) return false;
          if (cell.type === "property" && (houses[cellId] || 0) > 0) return false;
          return true;
        });
    }

    if (decoded.type === "buy_property" && propertyBuyAvailable && landingCell) {
      mappedPostRollActions.push({ type: "buy", cellId: landingCell.id });
      mappedPostRollActions.push({ type: "endTurn" });
      addLog("✅ Executing: buy property");
    } else if (decoded.type === "mortgage" && decoded.cellId) {
      mappedPostRollActions.push({ type: "mortgage", cellId: decoded.cellId });
      mappedPostRollActions.push({ type: "endTurn" });
      addLog("✅ Executing: mortgage");
    } else if (decoded.type === "unmortgage" && decoded.cellId) {
      mappedPostRollActions.push({ type: "unmortgage", cellId: decoded.cellId });
      mappedPostRollActions.push({ type: "endTurn" });
      addLog("✅ Executing: unmortgage");
    } else if (decoded.type === "build_house" && decoded.cellId) {
      mappedPostRollActions.push({ type: "build", cellId: decoded.cellId });
      mappedPostRollActions.push({ type: "endTurn" });
      addLog("✅ Executing: build house");
    } else if (decoded.type === "build_hotel" && decoded.cellId) {
      mappedPostRollActions.push({ type: "build_hotel", cellId: decoded.cellId });
      mappedPostRollActions.push({ type: "endTurn" });
      addLog("✅ Executing: build hotel");
    } else if (decoded.type === "sell_house" && decoded.cellId) {
      mappedPostRollActions.push({ type: "sell", cellId: decoded.cellId });
      mappedPostRollActions.push({ type: "endTurn" });
      addLog("✅ Executing: sell house");
    } else if (decoded.type === "sell_hotel" && decoded.cellId) {
      mappedPostRollActions.push({ type: "sell_hotel", cellId: decoded.cellId });
      mappedPostRollActions.push({ type: "endTurn" });
      addLog("✅ Executing: sell hotel");
    } else if (decoded.type === "sell_property" && decoded.cellId) {
      mappedPostRollActions.push({ type: "sell_property", cellId: decoded.cellId });
      mappedPostRollActions.push({ type: "endTurn" });
      addLog("✅ Executing: sell property");
    } else if (
      (decoded.type === "accept_trade" || decoded.type === "decline_trade") &&
      pendingTrade &&
      pendingTrade.to === currentPlayer
    ) {
      if (decoded.type === "accept_trade") {
        addLog(`🤝 AI accepted trade from ${players[pendingTrade.from]?.name || `Player ${pendingTrade.from + 1}`}`);
        applyTrade(pendingTrade);
      } else {
        addLog(`❌ AI rejected trade from ${players[pendingTrade.from]?.name || `Player ${pendingTrade.from + 1}`}`);
        setPendingTrade(null);
      }
      mappedPostRollActions.push({ type: "endTurn" });
    } else if (decoded.type === "buy_trade_offer") {
      const targetPlayer = resolveTradeTarget(decoded.targetPlayer);

      const targetTradable = getTradablePropertyIds(targetPlayer);
      const requestedProperty =
        ownership[decoded.property] === targetPlayer
          ? decoded.property
          : targetTradable[0];
      const property = requestedProperty !== undefined ? boardCells[requestedProperty] : null;

      if (targetPlayer === currentPlayer) {
        addLog(`🧾 AI trade skipped: no valid target player`);
      } else if (requestedProperty !== undefined) {
        const rawPrice = Math.max(
          1,
          Math.floor((property?.price || 100) * (decoded.priceLevel || 1))
        );
        const estimatedPrice = Math.min(rawPrice, Math.max(players[currentPlayer]?.money || 0, 0));

        if (estimatedPrice <= 0) {
          addLog(`🧾 AI trade skipped: AI has no cash to propose buy trade`);
        } else {
          setPendingTrade({
            from: currentPlayer,
            to: targetPlayer,
            offer: {
              giveProperties: [],
              takeProperties: [requestedProperty],
              giveMoney: estimatedPrice,
              takeMoney: 0,
            },
          });

          addLog(`🧾 AI proposed trade to ${players[targetPlayer]?.name || `Player ${targetPlayer + 1}`}: buy ${property?.name || requestedProperty} for ${estimatedPrice} gold`);
        }
      } else {
        addLog(`🧾 AI trade skipped: target player has no tradable properties`);
      }

      mappedPostRollActions.push({ type: "endTurn" });
    } else if (decoded.type === "sell_trade_offer") {
      const targetPlayer = resolveTradeTarget(decoded.targetPlayer);

      const aiTradable = getTradablePropertyIds(currentPlayer);
      const offeredProperty =
        ownership[decoded.property] === currentPlayer
          ? decoded.property
          : aiTradable[0];
      const property = offeredProperty !== undefined ? boardCells[offeredProperty] : null;

      if (targetPlayer === currentPlayer) {
        addLog(`🧾 AI trade skipped: no valid target player`);
      } else if (offeredProperty !== undefined) {
        const rawPrice = Math.max(
          1,
          Math.floor((property?.price || 100) * (decoded.priceLevel || 1))
        );
        const estimatedPrice = Math.min(rawPrice, Math.max(players[targetPlayer]?.money || 0, 0));

        if (estimatedPrice <= 0) {
          addLog(`🧾 AI trade skipped: ${players[targetPlayer]?.name || `Player ${targetPlayer + 1}`} has no cash to buy`);
        } else {
          setPendingTrade({
            from: currentPlayer,
            to: targetPlayer,
            offer: {
              giveProperties: [offeredProperty],
              takeProperties: [],
              giveMoney: 0,
              takeMoney: estimatedPrice,
            },
          });

          addLog(`🧾 AI proposed trade to ${players[targetPlayer]?.name || `Player ${targetPlayer + 1}`}: sell ${property?.name || offeredProperty} for ${estimatedPrice} gold`);
        }
      } else {
        addLog(`🧾 AI trade skipped: AI has no tradable properties to sell`);
      }

      mappedPostRollActions.push({ type: "endTurn" });
    } else if (decoded.type === "exchange_trade_offer") {
      const targetPlayer = resolveTradeTarget(decoded.targetPlayer);

      const aiTradable = getTradablePropertyIds(currentPlayer);
      const targetTradable = getTradablePropertyIds(targetPlayer);
      const offeredPropertyId =
        ownership[decoded.offeredProperty] === currentPlayer
          ? decoded.offeredProperty
          : aiTradable[0];

      const requestedPropertyId =
        ownership[decoded.requestedProperty] === targetPlayer
          ? decoded.requestedProperty
          : targetTradable.find((id) => id !== offeredPropertyId) ?? targetTradable[0];

      const offeredProperty =
        offeredPropertyId !== undefined ? boardCells[offeredPropertyId] : null;
      const requestedProperty =
        requestedPropertyId !== undefined ? boardCells[requestedPropertyId] : null;

      if (targetPlayer === currentPlayer) {
        addLog(`🧾 AI trade skipped: no valid target player`);
      } else if (offeredPropertyId !== undefined && requestedPropertyId !== undefined) {
        setPendingTrade({
          from: currentPlayer,
          to: targetPlayer,
          offer: {
            giveProperties: [offeredPropertyId],
            takeProperties: [requestedPropertyId],
            giveMoney: 0,
            takeMoney: 0,
          },
        });

        addLog(`🧾 AI proposed exchange to ${players[targetPlayer]?.name || `Player ${targetPlayer + 1}`}: ${offeredProperty?.name || offeredPropertyId} ↔ ${requestedProperty?.name || requestedPropertyId}`);
      } else {
        addLog(`🧾 AI exchange skipped: one side has no tradable properties`);
      }

      mappedPostRollActions.push({ type: "endTurn" });
    } else if (decoded.type === "end_turn") {
      mappedPostRollActions.push({ type: "endTurn" });
      addLog("✅ Executing: end turn");
    } else {
      mappedPostRollActions.push({ type: "endTurn" });
      addLog(`ℹ️ Backend action not yet mapped (${decoded.type}); defaulting to end turn`);
    }

    addLog(
      `🧩 Frontend mapped action(s): ${mappedPostRollActions
        .map((action) =>
          action.cellId !== undefined
            ? `${action.type}:${action.cellId}`
            : action.type
        )
        .join(" -> ")}`
    );

    for (const action of mappedPostRollActions) {
      addLog(
        `▶️ Frontend executing action: ${
          action.cellId !== undefined
            ? `${action.type} (${boardCells[action.cellId]?.name || action.cellId})`
            : action.type
        }`
      );
      await executeAIAction({
        action,
        currentPlayer,
        players,
        buildHouse,
        sellHouse,
        mortgageProperty,
        unmortgageProperty,
        setOwnership,
        updateMoney,
        releaseFromJail,
        decrementJailTurn,
        endTurn,
        delay , 
        addLog
      });
    }

  } catch (err) {
    console.error("AI TURN FAILED:", err);
  }

  setIsAITurn(false);
}


// ==========================
// 🧱 RENDER
// ==========================
return (
  <div className="game-layout">

    {/* ================= LEFT PANEL ================= */}
    <div className="left-panel">
      <PlayerHUD
        players={players}
        currentPlayer={currentPlayer}
        moneyEffect={moneyEffect}
        clearMoneyEffect={() => setMoneyEffect(null)}
        onManageAssets={() => setShowMortgage(true)}
        onDeclareBankruptcy={() => setShowBankruptcy(true)}
        onOpenTrade={() => setShowTrade(true)}
      />
    </div>

    {/* ================= CENTER PANEL ================= */}
    <div className="center-panel">

      {pendingTrade && (
        (players[pendingTrade.to]?.type || "").toLowerCase() !== "ai" ? (
        <TradeReviewModal
          trade={pendingTrade}
          players={players}
          onAccept={() => applyTrade(pendingTrade)}
          onReject={() => setPendingTrade(null)}
        />
        ) : null
      )}

      {showTrade && (
        <TradeModal
          players={players}
          currentPlayer={currentPlayer}
          tradeWith={tradeWith}
          setTradeWith={setTradeWith}
          ownership={ownership}
          mortgaged={mortgaged}
          houses={houses}
          tradeOffer={tradeOffer}
          setTradeOffer={setTradeOffer}
          onConfirm={handleConfirmTrade}
          onClose={() => {
            setShowTrade(false);
            setTradeWith(null);
            setTradeOffer({
              giveProperties: [],
              giveMoney: 0,
              takeProperties: [],
              takeMoney: 0,
            });
          }}
        />
      )}

      {chanceCard && players[currentPlayer].type === "human" && (
        <ChanceModal
          card={chanceCard}
          onAccept={() => applyChance(chanceCard)}
        />
      )}

      {showMortgage && (
        <MortgageModal
          player={players[currentPlayer]}
          ownership={ownership}
          mortgaged={mortgaged}
          houses={houses}
          onMortgage={(cellId, value) =>
            
            

            
            mortgageProperty(cellId, currentPlayer, value)
          }
          onUnmortgage={(cellId, cost) =>
            unmortgageProperty(cellId, currentPlayer, cost)
          }
          onBuildHouse={(cellId) => {
            const cell = boardCells[cellId];
            if (!canBuildHere(cell)) return;
            buildHouse(cellId, currentPlayer, cell.houseCost);
          }}
          onSellHouse={(cellId) => {
            const cell = boardCells[cellId];
            if (!canSellHere(cell)) return;
            sellHouse(cellId, currentPlayer, Math.floor(cell.houseCost / 2));
          }}
          onClose={() => setShowMortgage(false)}
        />
      )}

      <div className="board-wrapper">
        <Board displayPositions={displayPositions} />

        <div className="center-controls">
          <Dice dice={dice} rolling={rolling} />

          {players[currentPlayer]?.inJail &&
            players[currentPlayer]?.type !== "ai" && (
              <div className="jail-panel">
                <h3>🚨 You are in Jail</h3>
                <p>{players[currentPlayer].jailTurnsLeft} turns remaining</p>

                <div className="jail-actions">
                  <button
                    onClick={() => {
                      if (players[currentPlayer].money >= 100) {
                        updateMoney(currentPlayer, -100);
                        releaseFromJail(currentPlayer);
                        addLog(
        `🔓 ${players[currentPlayer].name} paid 100 gold to leave Jail`
      );
                      }
                    }}
                    disabled={players[currentPlayer].money < 100}
                  >
                    Pay 100 Gold
                  </button>

                  <button
                    onClick={() => {
                      releaseFromJail(currentPlayer);
                      addLog(
        `🔓 ${players[currentPlayer].name} used Jail Free Card  to leave Jail`
      );
                      setPlayers(prev =>
                        prev.map((p, i) =>
                          i === currentPlayer
                            ? { ...p, jailFreeCard: false }
                            : p
                        )
                      );
                    }}
                    disabled={!players[currentPlayer].jailFreeCard}
                  >
                    Use Jail-Free Card
                  </button>

                  <button
                    onClick={() => {
                      setPlayers(prev =>
                        prev.map((p, i) => {
                          if (i !== currentPlayer) return p;

                          const nextTurns = p.jailTurnsLeft - 1;

                          return {
                            ...p,
                            jailTurnsLeft: nextTurns,
                            inJail: nextTurns > 0,
                          };
                        })
                      );

                      setHasRolled(true);
                      endTurn();
                    }}
                  >
                    Stay in Jail
                  </button>
                </div>
              </div>
            )}

          <div className="control-buttons">
            <button
              className="roll-btn"
              onClick={rollDice}
              disabled={
                rolling ||
                hasRolled ||
                players[currentPlayer]?.inJail ||
                !!winner ||
                isAITurn
              }
            >
              Roll Dice
            </button>

            <button
              className="end-turn"
              onClick={endTurn}
              disabled={
                !hasRolled ||
                players[currentPlayer]?.money < 0 ||
                !!winner ||
                isAITurn
              }
            >
              End Turn
            </button>
          </div>
        </div>

        {activeCell &&
          ["property", "railroad", "utility"].includes(activeCell.type) &&
          ownership[activeCell.id] === undefined && (
            <PropertyModal
              cell={activeCell}
              onBuy={buyProperty}
              onSkip={skipProperty}
            />
          )}
      </div>

      {showBankruptcy && (
        <BankruptcyModal
          player={players[currentPlayer]}
          onClose={() => setShowBankruptcy(false)}
          onConfirm={() => {
            declareBankruptcy(currentPlayer);
            setShowBankruptcy(false);
            setHasRolled(false);

            let next = currentPlayer;
            do {
              next = (next + 1) % players.length;
            } while (bankruptPlayers.includes(next));

            setCurrentPlayer(next);
          }}
        />
      )}

      {winner && <WinnerModal winner={winner} />}
    </div>

    {/* ================= RIGHT PANEL ================= */}
    <div className="right-panel">
      <GameLog logs={gameLog} />
    </div>

  </div>
);

}


