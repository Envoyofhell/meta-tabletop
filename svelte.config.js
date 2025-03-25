// File: meta-tabletop/svelte.config.js
// Project: CLIENT
// Purpose: SvelteKit configuration for static adapter

import adapter from '@sveltejs/adapter-static';
import 'dotenv/config';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // Use static adapter for Cloudflare Pages
    adapter: adapter({
      // Output directory (can be overridden by BUILD_DIR env var)
      pages: process.env.BUILD_DIR || 'build',
      assets: process.env.BUILD_DIR || 'build',
      
      // This enables client-side routing and SPA behavior
      fallback: 'index.html',
      
      // Don't precompress assets (Cloudflare does this)
      precompress: false
    }),
    
    // Simplified prerender configuration
    prerender: {
      // Handle client-side routing properly
      handleHttpError: ({ path, referrer, message }) => {
        // Ignore "not found" errors for client-side routes
        if (message.includes('Not found')) {
          return;
        }
        
        // Otherwise, throw the error
        console.error(`Error while prerendering: ${path} from ${referrer}: ${message}`);
        throw new Error(message);
      }
    },
    
    // Enable CSP headers
    csp: {
      mode: 'auto',
      directives: {
        'connect-src': [
          'self',
          // Add your API domain
          'api.tabletop.meta-ptcg.org',
          // Allow WebSocket connections
          'wss://api.tabletop.meta-ptcg.org',
          // For local development
          'localhost:*',
          'ws://localhost:*'
        ]
      }
    },
    
    // Add aliases for cleaner imports
    alias: {
      '$components': 'src/lib/components',
      '$stores': 'src/lib/stores'
    }
  }
};

export default config;