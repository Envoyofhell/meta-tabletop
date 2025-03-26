// File: meta-tabletop/svelte.config.js
// Project: CLIENT
// Purpose: SvelteKit configuration for static adapter

import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import 'dotenv/config';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Add preprocessing support for Svelte components
  preprocess: vitePreprocess(),
  
  kit: {
    // Configure the static adapter for Cloudflare Pages
    adapter: adapter({
      // Output directory (can be overridden by BUILD_DIR env var)
      pages: 'build',
      assets: 'build',
      
      // Enable SPA mode with client-side routing
      fallback: 'index.html',
      
      // Disable precompression since Cloudflare handles this automatically
      precompress: false,
      
      // Ensure strict mode is disabled for compatibility
      strict: false
    }),
    
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
    
    // Path aliases for cleaner imports in your code
    alias: {
      '$lib': './src/lib',
      '$components': './src/lib/components',
      '$stores': './src/lib/stores',
      '$util': './src/lib/util'
    },
    
    // Ensure proper environment variable handling
    env: {
      dir: '.',
      publicPrefix: 'PUBLIC_',
      privatePrefix: 'PRIVATE_'
    }
  }
};

export default config;