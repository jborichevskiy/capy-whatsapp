import { useEffect, useRef, useState } from 'react';
import { WebSocketMessage, DashboardData } from '../types';

export const useWebSocket = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualClose = useRef(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = process.env.NODE_ENV === 'development' 
          ? `${protocol}//${window.location.host}/ws`
          : `${protocol}//${window.location.hostname}:3000/ws`;
        
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          console.log('WebSocket connected');
          setConnected(true);
          setError(null);
          isManualClose.current = false;
          
          // Start heartbeat to keep connection alive
          heartbeatRef.current = setInterval(() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000); // Send ping every 30 seconds
        };

        ws.current.onmessage = (event: MessageEvent) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            handleMessage(message);
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.current.onclose = (event) => {
          console.log('WebSocket disconnected', { code: event.code, reason: event.reason });
          setConnected(false);
          
          // Clear heartbeat
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
          }
          
          // Only reconnect if it wasn't a clean close (code 1000) or manual disconnect
          if (event.code !== 1000 && event.code !== 1001 && !isManualClose.current) {
            console.log('Attempting to reconnect in 3 seconds...');
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        ws.current.onerror = (err: Event) => {
          console.error('WebSocket error:', err);
          setError('WebSocket connection failed');
        };
      } catch (err) {
        console.error('Failed to create WebSocket connection:', err);
        setError('Failed to connect to server');
      }
    };

    const handleMessage = (message: WebSocketMessage) => {
      switch (message.type) {
        case 'STATUS_UPDATE':
          setData(message.data);
          break;
        case 'CONNECTION_UPDATE':
          setData((prev: DashboardData | null) => prev ? { ...prev, connected: message.data.connected } : null);
          break;
        case 'GROUPS_UPDATE':
          setData((prev: DashboardData | null) => prev ? { ...prev, groups: message.data.groups } : null);
          break;
        case 'MESSAGES_UPDATE':
          setData((prev: DashboardData | null) => prev ? { 
            ...prev, 
            scheduledMessages: message.data.scheduledMessages,
            recurringMessages: message.data.recurringMessages
          } : null);
          break;
        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    };

    connect();

    return () => {
      isManualClose.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const sendMessage = (type: string, data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, data }));
    }
  };

  return {
    data,
    connected,
    error,
    sendMessage
  };
}; 