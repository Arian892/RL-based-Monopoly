function Die({ value, rolling }) {
  return (
    <div className={`die ${rolling ? "rolling" : ""}`}>
      {[...Array(value)].map((_, i) => (
        <span key={i} className="dot" />
      ))}
    </div>
  );
}

export default function Dice({ dice, rolling }) {
  return (
    <div className="dice-wrapper">
      <div className="dice-row">
        <Die value={dice[0]} rolling={rolling} />
        <Die value={dice[1]} rolling={rolling} />
      </div>
    </div>
  );
}
