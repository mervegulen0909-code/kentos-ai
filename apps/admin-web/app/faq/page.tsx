import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';
import { createFaqAction, deleteFaqAction, toggleFaqPublishAction } from './actions';

const langLabels: Record<string, string> = { tr: 'Turkce', en: 'Ingilizce', ku: 'Kurtce', ar: 'Arapca' };

export default async function FaqPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;

  const articles = token
    ? await adminApi.faqArticles(token, params.lang).catch(() => [])
    : [];

  return (
    <AdminShell hasSession={Boolean(token)} role={role}>
      <p className="badge">Bilgi Bankasi · FAQ yonetimi</p>
      <h1>Bilgi Bankasi</h1>
      <p style={{ color: 'var(--muted)' }}>
        Vatandaslara yonelik sikca sorulan sorular. Yayinlanan makaleler herkese acik portalde goruntulenir.
        Cok dilli icerik icin ayni slug farkli dilde tekrar eklenebilir.
      </p>

      {/* Language filter */}
      <form className="filter-grid" style={{ marginTop: 12 }}>
        <label>
          Dil filtresi
          <select name="lang" defaultValue={params.lang ?? ''}>
            <option value="">Tum diller</option>
            {Object.entries(langLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div style={{ marginTop: '1.2rem' }}>
          <button type="submit">Filtrele</button>
        </div>
      </form>

      {/* New article form */}
      <section className="card" style={{ marginTop: 18 }}>
        <h2>Yeni Makale</h2>
        <form action={createFaqAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label>
            Baslik
            <input name="title" required placeholder="Makale basligi" />
          </label>
          <label>
            Slug (URL)
            <input name="slug" required placeholder="su-sayaci-nasil-okunur" />
          </label>
          <label>
            Icerik
            <textarea name="body" required rows={6} placeholder="Markdown desteklenir..." />
          </label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label>
              Dil
              <select name="lang" defaultValue="tr">
                {Object.entries(langLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.2rem' }}>
              <input type="checkbox" name="isPublished" />
              Hemen yayinla
            </label>
          </div>
          <button type="submit" style={{ alignSelf: 'flex-start' }}>Makale Ekle</button>
        </form>
      </section>

      {/* Article list */}
      <section className="card" style={{ marginTop: 18 }}>
        <h2>Makaleler ({articles.length})</h2>
        {articles.length === 0 ? (
          <p className="muted">Makale bulunamadi.</p>
        ) : (
          <div className="responsive-list">
            {articles.map((a) => (
              <div className="queue-row" key={a.id}>
                <div style={{ flex: 1 }}>
                  <strong>{a.title}</strong>
                  <span style={{ color: 'var(--muted)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                    /{a.slug} · {langLabels[a.lang] ?? a.lang}
                  </span>
                </div>
                <span style={{ color: a.isPublished ? 'var(--accent)' : 'var(--muted)', fontSize: '0.8rem' }}>
                  {a.isPublished ? 'Yayinda' : 'Taslak'}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{a.viewCount} goruntuleme</span>
                <form action={toggleFaqPublishAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="isPublished" value={String(a.isPublished)} />
                  <button type="submit" style={{ fontSize: '0.75rem' }}>
                    {a.isPublished ? 'Taslaga Al' : 'Yayinla'}
                  </button>
                </form>
                <form action={deleteFaqAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>Sil</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
