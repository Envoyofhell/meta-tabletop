// File: meta-tabletop/svelte.config.js
// Project: META-TABLETOP
// Purpose: SvelteKit configuration for static adapter with Cloudflare Pages optimization

import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import 'dotenv/config';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Add preprocessing support for Svelte components
  preprocess: vitePreprocess({
    // Add preprocessing options for better performance
    postcss: true,
    // Ensure proper source maps
    sourceMap: process.env.NODE_ENV !== 'production'
  }),
  
  // Configure Svelte compiler options
  compilerOptions: {
    // Enable accessibility checks
    a11y: {
      // Don't fail the build on accessibility warnings
      enable: true,
      // Consider warnings as hints, not errors
      failOnWarnings: false
    },
    // Enable CSS optimizations
    css: true,
    // Improve development experience with better error messages
    dev: process.env.NODE_ENV !== 'production',
    // Generate code to support immutability in Svelte
    immutable: true
  },
  
  kit: {
    // Configure the static adapter for Cloudflare Pages
    adapter: adapter({
      // Output directory (can be overridden by BUILD_DIR env var)
      pages: process.env.BUILD_DIR || 'build',
      assets: process.env.BUILD_DIR || 'build',
      
      // Enable SPA mode with client-side routing
      fallback: 'index.html',
      
      // Disable precompression since Cloudflare handles this automatically
      precompress: false,
      
      // Ensure strict mode is disabled for compatibility
      strict: false
    }),
    
    // Environment variables configuration
    env: {
      dir: '.',
      // Public environment variables prefix
      publicPrefix: 'PUBLIC_',
      // Private environment variables prefix (server-side only)
      privatePrefix: 'PRIVATE_'
    },
    
    // Path aliases for cleaner imports in your code
    alias: {
      '$lib': './src/lib',
      '$components': './src/lib/components',
      '$stores': './src/lib/stores',
      '$util': './src/lib/util'
    },
    
    // Prerendering configuration for static site generation
    prerender: {
      // Enable crawling for static site generation
      crawl: true,
      
      // Handle errors during prerendering process
      handleHttpError: ({ path, referrer, message }) => {
        // Ignore expected "Not found" errors for client-side routes
        if (message.includes('Not found')) {
          return;
        }
        
        // For other errors, log details and throw
        console.error(`Error while prerendering: ${path} from ${referrer}: ${message}`);
        throw new Error(message);
      },
      
      // Handle missing IDs during prerendering
      handleMissingId: 'ignore'
    },
    
    // Content Security Policy configuration
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self', 'unsafe-inline'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'https://images.pokemontcg.io', 'https://limitlesstcg.nyc3.digitaloceanspaces.com'],
        'connect-src': [
          'self',
          // API domain
          'api.tabletop.meta-ptcg.org',
          // WebSocket connections
          'wss://api.tabletop.meta-ptcg.org',
          // Local development
          'localhost:*',
          'ws://localhost:*'
        ]
      }
    },
    
    // Paths to files that should trigger full page reloads during development
    files: {
      assets: 'static',
      hooks: {
        client: 'src/hooks.client',
        server: 'src/hooks.server'
      },
      routes: 'src/routes',
      serviceWorker: 'src/service-worker',
      template: 'src/app.html'
    },
    
    // Disable generating type definitions (not needed for Cloudflare Pages)
    typescript: {
      config: (config) => config
    },
    
    // Configure how Vite is used
    vite: () => ({})
  }
};

export default config;