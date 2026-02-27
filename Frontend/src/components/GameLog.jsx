import { useEffect, useRef } from "react";
import "../styles/gameLog.css";

export default function GameLog({ logs }) {
  const logRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="game-log-container">
      <div className="game-log-title">GAME LOG</div>

      <div className="game-log-content" ref={logRef}>
        {logs.map(log => (
          <div key={log.id} className="log-entry">
            {log.text}
          </div>
        ))}
      </div>
    </div>
  );
}