import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // REPLACE '/your-repo-name/' WITH YOUR ACTUAL REPO NAME (e.g. '/circuit-sim/')
  // If deploying to username.github.io directly, use '/'
  base: '/your-repo-name/',
})