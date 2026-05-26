import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Veri Silme Talimatlari',
  description: 'KentOS AI vatandas uygulamasi icin kullanici verisi silme talimatlari.',
  alternates: {
    canonical: '/data-deletion',
  },
};

export default function DataDeletionPage() {
  return (
    <main className="wrap" style={{ paddingBlock: 'clamp(28px, 5vw, 64px)' }}>
      <section className="card" style={{ display: 'grid', gap: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 0 }}>
          KentOS AI
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Veri Silme Talimatlari</h1>
          <p style={{ margin: 0, color: 'var(--ink-soft)', lineHeight: 1.65 }}>
            Vatandas hesabina ait verileri silmek isteyen kullanicilar, dogrulanmis oturum
            uzerinden self-servis silme akisina ulasabilir veya belediye operatorune resmi talep
            iletebilir.
          </p>
        </div>

        <section style={{ display: 'grid', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Uygulama icinden silme</h2>
          <p style={{ margin: 0, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
            Giris yapmis vatandaslar hesap alaninda yer alan kalici silme akisini kullanabilir.
            Sistem, talebi audit kaydina yazar ve ilgili vatandas verisini tanimli retention ve
            anonymization kurallarina gore temizler.
          </p>
        </section>

        <section style={{ display: 'grid', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Destek kanali uzerinden silme</h2>
          <p style={{ margin: 0, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
            Kullanici uygulama icinde oturum acamiyorsa, belediye destek kanali uzerinden resmi
            silme talebi iletebilir. Operator, kimlik dogrulama sonrasinda ayni silme surecini
            baslatir.
          </p>
        </section>

        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.65 }}>
          Gizlilik kapsami icin
          {' '}
          <Link href="/privacy-policy">Gizlilik Politikasi</Link>
          {' '}
          sayfasina donun.
        </p>
      </section>
    </main>
  );
}
