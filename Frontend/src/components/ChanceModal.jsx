import "../styles/game.css";

export default function ChanceModal({ card, onAccept }) {
  if (!card) return null;

  const { text, effect } = card;

  function renderEffect() {
    if (effect.type === "money") {
      return (
        <div className={`chance-effect ${effect.amount > 0 ? "positive" : "negative"}`}>
          {effect.amount > 0 ? "+" : ""}
          {effect.amount} Gold
        </div>
      );
    }

    if (effect.type === "move") {
      return (
        <div className="chance-effect neutral">
          Move {effect.steps > 0 ? `+${effect.steps}` : effect.steps} spaces
        </div>
      );
    }

    if (effect.type === "goto") {
      return (
        <div className="chance-effect neutral">
          Go to Start
        </div>
      );
    }

    return null;
  }

  return (
    <div className="modal-overlay dark-fade">
      <div className="chance-modal">

        <div className="chance-header">✦ CHANCE ✦</div>

        <div className="chance-text">{text}</div>

        {renderEffect()}

        <button className="chance-accept-btn" onClick={onAccept}>
          Accept Fate
        </button>
      </div>
    </div>
  );
}
