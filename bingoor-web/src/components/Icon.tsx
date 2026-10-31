/**
 * Line icons drawn on a 24px grid with a single 1.75 stroke weight, so the
 * whole interface shares one drawing hand. Emoji were tempting but they render
 * differently on every OS and immediately look unconsidered.
 */
import React from 'react';

export type IconName =
  | 'home'
  | 'play'
  | 'image'
  | 'grid'
  | 'search'
  | 'cart'
  | 'user'
  | 'moon'
  | 'sun'
  | 'heart'
  | 'heart-fill'
  | 'pin'
  | 'package'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-right'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'star'
  | 'star-fill'
  | 'check'
  | 'check-circle'
  | 'x'
  | 'clock'
  | 'truck'
  | 'wallet'
  | 'shield'
  | 'logout'
  | 'edit'
  | 'lock'
  | 'phone'
  | 'store'
  | 'info'
  | 'alert'
  | 'sliders'
  | 'download'
  | 'bolt'
  | 'leaf'
  | 'tag'
  | 'repeat'
  | 'gift'
  | 'bell'
  | 'chat'
  | 'share'
  | 'copy'
  | 'zoom-in'
  | 'whatsapp'
  | 'facebook'
  | 'twitter'
  | 'eye'
  | 'eye-off'
  | 'rupee'
  | 'android'
  | 'apple';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  cart: (
    <>
      <path d="M3 5h2.2l2.3 10.2a1.5 1.5 0 0 0 1.5 1.2h8.3a1.5 1.5 0 0 0 1.5-1.2L20.5 8H6" />
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="17.5" cy="20" r="1.3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" />
    </>
  ),
  moon: <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  'heart-fill': (
    <path
      d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"
      fill="currentColor"
      stroke="none"
    />
  ),
  pin: (
    <>
      <path d="M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.3" />
    </>
  ),
  package: (
    <>
      <path d="M12 3 20 7v10l-8 4-8-4V7z" />
      <path d="M4 7l8 4 8-4M12 11v10" />
    </>
  ),
  'chevron-left': <path d="m14.5 6-5.5 6 5.5 6" />,
  'chevron-right': <path d="m9.5 6 5.5 6-5.5 6" />,
  'chevron-down': <path d="m6 9.5 6 5.5 6-5.5" />,
  'arrow-right': <path d="M4.5 12h14m-5.5-5.5L18.5 12 13 17.5" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  minus: <path d="M5.5 12h13" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <path d="M6.5 7l.9 11.4a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </>
  ),
  star: <path d="m12 4 2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.8 9.6 9z" />,
  'star-fill': (
    <path d="m12 4 2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.8 9.6 9z" fill="currentColor" stroke="none" />
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.2 12.3 2.6 2.6 5-5.4" />
    </>
  ),
  x: <path d="m6.5 6.5 11 11m0-11-11 11" />,
  play: <path d="M8 5.5v13l11-6.5Z" />,
  image: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m21 16-4.6-4.6a1.5 1.5 0 0 0-2.1 0L5.5 19.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </>
  ),
  truck: (
    <>
      <path d="M2.5 7.5h10v8h-10zM12.5 10.5h4l3 3v2h-7z" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="16.5" cy="18" r="1.6" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.5" y="6" width="17" height="12.5" rx="2.5" />
      <path d="M3.5 10.5h17M15.5 14.2h2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.4c0 4.2-2.9 7.3-7 9.1-4.1-1.8-7-4.9-7-9.1V6z" />
      <path d="m9 12 2.2 2.2L15.2 10" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 4.5h-8a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h8" />
      <path d="M11 12h9m-3.5-3.5L20 12l-3.5 3.5" />
    </>
  ),
  edit: <path d="M4.5 19.5h4L19 9a2.1 2.1 0 0 0-3-3L4.5 17.5zM15 7l2 2" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />,
  store: (
    <>
      <path d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" />
      <path d="M3 9.5 5 4.5h14l2 5a3 3 0 0 1-5.6 1.6 3 3 0 0 1-5.4 0A3 3 0 0 1 3 9.5z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4M12 16.8v.4" />
    </>
  ),
  sliders: (
    <>
      <path d="M5 7.5h14M5 12h14M5 16.5h14" />
      <circle cx="9" cy="7.5" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="16.5" r="1.8" fill="currentColor" stroke="none" />
    </>
  ),
  download: <path d="M12 4v10m-4-3.5L12 14.5l4-4M5 19.5h14" />,
  bolt: <path d="M13.5 3 6 13.5h4.5L10 21l7.5-10.5H13z" />,
  leaf: <path d="M20 4C10 4 5 8 5 14a5 5 0 0 0 5 5c6 0 10-5 10-15zM5.5 19.5 14 11" />,
  tag: (
    <>
      <path d="M11 3.5H20v8.5l-9 9-8.5-8.5z" />
      <circle cx="15.8" cy="8.2" r="1.5" />
    </>
  ),
  repeat: <path d="M4.5 10V8a2 2 0 0 1 2-2H18m0 0-3-3m3 3-3 3M19.5 14v2a2 2 0 0 1-2 2H6m0 0 3 3m-3-3 3-3" />,
  gift: (
    <>
      <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M3 7h18v3H3zM12 7v13" />
      <path d="M12 7S10.5 3.5 8.5 3.5a2 2 0 0 0 0 3.5zM12 7s1.5-3.5 3.5-3.5a2 2 0 0 1 0 3.5z" />
    </>
  ),
  bell: <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10zM10 19a2 2 0 0 0 4 0" />,
  chat: <path d="M20 12c0 3.9-3.6 7-8 7a9 9 0 0 1-2.6-.4L5 20l1.2-3.3A6.6 6.6 0 0 1 4 12c0-3.9 3.6-7 8-7s8 3.1 8 7z" />,
  share: (
    <>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="m8.2 10.8 7.6-4m-7.6 6.4 7.6 4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15" />
    </>
  ),
  'zoom-in': (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8M10.5 7.8v5.4M7.8 10.5h5.4" />
    </>
  ),
  /* The brand marks are filled silhouettes - a 1.75 stroke cannot carry them. */
  whatsapp: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12.04 2.5a9.4 9.4 0 0 0-8.03 14.26L2.5 21.5l4.88-1.46A9.4 9.4 0 1 0 12.04 2.5m0 1.7a7.7 7.7 0 0 1 0 15.4 7.7 7.7 0 0 1-4.08-1.17l-.33-.2-2.6.78.78-2.53-.21-.34A7.7 7.7 0 0 1 12.04 4.2m-3.5 3.6c-.18 0-.47.07-.72.34-.25.27-.95.93-.95 2.25s.97 2.6 1.1 2.78c.14.18 1.9 3.02 4.68 4.1 2.3.9 2.77.72 3.27.67.5-.04 1.6-.65 1.83-1.29.22-.63.22-1.17.16-1.28-.07-.11-.25-.18-.52-.31l-1.8-.87c-.24-.09-.42-.13-.6.14l-.57.86c-.13.18-.25.2-.47.07-.22-.11-.95-.35-1.8-1.11-.67-.6-1.12-1.33-1.25-1.55-.13-.23-.01-.35.1-.46l.35-.4c.11-.14.16-.23.24-.39.08-.16.04-.3-.02-.42l-.78-1.88c-.2-.49-.4-.42-.57-.43z"
    />
  ),
  facebook: (
    <path
      fill="currentColor"
      stroke="none"
      d="M13.5 21v-7.5h2.6l.4-3h-3V8.8c0-.87.24-1.46 1.49-1.46h1.59V4.65A21 21 0 0 0 14.76 4.5c-2.3 0-3.86 1.4-3.86 3.98v2.02H8.3v3h2.6V21z"
    />
  ),
  twitter: (
    <path
      fill="currentColor"
      stroke="none"
      d="M17.2 3.5h3.08l-6.73 7.7 7.92 10.3h-6.2l-4.86-6.35-5.55 6.35H1.78l7.2-8.23L1.38 3.5h6.35l4.52 5.97zm-1.08 16.1h1.7L6.3 5.2H4.47z"
    />
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M9.9 5.8A8.9 8.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16.6 16.6 0 0 1-3 3.8M6.5 7.7A16.4 16.4 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1" />
      <path d="M9.8 9.9a3.2 3.2 0 0 0 4.4 4.4M3.5 3.5l17 17" />
    </>
  ),
  rupee: <path d="M7 4h10M7 9h10M16 4c0 3.6-2.6 5-6.5 5H7l7.5 11" />,
  android: (
    <>
      <path d="M5 11a7 7 0 0 1 14 0zM5 11h14v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
      <path d="m7.5 6 1.2 2m6.8-2-1.2 2" />
      <circle cx="9.5" cy="8.5" r=".6" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="8.5" r=".6" fill="currentColor" stroke="none" />
    </>
  ),
  apple: (
    <path
      fill="currentColor"
      stroke="none"
      d="M16.1 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.2.8s-1.7-.8-2.8-.8c-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.6.7 2.7.7c1.1 0 1.9-1.1 2.6-2.1.5-.7.7-1.1 1.1-2-2.8-1.1-2.3-4-2.3-4zM14.3 6.6c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.7-1 1.7-.9 2.6 1 .1 2-.5 2.6-1.2z"
    />
  ),
};

export function Icon({
  name,
  size = 20,
  className,
  strokeWidth = 1.75,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
