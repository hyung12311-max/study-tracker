import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/hangul/',
  plugins: [react()],
  build: {
    outDir: '../../hangul',
    emptyOutDir: true,
    target: 'es2020',
  },
})
