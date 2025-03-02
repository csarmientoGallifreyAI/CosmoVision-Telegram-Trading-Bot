/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Cyberpunk neon color palette
        neon: {
          pink: '#FF00FF', // Magenta
          blue: '#00FFFF', // Cyan
          yellow: '#FFFF00', // Yellow
          green: '#00FF00', // Green
          purple: '#9900FF', // Purple
        },
        // Cyberpunk dark theme base colors
        cyber: {
          black: '#000000',
          dark: '#0D0D0D',
          gray: '#1A1A1A',
          blue: '#1E3A8A',
          accent: '#28133D', // Dark purple
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'neon-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 10px #FF00FF, 0 0 20px #FF00FF, 0 0 30px #FF00FF',
          },
          '50%': {
            boxShadow: '0 0 15px #FF00FF, 0 0 25px #FF00FF, 0 0 35px #FF00FF',
          },
        },
        'background-glow': {
          '0%, 100%': {
            backgroundPosition: '0% 50%',
          },
          '50%': {
            backgroundPosition: '100% 50%',
          },
        },
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      animation: {
        'neon-pulse': 'neon-pulse 2s infinite',
        'background-glow': 'background-glow 3s ease infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      fontFamily: {
        cyber: ['Orbitron', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 10px #FF00FF, 0 0 20px #FF00FF, 0 0 30px #FF00FF',
        'neon-blue': '0 0 10px #00FFFF, 0 0 20px #00FFFF, 0 0 30px #00FFFF',
        'neon-yellow': '0 0 10px #FFFF00, 0 0 20px #FFFF00, 0 0 30px #FFFF00',
        'neon-green': '0 0 10px #00FF00, 0 0 20px #00FF00, 0 0 30px #00FF00',
      },
      backgroundImage: {
        'cyber-grid':
          'linear-gradient(to right, #1a1a1a 1px, transparent 1px), linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)',
        'cyber-gradient': 'linear-gradient(to right, #000000, #1E3A8A, #28133D, #000000)',
      },
      backgroundSize: {
        'cyber-grid': '20px 20px',
      },
    },
  },
  plugins: ['tailwindcss-animate'],
};
