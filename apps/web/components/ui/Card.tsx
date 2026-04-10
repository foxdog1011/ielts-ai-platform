import React from 'react'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border-2 border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] theme-transition ${className}`}>{children}</div>
}

export function CardHeader({ title, subtitle, tone = 'default' }: { title: string; subtitle?: string; tone?: 'default'|'brand'|'speak' }) {
  const color = tone === 'brand' ? 'text-[#1CB0F6]' : tone === 'speak' ? 'text-[#FFD900]' : 'text-gray-900 dark:text-[var(--text)]'
  return (
    <div className="mb-4">
      <h2 className={`text-xl font-bold ${color}`}>{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-[var(--text-secondary)]">{subtitle}</p>}
    </div>
  )
}

export function CardSection({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>
}
