import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          pink:    '#ff2d78',
          cyan:    '#00f5ff',
          purple:  '#9b30ff',
          dark:    '#070b14',
          darker:  '#030508',
          glass:   'rgba(0, 245, 255, 0.05)',
          border:  'rgba(0, 245, 255, 0.15)',
        },
      },
      fontFamily: {
        mono:    ['Space Mono', 'Courier New', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      animation: {
        'pulse-slow':  'pulse 3s ease-in-out infinite',
        'scan-line':   'scanLine 4s linear infinite',
        'glow-pulse':  'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        scanLine: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0,245,255,0.3)' },
          '50%':      { boxShadow: '0 0 20px rgba(0,245,255,0.8), 0 0 40px rgba(0,245,255,0.3)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
