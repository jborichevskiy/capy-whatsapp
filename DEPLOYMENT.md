# Deployment Guide for Coolify

This guide provides multiple deployment options to avoid pnpm/node version issues.

## Option 1: Nixpacks (Recommended for Coolify)

Coolify natively supports Nixpacks, which handles Node.js and pnpm versions automatically.

1. In Coolify, create a new application
2. Choose "GitHub" as source
3. Select your repository
4. Coolify will automatically detect the `nixpacks.toml` file
5. Set environment variables:
   - `NODE_ENV=production`
   - `PORT=3000` (or your preferred port)
6. Deploy!

The `nixpacks.toml` file handles:
- Installing Node.js 20
- Installing pnpm 8
- Building the client and server
- Starting the production server

## Option 2: Docker Compose (For Testing)

Test locally before deploying:

```bash
# Test production build locally
docker-compose up foodexchange-bot

# Or run in development mode
docker-compose up foodexchange-bot-dev
```

## Option 3: Direct Node.js Deployment

If you prefer to run directly with Node.js:

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Build the app
pnpm run build

# Start production server
pnpm run start:prod
```

## Environment Variables

Make sure to set these in Coolify:

```env
NODE_ENV=production
PORT=3000

# Auth Management (Coolify-specific)
# Set to "true" to clear auth on next deployment/restart
CLEAR_AUTH_ON_STARTUP=false

# Optional: Admin token for API auth management
ADMIN_TOKEN=your-secure-token-here
```

## Managing WhatsApp Authentication in Coolify

Since Coolify doesn't provide direct file system access, here are three ways to manage auth:

### Method 1: Environment Variable (Recommended)
1. In Coolify, go to your app's Environment Variables
2. Set `CLEAR_AUTH_ON_STARTUP=true`
3. Redeploy or restart the app
4. The auth will be cleared on startup
5. Scan the new QR code
6. **Important**: Set `CLEAR_AUTH_ON_STARTUP=false` after scanning

### Method 2: API Endpoint
The app provides an auth management endpoint:

```bash
# Check auth status
curl https://your-app.coolify.io/api/auth-status

# Clear auth (requires admin token if set)
curl -X POST https://your-app.coolify.io/api/cleanup-auth \
  -H "Authorization: Bearer your-admin-token"
```

### Method 3: Volume Management
In Coolify's storage settings:
- Create a volume for `/app/auth`
- To reset: Delete and recreate the volume
- This will clear all auth data

## Persistent Data

The bot stores data in:
- `auth/` directory - WhatsApp session
- `bot.sqlite` - Message database

In Coolify, set up persistent volumes for these paths:
- `/app/auth`
- `/app/bot.sqlite`

## Troubleshooting

1. **Build fails with pnpm errors**: The Nixpacks config specifically installs pnpm 8 to avoid version conflicts
2. **WhatsApp disconnects**: Make sure the auth directory is persisted across deployments
3. **Port conflicts**: Change the PORT environment variable in Coolify

## Alternative: Simple Deployment Script

If Nixpacks doesn't work, create a custom build command in Coolify:

```bash
npm install -g pnpm@8 && pnpm install --frozen-lockfile && pnpm run build && pnpm run start:prod
```