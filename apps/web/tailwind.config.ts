/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        brand: ["var(--font-inter)", "var(--font-noto-sans-tc)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
