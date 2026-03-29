'use client';
// components/ThemeToggle.tsx
// Lightweight dark-mode toggle using localStorage + data-theme attribute on <html>.
// No external dependencies required.

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  }

  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={toggle}
      aria-label={dark ? '切換日間模式' : '切換深色模式'}
      title={dark ? '日間模式' : '深色模式'}
      className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[14px] hover:bg-zinc-50 transition-colors dark-btn"
    >
      {dark ? '☀︎' : '☽'}
    </button>
  );
}
