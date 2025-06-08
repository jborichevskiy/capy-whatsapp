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

// Start the bot
async function initializeBot() {
  try {
    console.log("🚀 Initializing WhatsApp Bot...");
    sock = await createBot();
    
    // Setup scheduler
    setupScheduler(sock);
    
    // Listen for connection updates
    sock.ev.on("connection.update", (update: any) => {
      const { connection } = update;
      botState.connected = connection === "open";
      if (botState.connected) {
        botState.lastConnectionTime = new Date();
        console.log("✅ WhatsApp connected for web UI");
      }
    });

    // Get phone number when available
    sock.ev.on("creds.update", () => {
      if (sock.user?.id) {
        botState.phoneNumber = sock.user.id.split('@')[0];
      }
    });

    // Track groups
    sock.ev.on("chats.set", (chats: any) => {
      botState.groups = chats.filter((chat: any) => chat.id.includes('@g.us')).map((group: any) => ({
        id: group.id,
        name: group.name || 'Unknown Group',
        participantCount: group.participants?.length || 0
      }));
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
            align-items: center;
        }
        .message-item:last-child, .group-item:last-child { border-bottom: none; }
        .message-text { flex: 1; margin-right: 15px; }
        .message-time { color: #666; font-size: 0.9em; }
        .refresh-btn {
            background: #25D366;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        .refresh-btn:hover { background: #128C7E; }
        .empty { color: #666; font-style: italic; text-align: center; padding: 40px; }
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
            <div class="section-content" id="scheduledMessages">
                Loading...
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
                        <div class="message-time">\${new Date(msg.datetime).toLocaleString()}</div>
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
                groupsDiv.innerHTML = '<div class="empty">No groups found</div>';
            } else {
                groupsDiv.innerHTML = data.groups.map(group => 
                    \`<div class="group-item">
                        <div class="message-text">
                            <strong>\${group.name}</strong><br>
                            <small>\${group.id}</small>
                        </div>
                        <div class="message-time">\${group.participantCount} members</div>
                    </div>\`
                ).join('');
            }
        }

        function refreshData() {
            fetchData();
        }

        // Initial load and auto-refresh
        fetchData();
        setInterval(fetchData, 5000); // Refresh every 5 seconds
    </script>
</body>
</html>`;

// Bun server
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Routes
    if (url.pathname === "/") {
      return new Response(dashboardHTML, {
        headers: { 
          "Content-Type": "text/html",
          ...corsHeaders 
        },
      });
    }

    if (url.pathname === "/api/status") {
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

      return new Response(JSON.stringify(data), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
      });
    }

    return new Response("Not Found", { 
      status: 404,
      headers: corsHeaders 
    });
  },
});

console.log("🌐 Web UI starting...");
console.log(`📱 Dashboard: http://localhost:${server.port}`);
console.log("🤖 Initializing WhatsApp bot...");

// Initialize the bot
initializeBot(); 