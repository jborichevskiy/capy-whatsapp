// Import crypto polyfill FIRST before any other imports
import './crypto-polyfill';

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createBot, hasExistingAuth, cleanupAuth } from "./whatsapp";
import { setupScheduler } from "./scheduler";
import { dbOps } from "./db";
import { getPendingMessages, getAllRecurringMessages, formatChatId } from "./utils";
import { authManager } from "./auth-manager";

// Global state for the bot
let botState = {
  connected: false,
  phoneNumber: null as string | null,
  lastConnectionTime: null as Date | null,
  groups: [] as any[],
  sentMessagesCount: 0
};

let sock: any = null;
let wss: WebSocketServer;

// Function to broadcast updates to all connected WebSocket clients
function broadcastUpdate(type: string, data: any) {
  if (!wss) return;
  
  const message = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Function to get current dashboard data
function getDashboardData() {
  return {
    connected: botState.connected,
    phoneNumber: botState.phoneNumber,
    lastConnectionTime: botState.lastConnectionTime,
    groups: botState.groups,
    scheduledMessages: getPendingMessages().map(msg => ({
      ...msg,
      chatId: formatChatId(msg.chatId)
    })),
    recurringMessages: getAllRecurringMessages().map(msg => ({
      ...msg,
      chatId: formatChatId(msg.chatId)
    }))
  };
}

// Function to fetch and update groups
async function updateGroups() {
  if (!sock || !botState.connected) {
    console.log("❌ Bot not connected, cannot fetch groups");
    return;
  }

  try {
    console.log("🔄 Fetching groups using Baileys methods...");
    
    let groups = [];
    
    try {
      console.log("📋 Trying groupFetchAllParticipating()...");
      const groupsParticipating = await sock.groupFetchAllParticipating();
      console.log(`📊 Found ${Object.keys(groupsParticipating).length} groups via groupFetchAllParticipating`);
      
      for (const [groupId, groupInfo] of Object.entries(groupsParticipating)) {
        const group = groupInfo as any;
        try {
          const groupMetadata = await sock.groupMetadata(groupId);
          groups.push({
            id: groupId,
            name: groupMetadata.subject || group.subject || 'Unknown Group',
            participantCount: groupMetadata.participants?.length || 0,
            description: groupMetadata.desc || '',
            owner: groupMetadata.owner || '',
            creation: groupMetadata.creation || null
          });
          console.log(`✅ Added group: ${groupMetadata.subject || group.subject} (${groupMetadata.participants?.length || 0} members)`);
        } catch (metadataError) {
          console.warn(`⚠️ Could not fetch metadata for group ${groupId}:`, metadataError instanceof Error ? metadataError.message : String(metadataError));
          groups.push({
            id: groupId,
            name: group.subject || 'Unknown Group',
            participantCount: group.participants?.length || 0,
            description: '',
            owner: group.owner || '',
            creation: group.creation || null
          });
          console.log(`⚠️ Added group (basic info): ${group.subject || 'Unknown Group'}`);
        }
      }
    } catch (participatingError) {
      console.log("❌ groupFetchAllParticipating failed:", participatingError instanceof Error ? participatingError.message : String(participatingError));
    }
    
    groups.sort((a, b) => a.name.localeCompare(b.name));
    botState.groups = groups;
    console.log(`✅ Updated ${groups.length} groups total`);
    
    // Broadcast group updates to all connected clients
    broadcastUpdate('GROUPS_UPDATE', { groups });
    
  } catch (error) {
    console.error("❌ Failed to fetch groups:", error);
  }
}

// Start the bot
async function initializeBot() {
  try {
    console.log("🚀 Initializing WhatsApp Bot...");
    
    // Check for CLEAR_AUTH_ON_STARTUP environment variable
    if (process.env.CLEAR_AUTH_ON_STARTUP === 'true') {
      console.log("🔄 CLEAR_AUTH_ON_STARTUP is set - clearing authentication");
      cleanupAuth();
    }
    
    // Check if we have existing auth
    if (hasExistingAuth()) {
      console.log("🔐 Found existing authentication files");
    } else {
      console.log("🆕 No existing authentication found - you'll need to scan a QR code");
    }
    
    sock = await createBot();
    
    // Setup scheduler
    setupScheduler(sock);
    
    // Listen for connection updates
    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect } = update;
      botState.connected = connection === "open";
      
      if (botState.connected) {
        botState.lastConnectionTime = new Date();
        console.log("✅ WhatsApp connected");
        
        // Broadcast connection update
        broadcastUpdate('CONNECTION_UPDATE', { connected: botState.connected });
        
        // Fetch groups after connection is established
        setTimeout(updateGroups, 2000);
      } else {
        // Check if it's an auth failure
        const error = lastDisconnect?.error as any;
        const statusCode = error?.output?.statusCode;
        
        if (statusCode === 401) {
          broadcastUpdate('AUTH_ERROR', { 
            message: 'Authentication expired. Please delete the auth folder and restart the bot.',
            instructions: [
              'Stop the bot (Ctrl+C)',
              'Run: rm -rf auth',
              'Run: pnpm dev',
              'Scan the new QR code'
            ]
          });
        } else {
          broadcastUpdate('CONNECTION_UPDATE', { connected: false });
        }
      }
    });

    // Get phone number when available
    sock.ev.on("creds.update", () => {
      if (sock.user?.id) {
        botState.phoneNumber = sock.user.id.split('@')[0];
        broadcastUpdate('STATUS_UPDATE', getDashboardData());
      }
    });

    // Track groups from initial chat set
    sock.ev.on("chats.set", async (chats: any) => {
      const groups = chats.filter((chat: any) => chat.id.includes('@g.us')).map((group: any) => ({
        id: group.id,
        name: group.name || 'Unknown Group',
        participantCount: group.participants?.length || 0,
        description: group.desc || '',
        owner: group.owner || '',
        creation: group.creation || null
      }));
      
      botState.groups = groups;
      console.log(`📊 Initial groups loaded: ${groups.length}`);
      
      broadcastUpdate('GROUPS_UPDATE', { groups });
      
      // Also fetch detailed metadata after initial load
      setTimeout(updateGroups, 1000);
    });

    // Listen for new groups being added or updated
    sock.ev.on("chats.upsert", async (chats: any) => {
      const newGroups = chats.filter((chat: any) => chat.id.includes('@g.us'));
      if (newGroups.length > 0) {
        console.log(`📊 New groups detected: ${newGroups.length}`);
        await updateGroups();
      }
    });

    // Listen for group updates
    sock.ev.on("chats.update", async (chats: any) => {
      const updatedGroups = chats.filter((chat: any) => chat.id.includes('@g.us'));
      if (updatedGroups.length > 0) {
        console.log(`📊 Groups updated: ${updatedGroups.length}`);
        await updateGroups();
      }
    });

  } catch (error) {
    console.error("❌ Failed to initialize bot:", error);
  }
}

