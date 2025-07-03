"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    label: 'Start',
    href: '/dashboard',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 11.5L12 4l9 7.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7.5Z"/><path d="M9 22V12h6v10"/></svg>
    ),
  },
  {
    label: 'Termine',
    href: '/appointments',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
    ),
  },
  {
    label: 'Zeit',
    href: '/time-tracking',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    ),
  },
  {
    label: 'Telefon',
    href: '/phone',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92V21a1 1 0 0 1-1.09 1A19 19 0 0 1 3 5.09 1 1 0 0 1 4 4h4.09a1 1 0 0 1 1 .75l1.13 4.52a1 1 0 0 1-.29 1L8.91 12.09a16 16 0 0 0 7 7l1.82-1.82a1 1 0 0 1 1-.29l4.52 1.13a1 1 0 0 1 .75 1V21a1 1 0 0 1-1 1z"/></svg>
    ),
  },
  {
    label: 'Profil',
    href: '/profile',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
    ),
  },
];

export default function MobileNavbar() {
  const pathname = usePathname();

  // Hide on /auth routes and desktop/tablet
  if (pathname.startsWith('/auth')) return null;

  // Hide on desktop/tablet
  // Safe area for iOS/Android
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center h-16 bg-[#121212] border-t border-white/10 text-white md:hidden" style={{paddingBottom: 'env(safe-area-inset-bottom)'}}>
      <div className="flex justify-around items-center h-16 w-full">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-2 px-1 transition-colors ${isActive ? 'text-[#ffcb00]' : 'text-white'} hover:text-[#ffcb00] focus:text-[#ffcb00]`}
              aria-label={item.label}
            >
              {item.icon}
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-red-400 hover:bg-red-100/10 transition-colors rounded-xl mt-4"
        onClick={() => {
          localStorage.removeItem('token');
          window.location.href = '/';
        }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1"></path></svg>
        Abmelden
      </button>
    </nav>
  );
}
