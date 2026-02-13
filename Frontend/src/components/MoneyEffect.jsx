import { useEffect } from "react";

export default function MoneyEffect({ amount, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`hud-money-effect ${amount > 0 ? "plus" : "minus"}`}>
      {amount > 0 ? `+${amount}` : amount}
    </div>
  );
}
