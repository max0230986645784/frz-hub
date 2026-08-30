import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset URLs so the same build runs in the browser and inside Electron.
export default defineConfig({
  base: './',
  plugins: [react()],
})
