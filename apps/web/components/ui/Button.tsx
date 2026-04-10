import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'brand' | 'speak'
  fullWidth?: boolean
}

export default function Button({ isLoading, className = '', variant = 'primary', fullWidth, children, ...rest }: Props) {
  const base = 'inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-bold transition-all shadow-[3px_3px_0_0_rgba(0,0,0,0.1)] dark:shadow-[3px_3px_0_0_rgba(0,0,0,0.3)] active:scale-[0.97] active:shadow-[1px_1px_0_0_rgba(0,0,0,0.1)] min-h-[44px] theme-transition'
  const styles = {
    primary: 'bg-[#58CC02] text-white hover:bg-[#4CAD02] disabled:opacity-60',
    secondary: 'bg-white dark:bg-[var(--surface)] text-gray-900 dark:text-[var(--text)] border-2 border-gray-200 dark:border-[var(--border)] hover:bg-gray-50 dark:hover:bg-[var(--surface-raised)] hover:border-gray-300 dark:hover:border-[var(--border)]',
    ghost: 'text-gray-700 dark:text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-[var(--surface)] shadow-none',
    brand: 'bg-[#1CB0F6] text-white hover:bg-[#1899D6] disabled:opacity-60',
    speak: 'bg-[#FFD900] text-gray-900 hover:bg-[#E6C400] disabled:opacity-60',
  }[variant]

  return (
    <button
      className={`${base} ${styles} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={isLoading || rest.disabled}
      {...rest}
    >
      {isLoading && <span className="mr-2 animate-pulse">•</span>}
      {children}
    </button>
  )
}
