export default function CellTooltip({ cell ,side}) {
  if (!cell) return null;

  return (
    <div className={`cell-tooltip tooltip-${side}`}>
      <h3 className="tooltip-title">{cell.name}</h3>

      {cell.type === "property" && (
        <>
          <div className="tooltip-section">
            <div className="tooltip-row">
              <span>Rent</span><span>${cell.rent[0]}</span>
            </div>
            <div className="tooltip-row">
              <span>1 House</span><span>${cell.rent[1]}</span>
            </div>
            <div className="tooltip-row">
              <span>2 Houses</span><span>${cell.rent[2]}</span>
            </div>
            <div className="tooltip-row">
              <span>3 Houses</span><span>${cell.rent[3]}</span>
            </div>
            <div className="tooltip-row">
              <span>4 Houses</span><span>${cell.rent[4]}</span>
            </div>
            <div className="tooltip-row">
              <span>Hotel</span><span>${cell.rent[5]}</span>
            </div>
          </div>

          <div className="tooltip-footer">
            <div>Price ${cell.price}</div>
            <div>House ${cell.houseCost}</div>
            <div>Mortgage ${cell.mortgage}</div>
          </div>
        </>
      )}

      {cell.type === "utility" && (
        <>
          <div className="tooltip-section">
            <div className="tooltip-row">
              <span>If one utility owned</span>
              <span>{cell.rentMultiplier.one}× dice</span>
            </div>
            <div className="tooltip-row">
              <span>If two utilities owned</span>
              <span>{cell.rentMultiplier.two}× dice</span>
            </div>
          </div>

          <div className="tooltip-footer">
            <div>Price ${cell.price}</div>
            <div>Mortgage ${cell.mortgage}</div>
          </div>
        </>
      )}

      {cell.type === "railroad" && (
        <>
          <div className="tooltip-section">
            {cell.rent.map((r, i) => (
              <div key={i} className="tooltip-row">
                <span>{i + 1} owned</span>
                <span>${r}</span>
              </div>
            ))}
          </div>

          <div className="tooltip-footer">
            <div>Price ${cell.price}</div>
            <div>Mortgage ${cell.mortgage}</div>
          </div>
        </>
      )}

      {cell.type === "tax" && (
        <div className="tooltip-section">
          <div className="tooltip-row">
            <span>Pay</span>
            <span>${cell.amount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
