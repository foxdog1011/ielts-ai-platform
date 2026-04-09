'use client';
// components/ThemeToggle.tsx
// Dark-mode toggle: uses `class` strategy on <html> for TailwindCSS dark: support.
// Persists preference in localStorage; defaults to system preference.

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
    return <div className="w-9 h-9 rounded-xl border border-transparent" />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={[
        'relative flex items-center justify-center w-9 h-9',
        'rounded-xl border theme-transition focus-ring',
        dark
          ? 'border-[var(--border)] bg-[var(--surface)] text-amber-400 hover:bg-[var(--surface-raised)]'
          : 'border-zinc-200 bg-white text-indigo-500 hover:bg-zinc-50 hover:border-zinc-300',
      ].join(' ')}
    >
      <span
        className="inline-block transition-transform duration-300"
        style={{ transform: dark ? 'rotate(0deg)' : 'rotate(-30deg)' }}
      >
        {dark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </span>
    </button>
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
