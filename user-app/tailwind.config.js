export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6C63FF',        // tím than
        secondary: '#1A73E8',      // xanh tươi
        success: '#4CAF50',        // xanh lá nhạt
        danger: '#F7444E',         // đỏ / san hô
        accent: '#78BCC4',         // xanh nhạt
        dark: '#002C3E',           // xanh đậm
        black: '#000000',
        white: '#FFFFFF',
        gray: { 50: '#F7F8F3', 700: '#212121' }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Arial', 'sans-serif']
      },
      borderRadius: { xl: '12px', '2xl': '16px' },
      boxShadow: { card: '0 8px 24px rgba(16,24,40,0.08)' }
    }
  },
  plugins: []
}
