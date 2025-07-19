import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import Dashboard from './Dashboard';
import ConnectionStatus from './ConnectionStatus';
import './App.css';

const App: React.FC = () => {
  const { data, connected, error } = useWebSocket();
  const [showModal, setShowModal] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem('capyModalDismissed');
    if (dismissed === 'true') {
      setShowModal(false);
    }
  }, []);

  const handleDismissModal = () => {
    setShowModal(false);
    localStorage.setItem('capyModalDismissed', 'true');
  };

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
      {showModal && (
        <div className="modal-overlay" onClick={handleDismissModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img src="/profile.png" alt="Capy" className="modal-image" />
            <p className="modal-text">
              This is Capy, a WhatsApp notifier bot built by Jon. It doesn't have authentication at the moment and you're welcome to look around but if you want any clarification or help, talk to Jon!
            </p>
            <button onClick={handleDismissModal} className="modal-button">
              I agree
            </button>
          </div>
        </div>
      )}
      <ConnectionStatus wsConnected={connected} botConnected={data.connected} />
      <Dashboard data={data} />
    </div>
  );
};

export default App; 