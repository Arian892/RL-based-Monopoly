import MoneyEffect from "./MoneyEffect";
import { useContext } from "react";
import { GameContext } from "../context/GameContext";

const COLORS = [
  "#c0392b",
  "#2980b9",
  "#27ae60",
  "#f1c40f",
  "#9b59b6",
  "#e67e22",
];

export default function PlayerHUD({
  players,
  currentPlayer,
  moneyEffect,
  clearMoneyEffect,
  onManageAssets,
  onDeclareBankruptcy,
  onOpenTrade,               // 🆕
}) {
  const { bankruptPlayers } = useContext(GameContext);

  return (
    <div className="player-hud">
      <h2>Players</h2>

      {players.map((player, index) => {
        const isActive = index === currentPlayer;
        const isBankrupt = bankruptPlayers.includes(index);
        const showEffect =
          moneyEffect && moneyEffect.player === player.id;

        return (
          <div
            key={player.id}
            className={`player-card
              ${isBankrupt ? "bankrupt" : ""}
              ${isActive ? "active" : ""}
            `}
          >
            <span
              className="player-color"
              style={{ backgroundColor: COLORS[player.id % COLORS.length] }}
            />

            <div className="player-info">
              <div className="player-name">
                {player.name}
                {isBankrupt && <span className="dead-mark"> ☠</span>}
              </div>

              <div className="player-money">
                💰 {player.money} Gold
              </div>

              {showEffect && (
                <MoneyEffect
                  amount={moneyEffect.amount}
                  onDone={clearMoneyEffect}
                />
              )}

              {isActive && !isBankrupt &&  (
                <div className="player-actions">
                  <button
                    className="manage-assets-btn"
                    onClick={onManageAssets}
                  >
                    Manage Assets
                  </button>

                  {/* 🆕 TRADE BUTTON */}
                  <button
                    className="trade-btn"
                    onClick={onOpenTrade}
                  >
                    Trade
                  </button>
                </div>
              )}

              {isActive && !isBankrupt && player.money < 0 && (
                <button
                  className="bankrupt-btn"
                  onClick={onDeclareBankruptcy}
                >
                  Declare Bankruptcy
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
