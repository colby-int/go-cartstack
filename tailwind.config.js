/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        broadcast: {
          bg: '#1a1a1a',
          panel: '#2a2a2a',
          accent: '#ef4444', // Red for On Air
          text: '#e5e5e5',
          muted: '#737373',
          highlight: '#3b82f6',
        }
      },
      fontFamily: {
        mono: ['Menlo', 'Monaco', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
