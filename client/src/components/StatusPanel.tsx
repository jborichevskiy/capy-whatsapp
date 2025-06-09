import React, { useState } from 'react';
import { Group } from '../types';
import './StatusPanel.css';

interface StatusPanelProps {
  connected: boolean;
  phoneNumber: string | null;
  lastConnectionTime: Date | null;
  groups: Group[];
}

const StatusPanel: React.FC<StatusPanelProps> = ({
  connected,
  phoneNumber,
  lastConnectionTime,
  groups
}) => {
  const [loading, setLoading] = useState(false);

  const refreshGroups = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/refresh-groups', {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to refresh groups');
      }
    } catch (error) {
      console.error('Error refreshing groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyGroupId = async (groupId: string) => {
    try {
      await navigator.clipboard.writeText(groupId);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy group ID:', error);
    }
  };

  const formatLastSeen = (date: Date | null) => {
    if (!date) return 'NEVER';
    return new Date(date).toLocaleString().replace(/[/:]/g, '.').substring(0, 16);
  };

  return (
    <div className="column">
      <div className="column-header">
        STATUS & GROUPS
        <button 
          className="btn" 
          onClick={refreshGroups}
          disabled={loading}
        >
          {loading ? 'REFRESHING...' : 'REFRESH'}
        </button>
      </div>
      <div className="column-content">
        <div className="status-grid">
          <div className="status-item">
            <div className="status-label">CONNECTION</div>
            <div className={`status-value ${connected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot">●</span>
              {connected ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">PHONE</div>
            <div className="status-value">
              {phoneNumber ? phoneNumber.split(':')[0] : 'N/A'}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">LAST SEEN</div>
            <div className="status-value">
              {formatLastSeen(lastConnectionTime)}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">GROUPS</div>
            <div className="status-value">{groups.length}</div>
          </div>
        </div>
        
        <div className="groups-list">
          {groups.length === 0 ? (
            <div className="empty">NO GROUPS FOUND</div>
          ) : (
            groups.map(group => (
              <div key={group.id} className="group-item">
                <div className="group-text">
                  <strong>{group.name}</strong><br/>
                  <span className="group-id">{group.id}</span>
                </div>
                <div className="group-meta">
                  {group.participantCount} MEMBERS<br/>
                  <button 
                    className="btn btn-small" 
                    onClick={() => copyGroupId(group.id)}
                  >
                    COPY
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusPanel; 