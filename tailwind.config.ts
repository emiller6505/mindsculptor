import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

export default {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas:  'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        edge:    'rgb(var(--color-edge) / <alpha-value>)',
        spark:   'rgb(var(--color-spark) / <alpha-value>)',
        flame:   'rgb(var(--color-flame) / <alpha-value>)',
        copper:  'rgb(var(--color-copper) / <alpha-value>)',
        gold:    'rgb(var(--color-gold) / <alpha-value>)',
        ink:     'rgb(var(--color-ink) / <alpha-value>)',
        ash:     'rgb(var(--color-ash) / <alpha-value>)',
        danger:  'rgb(var(--color-danger) / <alpha-value>)',
        brand:   'rgb(var(--color-brand) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', ...fontFamily.sans],
        mono: ['var(--font-geist-mono)', ...fontFamily.mono],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
} satisfies Config
