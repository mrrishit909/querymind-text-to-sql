import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages project-site base path: https://mrrishit909.github.io/querymind-text-to-sql/
export default defineConfig({
  base: '/querymind-text-to-sql/',
  plugins: [react()],
})
