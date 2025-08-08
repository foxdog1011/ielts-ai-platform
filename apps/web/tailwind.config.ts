import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      borderRadius: { xl: '0.75rem', '2xl': '1rem' },
      boxShadow: {
        soft: '0 8px 30px rgba(0,0,0,0.06)',
        lift: '0 10px 25px rgba(0,0,0,0.08)',
      },
      colors: {
        brand: { DEFAULT: '#1e66f5', 50: '#eef5ff', 100: '#d9e7ff', 600: '#1e66f5', 700: '#1750c4' },
        speak: { DEFAULT: '#10b981', 50: '#ecfdf5', 100: '#d1fae5', 600: '#10b981', 700: '#059669' },
      },
    },
  },
  plugins: [],
}
export default config
