/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          500: '#D4AF37',
          600: '#AA8C2C',
        },
        wood: {
          800: '#4A3728',
          900: '#2E2218',
        }
      }
    },
  },
  plugins: [],
}