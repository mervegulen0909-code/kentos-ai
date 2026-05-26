import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası',
  description: 'KentOS AI vatandaş kanalları için gizlilik, veri işleme ve saklama ilkeleri.',
  alternates: {
    canonical: '/privacy-policy',
  },
};

const sections = [
  {
    title: 'Toplanan veriler',
    body:
      'KentOS AI; başvuru metni, iletişim bilgileri, takip kodu, vatandaşın yüklediği ekler ve oturum güvenliği için gereken sınırlı teknik kayıtları işler.',
  },
  {
    title: 'Veri işleme amacı',
    body:
      'Veriler belediye talep, şikayet ve bilgilendirme süreçlerini yürütmek; vatandaşla aynı başvuru üzerinden güvenli takip sağlamak; audit ve hizmet kalitesi kayıtlarını tutmak için kullanılır.',
  },
  {
    title: 'Saklama ve silme',
    body:
      'Tenant bazlı saklama pencereleri uygulanır. Yetkili operatörler veri dışa aktarma kaydı alabilir; vatandaş ise doğrulanmış oturumu üzerinden kalıcı silme talebi başlatabilir.',
  },
  {
    title: 'Üçüncü taraf hizmetler',
    body:
      'Sistem; kimlik doğrulama, mesajlaşma ve e-posta iletimi gibi alanlarda operatör onaylı servislerle entegre olabilir. Üretim canlı gönderim bayrakları kapalı olduğu sürece dış servisler yalnızca hazırlık veya doğrulama amaçlı kullanılır.',
  },
  {
    title: 'Haklar ve iletişim',
    body:
      'Vatandaş; verilerine erişim, düzeltme, silme ve işleme kapsamını sorma haklarına sahiptir. Resmi başvuru veya destek talebi belediye operatörü tarafından sağlanan destek kanallarından iletilebilir.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="wrap" style={{ paddingBlock: 'clamp(28px, 5vw, 64px)' }}>
      <section className="card" style={{ display: 'grid', gap: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 0 }}>
          KentOS AI
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Gizlilik Politikası</h1>
          <p style={{ margin: 0, color: 'var(--ink-soft)', lineHeight: 1.65 }}>
            Bu sayfa, KentOS AI vatandaş kanallarında işlenen verilerin kapsamını ve temel koruma
            ilkelerini özetler. Uygulama incelemesi ve kamuya açık bilgilendirme yüzeyi olarak
            kullanılabilir.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {sections.map((section) => (
            <section key={section.title} style={{ display: 'grid', gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{section.title}</h2>
              <p style={{ margin: 0, color: 'var(--ink-soft)', lineHeight: 1.7 }}>{section.body}</p>
            </section>
          ))}
        </div>

        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.65 }}>
          Uygulama içi vatandaş akışları ve hesap işlemleri için ana giriş:
          {' '}
          <Link href="/">KentOS AI vatandaş ana sayfası</Link>
        </p>
      </section>
    </main>
  );
}
