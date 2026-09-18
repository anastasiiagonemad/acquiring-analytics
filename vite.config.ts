/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    proxy: {
      '/deepseek-api': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/deepseek-api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
