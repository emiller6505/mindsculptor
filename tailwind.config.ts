import type { Config } from 'tailwindcss'

export default {
  content: ['./src/app/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
} satisfies Config

