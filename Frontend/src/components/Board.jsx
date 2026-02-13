import Cell from "./Cell";
import { boardCells } from "../data/boardData";
import "../styles/board.css";
import { useContext } from "react";
import { GameContext } from "../context/GameContext";
import TokenLayer from "./TokenLayer";


export default function Board({displayPositions}) {
    const { players, ownership,currentPlayer } = useContext(GameContext);

  return (
    <div className="board">
      {boardCells.map((cell) => (
        <Cell key={cell.id} cell={cell} 
        ownership = {ownership}
        players = {players} />
      ))}
      <TokenLayer players={players} currentPlayer={currentPlayer} displayPositions={displayPositions}/>

    </div>
  );
}
