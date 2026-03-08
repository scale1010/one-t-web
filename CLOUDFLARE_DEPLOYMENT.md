# Cloudflare Deployment Guide

This guide explains how to deploy your Next.js application to Cloudflare Pages with complete DNS management.

## What Was Configured

1. **OpenNext Cloudflare Adapter** - Modern adapter for Next.js on Cloudflare
2. **Wrangler Configuration** - Cloudflare Workers/Pages configuration
3. **Build Scripts** - Added deployment commands to package.json
4. **Git Ignore** - Added Cloudflare build outputs to .gitignore

## Prerequisites

1. Cloudflare account (free tier works)
2. Domain name (or you can use the free `.pages.dev` subdomain)
3. MongoDB Atlas account (for your database)

## Step-by-Step Deployment

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

This will open your browser to authenticate with Cloudflare.

### 2. Set Environment Variables

You need to set your MongoDB connection variables in Cloudflare:

**Option A: Using Wrangler CLI (for local testing)**
```bash
npx wrangler pages secret put MONGODB_URI
# Enter your MongoDB connection string when prompted
```

**Option B: Using Cloudflare Dashboard (Recommended for production)**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → Your Project → **Settings** → **Environment Variables**
3. Add the following variables:
   - `MONGODB_URI` - Your full MongoDB connection string
   - OR use separate variables:
     - `MONGODB_CLUSTER` - Your MongoDB cluster name
     - `MONGODB_USERNAME` - Your MongoDB username
     - `MONGODB_PASSWORD` - Your MongoDB password
   - `NODE_ENV` - Set to `production`

### 3. Build and Deploy

**Option A: Deploy via Git (Recommended)**
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to Cloudflare Dashboard → **Pages** → **Create a project**
3. Connect your repository
4. Configure build settings:
   - **Framework preset**: None (or Next.js)
   - **Build command**: `npm run build && npm run pages:build`
   - **Build output directory**: `.open-next`
   - **Root directory**: `/` (or your repo root)
5. Click **Save and Deploy**

**Option B: Deploy via CLI**
```bash
npm run pages:deploy
```

This will:
1. Build your Next.js app
2. Convert it to Cloudflare format
3. Deploy to Cloudflare Pages

### 4. Test Your Deployment

After deployment, you'll get a URL like: `https://one-t-web-xxxxx.pages.dev`

Test:
- ✅ Homepage loads
- ✅ `/api/signup` endpoint works
- ✅ `/api/contact` endpoint works
- ✅ MongoDB connections work

### 5. DNS Configuration

#### Step 1: Add Your Domain to Cloudflare

1. In Cloudflare Dashboard → **Websites** → **Add a Site**
2. Enter your domain (e.g., `onethought.ai`)
3. Cloudflare will scan your existing DNS records
4. Follow the prompts to update your nameservers at your domain registrar

#### Step 2: Update Nameservers at Registrar

Cloudflare will provide you with nameservers like:
- `alice.ns.cloudflare.com`
- `bob.ns.cloudflare.com`

Go to your domain registrar (where you bought the domain) and update the nameservers to Cloudflare's nameservers.

#### Step 3: Configure DNS Records

After nameservers are updated (usually takes 5-30 minutes):

1. Go to **DNS** → **Records**
2. Add/Update your records:

   **For root domain:**
   ```
   Type: CNAME
   Name: @
   Target: your-project.pages.dev
   Proxy: Proxied (orange cloud) ✅
   TTL: Auto
   ```

   **For www subdomain:**
   ```
   Type: CNAME
   Name: www
   Target: your-project.pages.dev
   Proxy: Proxied ✅
   TTL: Auto
   ```

#### Step 4: Connect Custom Domain to Pages

1. Go to **Pages** → Your Project → **Custom Domains**
2. Click **Set up a custom domain**
3. Enter your domain
4. Cloudflare will automatically:
   - Provision SSL certificate
   - Configure DNS records
   - Enable HTTPS

### 6. Additional DNS Records (If Needed)

If you need email or other services:

**Email (MX Records):**
```
Type: MX
Name: @
Priority: 10
Target: mail.your-email-provider.com
Proxy: DNS only (grey cloud)
```

**SPF Record (TXT):**
```
Type: TXT
Name: @
Content: v=spf1 include:_spf.google.com ~all
Proxy: DNS only
```

**DKIM Record (TXT):**
```
Type: TXT
Name: default._domainkey
Content: (provided by your email service)
Proxy: DNS only
```

## Local Development & Testing

### Preview Locally

```bash
npm run pages:preview
```

This builds and starts a local server to test your Cloudflare deployment.

### Test MongoDB Connection

```bash
npm run test:mongodb
```

Make sure your `.env.local` file has the MongoDB credentials.

## Troubleshooting

### Build Fails

- Check that all dependencies are installed: `npm install`
- Verify Node.js version (should be 18+)
- Check build logs in Cloudflare Dashboard

### API Routes Not Working

- Verify environment variables are set correctly
- Check Cloudflare Workers logs in Dashboard
- Ensure MongoDB connection string is correct
- Test MongoDB connection separately

### DNS Not Resolving

- Wait 5-30 minutes for DNS propagation
- Verify nameservers are correctly set at registrar
- Check DNS records in Cloudflare dashboard
- Use `dig yourdomain.com` or `nslookup yourdomain.com` to check

### MongoDB Connection Errors

- Verify `MONGODB_URI` is set in Cloudflare environment variables
- Check MongoDB Atlas IP whitelist (add Cloudflare IPs or allow all)
- Ensure MongoDB credentials are correct
- Test connection with `npm run test:mongodb`

### SSL Certificate Issues

- Cloudflare automatically provisions SSL certificates
- Wait a few minutes after adding custom domain
- Check SSL/TLS settings in Cloudflare Dashboard
- Ensure domain is proxied (orange cloud)

## Useful Commands

```bash
# Build for Cloudflare
npm run pages:build

# Preview locally
npm run pages:preview

# Deploy to Cloudflare
npm run pages:deploy

# View deployment logs
npx wrangler pages deployment tail

# List deployments
npx wrangler pages deployment list

# Set environment variable
npx wrangler pages secret put VARIABLE_NAME
```

## Architecture Notes

- **OpenNext** uses Node.js compatibility mode, so your MongoDB driver works as-is
- API routes run on Cloudflare Workers with Node.js compatibility
- Static assets are served from Cloudflare's CDN
- All traffic goes through Cloudflare's edge network for DDoS protection and caching

## Next Steps

1. ✅ Code is configured and ready
2. ⏳ Set up Cloudflare account and authenticate
3. ⏳ Set environment variables
4. ⏳ Deploy via Git or CLI
5. ⏳ Configure DNS and custom domain
6. ⏳ Test all functionality

## Support

- [OpenNext Documentation](https://opennext.js.org/cloudflare)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
