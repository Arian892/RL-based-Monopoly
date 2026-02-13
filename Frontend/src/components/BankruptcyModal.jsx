import "../styles/game.css";

export default function BankruptcyModal({ player, onConfirm, onClose }) {
  return (
    <div className="modal-overlay dark-fade">
      <div className="bankruptcy-modal">

        {/* ✕ CLOSE ICON */}
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="skull">☠</div>

        <h2 className="bankruptcy-title">Bankruptcy</h2>

        <p className="bankruptcy-player">{player.name}</p>

        <p className="bankruptcy-text">
          Your treasury is empty.
          <br />
          You may mortgage assets to recover,
          <br />
          or accept your fate.
        </p>

        <p className="bankruptcy-balance">
          Current Balance: <span>{player.money} Gold</span>
        </p>

        <button
          className="bankruptcy-confirm-btn"
          onClick={onConfirm}
        >
          Accept Fate
        </button>
      </div>
    </div>
  );
}
