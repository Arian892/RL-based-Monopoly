import { useContext, useState } from "react";
import { GameContext } from "../context/GameContext";
import { useNavigate } from "react-router-dom";
import "../styles/start.css";

export default function StartPage() {
  const { setPlayers, setInitialMoney } = useContext(GameContext);
  const navigate = useNavigate();

  const [playerCount, setPlayerCount] = useState(2);
  const [money, setMoney] = useState(1500);
  const [playerData, setPlayerData] = useState([
    { name: "", type: "human" },
    { name: "", type: "human" },
  ]);

  function updatePlayerCount(count) {
    setPlayerCount(count);

    const updated = Array.from({ length: count }, (_, i) => ({
      name: "",
      type: "human",
    }));

    setPlayerData(updated);
  }

  function updatePlayer(index, field, value) {
    const updated = [...playerData];
    updated[index][field] = value;
    setPlayerData(updated);
  }

  function startGame() {
    const finalPlayers = playerData.map((p, i) => ({
      id: i,
      name: p.name || `Human-${i + 1}`,
      type: p.type,
      money,
      position: 0,
      inJail: false ,
      jailTurnsLeft : 0,
      jailFreeCard : false,
    }));

    setInitialMoney(money);
    setPlayers(finalPlayers);
    navigate("/game");
  }

  return (
    <div className="start-page">
      <div className="setup-container">
        <h1>Game Setup</h1>

        {/* GAME OPTIONS */}
        <div className="setup-card">
          <div className="field">
            <label>Number of Players</label>
            <select
              value={playerCount}
              onChange={(e) => updatePlayerCount(Number(e.target.value))}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Initial Money</label>
            <select
              value={money}
              onChange={(e) => setMoney(Number(e.target.value))}
            >
              {[300, 1500, 2000, 2500, 3000].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PLAYER CONFIG */}
        <div className="players-card">
          <h2>Players</h2>

          {playerData.map((player, index) => (
            <div key={index} className="player-row">
              <input
                placeholder={`Human-${index + 1}`}
                value={player.name}
                onChange={(e) =>
                  updatePlayer(index, "name", e.target.value)
                }
              />

              <select
                value={player.type}
                onChange={(e) =>
                  updatePlayer(index, "type", e.target.value)
                }
              >
                <option value="human">Human</option>
                <option value="ai">AI</option>
              </select>
            </div>
          ))}
        </div>

        <button className="start-btn" onClick={startGame}>
          Start Game
        </button>
      </div>
    </div>
  );
}
