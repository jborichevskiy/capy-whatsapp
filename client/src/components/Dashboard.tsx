import React from 'react';
import { DashboardData } from '../types';
import StatusPanel from './StatusPanel';
import MessagesPanel from './MessagesPanel';
import './Dashboard.css';

interface DashboardProps {
  data: DashboardData;
}

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  return (
    <div className="dashboard">
      <div className="main-grid">
        <StatusPanel 
          connected={data.connected}
          phoneNumber={data.phoneNumber}
          lastConnectionTime={data.lastConnectionTime}
          groups={data.groups}
        />
        <MessagesPanel 
          scheduledMessages={data.scheduledMessages}
          recurringMessages={data.recurringMessages}
          groups={data.groups}
        />
      </div>
    </div>
  );
};

export default Dashboard; 