'use client';

type Props = {
  tenantSlug: string;
};

export function LogoutButton({ tenantSlug }: Props) {
  async function handleLogout() {
    await fetch(`/${tenantSlug}/login/set-session`, { method: 'DELETE' });
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{
        background: 'none',
        border: 0,
        color: 'var(--muted)',
        cursor: 'pointer',
        fontSize: '0.8rem',
        padding: 0,
      }}
    >
      Çıkış
    </button>
  );
}
