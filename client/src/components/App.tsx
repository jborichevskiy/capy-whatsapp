import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import Dashboard from './Dashboard';
import ConnectionStatus from './ConnectionStatus';
import './App.css';

const App: React.FC = () => {
  const { data, connected, error } = useWebSocket();

  if (error) {
    return (
      <div className="error-container">
        <h1>Connection Error</h1>
        <p>{error}</p>
        <p>Please make sure the server is running and try refreshing the page.</p>
      </div>
    );
  }

  if (!connected || !data) {
    return (
      <div className="loading-container">
        <h1>WhatsApp Bot Dashboard</h1>
        <p>Connecting to server...</p>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="app">
      <ConnectionStatus wsConnected={connected} botConnected={data.connected} />
      <Dashboard data={data} />
    </div>
  );
};

export default App; 