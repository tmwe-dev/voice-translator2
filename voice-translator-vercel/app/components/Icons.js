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

// ── Additional icons for RoomView + HomeView ──
export const IconSubtitles = ({ size }) => <I size={size}><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M6 12h2"/><path d="M11 12h6"/><path d="M6 16h8"/></I>;
export const IconExport = ({ size }) => <I size={size}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></I>;
export const IconArchive = ({ size }) => <I size={size}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></I>;
export const IconUser = ({ size }) => <I size={size}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></I>;
export const IconKey = ({ size }) => <I size={size}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></I>;
export const IconCreditCard = ({ size }) => <I size={size}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></I>;
export const IconStar = ({ size }) => <I size={size}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={s}/></I>;
export const IconCrown = ({ size }) => <I size={size}><path d="M2 20h20"/><path d="M4 16l2-12 4 5 2-5 2 5 4-5 2 12z" fill={s} opacity="0.15"/><path d="M4 16l2-12 4 5 2-5 2 5 4-5 2 12z"/></I>;
export const IconZap = ({ size }) => <I size={size}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></I>;
export const IconSparkles = ({ size }) => <I size={size}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75z"/></I>;
export const IconMessageCircle = ({ size }) => <I size={size}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></I>;
export const IconSchool = ({ size }) => <I size={size}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></I>;
export const IconLock = ({ size }) => <I size={size}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></I>;
export const IconHome = ({ size }) => <I size={size}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></I>;
export const IconMegaphone = ({ size }) => <I size={size}><path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 11-5.8-1.6"/></I>;
export const IconSignal = ({ size }) => <I size={size}><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 20V4"/></I>;
export const IconShield = ({ size }) => <I size={size}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></I>;
export const IconGlobe = ({ size }) => <I size={size}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></I>;
export const IconCheckCircle = ({ size }) => <I size={size}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></I>;
export const IconDoor = ({ size }) => <I size={size}><path d="M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2z"/><path d="M15 13h.01"/></I>;
