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
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #2a2a2a;
            color: #f5f5f5;
            line-height: 1.5;
            height: 100vh;
            overflow: hidden;
        }
        .container { 
            max-width: 100vw; 
            height: 100vh;
            padding: 16px;
            display: grid;
            grid-template-rows: 1fr;
        }
        .main-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            height: 100vh;
            overflow: hidden;
        }
        .column {
            background: #353535;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .column-with-form {
            position: relative;
        }
        .column-form-sticky {
            position: sticky;
            bottom: 0;
            z-index: 10;
            transition: all 0.3s ease;
        }
        .form-section.collapsed .form-content {
            display: none;
        }
        .form-header-clickable {
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
        }
        .form-header-clickable:hover {
            background: #7c3aed;
        }
        .form-toggle-icon {
            font-weight: bold;
            font-size: 14px;
            transition: transform 0.3s ease;
        }
        .form-section.collapsed .form-toggle-icon {
            transform: rotate(180deg);
        }
        .column-header {
            background: #8b5cf6;
            color: #ffffff;
            padding: 12px 16px;
            font-weight: 600;
            font-size: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 12px 12px 0 0;
        }
        .column-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: #404040;
        }
        .status-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 16px;
        }
        .status-item {
            padding: 12px;
            background: #4a4a4a;
            border-radius: 8px;
            font-size: 12px;
            border-left: 3px solid #8b5cf6;
        }
        .status-label { 
            font-weight: 600; 
            color: #d1d5db;
            margin-bottom: 4px;
        }
        .connected::before { content: "●"; color: #10b981; margin-right: 6px; }
        .disconnected::before { content: "○"; color: #ef4444; margin-right: 6px; }
        
        .form-section {
            background: #4a4a4a;
            border-radius: 8px;
            margin-bottom: 16px;
            overflow: hidden;
        }
        .form-header {
            background: #8b5cf6;
            color: #ffffff;
            padding: 10px 12px;
            font-size: 12px;
            font-weight: 600;
        }
        .form-content {
            padding: 16px;
        }
        .form-group {
            margin-bottom: 12px;
        }
        .form-group label {
            display: block;
            margin-bottom: 6px;
            font-size: 12px;
            font-weight: 600;
            color: #d1d5db;
        }
        .form-group input, .form-group textarea, .form-group select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #5a5a5a;
            border-radius: 6px;
            font-family: inherit;
            font-size: 12px;
            background: #2a2a2a;
            color: #f5f5f5;
            transition: border-color 0.2s ease;
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
        }
        .form-group select {
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f5f5f5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 16px;
            padding-right: 32px;
        }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
            outline: none;
            border-color: #8b5cf6;
            box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
        }
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        }
        .checkbox-group input[type="checkbox"] {
            width: auto;
            margin: 0;
        }
        .checkbox-group label {
            margin: 0;
            font-size: 12px;
            cursor: pointer;
        }
        .recurring-fields {
            display: none;
        }
        .recurring-fields.show {
            display: block;
        }
        .form-group textarea {
            height: 60px;
            resize: none;
        }
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
        .btn {
            background: #8b5cf6;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            cursor: pointer;
            font-family: inherit;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s ease;
        }
        .btn:hover {
            background: #7c3aed;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(139, 92, 246, 0.2);
        }
        .btn-danger {
            background: #ef4444;
            color: #ffffff;
        }
        .btn-danger:hover {
            background: #dc2626;
            box-shadow: 0 4px 8px rgba(239, 68, 68, 0.2);
        }
        .message-item, .group-item {
            padding: 12px;
            border-radius: 6px;
            background: #4a4a4a;
            margin-bottom: 8px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            transition: background-color 0.2s ease;
        }
        .message-item:hover, .group-item:hover {
            background: #525252;
        }
        .message-item:last-child, .group-item:last-child { margin-bottom: 0; }
        .message-text { 
            flex: 1; 
            word-break: break-word;
            line-height: 1.4;
        }
        .message-text strong {
            color: #8b5cf6;
        }
        .message-meta { 
            font-size: 11px; 
            text-align: right;
            white-space: nowrap;
            color: #d1d5db;
        }
        .empty { 
            text-align: center; 
            padding: 32px; 
            font-style: italic;
            font-size: 12px;
            color: #9ca3af;
        }
        .status-message {
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 12px;
            display: none;
            font-size: 12px;
            font-weight: 500;
        }
        .weekday-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 4px;
            margin-bottom: 12px;
        }
        .weekday-btn {
            padding: 6px;
            border: 1px solid #5a5a5a;
            background: #2a2a2a;
            color: #f5f5f5;
            border-radius: 4px;
            font-size: 10px;
            cursor: pointer;
            text-align: center;
            transition: all 0.2s ease;
        }
        .weekday-btn:hover {
            background: #404040;
        }
        .weekday-btn.selected {
            background: #8b5cf6;
            border-color: #8b5cf6;
            color: #ffffff;
        }
        .time-inputs {
            display: grid;
            grid-template-columns: 1fr auto 1fr 1fr;
            gap: 8px;
            align-items: center;
        }
        .time-inputs span {
            text-align: center;
            color: #d1d5db;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="main-grid">
            <!-- Column 1: Status & Groups -->
            <div class="column">
                <div class="column-header">
                    STATUS & GROUPS
                    <button class="btn" onclick="refreshGroups()">REFRESH</button>
                </div>
                <div class="column-content">
                    <div class="status-grid">
                        <div class="status-item">
                            <div class="status-label">CONNECTION</div>
                            <div id="connectionStatus">Loading...</div>
                        </div>
                        <div class="status-item">
                            <div class="status-label">PHONE</div>
                            <div id="phoneNumber">Loading...</div>
                        </div>
                        <div class="status-item">
                            <div class="status-label">LAST SEEN</div>
                            <div id="lastConnected">Loading...</div>
                        </div>
                        <div class="status-item">
                            <div class="status-label">GROUPS</div>
                            <div id="groupCount">Loading...</div>
                        </div>
                    </div>
                    
                    <div id="groups">Loading...</div>
                </div>
            </div>

            <!-- Column 2: Messages -->
            <div class="column column-with-form">
                <div class="column-header">
                    MESSAGES
                    <button class="btn" onclick="refreshData()">REFRESH</button>
                </div>
                <div class="column-content" style="padding-bottom: 80px;">
                    <div id="statusMessage" class="status-message"></div>
                    <div id="scheduledMessages">Loading...</div>
                    <div id="recurringMessages">Loading...</div>
                </div>
                
                <div class="form-section column-form-sticky collapsed" id="messageFormSection">
                    <div class="form-header form-header-clickable" onclick="toggleForm('messageFormSection')">
                        <span>ADD MESSAGE</span>
                        <span class="form-toggle-icon">▼</span>
                    </div>
                    <div class="form-content">
                        <form id="messageForm" onsubmit="addMessage(event)">
                            <div class="form-group">
                                <label>GROUP/CHAT:</label>
                                <select id="chatId" name="chatId" required>
                                    <option value="">Select group...</option>
                                </select>
                            </div>
                            
                            <div class="checkbox-group">
                                <input type="checkbox" id="isRecurring" name="isRecurring" onchange="toggleRecurringFields()">
                                <label for="isRecurring">Recurring Message</label>
                            </div>
                            
                            <div id="oneTimeFields">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>DATE:</label>
                                        <input type="date" id="scheduleDate" name="scheduleDate">
                                    </div>
                                    <div class="form-group">
                                        <label>TIME (MT):</label>
                                        <input type="time" id="scheduleTime" name="scheduleTime">
                                    </div>
                                </div>
                            </div>
                            
                            <div id="recurringFields" class="recurring-fields">
                                <div class="form-group">
                                    <label>DAYS:</label>
                                    <div class="weekday-grid">
                                        <div class="weekday-btn" data-day="0">SUN</div>
                                        <div class="weekday-btn" data-day="1">MON</div>
                                        <div class="weekday-btn" data-day="2">TUE</div>
                                        <div class="weekday-btn" data-day="3">WED</div>
                                        <div class="weekday-btn" data-day="4">THU</div>
                                        <div class="weekday-btn" data-day="5">FRI</div>
                                        <div class="weekday-btn" data-day="6">SAT</div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>TIME (MT):</label>
                                    <div class="time-inputs">
                                        <select id="recurringHour" name="hour">
                                            ${Array.from({length: 12}, (_, i) => {
                                                const hour = i === 0 ? 12 : i;
                                                return `<option value="${hour}">${hour}</option>`;
                                            }).join('')}
                                        </select>
                                        <span>:</span>
                                        <select id="recurringMinute" name="minute">
                                            ${Array.from({length: 60}, (_, i) => 
                                                `<option value="${i}">${i.toString().padStart(2, '0')}</option>`
                                            ).join('')}
                                        </select>
                                        <select id="recurringAmPm" name="ampm">
                                            <option value="AM">AM</option>
                                            <option value="PM">PM</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>MESSAGE:</label>
                                <textarea id="messageText" name="text" placeholder="Enter message..." required></textarea>
                            </div>
                            <button type="submit" class="btn">ADD MESSAGE</button>
                        </form>
                    </div>
                </div>
            </div>


        </div>
    </div>

    <script>
        let globalData = null;

        async function fetchData() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                globalData = data;
                updateUI(data);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            }
        }

        function getGroupName(chatId) {
            if (!globalData || !globalData.groups) return chatId;
            const group = globalData.groups.find(g => g.id === chatId);
            return group ? group.name : chatId;
        }

        function formatTime12Hour(hour24, minute) {
            const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
            const ampm = hour24 < 12 ? 'AM' : 'PM';
            return \`\${hour12}:\${String(minute).padStart(2, '0')} \${ampm}\`;
        }

        function updateUI(data) {
            // Update status
            document.getElementById('connectionStatus').innerHTML = 
                \`<span class="\${data.connected ? 'connected' : 'disconnected'}">\${data.connected ? 'ONLINE' : 'OFFLINE'}</span>\`;
            
            document.getElementById('phoneNumber').textContent = 
                data.phoneNumber ? data.phoneNumber.split(':')[0] : 'N/A';
            
            document.getElementById('lastConnected').textContent = 
                data.lastConnectionTime ? new Date(data.lastConnectionTime).toLocaleString().replace(/[/:]/g, '.').substring(0, 16) : 'NEVER';
            
            document.getElementById('groupCount').textContent = data.groups.length;

            // Update group dropdowns
            updateGroupDropdowns(data.groups);

            // Update scheduled messages
            const scheduledDiv = document.getElementById('scheduledMessages');
            if (data.scheduledMessages.length === 0) {
                scheduledDiv.innerHTML = '<div class="empty">NO SCHEDULED MESSAGES</div>';
            } else {
                scheduledDiv.innerHTML = '<h4 style="margin-bottom: 12px; color: #8b5cf6; font-size: 14px;">SCHEDULED</h4>' +
                    data.scheduledMessages.map(msg => 
                        \`<div class="message-item">
                            <div class="message-text">
                                <strong>\${getGroupName(msg.chatId)}</strong><br>
                                \${msg.text}
                            </div>
                            <div class="message-meta">
                                \${new Date(msg.datetime).toLocaleDateString()}<br>
                                \${new Date(msg.datetime).toLocaleTimeString().substring(0, 5)}<br>
                                <button class="btn btn-danger" onclick="deleteScheduledMessage(\${msg.id})">DEL</button>
                            </div>
                        </div>\`
                    ).join('');
            }

            // Update recurring messages
            const recurringDiv = document.getElementById('recurringMessages');
            if (data.recurringMessages.length === 0) {
                if (data.scheduledMessages.length === 0) {
                    recurringDiv.innerHTML = '<div class="empty">NO MESSAGES</div>';
                } else {
                    recurringDiv.innerHTML = '';
                }
            } else {
                const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                
                // Group messages by chatId, text, hour, and minute
                const grouped = {};
                data.recurringMessages.forEach(msg => {
                    const key = \`\${msg.chatId}|\${msg.text}|\${msg.hour}|\${msg.minute}\`;
                    if (!grouped[key]) {
                        grouped[key] = {
                            chatId: msg.chatId,
                            text: msg.text,
                            hour: msg.hour,
                            minute: msg.minute,
                            weekdays: [],
                            ids: []
                        };
                    }
                    grouped[key].weekdays.push(msg.weekday);
                    grouped[key].ids.push(msg.id);
                });
                
                const headerHtml = data.scheduledMessages.length > 0 ? 
                    '<h4 style="margin: 20px 0 12px 0; color: #8b5cf6; font-size: 14px;">RECURRING</h4>' :
                    '<h4 style="margin-bottom: 12px; color: #8b5cf6; font-size: 14px;">RECURRING</h4>';
                
                recurringDiv.innerHTML = headerHtml + Object.values(grouped).map(group => {
                    const sortedWeekdays = group.weekdays.sort((a, b) => a - b);
                    const weekdayText = sortedWeekdays.map(day => weekdays[day]).join(', ');
                    const idsParam = group.ids.join(',');
                    
                    return \`<div class="message-item">
                        <div class="message-text">
                            <strong>\${getGroupName(group.chatId)}</strong><br>
                            \${group.text}
                        </div>
                        <div class="message-meta">
                            \${weekdayText}<br>
                            \${formatTime12Hour(group.hour, group.minute)}<br>
                            <button class="btn btn-danger" onclick="deleteRecurringMessageGroup('\${idsParam}')">DEL</button>
                        </div>
                    </div>\`;
                }).join('');
            }

            // Update groups
            const groupsDiv = document.getElementById('groups');
            if (data.groups.length === 0) {
                groupsDiv.innerHTML = '<div class="empty">NO GROUPS FOUND</div>';
            } else {
                groupsDiv.innerHTML = data.groups.map(group => 
                    \`<div class="group-item">
                        <div class="message-text">
                            <strong>\${group.name}</strong><br>
                            \${group.id}
                        </div>
                        <div class="message-meta">
                            \${group.participantCount} MEMBERS<br>
                            <button class="btn" onclick="copyGroupId('\${group.id}')">COPY</button>
                        </div>
                    </div>\`
                ).join('');
            }
        }

        function updateGroupDropdowns(groups) {
            const chatSelect = document.getElementById('chatId');
            
            // Clear existing options except first
            chatSelect.innerHTML = '<option value="">Select group...</option>';
            
            // Add groups
            groups.forEach(group => {
                const option = new Option(group.name, group.id);
                chatSelect.add(option);
            });
        }

        function refreshData() {
            fetchData();
        }

        function showStatus(message, isError = false) {
            const statusEl = document.getElementById('statusMessage');
            statusEl.textContent = message;
            statusEl.style.display = 'block';
            statusEl.style.background = isError ? '#000000' : '#ffffff';
            statusEl.style.color = isError ? '#ffffff' : '#000000';
            
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }

        async function addMessage(event) {
            event.preventDefault();
            
            const formData = new FormData(event.target);
            const isRecurring = document.getElementById('isRecurring').checked;
            
            if (isRecurring) {
                // Handle recurring message
                if (selectedWeekdays.length === 0) {
                    showStatus('SELECT AT LEAST ONE DAY', true);
                    return;
                }
                
                // Convert 12-hour format to 24-hour format
                const hour12 = parseInt(formData.get('hour'));
                const ampm = formData.get('ampm');
                let hour24;
                
                if (ampm === 'AM') {
                    hour24 = hour12 === 12 ? 0 : hour12;
                } else {
                    hour24 = hour12 === 12 ? 12 : hour12 + 12;
                }
                
                // Add recurring message for each selected weekday
                const promises = selectedWeekdays.map(async (weekday) => {
                    const data = {
                        chatId: formData.get('chatId'),
                        text: formData.get('text'),
                        weekday: weekday,
                        hour: hour24,
                        minute: parseInt(formData.get('minute'))
                    };

                    return fetch('/api/recurring', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(data)
                    });
                });

                try {
                    const responses = await Promise.all(promises);
                    const allSuccessful = responses.every(response => response.ok);
                    
                    if (allSuccessful) {
                        showStatus('RECURRING MESSAGE ADDED');
                        event.target.reset();
                        selectedWeekdays = [];
                        document.querySelectorAll('.weekday-btn').forEach(btn => btn.classList.remove('selected'));
                        document.getElementById('isRecurring').checked = false;
                        toggleRecurringFields();
                        fetchData();
                    } else {
                        showStatus('ERROR ADDING RECURRING MESSAGE', true);
                    }
                } catch (error) {
                    showStatus(\`ERROR: \${error.message}\`, true);
                }
            } else {
                // Handle one-time scheduled message
                const date = formData.get('scheduleDate');
                const time = formData.get('scheduleTime');
                const datetime = \`\${date}T\${time}\`;
                
                const data = {
                    chatId: formData.get('chatId'),
                    text: formData.get('text'),
                    datetime: datetime
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
                        showStatus('MESSAGE SCHEDULED');
                        event.target.reset();
                        document.getElementById('isRecurring').checked = false;
                        toggleRecurringFields();
                        fetchData();
                    } else {
                        const error = await response.text();
                        showStatus(\`ERROR: \${error}\`, true);
                    }
                } catch (error) {
                    showStatus(\`ERROR: \${error.message}\`, true);
                }
            }
        }

        let selectedWeekdays = [];

        function initWeekdayButtons() {
            const weekdayButtons = document.querySelectorAll('.weekday-btn');
            weekdayButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    const day = parseInt(this.dataset.day);
                    const index = selectedWeekdays.indexOf(day);
                    
                    if (index > -1) {
                        selectedWeekdays.splice(index, 1);
                        this.classList.remove('selected');
                    } else {
                        selectedWeekdays.push(day);
                        this.classList.add('selected');
                    }
                });
            });
        }



        async function deleteRecurringMessage(id) {
            try {
                const response = await fetch(\`/api/recurring/\${id}\`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    showStatus('RECURRING MESSAGE DELETED');
                    fetchData();
                } else {
                    const error = await response.text();
                    showStatus(\`ERROR: \${error}\`, true);
                }
            } catch (error) {
                showStatus(\`ERROR: \${error.message}\`, true);
            }
        }

        async function deleteRecurringMessageGroup(ids) {
            try {
                const idArray = ids.split(',');
                const promises = idArray.map(id => 
                    fetch(\`/api/recurring/\${id.trim()}\`, { method: 'DELETE' })
                );
                
                const responses = await Promise.all(promises);
                const allSuccessful = responses.every(response => response.ok);
                
                if (allSuccessful) {
                    showStatus('RECURRING MESSAGE DELETED');
                    fetchData();
                } else {
                    showStatus('ERROR DELETING SOME MESSAGES', true);
                }
            } catch (error) {
                showStatus(\`ERROR: \${error.message}\`, true);
            }
        }

        async function deleteScheduledMessage(id) {
            try {
                const response = await fetch(\`/api/schedule/\${id}\`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    showStatus('SCHEDULED MESSAGE DELETED');
                    fetchData();
                } else {
                    const error = await response.text();
                    showStatus(\`ERROR: \${error}\`, true);
                }
            } catch (error) {
                showStatus(\`ERROR: \${error.message}\`, true);
            }
        }

        async function refreshGroups() {
            try {
                showStatus('REFRESHING GROUPS...');
                
                const response = await fetch('/api/refresh-groups', {
                    method: 'POST'
                });

                if (response.ok) {
                    const result = await response.json();
                    showStatus(\`REFRESHED \${result.groupCount} GROUPS\`);
                    fetchData();
                } else {
                    const error = await response.text();
                    showStatus(\`ERROR: \${error}\`, true);
                }
            } catch (error) {
                showStatus(\`ERROR: \${error.message}\`, true);
            }
        }

        function copyGroupId(groupId) {
            navigator.clipboard.writeText(groupId).then(() => {
                showStatus('GROUP ID COPIED');
                
                // Set the dropdown to this group
                document.getElementById('chatId').value = groupId;
            }).catch(err => {
                console.error('Failed to copy:', err);
                showStatus('COPY FAILED', true);
                
                // Fallback: still set the form field
                document.getElementById('chatId').value = groupId;
                showStatus('GROUP SELECTED');
            });
        }

        function toggleForm(formId) {
            const formSection = document.getElementById(formId);
            const isCollapsed = formSection.classList.contains('collapsed');
            
            if (isCollapsed) {
                formSection.classList.remove('collapsed');
            } else {
                formSection.classList.add('collapsed');
            }
        }

        function toggleRecurringFields() {
            const isRecurring = document.getElementById('isRecurring').checked;
            const oneTimeFields = document.getElementById('oneTimeFields');
            const recurringFields = document.getElementById('recurringFields');
            const dateInput = document.getElementById('scheduleDate');
            const timeInput = document.getElementById('scheduleTime');
            
            if (isRecurring) {
                oneTimeFields.style.display = 'none';
                recurringFields.classList.add('show');
                dateInput.removeAttribute('required');
                timeInput.removeAttribute('required');
            } else {
                oneTimeFields.style.display = 'block';
                recurringFields.classList.remove('show');
                dateInput.setAttribute('required', 'required');
                timeInput.setAttribute('required', 'required');
            }
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', () => {
            // Set default date/time to now + 1 hour
            const now = new Date();
            now.setHours(now.getHours() + 1);
            
            const dateInput = document.getElementById('scheduleDate');
            const timeInput = document.getElementById('scheduleTime');
            
            if (dateInput) dateInput.value = now.toISOString().split('T')[0];
            if (timeInput) timeInput.value = now.toTimeString().slice(0, 5);
            
            // Initialize weekday buttons
            initWeekdayButtons();
            
            // Initialize form field visibility
            toggleRecurringFields();
        });

        // Initial load and auto-refresh
        fetchData();
        setInterval(fetchData, 10000); // Refresh every 10 seconds
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

        // Insert into database
        const id = dbOps.insertRecurringMessage({ chatId, text, weekday, hour, minute });
        
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