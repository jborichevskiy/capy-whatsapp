import React, { useState, useEffect } from 'react';
import { Group } from '../types';

interface MessageFormProps {
  groups: Group[];
}

const MessageForm: React.FC<MessageFormProps> = ({ groups }) => {
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    chatId: '',
    text: '',
    scheduleDate: '',
    scheduleTime: '',
    hour: '12',
    minute: '0',
    ampm: 'AM'
  });

  // Set default date/time to now + 1 hour
  useEffect(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    
    setFormData(prev => ({
      ...prev,
      scheduleDate: now.toISOString().split('T')[0],
      scheduleTime: now.toTimeString().slice(0, 5)
    }));
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleWeekdayToggle = (day: number) => {
    setSelectedWeekdays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isRecurring) {
      // Handle recurring message
      if (selectedWeekdays.length === 0) {
        alert('SELECT AT LEAST ONE DAY');
        return;
      }
      
      // Convert 12-hour format to 24-hour format
      const hour12 = parseInt(formData.hour);
      const ampm = formData.ampm;
      let hour24: number;
      
      if (ampm === 'AM') {
        hour24 = hour12 === 12 ? 0 : hour12;
      } else {
        hour24 = hour12 === 12 ? 12 : hour12 + 12;
      }
      
      // Add recurring message for each selected weekday
      try {
        const promises = selectedWeekdays.map(async (weekday) => {
          const data = {
            chatId: formData.chatId,
            text: formData.text,
            weekday: weekday,
            hour: hour24,
            minute: parseInt(formData.minute)
          };

          return fetch('/api/recurring', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          });
        });

        const responses = await Promise.all(promises);
        const allSuccessful = responses.every(response => response.ok);
        
        if (allSuccessful) {
          // Reset form
          setFormData({
            chatId: '',
            text: '',
            scheduleDate: '',
            scheduleTime: '',
            hour: '12',
            minute: '0',
            ampm: 'AM'
          });
          setSelectedWeekdays([]);
          setIsRecurring(false);
          
          // Refresh page to show new data
          window.location.reload();
        } else {
          alert('ERROR ADDING RECURRING MESSAGE');
        }
      } catch (error) {
        console.error('Error adding recurring message:', error);
        alert('ERROR: ' + error);
      }
    } else {
      // Handle one-time scheduled message
      const datetime = `${formData.scheduleDate}T${formData.scheduleTime}`;
      
      const data = {
        chatId: formData.chatId,
        text: formData.text,
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
          // Reset form
          setFormData({
            chatId: '',
            text: '',
            scheduleDate: '',
            scheduleTime: '',
            hour: '12',
            minute: '0',
            ampm: 'AM'
          });
          setIsRecurring(false);
          
          // Refresh page to show new data
          window.location.reload();
        } else {
          const error = await response.text();
          alert(`ERROR: ${error}`);
        }
      } catch (error) {
        console.error('Error adding scheduled message:', error);
        alert(`ERROR: ${error}`);
      }
    }
  };

  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>GROUP/CHAT:</label>
        <select 
          name="chatId" 
          value={formData.chatId} 
          onChange={handleInputChange} 
          required
        >
          <option value="">Select group...</option>
          {groups.map(group => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="checkbox-group">
        <input 
          type="checkbox" 
          id="isRecurring" 
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
        />
        <label htmlFor="isRecurring">Recurring Message</label>
      </div>
      
      {!isRecurring && (
        <div className="form-row">
          <div className="form-group">
            <label>DATE:</label>
            <input 
              type="date" 
              name="scheduleDate" 
              value={formData.scheduleDate}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label>TIME (MT):</label>
            <input 
              type="time" 
              name="scheduleTime" 
              value={formData.scheduleTime}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>
      )}
      
      {isRecurring && (
        <>
          <div className="form-group">
            <label>DAYS:</label>
            <div className="weekday-grid">
              {weekdays.map((day, index) => (
                <div 
                  key={index}
                  className={`weekday-btn ${selectedWeekdays.includes(index) ? 'selected' : ''}`}
                  onClick={() => handleWeekdayToggle(index)}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>TIME (MT):</label>
            <div className="time-inputs">
              <select 
                name="hour" 
                value={formData.hour} 
                onChange={handleInputChange}
              >
                {Array.from({length: 12}, (_, i) => {
                  const hour = i === 0 ? 12 : i;
                  return (
                    <option key={hour} value={hour}>{hour}</option>
                  );
                })}
              </select>
              <span>:</span>
              <select 
                name="minute" 
                value={formData.minute} 
                onChange={handleInputChange}
              >
                {Array.from({length: 60}, (_, i) => (
                  <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <select 
                name="ampm" 
                value={formData.ampm} 
                onChange={handleInputChange}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
        </>
      )}
      
      <div className="form-group">
        <label>MESSAGE:</label>
        <textarea 
          name="text" 
          value={formData.text}
          onChange={handleInputChange}
          placeholder="Enter message..." 
          required
        />
      </div>
      <button type="submit" className="btn">ADD MESSAGE</button>
    </form>
  );
};

export default MessageForm; 