import { createContext, useState } from "react";

export const GameContext = createContext();

export function GameProvider({ children }) {
  const [players, setPlayers] = useState([]);
  const [initialMoney, setInitialMoney] = useState(1500);

  // 🔑 turn control
  const [currentPlayer, setCurrentPlayer] = useState(0);

  // 🔑 propertyId -> playerIndex
  const [ownership, setOwnership] = useState({});

  // 🔑 propertyId -> boolean
  const [mortgaged, setMortgaged] = useState({});

  // 🔑 propertyId -> house count (0–5)
  const [houses, setHouses] = useState({});

  // 🔑 array of player indexes
  const [bankruptPlayers, setBankruptPlayers] = useState([]);

    // 🔑 TRADE STATE (NEW)
  const [tradeRequest, setTradeRequest] = useState(null);

  // ==========================
  // 💰 SAFE MONEY UPDATER
  // ==========================
  function updateMoney(playerId, amount) {
    setPlayers(prev =>
      prev.map((p, idx) =>
        idx === playerId
          ? { ...p, money: Number(p.money) + Number(amount || 0) }
          : p
      )
    );
  }

  // ==========================
  // 🏠 HOUSE HELPERS
  // ==========================
  function getHouseCount(cellId) {
    return houses[cellId] || 0;
  }

  function buildHouse(cellId, playerId, cost) {
  setHouses(prev => {
    const current = prev[cellId] || 0;

    // 🛑 HARD STOP — MAX HOUSES
    if (current >= 5) return prev;

    // 🛑 NOT ENOUGH MONEY
    const playerMoney = players[playerId]?.money ?? 0;
    if (playerMoney < cost) return prev;

    // ✅ VALID BUILD
    updateMoney(playerId, -cost);

    return {
      ...prev,
      [cellId]: current + 1,
    };
  });
}

  function sellHouse(cellId, playerId, refund) {
    if (ownership[cellId] !== playerId) return;

    setHouses(prev => {
      const count = prev[cellId] || 0;
      if (count <= 0) return prev;
      return { ...prev, [cellId]: count - 1 };
    });

    updateMoney(playerId, refund);
  }

  // ==========================
  // ☠️ DECLARE BANKRUPTCY
  // ==========================
  function declareBankruptcy(playerId) {
    // remove ownership
    setOwnership(prev => {
      const updated = {};
      for (const cellId in prev) {
        if (prev[cellId] !== playerId) {
          updated[cellId] = prev[cellId];
        }
      }
      return updated;
    });

    // clear mortgages
    setMortgaged(prev => {
      const updated = {};
      for (const cellId in prev) {
        if (ownership[cellId] !== playerId) {
          updated[cellId] = prev[cellId];
        }
      }
      return updated;
    });

    // clear houses
    setHouses(prev => {
      const updated = {};
      for (const cellId in prev) {
        if (ownership[cellId] !== playerId) {
          updated[cellId] = prev[cellId];
        }
      }
      return updated;
    });

    setBankruptPlayers(prev =>
      prev.includes(playerId) ? prev : [...prev, playerId]
    );
  }

  // ==========================
  // 🏦 MORTGAGE
  // ==========================
  function mortgageProperty(cellId, playerId, value) {
    if (houses[cellId] > 0) return;

    setMortgaged(prev => ({ ...prev, [cellId]: true }));
    updateMoney(playerId, value);
  }

  function unmortgageProperty(cellId, playerId, cost) {
    setPlayers(prev =>
      prev.map((p, idx) =>
        idx === playerId && p.money >= cost
          ? { ...p, money: p.money - cost }
          : p
      )
    );
    setMortgaged(prev => ({ ...prev, [cellId]: false }));
  }
   // ==========================
  // 🔁 TRADE HELPERS (NEW)
  // ==========================
  function clearTradeRequest() {
    setTradeRequest(null);
  }

  function executeTrade(trade) {
    if (!trade) return;

    const { from, to } = trade;

    // 💰 CASH TRANSFER
    updateMoney(from.playerId, -from.cash);
    updateMoney(to.playerId, from.cash);

    updateMoney(to.playerId, -to.cash);
    updateMoney(from.playerId, to.cash);

    // 🏠 PROPERTY TRANSFER
    setOwnership(prev => {
      const updated = { ...prev };

      from.properties.forEach(cellId => {
        updated[cellId] = to.playerId;
      });

      to.properties.forEach(cellId => {
        updated[cellId] = from.playerId;
      });

      return updated;
    });

    // 🧹 CLEAR TRADE
    clearTradeRequest();
  }

  // ==========================
// 🚔 SEND PLAYER TO JAIL
// ==========================
function sendToJail(playerId, jailPosition = 10) {
  setPlayers(prev =>
    prev.map((p, idx) =>
      idx === playerId
        ? {
            ...p,
            position: jailPosition,
            inJail: true,
            jailTurnsLeft: 3,
          }
        : p
    )
  );
}

// ==========================
// 🔓 RELEASE FROM JAIL
// ==========================
function releaseFromJail(playerId) {
  setPlayers(prev =>
    prev.map((p, idx) =>
      idx === playerId
        ? {
            ...p,
            inJail: false,
            jailTurnsLeft: 0,
          }
        : p
    )
  );
}

// ==========================
// ⏳ STAY IN JAIL
// ==========================
function decrementJailTurn(playerId) {
  setPlayers(prev =>
    prev.map((p, idx) =>
      idx === playerId
        ? {
            ...p,
            jailTurnsLeft: p.jailTurnsLeft - 1,
          }
        : p
    )
  );
}


  return (
    <GameContext.Provider
      value={{
        players,
        setPlayers,
        initialMoney,
        setInitialMoney,
        currentPlayer,
        setCurrentPlayer,
        ownership,
        setOwnership,
        mortgaged,
        houses,
        buildHouse,
        sellHouse,
        getHouseCount,
        mortgageProperty,
        unmortgageProperty,
        bankruptPlayers,
        declareBankruptcy,
        updateMoney,

        tradeRequest,
        setTradeRequest,
        clearTradeRequest,
        executeTrade,

        sendToJail,
        releaseFromJail,
        decrementJailTurn,




      }}
    >
      {children}
    </GameContext.Provider>
  );
}
