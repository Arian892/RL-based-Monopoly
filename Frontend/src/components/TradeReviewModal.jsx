import "../styles/game.css";
import { boardCells } from "../data/boardData";

export default function TradeReviewModal({
  trade,
  players,
  onAccept,
  onReject,
}) {
  const { from, to, offer } = trade;

  return (
    <div className="modal-overlay dark-fade">
      <div className="trade-modal">

        {/* HEADER */}
        <div className="modal-header">
          <div>
            <h2 className="trade-review-title">
              Trade Offer for <span>{players[to].name}</span>
            </h2>

            <div className="trade-review-sub">
              From <strong>{players[from].name}</strong>
            </div>
          </div>

          <button className="close-btn" onClick={onReject}>✕</button>
        </div>

        {/* BODY */}
        <div className="trade-review">

          <h3>{players[from].name} gives:</h3>

          {offer.giveProperties.length === 0 && offer.giveMoney === 0 && (
            <div className="muted">Nothing</div>
          )}

          {offer.giveProperties.map(id => (
            <div key={id}>🏠 {boardCells[id].name}</div>
          ))}

          {offer.giveMoney > 0 && (
            <div>💰 {offer.giveMoney} Gold</div>
          )}

          <hr />

          <h3>{players[to].name} gives:</h3>

          {offer.takeProperties.length === 0 && offer.takeMoney === 0 && (
            <div className="muted">Nothing</div>
          )}

          {offer.takeProperties.map(id => (
            <div key={id}>🏠 {boardCells[id].name}</div>
          ))}

          {offer.takeMoney > 0 && (
            <div>💰 {offer.takeMoney} Gold</div>
          )}
        </div>

        {/* FOOTER */}
        <div className="trade-footer">
          <button className="trade-confirm-btn" onClick={onAccept}>
            Accept Trade
          </button>

          <button className="trade-cancel-btn" onClick={onReject}>
            Reject
          </button>
        </div>

      </div>
    </div>
  );
}
