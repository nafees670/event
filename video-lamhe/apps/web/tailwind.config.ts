import type { Config } from 'tailwindcss';

/** Every colour is a CSS variable (RGB channels) so light/dark switch automatically. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: token('ground'),
        surface: token('surface'),
        sand: token('sand'),
        ink: token('ink'),
        muted: token('muted'),
        line: token('line'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        gold: { DEFAULT: token('gold'), foreground: token('gold-foreground') },
        'gold-text': token('gold-text'),
        band: { DEFAULT: token('band'), foreground: token('band-foreground') },
        whatsapp: { DEFAULT: token('whatsapp'), foreground: token('whatsapp-foreground') },
        danger: token('danger'),
        success: token('success'),
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        input: '12px',
        media: '18px',
        card: '28px',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        lift: 'var(--shadow-lift)',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'sheet-out': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100%)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 250ms ease-out',
        'fade-out': 'fade-out 200ms ease-in',
        'sheet-in': 'sheet-in 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        'sheet-out': 'sheet-out 200ms ease-in',
        'pop-in': 'pop-in 250ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
