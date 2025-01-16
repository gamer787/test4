/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'neon-pink': '#ff2d8d',
        'neon-blue': '#00ffff',
        'neon-purple': '#bf00ff',
        'neon-green': '#39ff14',
        'dark-bg': '#0a0a0f',
        'darker-bg': '#050507',
        'card-bg': '#151520',
      },
      boxShadow: {
        'neon': '0 0 10px #00ffff, 0 0 20px #00ffff',
        'neon-hover': '0 0 15px #00ffff, 0 0 30px #00ffff',
        'neon-pink': '0 0 10px #ff2d8d, 0 0 20px #ff2d8d',
        'neon-purple': '0 0 10px #bf00ff, 0 0 20px #bf00ff',
        'neon-green': '0 0 10px #39ff14, 0 0 20px #39ff14',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          'from': {
            'text-shadow': '0 0 10px #fff, 0 0 20px #fff, 0 0 30px #00ffff, 0 0 40px #00ffff',
          },
          'to': {
            'text-shadow': '0 0 20px #fff, 0 0 30px #00ffff, 0 0 40px #00ffff, 0 0 50px #00ffff',
          },
        },
      },
    },
  },
  plugins: [],
};