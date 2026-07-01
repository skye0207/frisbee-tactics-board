export default function MiniField({ frame, className = '', orientation = 'horizontal' }) {
  const isVertical = orientation === 'vertical';
  return (
    <div className={`mini-field ${isVertical ? 'mini-field--vertical' : ''} ${className}`}>
      <div className="mini-field__endzone mini-field__endzone--left" />
      <div className="mini-field__endzone mini-field__endzone--right" />
      <div className="mini-field__midline" />
      {(frame?.pieces || []).map((piece) => (
        <span
          key={piece.id}
          className={`mini-piece mini-piece--${piece.type}`}
          style={isVertical
            ? { left: `${(piece.y / 60) * 100}%`, top: `${piece.x}%` }
            : { left: `${piece.x}%`, top: `${(piece.y / 60) * 100}%` }}
        />
      ))}
    </div>
  );
}
