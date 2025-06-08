import { createServer } from 'http';
import { createBot } from "./whatsapp";
import { setupScheduler } from "./scheduler";
import { dbOps } from "./db";
import { getPendingMessages, getAllRecurringMessages, formatChatId } from "./utils";

// Global state for the web UI
let botState = {
  connected: false,
  phoneNumber: null as string | null,
  lastConnectionTime: null as Date | null,
  groups: [] as any[],
  sentMessagesCount: 0
};

let sock: any = null;

// Function to fetch and update groups
async function updateGroups() {
  if (!sock || !botState.connected) {
    console.log("❌ Bot not connected, cannot fetch groups");
    return;
  }

  try {
    console.log("🔄 Fetching groups using Baileys methods...");
    
    // Method 1: Use groupFetchAllParticipating() to get all groups
    let groups = [];
    
    try {
      console.log("📋 Trying groupFetchAllParticipating()...");
      const groupsParticipating = await sock.groupFetchAllParticipating();
      console.log(`📊 Found ${Object.keys(groupsParticipating).length} groups via groupFetchAllParticipating`);
      
             for (const [groupId, groupInfo] of Object.entries(groupsParticipating)) {
         const group = groupInfo as any; // Type assertion for groupInfo
         try {
           // Get additional metadata for each group
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
           // Fallback to basic group info
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
      
      // Method 2: Fallback - try to get groups from chat history
      try {
        console.log("📋 Trying alternative method - searching chat history...");
        
        // This is a more manual approach - we'll look for groups in recent chats
        const chatHistoryGroups: any[] = [];
        
        // Note: This is a fallback method. In a real implementation, you might want to
        // maintain your own group registry or use the store properly
        console.log("ℹ️ Alternative method would require implementing custom group tracking");
        console.log("ℹ️ For now, will return empty groups list");
        
      } catch (fallbackError) {
        console.log("❌ Fallback method also failed:", fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      }
    }
    
    // Sort groups by name for better organization
    groups.sort((a, b) => a.name.localeCompare(b.name));
    
    botState.groups = groups;
    console.log(`✅ Updated ${groups.length} groups total`);
    
    // Log group details for debugging
    if (groups.length > 0) {
      console.log("📋 Groups found:");
      groups.forEach(group => {
        console.log(`  - ${group.name} (${group.id}) - ${group.participantCount} members`);
      });
    }
    
  } catch (error) {
    console.error("❌ Failed to fetch groups:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
  }
}

// Start the bot
async function initializeBot() {
  try {
    console.log("🚀 Initializing WhatsApp Bot...");
    sock = await createBot();
    
    // Setup scheduler
    setupScheduler(sock);
    
    // Listen for connection updates
    sock.ev.on("connection.update", async (update: any) => {
      const { connection } = update;
      botState.connected = connection === "open";
      if (botState.connected) {
        botState.lastConnectionTime = new Date();
        console.log("✅ WhatsApp connected for web UI");
        
        // Fetch groups after connection is established
        setTimeout(updateGroups, 2000); // Wait 2 seconds for everything to initialize
      }
    });

    // Get phone number when available
    sock.ev.on("creds.update", () => {
      if (sock.user?.id) {
        botState.phoneNumber = sock.user.id.split('@')[0];
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
      
      // Also fetch detailed metadata after initial load
      setTimeout(updateGroups, 1000);
    });

    // Listen for new groups being added or updated
    sock.ev.on("chats.upsert", async (chats: any) => {
      const newGroups = chats.filter((chat: any) => chat.id.includes('@g.us'));
      if (newGroups.length > 0) {
        console.log(`📊 New groups detected: ${newGroups.length}`);
        await updateGroups(); // Refresh all groups when new ones are added
      }
    });

    // Listen for group updates
    sock.ev.on("chats.update", async (chats: any) => {
      const updatedGroups = chats.filter((chat: any) => chat.id.includes('@g.us'));
      if (updatedGroups.length > 0) {
        console.log(`📊 Groups updated: ${updatedGroups.length}`);
        await updateGroups(); // Refresh all groups when they're updated
      }
    });

  } catch (error) {
    console.error("❌ Failed to initialize bot:", error);
  }
}

// HTML Dashboard
const dashboardHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Bot Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #25D366, #128C7E);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .status-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .connected { background: #25D366; }
        .disconnected { background: #ff4444; }
        .section {
            background: white;
            margin-bottom: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .section-header {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #eee;
            border-radius: 10px 10px 0 0;
            font-weight: 600;
        }
        .section-content { padding: 20px; }
        .message-item, .group-item {
            padding: 15px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .group-item {
            align-items: center;
        }
        .message-item:last-child, .group-item:last-child { border-bottom: none; }
        .message-text { flex: 1; margin-right: 15px; }
        .message-time { color: #666; font-size: 0.9em; }
        .refresh-btn, .btn {
            background: #25D366;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin: 5px;
        }
        .refresh-btn:hover, .btn:hover { background: #128C7E; }
        .btn-danger {
            background: #ff4444;
        }
        .btn-danger:hover {
            background: #cc0000;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
        }
        .form-group input, .form-group textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        .form-group textarea {
            height: 80px;
            resize: vertical;
        }
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .add-form {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .empty { color: #666; font-style: italic; text-align: center; padding: 40px; }
        .message-actions {
            display: flex;
            gap: 10px;
        }
        .status-message {
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 15px;
            display: none;
        }
        .status-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status-error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 WhatsApp Bot Dashboard</h1>
            <p>Monitor your bot's activity and manage messages</p>
        </div>

        <div class="status-grid" id="statusGrid">
            <div class="status-card">
                <h3>Connection Status</h3>
                <p id="connectionStatus">Loading...</p>
            </div>
            <div class="status-card">
                <h3>Phone Number</h3>
                <p id="phoneNumber">Loading...</p>
            </div>
            <div class="status-card">
                <h3>Last Connected</h3>
                <p id="lastConnected">Loading...</p>
            </div>
            <div class="status-card">
                <h3>Groups Joined</h3>
                <p id="groupCount">Loading...</p>
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                📅 Scheduled Messages
                <button class="refresh-btn" onclick="refreshData()">Refresh</button>
            </div>
            <div class="section-content">
                <div id="statusMessage" class="status-message"></div>
                
                <div class="add-form">
                    <h4>📝 Add New Scheduled Message</h4>
                    <form id="scheduleForm" onsubmit="addScheduledMessage(event)">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="chatId">Chat ID (phone number with @s.whatsapp.net or group ID):</label>
                                <input type="text" id="chatId" name="chatId" placeholder="1234567890@s.whatsapp.net" required>
                            </div>
                            <div class="form-group">
                                <label for="datetime">Date & Time:</label>
                                <input type="datetime-local" id="datetime" name="datetime" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="text">Message:</label>
                            <textarea id="text" name="text" placeholder="Enter your message here..." required></textarea>
                        </div>
                        <button type="submit" class="btn">📤 Schedule Message</button>
                    </form>
                </div>
                
                <div id="scheduledMessages">
                    Loading...
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                🔄 Recurring Messages
            </div>
            <div class="section-content" id="recurringMessages">
                Loading...
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                👥 Groups
                <button class="refresh-btn" onclick="refreshGroups()">🔄 Refresh Groups</button>
            </div>
            <div class="section-content" id="groups">
                Loading...
            </div>
        </div>
    </div>

    <script>
        async function fetchData() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                updateUI(data);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            }
        }

        function updateUI(data) {
            // Update status cards
            document.getElementById('connectionStatus').innerHTML = 
                \`<span class="status-indicator \${data.connected ? 'connected' : 'disconnected'}"></span>
                \${data.connected ? 'Connected' : 'Disconnected'}\`;
            
            document.getElementById('phoneNumber').textContent = 
                data.phoneNumber || 'Not available';
            
            document.getElementById('lastConnected').textContent = 
                data.lastConnectionTime ? new Date(data.lastConnectionTime).toLocaleString() : 'Never';
            
            document.getElementById('groupCount').textContent = data.groups.length;

            // Update scheduled messages
            const scheduledDiv = document.getElementById('scheduledMessages');
            if (data.scheduledMessages.length === 0) {
                scheduledDiv.innerHTML = '<div class="empty">No scheduled messages</div>';
            } else {
                scheduledDiv.innerHTML = data.scheduledMessages.map(msg => 
                    \`<div class="message-item">
                        <div class="message-text">
                            <strong>\${msg.chatId}</strong><br>
                            \${msg.text}
                        </div>
                        <div class="message-actions">
                            <div class="message-time">\${new Date(msg.datetime).toLocaleString()}</div>
                            <button class="btn btn-danger" onclick="deleteScheduledMessage(\${msg.id})">🗑️ Delete</button>
                        </div>
                    </div>\`
                ).join('');
            }

            // Update recurring messages
            const recurringDiv = document.getElementById('recurringMessages');
            if (data.recurringMessages.length === 0) {
                recurringDiv.innerHTML = '<div class="empty">No recurring messages</div>';
            } else {
                const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                recurringDiv.innerHTML = data.recurringMessages.map(msg => 
                    \`<div class="message-item">
                        <div class="message-text">
                            <strong>\${msg.chatId}</strong><br>
                            \${msg.text}
                        </div>
                        <div class="message-time">Every \${weekdays[msg.weekday]} at \${String(msg.hour).padStart(2, '0')}:\${String(msg.minute).padStart(2, '0')}</div>
                    </div>\`
                ).join('');
            }

            // Update groups
            const groupsDiv = document.getElementById('groups');
            if (data.groups.length === 0) {
                groupsDiv.innerHTML = '<div class="empty">No groups found. Try refreshing groups or check your WhatsApp connection.</div>';
            } else {
                groupsDiv.innerHTML = data.groups.map(group => 
                    \`<div class="group-item">
                        <div class="message-text">
                            <strong>\${group.name}</strong><br>
                            <small style="color: #666;">\${group.id}</small>
                            \${group.description ? \`<br><em style="color: #888; font-size: 0.9em;">\${group.description.length > 100 ? group.description.substring(0, 100) + '...' : group.description}</em>\` : ''}
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                            <div class="message-time">
                                👥 \${group.participantCount} members
                                \${group.creation ? \`<br><small>Created: \${new Date(group.creation * 1000).toLocaleDateString()}</small>\` : ''}
                            </div>
                            <button class="btn" style="font-size: 12px; padding: 5px 10px;" onclick="copyGroupId('\${group.id}')">📋 Copy ID</button>
                        </div>
                    </div>\`
                ).join('');
            }
        }

        function refreshData() {
            fetchData();
        }

        function showStatus(message, isError = false) {
            const statusEl = document.getElementById('statusMessage');
            statusEl.textContent = message;
            statusEl.className = \`status-message \${isError ? 'status-error' : 'status-success'}\`;
            statusEl.style.display = 'block';
            
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }

        async function addScheduledMessage(event) {
            event.preventDefault();
            
            const formData = new FormData(event.target);
            const data = {
                chatId: formData.get('chatId'),
                text: formData.get('text'),
                datetime: formData.get('datetime')
            };

            try {
                const response = await fetch('/api/schedule', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showStatus('✅ Message scheduled successfully!');
                    event.target.reset();
                    fetchData(); // Refresh the list
                } else {
                    const error = await response.text();
                    showStatus(\`❌ Failed to schedule message: \${error}\`, true);
                }
            } catch (error) {
                showStatus(\`❌ Error: \${error.message}\`, true);
            }
        }

        async function deleteScheduledMessage(id) {
            if (!confirm('Are you sure you want to delete this scheduled message?')) {
                return;
            }

            try {
                const response = await fetch(\`/api/schedule/\${id}\`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    showStatus('✅ Message deleted successfully!');
                    fetchData(); // Refresh the list
                } else {
                    const error = await response.text();
                    showStatus(\`❌ Failed to delete message: \${error}\`, true);
                }
            } catch (error) {
                showStatus(\`❌ Error: \${error.message}\`, true);
            }
        }

        async function refreshGroups() {
            try {
                showStatus('🔄 Refreshing groups...', false);
                
                const response = await fetch('/api/refresh-groups', {
                    method: 'POST'
                });

                if (response.ok) {
                    const result = await response.json();
                    showStatus(\`✅ \${result.message}\`, false);
                    fetchData(); // Refresh the entire UI to show updated groups
                } else {
                    const error = await response.text();
                    showStatus(\`❌ Failed to refresh groups: \${error}\`, true);
                }
            } catch (error) {
                showStatus(\`❌ Error refreshing groups: \${error.message}\`, true);
            }
        }

        function copyGroupId(groupId) {
            // Copy to clipboard
            navigator.clipboard.writeText(groupId).then(() => {
                showStatus(\`📋 Group ID copied to clipboard: \${groupId}\`, false);
                
                // Also populate the chat ID field in the scheduling form
                const chatIdInput = document.getElementById('chatId');
                if (chatIdInput) {
                    chatIdInput.value = groupId;
                    chatIdInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    chatIdInput.focus();
                }
            }).catch(err => {
                console.error('Failed to copy group ID:', err);
                showStatus('❌ Failed to copy group ID to clipboard', true);
                
                // Fallback: still populate the form field
                const chatIdInput = document.getElementById('chatId');
                if (chatIdInput) {
                    chatIdInput.value = groupId;
                    chatIdInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    chatIdInput.focus();
                    showStatus('📝 Group ID added to message form', false);
                }
            });
        }

        // Set default datetime to 1 hour from now
        document.addEventListener('DOMContentLoaded', () => {
            const datetimeInput = document.getElementById('datetime');
            const now = new Date();
            now.setHours(now.getHours() + 1);
            datetimeInput.value = now.toISOString().slice(0, 16);
        });

        // Initial load and auto-refresh
        fetchData();
        setInterval(fetchData, 5000); // Refresh every 5 seconds
    </script>
</body>
</html>`;

// Node.js HTTP server
const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || '', `http://${req.headers.host}`);

  // Routes
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(dashboardHTML);
    return;
  }

  if (url.pathname === '/api/status') {
    const data = {
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

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
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

        // Insert into database
        const id = dbOps.insertScheduledMessage({ chatId, text, datetime });
        
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

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log("🌐 Web UI starting...");
  console.log(`📱 Dashboard: http://localhost:${PORT}`);
  console.log("🤖 Initializing WhatsApp bot...");
});

// Initialize the bot
initializeBot(); 