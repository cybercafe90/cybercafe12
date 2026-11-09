import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Let Vite/Rolldown build the dependency graph with its default chunking.
// The previous manual vendor group with maxSize split shared dependencies
// across many vendor chunks and caused a browser runtime failure in production.
export default defineConfig({
  plugins: [react()],
})
