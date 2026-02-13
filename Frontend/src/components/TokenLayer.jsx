import PlayerToken from "./PlayerToken";
import { positionMap } from "../data/positionMap";
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

export default function TokenLayer({
  players,
  currentPlayer,
  displayPositions,
}) {
  // guards
  if (!players || players.length === 0) return null;
  if (!displayPositions || displayPositions.length === 0) return null;


  const { bankruptPlayers } = useContext(GameContext);

  const grouped = {};

  // group players by board position
  players.forEach((player, index) => {
    if (bankruptPlayers.includes(index)) return; 
    const pos = displayPositions[index];

    if (pos === undefined) return;
    if (!positionMap[pos]) return;

    if (!grouped[pos]) grouped[pos] = [];
    grouped[pos].push({ ...player, index });
  });

  return (
    <>
      {Object.entries(grouped).map(([posStr, group]) => {
        const pos = Number(posStr); // 🔥 CRITICAL FIX
        const position = positionMap[pos];

        if (!position) return null;

        const [row, col] = position;

        return (
          <div
            key={pos}
            className="token-cell"
            style={{
              gridRow: row,
              gridColumn: col,
            }}
          >
            {group.map((player, i) => (
              <PlayerToken
                key={player.id ?? `${pos}-${i}`}
                color={COLORS[player.id % COLORS.length]}
                active={player.index === currentPlayer}
                offset={{
                  x: (i % 2) * 18,
                  y: Math.floor(i / 2) * 18,
                }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
