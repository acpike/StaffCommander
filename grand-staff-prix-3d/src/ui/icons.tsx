// Shared inline SVG icons (stroke = currentColor).

export const Icon = {
  play: (
    <svg className="ico" viewBox="0 0 24 24">
      <path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" />
    </svg>
  ),
  chevDown: (
    <svg className="ico" viewBox="0 0 24 24">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  back: (
    <svg className="ico" viewBox="0 0 24 24">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  plus: (
    <svg className="ico" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  trophy: (
    <svg className="ico" viewBox="0 0 24 24">
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
      <path d="M10 15h4M9 19h6M12 15v4" />
    </svg>
  ),
  music: (
    <svg className="ico" viewBox="0 0 24 24">
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  ),
  lock: (
    <svg className="ico" viewBox="0 0 24 24">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  trash: (
    <svg className="ico" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  ),
  keys: (
    <svg className="ico" viewBox="0 0 24 24">
      <rect x="3" y="8" width="18" height="11" rx="2" />
      <path d="M7 12h.01M11 12h.01M15 12h.01M8 16h8" />
    </svg>
  ),
  touch: (
    <svg className="ico" viewBox="0 0 24 24">
      <path d="M9 11V6a2 2 0 0 1 4 0v5" />
      <path d="M13 8a2 2 0 0 1 4 0v6a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-2.5-3.5a1.6 1.6 0 0 1 2.4-2L8 14" />
    </svg>
  ),
  tilt: (
    <svg className="ico" viewBox="0 0 24 24">
      <rect x="7" y="3" width="10" height="18" rx="2" transform="rotate(15 12 12)" />
    </svg>
  ),
  // side quests — a pennant flag on a pole
  quest: (
    <svg className="ico" viewBox="0 0 24 24">
      <path d="M6 21V4" />
      <path d="M6 5h11l-2.5 3.5L17 12H6z" />
    </svg>
  ),
  // create-a-level — a pencil
  create: (
    <svg className="ico" viewBox="0 0 24 24">
      <path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17z" />
      <path d="M14 7l3 3" />
    </svg>
  ),
}
