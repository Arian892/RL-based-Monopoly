export default function PlayerToken({ color, active, offset }) {
  return (
    <div
      className={`player-token ${active ? "active" : ""}`}
      style={{
        "--token-color": color,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
    >
      <span className="token-core" />
    </div>
  );
}
