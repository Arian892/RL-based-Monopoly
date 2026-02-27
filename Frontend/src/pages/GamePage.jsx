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
import { fetchAIMoveDummy } from "../services/aiDummyService";
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
  giveGold: 0,
  takeProperties: [],
  takeGold: 0,
});

const [pendingTrade, setPendingTrade] = useState(null);
const [chanceIndex, setChanceIndex] = useState(0);
const [chanceCard, setChanceCard] = useState(null);


const isAI = players[currentPlayer]?.type === "ai";

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
  addLog(`🎲 ${player.name} (${player.type.toUpperCase()}) turn started`);

  if (player.type === "ai" && !winner && !isAITurn) {
    runAITurn();
  }
}, [currentPlayer]);
    

  // keep displayPositions synced with real positions
  useEffect(() => {
    setDisplayPositions(players.map((p) => p.position));
  }, [players]);

  // ==========================
  // 🎲 ROLL DICE & MOVE PLAYER
  // ==========================
  function rollDice() {
      if (isAITurn) return;  // 🛑 BLOCK AI TURN
     if (players[currentPlayer]?.type === "ai") return; // 🛑 BLOCK AI PLAYER
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

  setPendingTrade({
    from: currentPlayer,
    to: tradeWith,
    offer: tradeOffer,
  });

  // close trade builder
  setShowTrade(false);
}


function applyTrade(trade) {
  const { from, to, offer } = trade;

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
  if (offer.giveMoney > 0) {
    updateMoney(from, -offer.giveMoney);
    updateMoney(to, offer.giveMoney);
  }

  if (offer.takeMoney > 0) {
    updateMoney(to, -offer.takeMoney);
    updateMoney(from, offer.takeMoney);
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
  silent: players[currentPlayer]?.type === "ai"
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
  };

  try {
    const aiResponse = await fetchAIMoveDummy(gameState);

    // 🔹 PRE-ROLL ACTIONS
    for (const action of aiResponse.preRollActions || []) {
      await executeAIAction({
        action,
        currentPlayer,
        players , 
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

  
      // 🔹 ROLL (ONLY IF EXISTS)
  if (aiResponse.roll) {
    const { d1, d2 } = aiResponse.roll;
    await rollDiceFromBackend(d1, d2);
  }


    // 🔹 POST-ROLL ACTIONS
    for (const action of aiResponse.postRollActions || []) {
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
        <TradeReviewModal
          trade={pendingTrade}
          players={players}
          onAccept={() => applyTrade(pendingTrade)}
          onReject={() => setPendingTrade(null)}
        />
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


