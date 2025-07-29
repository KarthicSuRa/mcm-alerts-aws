import React from 'react';

interface IconProps {
  name: string;
  className?: string;
}

const icons: { [key: string]: React.ReactNode } = {
  mcmLogo: (
    <img 
      src="/icons/icon-192x192.png" 
      alt="MCM Logo" 
      className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:w-14 xl:w-16 xl:h-16 object-contain"
    />
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" strokeWidth="0" />,
  sun: <><circle cx="12" cy="12" r="5" fill="currentColor" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  settings: <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39 1.02a7.65 7.65 0 0 0-1.64-.94l-.38-2.61a.5.5 0 0 0-.5-.44H9.24a.5.5 0 0 0-.5.44l-.38 2.61a7.65 7.65 0 0 0-1.64-.94l-2.39-1.02a.5.5 0 0 0-.61.22l-1.92 3.32a.5.5 0 0 0 .12.61l2.03 1.58c-.04.3-.06.61-.06.94s.02.64.06.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32a.5.5 0 0 0 .61.22l2.39-1.02a7.65 7.65 0 0 0 1.64.94l.38 2.61a.5.5 0 0 0 .5.44h3.52a.5.5 0 0 0 .5-.44l.38-2.61a7.65 7.65 0 0 0 1.64.94l2.39 1.02a.5.5 0 0 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" fill="currentColor" strokeWidth="0"/>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" fill="currentColor" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></>,
  dashboard: <><path d="M12 3H3v18h18V12" /><path d="M21 3h-9v9" /><path d="m13 11 8-8" /></>,
  docs: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></>,
  logs: <><path d="M10 21h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" /><path d="M7 21h10" /><path d="M12 15h.01" /><path d="M12 11h.01" /><path d="M12 7h.01" /></>,
  send: <path d="M22 2L2 9l9 4 4 9 7-20z" fill="currentColor" strokeWidth="0" />,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  copy: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect width="8" height="4" x="8" y="2" rx="1" ry="1" fill="currentColor" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  monitor: <><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></>,
  alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" strokeWidth="0" />,
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" strokeWidth="0" />,
  arrowLeft: <><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" fill="currentColor" strokeWidth="0" />,
  pieChart: <><path d="M21.21 15.89A10 10 0 1 1 8 2.83" fill="currentColor" strokeWidth="0" /><path d="M22 12A10 10 0 0 0 12 2v10z" fill="currentColor" strokeWidth="0" /></>,
  lineChart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>,
  messageSquare: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  comment: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="currentColor" strokeWidth="0" />,
  barChart: <><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20V16" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01"/></>,
  'alert-circle': <><circle cx="12" cy="12" r="10" fill="currentColor" strokeWidth="0"/><line x1="12" x2="12" y1="8" y2="12" stroke="white" strokeWidth="2"/><line x1="12" x2="12.01" y1="16" y2="16" stroke="white" strokeWidth="2.5"/></>,
  'check-circle': <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" fill="currentColor"/><path d="m9 17 2 2 4-4" stroke="white" fill="none"/></>,
  'shield-check': <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" strokeWidth="0"/><path d="m9 12 2 2 4-4" stroke="white" fill="none"/></>,
  'refresh-cw': <><path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8"/><path d="M21 22v-6h-6"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/></>,
  clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  'trending-up': <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></>,
  layers: <><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polygon points="2 17 12 22 22 17"></polygon><polygon points="2 12 12 17 22 12"></polygon></>
};

export const Icon: React.FC<IconProps> = ({ name, className = 'w-6 h-6' }) => {
  const icon = icons[name];
  if (name === 'mcmLogo') {
    return (
      <div className={className}>
        {icon}
      </div>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {icon}
    </svg>
  );
};
