import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <a href="/" className="text-sm font-semibold">IELTS AI Platform</a>
            <a href="/" className="text-sm text-gray-600 hover:text-gray-900">Home</a>
          </div>
        </header>

        <main className="min-h-[calc(100vh-200px)]">{children}</main>

        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-gray-500">
          © {new Date().getFullYear()} IELTS AI – demo
        </footer>
      </body>
    </html>
  )
}