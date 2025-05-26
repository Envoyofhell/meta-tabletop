import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import WindiCSS from 'vite-plugin-windicss';

export default defineConfig({
  plugins: [
    sveltekit(),
    WindiCSS()
  ],
  server: {
    port: 3005,
    host: true
  },
  optimizeDeps: {
    include: ['socket.io-client']
  }
});