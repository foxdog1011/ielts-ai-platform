import React from 'react'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-6 shadow-soft ${className}`}>{children}</div>
}

export function CardHeader({ title, subtitle, tone = 'default' }: { title: string; subtitle?: string; tone?: 'default'|'brand'|'speak' }) {
  const color = tone === 'brand' ? 'text-brand' : tone === 'speak' ? 'text-speak' : 'text-gray-900'
  return (
    <div className="mb-4">
      <h2 className={`text-xl font-semibold ${color}`}>{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
    </div>
  )
}

export function CardSection({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>
}