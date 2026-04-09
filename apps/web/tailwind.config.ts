/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        brand: ["var(--font-inter)", "var(--font-noto-sans-tc)", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          200: "var(--color-primary-200)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          900: "var(--color-primary-900)",
          DEFAULT: "var(--color-primary)",
          light: "var(--color-primary-light)",
          dark: "var(--color-primary-dark)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          light: "var(--color-success-light)",
          dark: "var(--color-success-dark)",
        },
        error: {
          DEFAULT: "var(--color-error)",
          light: "var(--color-error-light)",
          dark: "var(--color-error-dark)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          light: "var(--color-warning-light)",
          dark: "var(--color-warning-dark)",
        },
      },
      animation: {
        "score-pop": "score-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "progress-fill": "progress-fill 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-success": "pulse-success 1s ease-out",
        "slide-in-right": "slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
