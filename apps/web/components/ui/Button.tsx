import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'brand' | 'speak'
  fullWidth?: boolean
}

export default function Button({ isLoading, className = '', variant = 'primary', fullWidth, children, ...rest }: Props) {
  const base = 'inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition shadow-soft active:scale-[0.99]'
  const styles = {
    primary: 'bg-gray-900 text-white hover:bg-black disabled:opacity-60',
    secondary: 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50',
    ghost: 'text-gray-700 hover:bg-gray-100',
    brand: 'bg-brand text-white hover:bg-brand-700 disabled:opacity-60',
    speak: 'bg-speak text-white hover:bg-speak-700 disabled:opacity-60',
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