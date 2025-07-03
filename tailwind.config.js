/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'heading': ['Archivo Black'],
      },
      colors: {
        primary: '#ffcb00',     // Yellow accent color
        secondary: '#1a1a1a',   // Dark gray for secondary elements
        success: '#4ade80',     // Green for success messages
        error: '#ef4444',       // Red for error messages
        warning: '#f59e0b',     // Amber for warning messages
        dark: '#121212',        // Dark background
        'dark-lighter': '#1a1a1a', // Slightly lighter dark for cards/elements
        'dark-border': '#2a2a2a', // Border color for dark mode
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-up': 'slideUp 0.5s ease forwards',
      },
    },
  },
  plugins: [],
}
