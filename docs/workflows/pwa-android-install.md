# Android PWA USB Install Flow

This runbook installs the citizen web app as a PWA on a USB-connected Android phone.

## Current repo readiness

The citizen app now exposes an installable web app manifest at [`/manifest.webmanifest`](apps/citizen-web/app/manifest.ts:3), registers a service worker through [`PwaRegister`](apps/citizen-web/app/components/pwa-register.tsx:5), and serves offline shell caching from [`sw.js`](apps/citizen-web/public/sw.js). The root metadata is wired in [`RootLayout`](apps/citizen-web/app/layout.tsx:6).

Verified locally:

- [`pnpm --filter @kentos/citizen-web typecheck`](apps/citizen-web/package.json:10)
- [`pnpm --filter @kentos/citizen-web build`](apps/citizen-web/package.json:7)

## External blocker

`adb` is not installed on this Windows machine, so USB device verification cannot be automated yet. The command [`adb version`](docs/workflows/pwa-android-install.md) currently fails with:

```text
'adb' is not recognized as an internal or external command,
operable program or batch file.
```

## One-time workstation setup

Install Android Platform Tools so [`adb`](docs/workflows/pwa-android-install.md) is available in [`cmd.exe`](docs/workflows/pwa-android-install.md).

On Windows:

1. Download Android SDK Platform Tools from the official Android developer site.
2. Extract them to a stable path such as `C:\Android\platform-tools`.
3. Add that folder to the system `Path`.
4. Open a new terminal and verify with `adb version`.

## One-time phone setup

1. Connect the Android phone over USB.
2. Enable Developer Options.
3. Enable USB debugging.
4. Accept the host trust prompt on the phone.
5. Verify the device appears with `adb devices`.

Expected device state:

```text
List of devices attached
<serial>    device
```

If the device shows `unauthorized`, unlock the phone and accept the RSA prompt.

## Start the local stack for phone access

The phone must be able to reach the citizen app over your local network or through USB reverse tunneling.

Start the citizen app and API with host-bound URLs:

```bash
set NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3100/api/v1 && pnpm --filter @kentos/api dev
```

In a second terminal:

```bash
set NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3100/api/v1 && pnpm --filter @kentos/citizen-web exec next dev --hostname 0.0.0.0 -p 3002
```

## USB reverse method

This is the most reliable path when the phone is physically connected.

Run:

```bash
adb reverse tcp:3002 tcp:3002
adb reverse tcp:3100 tcp:3100
```

Then open this URL on the Android phone in Chrome:

```text
http://127.0.0.1:3002/demo-belediye/report
```

Because [`NEXT_PUBLIC_API_BASE_URL`](apps/citizen-web/lib/api.ts:1) points to `http://127.0.0.1:3100/api/v1`, the reversed API port keeps the citizen flow working from the phone.

## Install as PWA on Android

1. Open Chrome on the phone at `http://127.0.0.1:3002/demo-belediye/report`.
2. Wait for the page to finish loading once so the service worker can register.
3. Open the Chrome menu.
4. Tap `Install app` or `Add to Home screen`.
5. Confirm the install prompt.
6. Launch the installed app from the launcher/home screen.

## Smoke checks on device

Run these checks after installation:

1. Open the installed PWA and confirm it launches in standalone mode without browser tabs.
2. Submit a citizen report and confirm redirect to [`/[tenantSlug]/ticket/[trackingToken]`](apps/citizen-web/app/[tenantSlug]/ticket/[trackingToken]/page.tsx:56).
3. Copy the generated `TK-...` token.
4. Open the tracking screen and confirm the same token resolves through [`trackTicketAction`](apps/citizen-web/app/[tenantSlug]/track/actions.ts:6).
5. Submit a legacy `KNT-2026-0001` value and confirm the Turkish format error on [`TrackPage`](apps/citizen-web/app/[tenantSlug]/track/page.tsx:18).
6. Turn off network temporarily and reopen the installed app; confirm at least the cached shell can load.

## Notes

- The manifest currently uses vector icons from [`icon.svg`](apps/citizen-web/public/icon.svg) and [`icon-maskable.svg`](apps/citizen-web/public/icon-maskable.svg). This is adequate for installability, though a future polish pass can add dedicated PNG sizes for launcher fidelity.
- The offline behavior is intentionally minimal and should not be treated as a full offline-first citizen workflow.
