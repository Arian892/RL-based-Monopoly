import "../styles/game.css";
import { boardCells } from "../data/boardData";

/* ==========================
   🔢 INTEGER SANITIZER
========================== */
function sanitizeGoldInput(value) {
  if (value === "") return "";
  const num = Math.floor(Number(value));
  return Number.isFinite(num) && num >= 0 ? num : "";
}

export default function TradeModal({
  currentPlayer,
  tradeWith,
  setTradeWith,
  players,
  ownership = {},
  mortgaged = {},
  houses = {},
  tradeOffer,
  setTradeOffer,
  onConfirm,
  onClose,
}) {
  const myMoney = players[currentPlayer]?.money ?? 0;
  const theirMoney =
    tradeWith !== null ? players[tradeWith]?.money ?? 0 : 0;

  /* ==========================
     🛡 SAFE OFFER
  ========================== */
  const safeOffer = {
    giveProperties: tradeOffer?.giveProperties || [],
    takeProperties: tradeOffer?.takeProperties || [],
    giveMoney: tradeOffer?.giveMoney ?? "",
    takeMoney: tradeOffer?.takeMoney ?? "",
  };

  /* ==========================
     ✅ TRADABLE RULE
  ========================== */
  function isTradable(cell, ownerIndex) {
    if (ownership[cell.id] !== ownerIndex) return false;
    if (mortgaged[cell.id]) return false;

    // Cannot trade properties with houses
    if (cell.type === "property" && (houses[cell.id] || 0) > 0) {
      return false;
    }

    return true;
  }

  const myCells = boardCells.filter(cell =>
    isTradable(cell, currentPlayer)
  );

  const theirCells =
    tradeWith == null
      ? []
      : boardCells.filter(cell =>
          isTradable(cell, tradeWith)
        );

  /* ==========================
     🔄 TOGGLE HELPERS
  ========================== */
  function toggle(list, id) {
    return list.includes(id)
      ? list.filter(x => x !== id)
      : [...list, id];
  }

  function toggleGive(id) {
    setTradeOffer(prev => ({
      ...prev,
      giveProperties: toggle(prev.giveProperties || [], id),
    }));
  }

  function toggleTake(id) {
    setTradeOffer(prev => ({
      ...prev,
      takeProperties: toggle(prev.takeProperties || [], id),
    }));
  }

  /* ==========================
     🎨 GROUPING
  ========================== */
  function groupCells(cells) {
    return cells.reduce((acc, cell) => {
      const key = cell.type === "property" ? cell.color : cell.type;
      acc[key] = acc[key] || [];
      acc[key].push(cell);
      return acc;
    }, {});
  }

  const myGroups = groupCells(myCells);
  const theirGroups = groupCells(theirCells);

  /* ==========================
     ✅ VALIDATION (FIXED)
  ========================== */
  const giveMoneyNum = Number(safeOffer.giveMoney) || 0;
  const takeMoneyNum = Number(safeOffer.takeMoney) || 0;

  // Only validate money IF it is being given
  const canGiveMoney =
    giveMoneyNum === 0 || giveMoneyNum <= myMoney;

  const canTakeMoney =
    takeMoneyNum === 0 || takeMoneyNum <= theirMoney;

  const isValidTrade =
    canGiveMoney &&
    canTakeMoney &&
    (
      safeOffer.giveProperties.length > 0 ||
      safeOffer.takeProperties.length > 0 ||
      giveMoneyNum > 0 ||
      takeMoneyNum > 0
    );

  return (
    <div className="modal-overlay dark-fade">
      <div className="trade-modal">

        {/* HEADER */}
        <div className="modal-header">
          <h2>Trade</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* PLAYER SELECT */}
        <div className="trade-players">
          <span>{players[currentPlayer]?.name}</span>
          <span>⇄</span>

          <select
            value={tradeWith ?? ""}
            onChange={e => setTradeWith(Number(e.target.value))}
          >
            <option value="" disabled>Select player</option>
            {players.map((p, idx) =>
              idx !== currentPlayer ? (
                <option key={idx} value={idx}>{p.name}</option>
              ) : null
            )}
          </select>
        </div>

        {tradeWith != null && (
          <>
            <div className="trade-columns">

              {/* GIVE */}
              <div className="trade-column">
                <h3>You Give</h3>

                {Object.keys(myGroups).length === 0 && (
                  <div className="empty-trade">No tradable assets</div>
                )}

                {Object.entries(myGroups).map(([group, cells]) => (
                  <div key={group} className="trade-group">
                    <div className={`trade-label ${group}`} />
                    {cells.map(cell => (
                      <div
                        key={cell.id}
                        className={`trade-property ${
                          safeOffer.giveProperties.includes(cell.id)
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => toggleGive(cell.id)}
                      >
                        {cell.name}
                      </div>
                    ))}
                  </div>
                ))}

                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Gold"
                  value={safeOffer.giveMoney}
                  onChange={e =>
                    setTradeOffer(prev => ({
                      ...prev,
                      giveMoney: sanitizeGoldInput(e.target.value),
                    }))
                  }
                />

                {!canGiveMoney && (
                  <div className="trade-error">
                    Not enough gold
                  </div>
                )}
              </div>

              {/* TAKE */}
              <div className="trade-column">
                <h3>You Get</h3>

                {Object.keys(theirGroups).length === 0 && (
                  <div className="empty-trade">No tradable assets</div>
                )}

                {Object.entries(theirGroups).map(([group, cells]) => (
                  <div key={group} className="trade-group">
                    <div className={`trade-label ${group}`} />
                    {cells.map(cell => (
                      <div
                        key={cell.id}
                        className={`trade-property ${
                          safeOffer.takeProperties.includes(cell.id)
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => toggleTake(cell.id)}
                      >
                        {cell.name}
                      </div>
                    ))}
                  </div>
                ))}

                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Gold"
                  value={safeOffer.takeMoney}
                  onChange={e =>
                    setTradeOffer(prev => ({
                      ...prev,
                      takeMoney: sanitizeGoldInput(e.target.value),
                    }))
                  }
                />

                {!canTakeMoney && (
                  <div className="trade-error">
                    Other player doesn’t have enough gold
                  </div>
                )}
              </div>

            </div>

            <div className="trade-footer">
              <button
                className="trade-confirm-btn"
                disabled={!isValidTrade}
                onClick={onConfirm}
              >
                Propose Trade
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
