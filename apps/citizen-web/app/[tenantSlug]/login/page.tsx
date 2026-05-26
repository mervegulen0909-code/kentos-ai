import { FirebaseLogin } from './firebase-login';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { tenantSlug } = await params;
  const { redirect: redirectTo } = await searchParams;
  const safeRedirect =
    redirectTo && redirectTo.startsWith(`/${tenantSlug}/`) && !redirectTo.includes('//')
      ? redirectTo
      : `/${tenantSlug}/report`;

  return (
    <main className="wrap">
      <section className="hero">
        <FirebaseLogin tenantSlug={tenantSlug} redirectTo={safeRedirect} />
      </section>
    </main>
  );
}
