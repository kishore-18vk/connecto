/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#7C3AED',
          secondary: '#06B6D4',
          accent: '#EC4899',
          success: '#10B981',
          bg: '#0F172A',
          card: 'rgba(255, 255, 255, 0.08)',
          text: '#FFFFFF',
        },
        wa: {
          dark: '#0b141a',
          darker: '#111b21',
          chat: '#0b141a',
          incoming: '#202c33',
          outgoing: '#005c4b',
          green: '#00a884',
          teal: '#005c4b',
          gray: '#8696a0',
          lightGray: '#d1d7db',
          border: '#222e35',
          active: '#2a3942',
        }
      }
    },
  },
  plugins: [],
}
