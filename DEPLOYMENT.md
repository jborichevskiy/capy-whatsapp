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

## Persistent Data (CRITICAL for WhatsApp Auth)

The bot stores data in:
- `auth/` directory - WhatsApp session (MUST be persisted)
- `bot.sqlite` - Message database

### Setting up Persistent Volumes in Coolify

**IMPORTANT**: Without persistent volumes, you'll need to re-scan the QR code every time the app restarts!

1. In Coolify, go to your application's **Storages** tab
2. Click **Add Storage**
3. Create two volumes:

#### Volume 1: WhatsApp Auth
- **Name**: `whatsapp-auth`
- **Mount Path**: `/app/auth`
- **Type**: `volume`

#### Volume 2: Database
- **Name**: `bot-database`  
- **Mount Path**: `/app/bot.sqlite`
- **Type**: `volume`

4. **Save** and **Redeploy** your application

### Verifying Persistence

After scanning the QR code once:
1. Restart your application in Coolify
2. The bot should reconnect without showing a new QR code
3. Check `/api/auth-status` to verify auth exists

## WebSocket Configuration for Coolify

**Good news**: WebSockets work automatically in Coolify! If you're seeing connection errors:

### Quick Fixes:

1. **Check Application Logs**:
   - In Coolify, go to your app → Logs
   - Look for WebSocket connection attempts
   - Check if requests are reaching your app

2. **Verify Port Configuration**:
   - Ensure `PORT=3000` is set in environment variables
   - The app should listen on `0.0.0.0:3000` not `localhost:3000`

3. **Reset Proxy Labels** (if needed):
   - Go to your app's Settings
   - Click "Reset to Coolify Default Labels"
   - This ensures proper Traefik configuration

### If WebSocket Still Fails:

1. **Check Browser Console**:
   - Open DevTools → Console
   - Look for the WebSocket URL being attempted
   - Should be: `wss://your-domain.com/ws`

2. **Test Direct Access**:
   ```bash
   curl https://your-domain.com/api/auth-status
   ```
   If this works but WebSocket doesn't, it's a proxy issue.

3. **For High Traffic** (optional):
   - Map port directly: `3000:3000` in Coolify port settings
   - This bypasses proxy but loses some features

## Troubleshooting

1. **Build fails with pnpm errors**: The Nixpacks config specifically installs pnpm 8 to avoid version conflicts
2. **WebSocket connection failed**: Check proxy settings and ensure WebSocket upgrade is allowed
2. **WhatsApp disconnects**: Make sure the auth directory is persisted across deployments
3. **Port conflicts**: Change the PORT environment variable in Coolify

## Alternative: Simple Deployment Script

If Nixpacks doesn't work, create a custom build command in Coolify:

```bash
npm install -g pnpm@8 && pnpm install --frozen-lockfile && pnpm run build && pnpm run start:prod
```