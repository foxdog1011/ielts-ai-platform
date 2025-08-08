export default function Badge({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'success' | 'warn' | 'error' }) {
  const map = {
    info: 'bg-blue-100 text-blue-700',
    success: 'bg-green-100 text-green-700',
    warn: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
  }[tone]
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${map}`}>{children}</span>
}