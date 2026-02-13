import "../styles/board.css";
import { positionMap } from "../data/positionMap";
import { useState, useEffect, useRef, useContext } from "react";
import { GameContext } from "../context/GameContext";
import CellTooltip from "./CellTooltip";

const COLORS = [
  "#c0392b",
  "#2980b9",
  "#27ae60",
  "#f1c40f",
  "#9b59b6",
  "#e67e22",
];

const houseSideMap = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};




export default function Cell({ cell }) {
  const { ownership, mortgaged, houses } = useContext(GameContext);

  const [row, col] = positionMap[cell.id];
  const [open, setOpen] = useState(false);
  const cellRef = useRef(null);

  let side = "center";
  if (row === 11) side = "bottom";
  else if (row === 1) side = "top";
  else if (col === 1) side = "left";
  else if (col === 11) side = "right";

  const houseSide = houseSideMap[side];

  const ownerId = ownership[cell.id];
  const ownerColor =
    ownerId !== undefined
      ? COLORS[ownerId % COLORS.length]
      : null;

//   const houseCount = houses[cell.id] || 0;

  useEffect(() => {
    function handleClickOutside(e) {
      if (cellRef.current && !cellRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleCellClick(e) {
    e.stopPropagation();
    setOpen(prev => !prev);
  }

 


  return (
    <div
      ref={cellRef}
      className={`cell ${cell.type} ${side} ${
        mortgaged[cell.id] ? "mortgaged" : ""
      }`}
      style={{
        gridRow: row,
        gridColumn: col,
      }}
      onClick={handleCellClick}
    >
      {open && <CellTooltip cell={cell} side={side} />}

      {/* OWNERSHIP EDGE */}
      {ownerColor && (
        <div
          className={`ownership-edge ${side}`}
          style={{ backgroundColor: ownerColor }}
        />
      )}

   {/* 🏠 HOUSES (follow property color edge) */}
        {cell.type === "property" && houses?.[cell.id] > 0 && (
        <div className={`houses ${houseSide}`}>
            {Array.from({ length: Math.min(houses[cell.id], 4) }).map((_, i) => (
            <span key={i} className="house" />
            ))}

            {/* HOTEL */}
            {houses[cell.id] === 5 && <span className="hotel" />}
        </div>
        )}


      {/* COLOR BAR */}
      {cell.color && <div className={`color-bar ${cell.color}`} />}

      {/* CELL CONTENT */}
      <div className="cell-content">
        <div className="cell-name">{cell.name}</div>
        {cell.price && (
          <div className="cell-price">{cell.price} Gold</div>
        )}
      </div>
    </div>
  );
}
