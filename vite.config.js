import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) {
            return 'firebase';
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react') || id.includes('node_modules/react-router')) {
            return 'vendor';
          }
        },
      },
    },
  },
})
