export default function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        height: '100%',
        boxSizing: 'border-box',
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="skeleton" style={{ minHeight: 48 }} />
      <div className="skeleton" style={{ minHeight: 48 }} />
      <div className="skeleton" style={{ flex: 1 }} />
    </div>
  );
}
