import React, { useState } from 'react';
import { ScheduledMessage, RecurringMessage, Group } from '../types';
import MessageForm from './MessageForm';
import './MessagesPanel.css';

interface MessagesPanelProps {
  scheduledMessages: ScheduledMessage[];
  recurringMessages: RecurringMessage[];
  groups: Group[];
}

const MessagesPanel: React.FC<MessagesPanelProps> = ({
  scheduledMessages,
  recurringMessages,
  groups
}) => {
  const [formCollapsed, setFormCollapsed] = useState(true);

  const getGroupName = (chatId: string) => {
    const group = groups.find(g => g.id === chatId);
    return group ? group.name : chatId;
  };

  const formatTime12Hour = (hour24: number, minute: number) => {
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 < 12 ? 'AM' : 'PM';
    return `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
  };

  const deleteScheduledMessage = async (id: number) => {
    try {
      const response = await fetch(`/api/schedule/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Failed to delete scheduled message');
      }
    } catch (error) {
      console.error('Error deleting scheduled message:', error);
    }
  };

  const deleteRecurringMessageGroup = async (ids: string) => {
    try {
      const idArray = ids.split(',');
      const promises = idArray.map(id => 
        fetch(`/api/recurring/${id.trim()}`, { method: 'DELETE' })
      );
      
      const responses = await Promise.all(promises);
      const allSuccessful = responses.every(response => response.ok);
      
      if (!allSuccessful) {
        throw new Error('Failed to delete some recurring messages');
      }
    } catch (error) {
      console.error('Error deleting recurring messages:', error);
    }
  };

  // Group recurring messages by chatId, text, hour, and minute
  const groupedRecurringMessages = React.useMemo(() => {
    const grouped: { [key: string]: {
      chatId: string;
      text: string;
      hour: number;
      minute: number;
      weekdays: number[];
      ids: number[];
    } } = {};

    recurringMessages.forEach(msg => {
      const key = `${msg.chatId}|${msg.text}|${msg.hour}|${msg.minute}`;
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

    return Object.values(grouped);
  }, [recurringMessages]);

  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="column column-with-form">
      <div className="column-header">
        MESSAGES
        <button className="btn" onClick={() => window.location.reload()}>
          REFRESH
        </button>
      </div>
      <div className="column-content" style={{ paddingBottom: '80px' }}>
        {/* Scheduled Messages */}
        {scheduledMessages.length > 0 && (
          <>
            <h4 className="section-header">SCHEDULED</h4>
            {scheduledMessages.map(msg => (
              <div key={msg.id} className="message-item">
                <div className="message-text">
                  <strong>{getGroupName(msg.chatId)}</strong><br/>
                  {msg.text}
                </div>
                <div className="message-meta">
                  {new Date(msg.datetime).toLocaleDateString()}<br/>
                  {new Date(msg.datetime).toLocaleTimeString().substring(0, 5)}<br/>
                  <button 
                    className="btn btn-danger btn-small" 
                    onClick={() => deleteScheduledMessage(msg.id)}
                  >
                    DEL
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Recurring Messages */}
        {groupedRecurringMessages.length > 0 && (
          <>
            <h4 className={`section-header ${scheduledMessages.length > 0 ? 'with-margin' : ''}`}>
              RECURRING
            </h4>
            {groupedRecurringMessages.map((group, index) => {
              const sortedWeekdays = group.weekdays.sort((a, b) => a - b);
              const weekdayText = sortedWeekdays.map(day => weekdays[day]).join(', ');
              const idsParam = group.ids.join(',');
              
              return (
                <div key={index} className="message-item">
                  <div className="message-text">
                    <strong>{getGroupName(group.chatId)}</strong><br/>
                    {group.text}
                  </div>
                  <div className="message-meta">
                    {weekdayText}<br/>
                    {formatTime12Hour(group.hour, group.minute)}<br/>
                    <button 
                      className="btn btn-danger btn-small" 
                      onClick={() => deleteRecurringMessageGroup(idsParam)}
                    >
                      DEL
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Empty State */}
        {scheduledMessages.length === 0 && groupedRecurringMessages.length === 0 && (
          <div className="empty">NO MESSAGES</div>
        )}
      </div>
      
      {/* Collapsible Form */}
      <div className={`form-section column-form-sticky ${formCollapsed ? 'collapsed' : ''}`}>
        <div 
          className="form-header form-header-clickable" 
          onClick={() => setFormCollapsed(!formCollapsed)}
        >
          <span>ADD MESSAGE</span>
          <span className="form-toggle-icon">▼</span>
        </div>
        <div className="form-content">
          <MessageForm groups={groups} />
        </div>
      </div>
    </div>
  );
};

export default MessagesPanel; 