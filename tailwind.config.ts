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
        canvas:  '#06080F',   // page background — deep navy-black
        surface: '#0C1220',   // cards, panels, modals
        edge:    '#172035',   // borders, dividers
        spark:   '#4F8EF7',   // electric blue — CTAs, active states
        flame:   '#D4552A',   // Izzet red — heat indicators
        copper:  '#B87333',   // machinery micro-details
        gold:    '#C9A050',   // Spike tier badge
        ink:     '#E4EEFF',   // body text
        ash:     '#4A5878',   // secondary labels, timestamps
        danger:  '#E85D5D',   // errors
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', ...fontFamily.sans],
        mono: ['var(--font-geist-mono)', ...fontFamily.mono],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
} satisfies Config
