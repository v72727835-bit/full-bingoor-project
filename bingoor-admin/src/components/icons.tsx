import React from 'react';

/** Line icons, 24-grid, drawn with currentColor so any parent tints them. */

type P = { size?: number; strokeWidth?: number; className?: string };

const base = (size: number, sw: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: sw,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconDashboard = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="2" />
    <rect x="3" y="15" width="7.5" height="6" rx="2" />
    <rect x="13.5" y="12" width="7.5" height="9" rx="2" />
  </svg>
);

export const IconBolt = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" />
  </svg>
);

export const IconBox = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M21 8.5v7a2 2 0 0 1-1.05 1.76l-7 3.5a2 2 0 0 1-1.9 0l-7-3.5A2 2 0 0 1 3 15.5v-7" />
    <path d="M3.3 7.4 11.05 3.3a2 2 0 0 1 1.9 0l7.75 4.1a1 1 0 0 1 0 1.77l-7.75 4.1a2 2 0 0 1-1.9 0L3.3 9.17a1 1 0 0 1 0-1.77Z" />
  </svg>
);

export const IconImage = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.7" />
    <path d="m21 15.5-4.6-4.6a1.5 1.5 0 0 0-2.1 0L5 20" />
  </svg>
);

export const IconVideo = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m10.5 9.5 4.2 2.5-4.2 2.5Z" />
  </svg>
);

export const IconLayers = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="m12 2.8 9 4.7-9 4.7-9-4.7 9-4.7Z" />
    <path d="m3.5 12.4 8.5 4.4 8.5-4.4" />
    <path d="m3.5 16.9 8.5 4.4 8.5-4.4" />
  </svg>
);

export const IconReceipt = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M5 21V4a1 1 0 0 1 1.5-.87l1.8 1.03a1 1 0 0 0 1 0l1.7-.97a1 1 0 0 1 1 0l1.7.97a1 1 0 0 0 1 0l1.8-1.03A1 1 0 0 1 19 4v17l-2.4-1.4a1 1 0 0 0-1 0l-1.6.9a1 1 0 0 1-1 0l-1.6-.9a1 1 0 0 0-1 0L5 21Z" />
    <path d="M9 8.5h6M9 12.5h6" />
  </svg>
);

export const IconStore = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M3.5 9.5 5 4.2A1.5 1.5 0 0 1 6.45 3h11.1A1.5 1.5 0 0 1 19 4.2l1.5 5.3" />
    <path d="M4.5 9.5h15v10a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-10Z" />
    <path d="M9.5 21v-5.5h5V21" />
  </svg>
);

export const IconRider = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <circle cx="5.5" cy="17.5" r="3.2" />
    <circle cx="18.5" cy="17.5" r="3.2" />
    <path d="M14.5 17.5h-6l3-7.5h-3" />
    <path d="m14.5 6.5 2 3.5h2" />
    <circle cx="16.2" cy="4.2" r="1.3" />
  </svg>
);

export const IconUsers = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <circle cx="9.5" cy="8" r="3.4" />
    <path d="M3.2 20a6.6 6.6 0 0 1 12.6 0" />
    <path d="M17 11.2a3.2 3.2 0 0 0 0-6.2" />
    <path d="M18.4 20h2.4a5.6 5.6 0 0 0-3.6-5.2" />
  </svg>
);

export const IconTag = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M3.5 11.6V5.4A1.9 1.9 0 0 1 5.4 3.5h6.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.5-1.5Z" />
    <circle cx="8" cy="8" r="1.4" />
  </svg>
);

export const IconChart = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M3.5 3.5v15a2 2 0 0 0 2 2h15" />
    <path d="M7.5 15.5v2M11.5 11v6.5M15.5 13.5v4M19.5 7.5v10" />
  </svg>
);

export const IconSettings = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.2 14.4a1.5 1.5 0 0 0 .3 1.65l.05.06a1.8 1.8 0 1 1-2.55 2.55l-.06-.06a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37v.17a1.8 1.8 0 1 1-3.6 0v-.09a1.5 1.5 0 0 0-1-1.37 1.5 1.5 0 0 0-1.65.3l-.06.06A1.8 1.8 0 1 1 4.5 16.2l.06-.06a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9H3.3a1.8 1.8 0 0 1 0-3.6h.09a1.5 1.5 0 0 0 1.37-1 1.5 1.5 0 0 0-.3-1.65L4.4 7.3A1.8 1.8 0 1 1 6.95 4.75l.06.06a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .9-1.37V3.3a1.8 1.8 0 0 1 3.6 0v.09a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.06-.06a1.8 1.8 0 1 1 2.55 2.55l-.06.06a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.9h.17a1.8 1.8 0 0 1 0 3.6h-.09a1.5 1.5 0 0 0-1.37.9Z" />
  </svg>
);

export const IconSearch = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);

export const IconBell = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5Z" />
    <path d="M13.7 20a2 2 0 0 1-3.4 0" />
  </svg>
);

export const IconRefresh = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M20.5 11A8.5 8.5 0 0 0 6 6.2L3.5 8.5" />
    <path d="M3.5 13A8.5 8.5 0 0 0 18 17.8l2.5-2.3" />
    <path d="M3.5 4v4.5H8M20.5 20v-4.5H16" />
  </svg>
);

export const IconRupee = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M7 4h10M7 8.5h10M16 4c0 4-3.2 6-6.5 6H7l7.5 10" />
  </svg>
);

export const IconClock = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.2 2" />
  </svg>
);

export const IconAlert = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 17.2h.01" />
  </svg>
);

export const IconCheck = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.2 12.3 2.6 2.6 5-5.2" />
  </svg>
);

export const IconPlus = ({ size = 18, strokeWidth = 2, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconArrowUp = ({ size = 14, strokeWidth = 2.4, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M12 19V6M6 11.5 12 5l6 6.5" />
  </svg>
);

export const IconArrowDown = ({ size = 14, strokeWidth = 2.4, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M12 5v13M6 12.5 12 19l6-6.5" />
  </svg>
);

export const IconTruck = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M3 6.5h10.5v10H3zM13.5 10h3.7l2.8 3v3.5h-6.5z" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
);

export const IconVolume = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M4 9.5v5h3.3L12 18.5v-13L7.3 9.5H4Z" />
    <path d="M16 9a4.2 4.2 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
  </svg>
);

export const IconVolumeOff = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M4 9.5v5h3.3L12 18.5v-13L7.3 9.5H4Z" />
    <path d="m15.5 9.5 4 4M19.5 9.5l-4 4" />
  </svg>
);

export const IconShield = ({ size = 18, strokeWidth = 1.8, className }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M12 3 5 6v6c0 4.2 2.9 7.8 7 9 4.1-1.2 7-4.8 7-9V6l-7-3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);
