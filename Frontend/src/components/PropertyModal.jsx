import "../styles/game.css";

export default function PropertyModal({ cell, onBuy, onSkip }) {
  if (!cell) return null;

  return (
    <div className="modal-overlay">
      <div className="property-modal dark">

        {/* COLOR BAND (only for properties) */}
        {cell.color && (
          <div className={`property-band ${cell.color}`} />
        )}

        <h2 className="property-title">{cell.name}</h2>

        <div className="property-details">

          {/* PRICE */}
          {cell.price && (
            <div className="detail-row">
              <span>Price</span>
              <span>{cell.price} Gold</span>
            </div>
          )}

          {/* =====================
              PROPERTY
          ===================== */}
          {cell.type === "property" && (
            <>
              <div className="detail-section">
                <h4>Rent</h4>

                <div className="detail-row">
                  <span>No Houses</span>
                  <span>{cell.rent[0]} Gold</span>
                </div>

                <div className="detail-row">
                  <span>1 House</span>
                  <span>{cell.rent[1]} Gold</span>
                </div>

                <div className="detail-row">
                  <span>2 Houses</span>
                  <span>{cell.rent[2]} Gold</span>
                </div>

                <div className="detail-row">
                  <span>3 Houses</span>
                  <span>{cell.rent[3]} Gold</span>
                </div>

                <div className="detail-row">
                  <span>4 Houses</span>
                  <span>{cell.rent[4]} Gold</span>
                </div>

                <div className="detail-row">
                  <span>Hotel</span>
                  <span>{cell.rent[5]} Gold</span>
                </div>
              </div>

              <div className="detail-row muted">
                <span>House Cost</span>
                <span>{cell.houseCost} Gold</span>
              </div>

              <div className="detail-row muted">
                <span>Mortgage</span>
                <span>{cell.mortgage} Gold</span>
              </div>
            </>
          )}

          {/* =====================
              RAILROAD
          ===================== */}
          {cell.type === "railroad" && (
            <>
              <div className="detail-section">
                <h4>Rent</h4>

                <div className="detail-row">
                  <span>1 Railroad</span>
                  <span>{cell.rent[0]} Gold</span>
                </div>

                <div className="detail-row">
                  <span>2 Railroads</span>
                  <span>{cell.rent[1]} Gold</span>
                </div>

                <div className="detail-row">
                  <span>3 Railroads</span>
                  <span>{cell.rent[2]} Gold</span>
                </div>

                <div className="detail-row">
                  <span>4 Railroads</span>
                  <span>{cell.rent[3]} Gold</span>
                </div>
              </div>

              <div className="detail-row muted">
                <span>Mortgage</span>
                <span>{cell.mortgage} Gold</span>
              </div>
            </>
          )}

          {/* =====================
              UTILITY
          ===================== */}
          {cell.type === "utility" && (
            <>
              <div className="detail-section">
                <h4>Rent</h4>

                <div className="detail-row">
                  <span>1 Utility</span>
                  <span>Dice × {cell.rentMultiplier.one}</span>
                </div>

                <div className="detail-row">
                  <span>2 Utilities</span>
                  <span>Dice × {cell.rentMultiplier.two}</span>
                </div>
              </div>

              <div className="detail-row muted">
                <span>Mortgage</span>
                <span>{cell.mortgage} Gold</span>
              </div>
            </>
          )}

        </div>

        <div className="modal-actions">
          <button className="buy-btn" onClick={onBuy}>
            Buy
          </button>
          <button className="skip-btn" onClick={onSkip}>
            Skip
          </button>
        </div>

      </div>
    </div>
  );
}
