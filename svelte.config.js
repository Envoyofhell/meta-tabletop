// File: meta-tabletop/svelte.config.js
// Project: CLIENT
// Purpose: SvelteKit configuration for static adapter

import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import 'dotenv/config';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Add preprocessing support for Svelte components
  // This is essential for handling TypeScript, SCSS, etc.
  preprocess: vitePreprocess(),
  
  kit: {
    // Configure the static adapter for Cloudflare Pages
    // The adapter converts your app to static files that Cloudflare can serve
    adapter: adapter({
      // Output directory (can be overridden by BUILD_DIR env var)
      pages: process.env.BUILD_DIR || 'build',
      assets: process.env.BUILD_DIR || 'build',
      
      // Enable SPA mode with client-side routing
      // This makes all routes fall back to index.html, letting the client router handle them
      fallback: 'index.html',
      
      // Disable precompression since Cloudflare handles this automatically
      precompress: false,
      
      // Ensure strict mode is disabled (can help with some adapter compatibility issues)
      strict: false
    }),
    
    // Prerendering configuration for static site generation
    prerender: {
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
      // Ensure prerendering works with your routing strategy
      handleMissingId: 'ignore'
    },
    
    // Content Security Policy configuration
    // This defines which resources your app can load
    csp: {
      mode: 'auto',
      directives: {
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
      '$components': 'src/lib/components',
      '$stores': 'src/lib/stores'
    },
    
    // Ensure proper environment variable handling
    env: {
      dir: '.'
    }
  }
};

export default config;