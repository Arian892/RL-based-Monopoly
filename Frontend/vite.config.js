import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // 👈 allow LAN access
    port: 5173,          // optional but recommended
  },
})
