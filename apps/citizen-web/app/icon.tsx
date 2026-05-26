import { ImageResponse } from 'next/og';

export const size = {
  width: 1024,
  height: 1024,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(160deg, #0f172a 0%, #13315c 48%, #1d4ed8 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: 800,
            height: 800,
            borderRadius: 180,
            border: '18px solid rgba(248,250,252,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 40px 120px rgba(15,23,42,0.35)',
            background: 'rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
            }}
          >
            <div style={{ fontSize: 300, fontWeight: 800, lineHeight: 1 }}>K</div>
            <div
              style={{
                fontSize: 88,
                fontWeight: 700,
                letterSpacing: 10,
                textTransform: 'uppercase',
              }}
            >
              KentOS AI
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
