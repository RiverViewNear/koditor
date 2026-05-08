import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.ELECTRON === 'true' ? './' : '/',
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // Monaco Editor를 CDN 대신 로컬 번들로 사용
  optimizeDeps: {
    include: ['monaco-editor/esm/vs/language/json/json.worker',
              'monaco-editor/esm/vs/language/css/css.worker',
              'monaco-editor/esm/vs/language/html/html.worker',
              'monaco-editor/esm/vs/language/typescript/ts.worker',
              'monaco-editor/esm/vs/editor/editor.worker'],
  },
  worker: {
    format: 'es',
  },
})