// HTTP server
const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || '', `http://${req.headers.host}`);

  // Serve static files in production
  if (url.pathname === '/' || url.pathname.startsWith('/assets/')) {
    try {
      let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
      const fullPath = join(process.cwd(), 'client/dist', filePath);
      const content = readFileSync(fullPath);
      
      const ext = filePath.split('.').pop();
      const mimeTypes: { [key: string]: string } = {
        'html': 'text/html',
        'js': 'application/javascript',
        'css': 'text/css',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'gif': 'image/gif',
        'ico': 'image/x-icon'
      };
      
      res.writeHead(200, { 
        'Content-Type': mimeTypes[ext || 'html'] || 'text/plain' 
      });
      res.end(content);
      return;
    } catch (error) {
      // In development, let Vite handle static files
      if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>WhatsApp Bot Dashboard</title>
            </head>
            <body>
              <div id="root"></div>
              <script>
                window.location.href = 'http://localhost:3001';
              </script>
            </body>
          </html>
        `);
        return;
      }
    }
  }

  // API Routes
  if (url.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getDashboardData()));
    return;
  }

  if (url.pathname === '/api/schedule' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { chatId, text, datetime } = JSON.parse(body);
        
        if (!chatId || !text || !datetime) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing required fields: chatId, text, datetime');
          return;
        }

        const id = dbOps.insertScheduledMessage({ chatId, text, datetime });
        
        // Broadcast message updates
        broadcastUpdate('MESSAGES_UPDATE', {
          scheduledMessages: getPendingMessages().map(msg => ({
            ...msg,
            chatId: formatChatId(msg.chatId)
          })),
          recurringMessages: getAllRecurringMessages().map(msg => ({
            ...msg,
            chatId: formatChatId(msg.chatId)
          }))
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id }));
      } catch (error) {
        console.error('Error adding scheduled message:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
      }
    });
    return;
  }

  if (url.pathname.startsWith('/api/schedule/') && req.method === 'DELETE') {
    const id = url.pathname.split('/')[3];
    
    try {
      const result = dbOps.deleteScheduledMessage(parseInt(id));
      
      if (result.changes > 0) {
        // Broadcast message updates
        broadcastUpdate('MESSAGES_UPDATE', {
          scheduledMessages: getPendingMessages().map(msg => ({
            ...msg,
            chatId: formatChatId(msg.chatId)
          })),
          recurringMessages: getAllRecurringMessages().map(msg => ({
            ...msg,
            chatId: formatChatId(msg.chatId)
          }))
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Message not found');
      }
    } catch (error) {
      console.error('Error deleting scheduled message:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
    return;
  }

  if (url.pathname === '/api/refresh-groups' && req.method === 'POST') {
    try {
      await updateGroups();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        groupCount: botState.groups.length,
        message: `Successfully refreshed ${botState.groups.length} groups`
      }));
    } catch (error) {
      console.error('Error refreshing groups:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to refresh groups');
    }
    return;
  }

  if (url.pathname === '/api/recurring' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { chatId, text, weekday, hour, minute } = JSON.parse(body);
        
        if (!chatId || !text || weekday === undefined || hour === undefined || minute === undefined) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing required fields: chatId, text, weekday, hour, minute');
          return;
        }

        const id = dbOps.insertRecurringMessage({ chatId, text, weekday, hour, minute });
        
        // Broadcast message updates
        broadcastUpdate('MESSAGES_UPDATE', {
          scheduledMessages: getPendingMessages().map(msg => ({
            ...msg,
            chatId: formatChatId(msg.chatId)
          })),
          recurringMessages: getAllRecurringMessages().map(msg => ({
            ...msg,
            chatId: formatChatId(msg.chatId)
          }))
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id }));
      } catch (error) {
        console.error('Error adding recurring message:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
      }
    });
    return;
  }

  if (url.pathname.startsWith('/api/recurring/') && req.method === 'DELETE') {
    const id = url.pathname.split('/')[3];
    
    try {
      const result = dbOps.deleteRecurringMessage(parseInt(id));
      
      if (result.changes > 0) {
        // Broadcast message updates
        broadcastUpdate('MESSAGES_UPDATE', {
          scheduledMessages: getPendingMessages().map(msg => ({
            ...msg,
            chatId: formatChatId(msg.chatId)
          })),
          recurringMessages: getAllRecurringMessages().map(msg => ({
            ...msg,
            chatId: formatChatId(msg.chatId)
          }))
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Recurring message not found');
      }
    } catch (error) {
      console.error('Error deleting recurring message:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
    return;
  }

  // Clean up auth endpoint
  if (url.pathname === '/api/cleanup-auth' && req.method === 'POST') {
    try {
      // Check for admin token if configured
      const adminToken = process.env.ADMIN_TOKEN;
      if (adminToken) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Authorization required' }));
          return;
        }
        
        const token = authHeader.substring(7);
        if (token !== adminToken) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Invalid token' }));
          return;
        }
      }
      
      console.log('🔐 Auth cleanup requested via API');
      
      // Clean up auth files
      cleanupAuth();
      
      // Disconnect existing socket if connected
      if (sock) {
        sock.end();
        sock = null;
      }
      
      // Update bot state
      botState.connected = false;
      botState.phoneNumber = null;
      
      // Broadcast the auth cleanup
      broadcastUpdate('AUTH_CLEANUP', { 
        message: 'Authentication cleaned up. Please restart the bot to re-authenticate.',
        success: true 
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'Auth cleaned up. Please restart the bot.' 
      }));
    } catch (error) {
      console.error('Error cleaning up auth:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        message: 'Failed to clean up auth' 
      }));
    }
    return;
  }

  // Auth status endpoint
  if (url.pathname === '/api/auth-status' && req.method === 'GET') {
    try {
      const status = authManager.getAuthStatus();
      const hasAuth = hasExistingAuth();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true,
        hasAuth,
        authExists: status.exists,
        lastCleared: status.lastCleared,
        connected: botState.connected,
        phoneNumber: botState.phoneNumber
      }));
    } catch (error) {
      console.error('Error getting auth status:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        message: 'Failed to get auth status' 
      }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// WebSocket server
wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');
  
  // Send current state immediately upon connection
  ws.send(JSON.stringify({
    type: 'STATUS_UPDATE',
    data: getDashboardData()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 Received WebSocket message:', data);
      
      // Handle client messages if needed
      switch (data.type) {
        case 'REFRESH_GROUPS':
          updateGroups();
          break;
        case 'ping':
          // Respond to ping with pong to keep connection alive
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.log('Unknown WebSocket message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Bind to all interfaces for container compatibility

server.listen(Number(PORT), HOST, () => {
  console.log("🌐 Server starting...");
  console.log(`📱 Dashboard: http://${HOST}:${PORT}`);
  console.log(`🔌 WebSocket: ws://${HOST}:${PORT}/ws`);
  console.log("🤖 Initializing WhatsApp bot...");
});

// Initialize the bot
initializeBot(); 