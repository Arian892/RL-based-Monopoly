import "../styles/game.css";
import { useNavigate } from "react-router-dom";

export default function WinnerModal({ winner }) {
  const navigate = useNavigate();

  if (!winner) return null;

  return (
    <div className="modal-overlay">
      <div className="property-modal dark winner">
        <h2>🏆 Victory</h2>

        <p style={{ marginTop: "16px", fontSize: "18px" }}>
          {winner.name} rules the Seven Kingdoms!
        </p>

        <p style={{ marginTop: "10px", opacity: 0.7 }}>
          Final Gold: {winner.money}
        </p>

        <div className="modal-actions" style={{ marginTop: "30px" }}>
          <button
            className="buy-btn"
            onClick={() => navigate("/")}
          >
            Back to Start
          </button>
        </div>
      </div>
    </div>
  );
}
