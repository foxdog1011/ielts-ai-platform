'use client'
import Link from 'next/link'

export default function BackLink({ href = '/', label = 'Back to Home' }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" aria-label={label}>
      <span aria-hidden>←</span>
      {label}
    </Link>
  )
}