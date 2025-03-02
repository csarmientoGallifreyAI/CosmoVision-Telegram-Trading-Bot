/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0f19',
        foreground: '#e0e0f0',
        'neon-blue': '#4EAEFF',
        'neon-pink': '#FF5EAE',
        'neon-purple': '#A56EFF',
        'neon-green': '#5EFF8F',
        'neon-yellow': '#FFE55E',
        destructive: '#FF4E4E',
      },
      fontFamily: {
        cyber: ['BlenderPro', 'Orbitron', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'neon-pulse': 'neonPulse 2s infinite alternate',
        glitch: 'glitch 3s infinite',
        'cyber-scan': 'cyberScan 3s linear infinite',
      },
      keyframes: {
        neonPulse: {
          '0%': { boxShadow: '0 0 5px rgba(78, 174, 255, 0.7), 0 0 10px rgba(78, 174, 255, 0.5)' },
          '100%': {
            boxShadow: '0 0 20px rgba(78, 174, 255, 0.9), 0 0 30px rgba(78, 174, 255, 0.7)',
          },
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        },
        cyberScan: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '100% 0%' },
        },
      },
    },
  },
  plugins: [],
};
