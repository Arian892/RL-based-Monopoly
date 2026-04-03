// src/utils/aiExecutor.js

import { boardCells } from "../data/boardData";

export async function executeAIAction({
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
  delay,
  addLog
}) {
  const { type } = action;

  const playerName =
    players?.[currentPlayer]?.name || `Player ${currentPlayer + 1}`;

  switch (type) {

    // =====================
    // 🏠 BUILD HOUSE
    // =====================
    case "build": {
      const cell = boardCells[action.cellId];

      buildHouse(
        action.cellId,
        currentPlayer,
        cell.houseCost
      );

      addLog?.(
        `🤖 ${playerName} built a house on ${cell.name} for ${cell.houseCost} gold`
      );
      break;
    }

    // =====================
    // 🏚 SELL HOUSE
    // =====================
    case "sell": {
      const cell = boardCells[action.cellId];
      const refund = Math.floor(cell.houseCost / 2);

      sellHouse(
        action.cellId,
        currentPlayer,
        refund
      );

      addLog?.(
        `🤖 ${playerName} sold a house on ${cell.name} for ${refund} gold`
      );
      break;
    }

    // =====================
    // 🏦 MORTGAGE
    // =====================
    case "mortgage": {
      const cell = boardCells[action.cellId];

      mortgageProperty(
        action.cellId,
        currentPlayer,
        cell.mortgageValue
      );

      addLog?.(
        `🤖 ${playerName} mortgaged ${cell.name} for ${cell.mortgageValue} gold`
      );
      break;
    }

    // =====================
    // 🏦 UNMORTGAGE
    // =====================
    case "unmortgage": {
      const cell = boardCells[action.cellId];

      unmortgageProperty(
        action.cellId,
        currentPlayer,
        cell.unmortgageCost
      );

      addLog?.(
        `🤖 ${playerName} unmortgaged ${cell.name} for ${cell.unmortgageCost} gold`
      );
      break;
    }

    // =====================
    // 🛒 BUY PROPERTY
    // =====================
    case "buy": {
      const cell = boardCells[action.cellId];

      setOwnership(prev => ({
        ...prev,
        [action.cellId]: currentPlayer,
      }));

      updateMoney(
        currentPlayer,
        -cell.price
      );

      addLog?.(
        `🤖 ${playerName} bought ${cell.name} for ${cell.price} gold`
      );
      break;
    }

    // =====================
    // 🚔 JAIL PAY
    // =====================
    case "jailPay": {
      updateMoney(currentPlayer, -100);
      releaseFromJail(currentPlayer);

      addLog?.(
        `🤖 ${playerName} paid 100 gold to leave Jail`
      );
      break;
    }

    // =====================
    // 🎟 USE JAIL FREE CARD
    // =====================
    case "jailUseCard": {
      releaseFromJail(currentPlayer);

      addLog?.(
        `🤖 ${playerName} used a Jail Free Card`
      );
      break;
    }

    // =====================
    // ⏳ STAY IN JAIL
    // =====================
    case "jailStay": {
      decrementJailTurn(currentPlayer);

      addLog?.(
        `🤖 ${playerName} stayed in Jail`
      );
      break;
    }

    // =====================
    // 🏨 BUILD HOTEL
    // =====================
    case "build_hotel": {
      const cell = boardCells[action.cellId];
      const hotelCost = cell.houseCost * 5; // 5x house cost for hotel

      buildHouse(
        action.cellId,
        currentPlayer,
        hotelCost
      );

      addLog?.(
        `🤖 ${playerName} built a HOTEL on ${cell.name} for ${hotelCost} gold`
      );
      break;
    }

    // =====================
    // 🏢 SELL HOTEL
    // =====================
    case "sell_hotel": {
      const cell = boardCells[action.cellId];
      const refund = Math.floor((cell.houseCost * 5) / 2);

      sellHouse(
        action.cellId,
        currentPlayer,
        refund
      );

      addLog?.(
        `🤖 ${playerName} sold a HOTEL on ${cell.name} for ${refund} gold`
      );
      break;
    }

    // =====================
    // 💰 SELL PROPERTY TO BANK
    // =====================
    case "sell_property": {
      const cell = boardCells[action.cellId];
      const mortgageValue = cell.mortgageValue || Math.floor(cell.price / 2);

      setOwnership(prev => {
        const updated = { ...prev };
        delete updated[action.cellId];
        return updated;
      });

      updateMoney(currentPlayer, mortgageValue);

      addLog?.(
        `🤖 ${playerName} sold ${cell.name} back to bank for ${mortgageValue} gold`
      );
      break;
    }

    // =====================
    // 🔚 END TURN
    // =====================
    case "endTurn": {
    
      endTurn();
      break;
    }

    default:
      addLog?.(`ℹ️ [${type}] action not yet implemented`);
      break;
  }

  // Small animation delay buffer
  await delay?.(600);
}