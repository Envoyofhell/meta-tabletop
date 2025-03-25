// File: meta-tabletop/vite.config.js
// Project: CLIENT
// Purpose: Vite configuration for SvelteKit and WindiCSS

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import WindiCSS from 'vite-plugin-windicss';

export default defineConfig({
  plugins: [
    // SvelteKit plugin
    sveltekit(),
    
    // WindiCSS integration
    WindiCSS()
  ],
  
  // Build optimization for Cloudflare Pages
  build: {
    // Target newer browsers
    target: 'es2020',
    
    // Minify output
    minify: true,
    
    // Make chunks smaller
    chunkSizeWarningLimit: 1000,
    
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/]
    },
    
    // Enable source maps for debugging
    sourcemap: process.env.NODE_ENV !== 'prod'
  },
  
  // Define environment variables to be replaced in client code
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['socket.io-client']
  },
  
  // Development server options
  server: {
    port: 3005,
    strictPort: true,
    host: true,
    
    // Enable CORS for local development
    cors: true
  },
  
  // Preview server configuration (for local previewing of built site)
  preview: {
    port: 4173,
    strictPort: true,
    host: true
  }
});