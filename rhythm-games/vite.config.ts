import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built app can be served from a subfolder
  // (e.g. /rhythm/) of the Staff Commander hub, not just the domain root.
  base: './',
  plugins: [react()],
})
