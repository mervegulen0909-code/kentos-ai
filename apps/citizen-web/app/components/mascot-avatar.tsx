/**
 * KentBot — belediye dijital asistan maskotu (inline SVG).
 * Saf SVG + CSS animasyon (sıfır bağımlılık). Yeşil temaya uyumlu.
 * `talking` true iken ağız animasyonu, hover/idle animasyonları CSS'te.
 */
export function MascotAvatar({
  size = 44,
  talking = false,
  className,
}: {
  size?: number;
  talking?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Belediye dijital asistanı"
      className={`mascot-svg${talking ? ' is-talking' : ''}${className ? ` ${className}` : ''}`}
    >
      {/* anten */}
      <line x1="32" y1="6" x2="32" y2="13" stroke="oklch(33% 0.11 146)" strokeWidth="2.4" strokeLinecap="round" />
      <circle className="mascot-antenna-dot" cx="32" cy="5" r="3.2" fill="oklch(72% 0.17 150)" />

      {/* baş/gövde */}
      <rect x="9" y="12" width="46" height="40" rx="13" fill="url(#mascotBody)" stroke="oklch(33% 0.11 146)" strokeWidth="2" />
      {/* yüz ekranı */}
      <rect x="15" y="18" width="34" height="26" rx="9" fill="oklch(98% 0.02 150)" />

      {/* gözler */}
      <g className="mascot-eyes" fill="oklch(30% 0.08 220)">
        <circle className="mascot-eye" cx="26" cy="29" r="3.4" />
        <circle className="mascot-eye" cx="38" cy="29" r="3.4" />
      </g>
      {/* yanak */}
      <circle cx="21" cy="35" r="2.2" fill="oklch(80% 0.12 30 / 0.55)" />
      <circle cx="43" cy="35" r="2.2" fill="oklch(80% 0.12 30 / 0.55)" />

      {/* ağız (gülümseme / konuşma) */}
      <path className="mascot-mouth" d="M26 37 Q32 41 38 37" stroke="oklch(33% 0.11 146)" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* kulaklık/yan düğmeler — destek hattı çağrışımı */}
      <rect x="5" y="27" width="5" height="11" rx="2.5" fill="oklch(45% 0.12 150)" />
      <rect x="54" y="27" width="5" height="11" rx="2.5" fill="oklch(45% 0.12 150)" />

      <defs>
        <linearGradient id="mascotBody" x1="9" y1="12" x2="55" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(63% 0.14 152)" />
          <stop offset="1" stopColor="oklch(50% 0.13 150)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
