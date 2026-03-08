# Deploy to Cloudflare Workers (workers.dev)
npm run workers:deploy

# Or manually:
npm run pages:build
npx wrangler deploy .open-next/worker.js

# Deploy to Cloudflare Pages (.pages.dev)
npm run pages:deploy