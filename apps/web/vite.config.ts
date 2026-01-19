import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces to allow access from other machines (e.g., via Tailscale)
    host: '0.0.0.0',
  },
})
