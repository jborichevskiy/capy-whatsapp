import React from 'react';

interface ConnectionStatusProps {
  wsConnected: boolean;
  botConnected: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ wsConnected, botConnected }) => {
  return (
    <div className="connection-status">
      <div className="status-item">
        <span className={`status-indicator ${wsConnected ? 'connected' : 'disconnected'}`}>
          ●
        </span>
        WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}
      </div>
      <div className="status-item">
        <span className={`status-indicator ${botConnected ? 'connected' : 'disconnected'}`}>
          ●
        </span>
        WhatsApp Bot: {botConnected ? 'Online' : 'Offline'}
      </div>
    </div>
  );
};

export default ConnectionStatus; 