import { notFound } from 'next/navigation';
import { citizenApi } from '../../../../lib/api';

export default async function FaqArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { tenantSlug, slug } = await params;
  const { lang } = await searchParams;

  const article = await citizenApi.faqArticle(tenantSlug, slug, lang).catch(() => null);
  if (!article) return notFound();

  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <nav style={{ marginBottom: '1.5rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
        <a href={`/${tenantSlug}/faq`}>← Bilgi Bankası</a>
      </nav>

      <article className="card">
        <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
          {new Date(article.createdAt).toLocaleDateString('tr-TR')} · {article.viewCount} görüntüleme
        </p>
        <h1 style={{ marginBottom: '1.5rem' }}>{article.title}</h1>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{article.body}</div>
      </article>

      <p style={{ marginTop: '2rem', color: 'var(--muted)' }}>
        Bu bilgi sorunuzu çözmedi mi?{' '}
        <a href={`/${tenantSlug}/report`}>Yeni başvuru oluşturun.</a>
      </p>
    </main>
  );
}
