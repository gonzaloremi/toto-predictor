import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Contourne CORS pour les articles pronostics du Figaro
      '/api/figaro': {
        target: 'https://paris-sportifs.lefigaro.fr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/figaro/, ''),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        },
      },
    },
  },
})
