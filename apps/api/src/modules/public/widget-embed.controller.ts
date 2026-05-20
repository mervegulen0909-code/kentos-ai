import { Controller, Get, Inject, NotFoundException, Param, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * F6 — Widget Embed Script
 * GET /public/:tenantSlug/widget.js
 *
 * Returns a self-contained JavaScript snippet that injects a floating
 * chat button into the host page and opens the citizen-web widget
 * in an iframe when clicked.
 *
 * Usage on any belediye web page:
 *   <script src="https://api.belediye.gov.tr/public/ankara/widget.js"></script>
 */
@SkipThrottle()
@ApiTags('public / widget')
@Controller('public/:tenantSlug')
export class WidgetEmbedController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'Belediye web sitesi için embed.js widget betiği' })
  @ApiProduces('application/javascript')
  @Get('widget.js')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async widgetScript(@Param('tenantSlug') tenantSlug: string, @Res() res: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, status: true, widgetEnabled: true, widgetTitle: true, widgetWelcome: true },
    });

    if (!tenant || tenant.status !== 'ACTIVE' || !tenant.widgetEnabled) {
      throw new NotFoundException('Widget bu belediye için aktif değil.');
    }

    const citizenWebOrigin =
      process.env.CITIZEN_WEB_URL?.replace(/\/$/, '') ?? 'https://vatandas.kentos.io';

    const widgetTitle = JSON.stringify(tenant.widgetTitle || 'Bize Yazın');
    const widgetUrl = JSON.stringify(`${citizenWebOrigin}/widget?tenant=${encodeURIComponent(tenantSlug)}`);

    const script = /* javascript */ `
(function () {
  if (window.__kentosWidgetLoaded) return;
  window.__kentosWidgetLoaded = true;

  var TITLE = ${widgetTitle};
  var WIDGET_URL = ${widgetUrl};
  var Z = 2147483647;

  // --- Button ---
  var btn = document.createElement('button');
  btn.id = 'kentos-widget-btn';
  btn.setAttribute('aria-label', TITLE);
  btn.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px',
    'width:56px', 'height:56px', 'border-radius:50%',
    'background:#1D4ED8', 'color:#fff', 'border:none',
    'cursor:pointer', 'box-shadow:0 4px 12px rgba(0,0,0,.25)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'z-index:' + Z, 'font-size:24px', 'transition:transform .2s',
  ].join(';');
  btn.innerHTML = '&#128172;'; // 💬
  btn.onmouseenter = function () { btn.style.transform = 'scale(1.1)'; };
  btn.onmouseleave = function () { btn.style.transform = 'scale(1)'; };

  // --- Iframe container ---
  var container = document.createElement('div');
  container.id = 'kentos-widget-container';
  container.style.cssText = [
    'position:fixed', 'bottom:96px', 'right:24px',
    'width:380px', 'height:580px', 'border-radius:16px',
    'box-shadow:0 8px 32px rgba(0,0,0,.2)', 'overflow:hidden',
    'display:none', 'z-index:' + Z, 'background:#fff',
  ].join(';');

  var iframe = document.createElement('iframe');
  iframe.src = WIDGET_URL;
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  iframe.allow = 'camera; microphone';
  container.appendChild(iframe);

  var open = false;
  btn.onclick = function () {
    open = !open;
    container.style.display = open ? 'block' : 'none';
    btn.innerHTML = open ? '&#10005;' : '&#128172;'; // ✕ / 💬
  };

  // Close when widget signals submission
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'kentos:submitted') {
      open = false;
      container.style.display = 'none';
      btn.innerHTML = '&#128172;';
    }
  });

  document.body.appendChild(btn);
  document.body.appendChild(container);
})();
`.trim();

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min client cache
    res.send(script);
  }
}
