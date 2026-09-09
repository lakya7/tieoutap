import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { devApiPlugin } from './server/devApiPlugin.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), devApiPlugin()],
})
