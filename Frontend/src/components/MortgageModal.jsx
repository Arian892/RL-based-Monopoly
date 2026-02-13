import "../styles/game.css";
import { boardCells } from "../data/boardData";

export default function MortgageModal({
  player,
  ownership,
  mortgaged,
  houses,
  onMortgage,
  onUnmortgage,
  onBuildHouse,
  onSellHouse,
  onClose,
}) {
  // ==========================
  // OWNED CELLS
  // ==========================
  const ownedCells = Object.entries(ownership)
    .filter(([_, ownerId]) => ownerId === player.id)
    .map(([cellId]) => boardCells[cellId]);

  // ==========================
  // GROUP PROPERTIES BY COLOR
  // ==========================
  const propertyGroups = {};
  ownedCells.forEach(cell => {
    if (cell.type === "property") {
      if (!propertyGroups[cell.color]) {
        propertyGroups[cell.color] = [];
      }
      propertyGroups[cell.color].push(cell);
    }
  });

  // ==========================
  // CHECK FULL COLOR SET
  // ==========================
  function ownsFullColorSet(color) {
    const allOfColor = boardCells.filter(
      c => c.type === "property" && c.color === color
    );

    return allOfColor.every(
      c => ownership[c.id] === player.id
    );
  }

  // ==========================
  // NON-PROPERTY CELLS
  // ==========================
  const otherCells = ownedCells.filter(
    c => c.type !== "property"
  );

  return (
    <div className="modal-overlay">
      <div className="mortgage-modal dark">

        {/* HEADER */}
        <div className="modal-header">
          <h2>Manage Assets</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="mortgage-list">

          {/* ==========================
              PROPERTY GROUPS
          ========================== */}
          {Object.entries(propertyGroups).map(([color, cells]) => {
            const fullSet = ownsFullColorSet(color);

            return (
              <div key={color} className="property-group">
                <div className={`group-header ${color}`}>
                  {color.toUpperCase()} SET
                  {!fullSet && (
                    <span className="group-note">
                      (Incomplete set)
                    </span>
                  )}
                </div>

                {cells.map(cell => {
                  const isMortgaged = mortgaged[cell.id];
                  const houseCount = houses?.[cell.id] || 0;
                  const mortgageValue = cell.mortgage;
                  const unmortgageCost = Math.floor(cell.mortgage * 1.1);

                  return (
                    <div
                      key={cell.id}
                      className={`mortgage-card ${
                        isMortgaged ? "mortgaged" : ""
                      }`}
                    >
                      <div className={`mortgage-band ${cell.color}`} />

                      <div className="mortgage-info">
                        <div className="mortgage-name">
                          {cell.name}
                        </div>

                        <div className="mortgage-meta">
                          🏠 Houses: {houseCount}
                        </div>
                      </div>

                      <div className="mortgage-action">
                        {/* MORTGAGE */}
                        {!isMortgaged ? (
                          <button
                            className="mortgage-btn"
                            disabled={houseCount > 0}
                            onClick={() =>
                              onMortgage(cell.id, mortgageValue)
                            }
                          >
                            Mortgage
                          </button>
                        ) : (
                          <button
                            className="unmortgage-btn"
                            disabled={player.money < unmortgageCost}
                            onClick={() =>
                              onUnmortgage(cell.id, unmortgageCost)
                            }
                          >
                            Unmortgage
                          </button>
                        )}

                        {/* BUILD / SELL (ONLY IF FULL SET) */}
                        {fullSet && !isMortgaged && (
                          <div className="house-actions">
                            <button
                            className="build-house-btn"
                            disabled={
                                player.money < cell.houseCost ||
                                houseCount >= 5
                            }
                            onClick={() => onBuildHouse(cell.id)}
                            >
                            {houseCount >= 5 ? "Max Built" : "+ Build"}
                            </button>


                            <button
                              className="sell-house-btn"
                              disabled={houseCount === 0}
                              onClick={() => onSellHouse(cell.id)}
                            >
                              − Sell
                            </button>
                          </div>
                        )}

                        {/* WARNING */}
                        {houseCount > 0 && !isMortgaged && (
                          <div className="mortgage-warning">
                            Sell houses before mortgaging
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* ==========================
              RAILROAD / UTILITY
          ========================== */}
          {otherCells.length > 0 && (
            <>
              <div className="group-header neutral">
                Other Assets
              </div>

              {otherCells.map(cell => {
                const isMortgaged = mortgaged[cell.id];
                const mortgageValue = cell.mortgage;
                const unmortgageCost = Math.floor(cell.mortgage * 1.1);

                return (
                  <div
                    key={cell.id}
                    className={`mortgage-card ${
                      isMortgaged ? "mortgaged" : ""
                    }`}
                  >
                    <div className="mortgage-band neutral" />

                    <div className="mortgage-info">
                      <div className="mortgage-name">
                        {cell.name}
                      </div>
                    </div>

                    <div className="mortgage-action">
                      {!isMortgaged ? (
                        <button
                          className="mortgage-btn"
                          onClick={() =>
                            onMortgage(cell.id, mortgageValue)
                          }
                        >
                          Mortgage
                        </button>
                      ) : (
                        <button
                          className="unmortgage-btn"
                          disabled={player.money < unmortgageCost}
                          onClick={() =>
                            onUnmortgage(cell.id, unmortgageCost)
                          }
                        >
                          Unmortgage
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {ownedCells.length === 0 && (
            <div className="empty-assets">
              No properties owned
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
