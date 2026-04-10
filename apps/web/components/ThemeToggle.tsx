'use client';
// components/ThemeToggle.tsx
// Dark-mode toggle: uses `class` strategy on <html> for TailwindCSS dark: support.
// Persists preference in localStorage; defaults to system preference.
// Duolingo pill-style toggle with sun/moon icons.

import { useEffect, useState, useCallback } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    setDark(isDark);
    applyTheme(isDark);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      applyTheme(next);
      return next;
    });
  }, []);

  if (!mounted) {
    return <div className="w-[60px] h-[32px] rounded-full border border-transparent" />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? '切換至淺色模式' : '切換至深色模式'}
      title={dark ? '淺色模式' : '深色模式'}
      className={[
        'relative flex items-center w-[60px] h-[32px]',
        'rounded-full border-2 transition-all duration-300 ease-out',
        'focus-ring',
        dark
          ? 'border-[var(--border)] bg-[#1E293B] shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]'
          : 'border-gray-200 bg-[#E8F5E9] shadow-[2px_2px_0_0_rgba(0,0,0,0.07)]',
      ].join(' ')}
    >
      {/* Track icons */}
      <span className="absolute left-[7px] top-1/2 -translate-y-1/2 text-amber-400 transition-opacity duration-200"
        style={{ opacity: dark ? 0.3 : 0 }}
      >
        <SunIcon size={14} />
      </span>
      <span className="absolute right-[7px] top-1/2 -translate-y-1/2 text-indigo-300 transition-opacity duration-200"
        style={{ opacity: dark ? 0 : 0.3 }}
      >
        <MoonIcon size={14} />
      </span>

      {/* Sliding thumb */}
      <span
        className={[
          'absolute top-[3px] w-[22px] h-[22px] rounded-full',
          'flex items-center justify-center',
          'transition-all duration-300 ease-out',
          'shadow-[1px_1px_0_0_rgba(0,0,0,0.15)]',
          dark
            ? 'left-[33px] bg-[#334155] text-amber-400'
            : 'left-[3px] bg-white text-indigo-500',
        ].join(' ')}
      >
        {dark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
      </span>
    </button>
  );
}

function SunIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function applyTheme(isDark: boolean): void {
  const html = document.documentElement;
  if (isDark) {
    html.classList.add('dark');
    html.setAttribute('data-theme', 'dark');
  } else {
    html.classList.remove('dark');
    html.setAttribute('data-theme', 'light');
  }
}
