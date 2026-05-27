export default function Loading() {
  return (
    <main className="wrap" aria-busy="true" aria-live="polite">
      <div className="card" style={{ display: 'grid', gap: 16, maxWidth: 720, margin: '0 auto' }}>
        <div className="skeleton" />
        <div className="skeleton" style={{ minHeight: 120 }} />
        <div className="skeleton" style={{ minHeight: 52 }} />
      </div>
    </main>
  );
}
