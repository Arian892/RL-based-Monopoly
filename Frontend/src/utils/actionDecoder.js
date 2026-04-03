import { boardCells } from "../data/boardData";

// Action offsets matching monopoly_drl.actions
const OFFSETS = {
  binary: 0,
  mortgage: 9,
  unmortgage: 37,
  improve_house: 65,
  improve_hotel: 87,
  sell_house: 109,
  sell_hotel: 131,
  sell_prop: 153,
  buy_trade: 181,
  sell_trade: 433,
  exch_trade: 685,
};

const BINARY_ACTIONS = {
  0: "do_nothing",
  1: "end_turn",
  2: "roll_dice",
  3: "buy_property",
  4: "use_gooj_card",
  5: "pay_bail",
  6: "declare_bankrupt",
  7: "accept_trade",
  8: "decline_trade",
};

// Utility to find property IDs (simplified; assumes all properties in boardCells)
function getPropertyIds() {
  return Object.values(boardCells)
    .filter(cell => ["property", "railroad", "utility"].includes(cell.type))
    .map((cell, idx) => ({ id: cell.id, idx }));
}

function getRealEstateIds() {
  return Object.values(boardCells)
    .filter(cell => (cell.houseCost !== undefined))
    .map((cell, idx) => ({ id: cell.id, idx }));
}

const PROPERTY_IDS = getPropertyIds().map(p => p.id);
const REAL_ESTATE_IDS = getRealEstateIds().map(p => p.id);

export function decodeAction(actionIndex) {
  // Binary actions
  if (actionIndex < OFFSETS.mortgage) {
    const localIdx = actionIndex - OFFSETS.binary;
    const actionName = BINARY_ACTIONS[localIdx];
    
    return {
      type: actionName,
      actionIndex,
      description: `Binary action: ${actionName}`,
    };
  }

  // Mortgage
  if (actionIndex < OFFSETS.unmortgage) {
    const localIdx = actionIndex - OFFSETS.mortgage;
    const propId = PROPERTY_IDS[localIdx];
    return {
      type: "mortgage",
      actionIndex,
      cellId: propId,
      description: `Mortgage property ${propId}`,
    };
  }

  // Unmortgage
  if (actionIndex < OFFSETS.improve_house) {
    const localIdx = actionIndex - OFFSETS.unmortgage;
    const propId = PROPERTY_IDS[localIdx];
    return {
      type: "unmortgage",
      actionIndex,
      cellId: propId,
      description: `Unmortgage property ${propId}`,
    };
  }

  // Improve house
  if (actionIndex < OFFSETS.improve_hotel) {
    const localIdx = actionIndex - OFFSETS.improve_house;
    const propId = REAL_ESTATE_IDS[localIdx];
    return {
      type: "build_house",
      actionIndex,
      cellId: propId,
      description: `Build house on property ${propId}`,
    };
  }

  // Improve hotel
  if (actionIndex < OFFSETS.sell_house) {
    const localIdx = actionIndex - OFFSETS.improve_hotel;
    const propId = REAL_ESTATE_IDS[localIdx];
    return {
      type: "build_hotel",
      actionIndex,
      cellId: propId,
      description: `Build hotel on property ${propId}`,
    };
  }

  // Sell house
  if (actionIndex < OFFSETS.sell_hotel) {
    const localIdx = actionIndex - OFFSETS.sell_house;
    const propId = REAL_ESTATE_IDS[localIdx];
    return {
      type: "sell_house",
      actionIndex,
      cellId: propId,
      description: `Sell house on property ${propId}`,
    };
  }

  // Sell hotel
  if (actionIndex < OFFSETS.sell_prop) {
    const localIdx = actionIndex - OFFSETS.sell_hotel;
    const propId = REAL_ESTATE_IDS[localIdx];
    return {
      type: "sell_hotel",
      actionIndex,
      cellId: propId,
      description: `Sell hotel on property ${propId}`,
    };
  }

  // Sell property to bank
  if (actionIndex < OFFSETS.buy_trade) {
    const localIdx = actionIndex - OFFSETS.sell_prop;
    const propId = PROPERTY_IDS[localIdx];
    return {
      type: "sell_property",
      actionIndex,
      cellId: propId,
      description: `Sell property ${propId} to bank`,
    };
  }

  // Buy trade offer
  if (actionIndex < OFFSETS.sell_trade) {
    const localIdx = actionIndex - OFFSETS.buy_trade;
    const nProps = PROPERTY_IDS.length;
    const nCashLevels = 3; // TRADE_CASH_LEVELS

    const playerIdx = Math.floor(localIdx / (nProps * nCashLevels));
    const rem = localIdx % (nProps * nCashLevels);
    const propIdx = Math.floor(rem / nCashLevels);
    const priceLevel = rem % nCashLevels;

    const priceLevels = [0.5, 0.75, 1.0];

    return {
      type: "buy_trade_offer",
      actionIndex,
      targetPlayer: playerIdx,
      property: PROPERTY_IDS[propIdx],
      priceLevel: priceLevels[priceLevel],
      description: `Propose buy trade for ${PROPERTY_IDS[propIdx]} at ${priceLevels[priceLevel] * 100}%`,
    };
  }

  // Sell trade offer
  if (actionIndex < OFFSETS.exch_trade) {
    const localIdx = actionIndex - OFFSETS.sell_trade;
    const nProps = PROPERTY_IDS.length;
    const nCashLevels = 3;

    const playerIdx = Math.floor(localIdx / (nProps * nCashLevels));
    const rem = localIdx % (nProps * nCashLevels);
    const propIdx = Math.floor(rem / nCashLevels);
    const priceLevel = rem % nCashLevels;

    const priceLevels = [0.5, 0.75, 1.0];

    return {
      type: "sell_trade_offer",
      actionIndex,
      targetPlayer: playerIdx,
      property: PROPERTY_IDS[propIdx],
      priceLevel: priceLevels[priceLevel],
      description: `Propose sell trade for ${PROPERTY_IDS[propIdx]} at ${priceLevels[priceLevel] * 100}%`,
    };
  }

  // Exchange trade
  if (actionIndex < 2922) {
    const localIdx = actionIndex - OFFSETS.exch_trade;
    const nProps = PROPERTY_IDS.length;

    const playerIdx = Math.floor(localIdx / (nProps * (nProps - 1)));
    const rem = localIdx % (nProps * (nProps - 1));
    const offerIdx = Math.floor(rem / (nProps - 1));
    const reqIdxRaw = rem % (nProps - 1);
    const reqIdx = reqIdxRaw < offerIdx ? reqIdxRaw : reqIdxRaw + 1;

    return {
      type: "exchange_trade_offer",
      actionIndex,
      targetPlayer: playerIdx,
      offeredProperty: PROPERTY_IDS[offerIdx],
      requestedProperty: PROPERTY_IDS[reqIdx],
      description: `Propose exchange: ${PROPERTY_IDS[offerIdx]} for ${PROPERTY_IDS[reqIdx]}`,
    };
  }

  return {
    type: "unknown",
    actionIndex,
    description: `Unknown action ${actionIndex}`,
  };
}

export function isExecutableAction(decoded) {
  const executableTypes = [
    "buy_property",
    "end_turn",
    "mortgage",
    "unmortgage",
    "build_house",
    "build_hotel",
    "sell_house",
    "sell_hotel",
    "sell_property",
    "buy_trade_offer",
    "sell_trade_offer",
    "exchange_trade_offer",
    "accept_trade",
    "decline_trade",
  ];
  return executableTypes.includes(decoded.type);
}
