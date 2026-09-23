/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
          sunken: 'var(--surface-sunken)',
        },
        border: {
          DEFAULT: 'var(--border)',
        },
        status: {
          success: 'var(--status-success)',
          failure: 'var(--status-failure)',
          running: 'var(--status-running)',
          pending: 'var(--status-pending)',
          unknown: 'var(--status-unknown)',
        },
      },
      fontFamily: {
        mono: ['"SFMono-Regular"', 'Consolas', '"Liberation Mono"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
