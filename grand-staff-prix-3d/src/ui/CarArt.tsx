// Clean side-profile car silhouette as inline SVG, tinted per car. Used on the
// garage "stage" and (smaller) as selectable thumbnails — crisp at any size.

export function CarArt({ color, accent, className }: { color: string; accent: string; className?: string }) {
  return (
    <svg viewBox="0 0 240 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`body-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="1" />
          <stop offset="1" stopColor={color} stopOpacity="0.78" />
        </linearGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="120" cy="104" rx="86" ry="9" fill="#000" opacity="0.35" />
      {/* body */}
      <path
        d="M22 84 Q24 64 50 60 L78 58 Q92 42 120 41 Q150 40 168 56 L196 60 Q214 64 218 80 Q219 90 210 92 L30 92 Q21 92 22 84 Z"
        fill={`url(#body-${color})`}
        stroke={accent}
        strokeWidth="2"
      />
      {/* cabin glass */}
      <path d="M92 56 Q104 45 120 45 Q140 45 152 57 L150 60 L96 60 Z" fill="#0c0e16" opacity="0.92" />
      {/* accent stripe */}
      <rect x="40" y="74" width="160" height="5" rx="2.5" fill={accent} opacity="0.9" />
      {/* headlight */}
      <circle cx="208" cy="74" r="4.5" fill="#fff3cf" />
      {/* wheels */}
      <circle cx="74" cy="92" r="18" fill="#14131a" stroke="#2a2933" strokeWidth="3" />
      <circle cx="74" cy="92" r="7" fill={accent} />
      <circle cx="170" cy="92" r="18" fill="#14131a" stroke="#2a2933" strokeWidth="3" />
      <circle cx="170" cy="92" r="7" fill={accent} />
    </svg>
  )
}
