import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export function GET() {
  const script = `(() => {
  const currentScript = document.currentScript;
  const tenant = currentScript?.dataset?.tenant;
  if (!tenant) return;

  const origin = new URL(currentScript.src).origin;
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.textContent = currentScript?.dataset?.label || 'Belediye asistanı';
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'kentos-widget-frame');
  launcher.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483646;min-height:48px;border:0;border-radius:999px;padding:0 18px;background:#2a211d;color:#fff;font:700 15px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 18px 48px rgba(42,33,29,.24);cursor:pointer;';

  const frame = document.createElement('iframe');
  frame.id = 'kentos-widget-frame';
  frame.title = 'KentOS belediye asistanı';
  frame.src = origin + '/widget/' + encodeURIComponent(tenant);
  frame.loading = 'lazy';
  frame.hidden = true;
  frame.style.cssText = 'position:fixed;right:20px;bottom:84px;z-index:2147483645;width:min(420px,calc(100vw - 32px));height:min(680px,calc(100dvh - 112px));border:0;border-radius:28px;box-shadow:0 28px 90px rgba(42,33,29,.28);background:#fff;';

  launcher.addEventListener('click', () => {
    const nextOpen = frame.hidden;
    frame.hidden = !nextOpen;
    launcher.setAttribute('aria-expanded', String(nextOpen));
    launcher.textContent = nextOpen ? 'Asistanı kapat' : (currentScript?.dataset?.label || 'Belediye asistanı');
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.body.append(frame, launcher);
  }, { once: true });

  if (document.body) document.body.append(frame, launcher);
})();`;

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
