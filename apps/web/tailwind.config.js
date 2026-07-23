/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        onSurface: 'rgb(var(--on-surface) / <alpha-value>)',
        separator: 'rgb(var(--separator) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        primaryHighlight: 'rgb(var(--primary-highlight) / <alpha-value>)',
        primaryVariant: 'rgb(var(--primary-variant) / <alpha-value>)',
        green: 'rgb(var(--green) / <alpha-value>)',
        red: 'rgb(var(--red) / <alpha-value>)',
        rare: 'rgb(var(--rare) / <alpha-value>)',
        battleGreen: 'rgb(var(--battle-green) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.08), 0 1px 6px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.14), 0 2px 6px -2px rgb(0 0 0 / 0.08)',
      },
      transitionTimingFunction: {
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
}
