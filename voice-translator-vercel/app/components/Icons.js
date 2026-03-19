// ═══════════════════════════════════════════════
// Modern SVG Icons — Monochromatic, scalable, consistent
//
// All icons are inline SVG components with:
// - currentColor fill (inherits from parent)
// - Configurable size (default 20px)
// - Clean, minimal line style (2px stroke)
// - No emoji — professional look on all platforms
// ═══════════════════════════════════════════════

const d = 'none';
const s = 'currentColor';
const r = 'round';

// Helper: wraps an SVG path in a consistent container
function I({ size = 20, children, style, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={s}
      strokeWidth="2" strokeLinecap={r} strokeLinejoin={r}
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }} {...props}>
      {children}
    </svg>
  );
}

// ── Navigation ──
export const IconBack = ({ size }) => <I size={size}><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></I>;
export const IconClose = ({ size }) => <I size={size}><path d="M18 6L6 18"/><path d="M6 6l12 12"/></I>;
export const IconChevronDown = ({ size }) => <I size={size}><path d="M6 9l6 6 6-6"/></I>;
export const IconExpand = ({ size }) => <I size={size}><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></I>;
export const IconMinimize = ({ size }) => <I size={size}><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></I>;

// ── Media Controls ──
export const IconMic = ({ size }) => <I size={size}><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><path d="M12 19v4"/><path d="M8 23h8"/></I>;
export const IconMicOff = ({ size }) => <I size={size}><path d="M1 1l22 22"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .87-.16 1.7-.45 2.47"/><path d="M12 19v4"/><path d="M8 23h8"/></I>;
export const IconCamera = ({ size }) => <I size={size}><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></I>;
export const IconCameraOff = ({ size }) => <I size={size}><path d="M1 1l22 22"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h8a2 2 0 012 2v8m0 4v1"/></I>;
export const IconFlipCamera = ({ size }) => <I size={size}><path d="M11 19H4a2 2 0 01-2-2V7a2 2 0 012-2h5"/><path d="M13 5h7a2 2 0 012 2v10a2 2 0 01-2 2h-5"/><path d="M14 15l-3 3 3 3"/><path d="M10 9l3-3-3-3"/></I>;
export const IconPlay = ({ size }) => <I size={size}><polygon points="5 3 19 12 5 21 5 3" fill={s} stroke={d}/></I>;
export const IconStop = ({ size }) => <I size={size}><rect x="4" y="4" width="16" height="16" rx="2" fill={s} stroke={d}/></I>;
export const IconVolume = ({ size }) => <I size={size}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></I>;
export const IconVolumeOff = ({ size }) => <I size={size}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M23 9l-6 6"/><path d="M17 9l6 6"/></I>;
export const IconVolumeLow = ({ size }) => <I size={size}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></I>;

// ── Phone ──
export const IconPhoneOff = ({ size }) => <I size={size}><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91"/><path d="M1 1l22 22"/></I>;

// ── Communication ──
export const IconSend = ({ size }) => <I size={size}><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4z"/></I>;
export const IconCheck = ({ size }) => <I size={size}><path d="M20 6L9 17l-5-5"/></I>;
export const IconCheckDouble = ({ size }) => <I size={size}><path d="M18 6L9 17l-1.5-1.5"/><path d="M22 6L13 17"/><path d="M2 12l5 5"/></I>;

// ── Status & Info ──
export const IconWarning = ({ size }) => <I size={size}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></I>;
export const IconSettings = ({ size }) => <I size={size}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></I>;
export const IconLoader = ({ size }) => <I size={size} style={{animation:'vtSpin 1s linear infinite'}}><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></I>;
export const IconMoreVertical = ({ size }) => <I size={size}><circle cx="12" cy="12" r="1" fill={s}/><circle cx="12" cy="5" r="1" fill={s}/><circle cx="12" cy="19" r="1" fill={s}/></I>;

// ── Recording ──
export const IconRecord = ({ size }) => <I size={size}><circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.9"/></I>;
export const IconListening = ({ size }) => <I size={size}><path d="M2 12h2"/><path d="M6 8v8"/><path d="M10 5v14"/><path d="M14 8v8"/><path d="M18 6v12"/><path d="M22 10v4"/></I>;

// ── Files & Misc ──
export const IconSave = ({ size }) => <I size={size}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></I>;
export const IconClipboard = ({ size }) => <I size={size}><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></I>;
export const IconMusic = ({ size }) => <I size={size}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></I>;
export const IconBattery = ({ size }) => <I size={size}><rect x="1" y="6" width="18" height="12" rx="2" ry="2"/><path d="M23 13v-2"/></I>;
export const IconSwap = ({ size }) => <I size={size}><path d="M16 3l4 4-4 4"/><path d="M20 7H4"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h16"/></I>;
export const IconKeyboard = ({ size }) => <I size={size}><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/></I>;
