export default function Loading() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Načítám">
      <div className="sk sk-h" />
      <div className="stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sk sk-stat" />
        ))}
      </div>
      <div className="sk sk-panel" />
    </div>
  );
}
