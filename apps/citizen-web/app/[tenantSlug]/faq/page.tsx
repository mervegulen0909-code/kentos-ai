import { notFound } from 'next/navigation';
import { citizenApi } from '../../../lib/api';

export default async function FaqPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { tenantSlug } = await params;
  const { lang } = await searchParams;

  const articles = await citizenApi.faqList(tenantSlug, lang).catch(() => null);
  if (articles === null) return notFound();

  const langLabel: Record<string, string> = { tr: 'Türkçe', en: 'English', ku: 'Kurdî', ar: 'العربية' };
  const langs = ['tr', 'en', 'ku', 'ar'];

  return (
    <main className="wrap">
      <p style={{ color: 'var(--muted)', fontWeight: 700 }}>{tenantSlug} · Bilgi Bankası</p>
      <h1>Sıkça Sorulan Sorular</h1>

      {/* Dil seçimi */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <a href={`/${tenantSlug}/faq`} style={{ fontWeight: !lang ? 700 : 400 }}>Tümü</a>
        {langs.map((l) => (
          <a key={l} href={`/${tenantSlug}/faq?lang=${l}`} style={{ fontWeight: lang === l ? 700 : 400 }}>
            {langLabel[l] ?? l}
          </a>
        ))}
      </div>

      {articles.length === 0 ? (
        <div className="card">
          <p>Bu dilde henüz makale bulunmuyor.</p>
          <a href={`/${tenantSlug}/report`}>Başvuru oluşturun →</a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {articles.map((a) => (
            <a
              key={a.id}
              href={`/${tenantSlug}/faq/${a.slug}${lang ? `?lang=${lang}` : ''}`}
              className="card"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{a.title}</strong>
                <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{a.viewCount} görüntüleme</span>
              </div>
            </a>
          ))}
        </div>
      )}

      <p style={{ marginTop: '2rem', color: 'var(--muted)' }}>
        Aradığınızı bulamadınız mı?{' '}
        <a href={`/${tenantSlug}/report`}>Yeni başvuru oluşturun.</a>
      </p>
    </main>
  );
}
