# Scheduling Integration Module - Real-Time Update Mechanisms

## Overview
This document details the architecture for implementing real-time updates in the scheduling integration module. Real-time updates ensure that users receive immediate notifications about meeting changes, attendee responses, sync status, and other important events.

## Real-Time Architecture

### Technologies
1. **WebSocket**: Bidirectional real-time communication
2. **Server-Sent Events (SSE)**: Unidirectional server-to-client updates
3. **Push Notifications**: Mobile and desktop notifications
4. **Redis Pub/Sub**: Message broadcasting across multiple server instances

### Components
1. **WebSocket Server**: Manages WebSocket connections
2. **Event Publisher**: Publishes events to channels
3. **Event Subscriber**: Subscribes to and processes events
4. **Notification Service**: Sends push notifications
5. **Presence Manager**: Tracks online users and their subscriptions

### Data Flow
```
External Platform (Cal.com/Zoom/Google)
    ↓ (Webhook)
Webhook Handler
    ↓ (Publish Event)
Event Publisher
    ↓ (Redis Pub/Sub)
Event Subscriber
    ↓ (Broadcast)
WebSocket Server
    ↓ (Push to Client)
Frontend Application
```

## WebSocket Server

```typescript
// src/lib/websocket/websocket-server.ts
import { Server as WebSocketServer, WebSocket } from 'ws';
import { Redis } from 'ioredis';

interface WebSocketClient {
  socket: WebSocket;
  userId: string;
  workspaceId: string;
  subscriptions: Set<string>;
  lastPing: Date;
}

class WebSocketManager {
  private wss: WebSocketServer;
  private redis: Redis;
  private clients: Map<string, WebSocketClient>;
  private redisSubscriber: Redis;
  private redisPublisher: Redis;
  
  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    this.redis = new Redis(process.env.REDIS_URL);
    this.redisSubscriber = new Redis(process.env.REDIS_URL);
    this.redisPublisher = new Redis(process.env.REDIS_URL);
    this.clients = new Map();
    
    this.initialize();
  }
  
  private initialize(): void {
    this.wss.on('connection', (socket: WebSocket, req) => {
      this.handleConnection(socket, req);
    });
    
    // Subscribe to Redis channels
    this.redisSubscriber.subscribe('scheduling:events', (err) => {
      if (err) {
        console.error('Failed to subscribe to Redis channel:', err);
      }
    });
    
    this.redisSubscriber.on('message', (channel, message) => {
      if (channel === 'scheduling:events') {
        this.handleRedisMessage(message);
      }
    });
    
    // Start heartbeat
    this.startHeartbeat();
    
    console.log(`WebSocket server started on port ${this.wss.options.port}`);
  }
  
  private async handleConnection(socket: WebSocket, req): Promise<void> {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract user and workspace from query parameters or auth token
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');
    const workspaceId = url.searchParams.get('workspaceId');
    
    if (!userId || !workspaceId) {
      socket.close(1008, 'Missing authentication');
      return;
    }
    
    // Verify user has access to workspace
    const hasAccess = await this.verifyWorkspaceAccess(userId, workspaceId);
    if (!hasAccess) {
      socket.close(1008, 'Access denied');
      return;
    }
    
    const client: WebSocketClient = {
      socket,
      userId,
      workspaceId,
      subscriptions: new Set(),
      lastPing: new Date(),
    };
    
    this.clients.set(clientId, client);
    
    socket.on('message', (data: string) => {
      this.handleClientMessage(clientId, data);
    });
    
    socket.on('close', () => {
      this.handleDisconnection(clientId);
    });
    
    socket.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });
    
    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString(),
    });
  }
  
  private async handleClientMessage(clientId: string, data: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'subscribe':
          await this.handleSubscribe(clientId, message.channels);
          break;
        case 'unsubscribe':
          await this.handleUnsubscribe(clientId, message.channels);
          break;
        case 'ping':
          client.lastPing = new Date();
          this.sendToClient(clientId, { type: 'pong' });
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from client ${clientId}:`, error);
    }
  }
  
  private async handleSubscribe(clientId: string, channels: string[]): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    for (const channel of channels) {
      // Validate channel format
      if (!this.isValidChannel(channel, client.workspaceId)) {
        continue;
      }
      
      client.subscriptions.add(channel);
    }
    
    this.sendToClient(clientId, {
      type: 'subscribed',
      channels: Array.from(client.subscriptions),
    });
  }
  
  private async handleUnsubscribe(clientId: string, channels: string[]): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    for (const channel of channels) {
      client.subscriptions.delete(channel);
    }
    
    this.sendToClient(clientId, {
      type: 'unsubscribed',
      channels: Array.from(client.subscriptions),
    });
  }
  
  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    this.clients.delete(clientId);
    console.log(`Client disconnected: ${clientId}`);
  }
  
  private handleRedisMessage(message: string): void {
    try {
      const event = JSON.parse(message);
      this.broadcastEvent(event);
    } catch (error) {
      console.error('Error handling Redis message:', error);
    }
  }
  
  private broadcastEvent(event: SchedulingEvent): void {
    const targetChannel = event.channel;
    
    for (const [clientId, client] of this.clients.entries()) {
      if (client.subscriptions.has(targetChannel) || client.subscriptions.has('*')) {
        this.sendToClient(clientId, {
          type: 'event',
          event,
        });
      }
    }
  }
  
  private sendToClient(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      client.socket.send(JSON.stringify(data));
    } catch (error) {
      console.error(`Error sending to client ${clientId}:`, error);
      this.handleDisconnection(clientId);
    }
  }
  
  private isValidChannel(channel: string, workspaceId: string): boolean {
    // Channel format: workspace:{workspaceId}:meetings
    // or: workspace:{workspaceId}:meetings:{meetingId}
    const workspacePattern = new RegExp(`^workspace:${workspaceId}:(meetings|sync|attendees)(?::\\w+)?$`);
    return workspacePattern.test(channel);
  }
  
  private async verifyWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
    });
    
    return !!workspace;
  }
  
  private startHeartbeat(): void {
    setInterval(() => {
      const now = new Date();
      const timeout = 30000; // 30 seconds
      
      for (const [clientId, client] of this.clients.entries()) {
        if (now.getTime() - client.lastPing.getTime() > timeout) {
          console.log(`Client ${clientId} timed out`);
          client.socket.close(1000, 'Timeout');
        }
      }
    }, 10000); // Check every 10 seconds
  }
  
  async publishEvent(event: SchedulingEvent): Promise<void> {
    await this.redisPublisher.publish('scheduling:events', JSON.stringify(event));
  }
}

interface SchedulingEvent {
  channel: string;
  type: string;
  data: any;
  timestamp: string;
  userId?: string;
}
```

## Event Publisher

```typescript
// src/lib/events/event-publisher.ts
import { WebSocketManager } from '../websocket/websocket-server';

class EventPublisher {
  private wsManager: WebSocketManager;
  
  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
  }
  
  async publishMeetingCreated(meeting: Meeting): Promise<void> {
    await this.wsManager.publishEvent({
      channel: `workspace:${meeting.workspaceId}:meetings`,
      type: 'meeting.created',
      data: meeting,
      timestamp: new Date().toISOString(),
    });
  }
  
  async publishMeetingUpdated(meeting: Meeting): Promise<void> {
    await this.wsManager.publishEvent({
      channel: `workspace:${meeting.workspaceId}:meetings:${meeting.id}`,
      type: 'meeting.updated',
      data: meeting,
      timestamp: new Date().toISOString(),
    });
  }
  
  async publishMeetingDeleted(meetingId: string, workspaceId: string): Promise<void> {
    await this.wsManager.publishEvent({
      channel: `workspace:${workspaceId}:meetings:${meetingId}`,
      type: 'meeting.deleted',
      data: { meetingId },
      timestamp: new Date().toISOString(),
    });
  }
  
  async publishMeetingStatusChanged(
    meetingId: string,
    workspaceId: string,
    status: string
  ): Promise<void> {
    await this.wsManager.publishEvent({
      channel: `workspace:${workspaceId}:meetings:${meetingId}`,
      type: 'meeting.status_changed',
      data: { meetingId, status },
      timestamp: new Date().toISOString(),
    });
  }
  
  async publishAttendeeAdded(attendee: MeetingAttendee): Promise<void> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: attendee.meetingId },
      select: { workspaceId: true },
    });
    
    if (!meeting) return;
    
    await this.wsManager.publishEvent({
      channel: `workspace:${meeting.workspaceId}:meetings:${attendee.meetingId}`,
      type: 'attendee.added',
      data: attendee,
      timestamp: new Date().toISOString(),
    });
  }
  
  async publishAttendeeUpdated(attendee: MeetingAttendee): Promise<void> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: attendee.meetingId },
      select: { workspaceId: true },
    });
    
    if (!meeting) return;
    
    await this.wsManager.publishEvent({
      channel: `workspace:${meeting.workspaceId}:meetings:${attendee.meetingId}`,
      type: 'attendee.updated',
      data: attendee,
      timestamp: new Date().toISOString(),
    });
  }
  
  async publishSyncStarted(integrationId: string, workspaceId: string): Promise<void> {
    await this.wsManager.publishEvent({
      channel: `workspace:${workspaceId}:sync`,
      type: 'sync.started',
      data: { integrationId },
      timestamp: new Date().toISOString(),
    });
  }
  
  async publishSyncCompleted(
    integrationId: string,
    workspaceId: string,
    result: any
  ): Promise<void> {
    await this.wsManager.publishEvent({
      channel: `workspace:${workspaceId}:sync`,
      type: 'sync.completed',
      data: { integrationId, result },
      timestamp: new Date().toISOString(),
    });
  }
  
  async publishSyncFailed(
    integrationId: string,
    workspaceId: string,
    error: string
  ): Promise<void> {
    await this.wsManager.publishEvent({
      channel: `workspace:${workspaceId}:sync`,
      type: 'sync.failed',
      data: { integrationId, error },
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Notification Service

```typescript
// src/lib/notifications/notification-service.ts

interface Notification {
  id: string;
  userId: string;
  workspaceId: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  read: boolean;
  createdAt: Date;
}

class NotificationService {
  async createNotification(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<Notification> {
    const created = await prisma.notification.create({
      data: {
        ...notification,
        read: false,
        createdAt: new Date(),
      },
    });
    
    // Send real-time notification
    await this.sendRealtimeNotification(created);
    
    // Send push notification if enabled
    await this.sendPushNotification(created);
    
    return created;
  }
  
  async getNotifications(userId: string, options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<Notification[]> {
    const where: any = { userId };
    
    if (options.unreadOnly) {
      where.read = false;
    }
    
    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });
  }
  
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { read: true },
    });
  }
  
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
  
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }
  
  private async sendRealtimeNotification(notification: Notification): Promise<void> {
    const wsManager = new WebSocketManager();
    await wsManager.publishEvent({
      channel: `user:${notification.userId}:notifications`,
      type: 'notification.new',
      data: notification,
      timestamp: new Date().toISOString(),
    });
  }
  
  private async sendPushNotification(notification: Notification): Promise<void> {
    // Check if user has push notifications enabled
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { notificationsPush: true },
    });
    
    if (!user?.notificationsPush) {
      return;
    }
    
    // Get user's push subscription
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: notification.userId, isActive: true },
    });
    
    for (const subscription of subscriptions) {
      try {
        await this.sendWebPush(subscription, notification);
      } catch (error) {
        console.error('Failed to send push notification:', error);
        
        // Deactivate failed subscription
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: { isActive: false },
        });
      }
    }
  }
  
  private async sendWebPush(subscription: any, notification: Notification): Promise<void> {
    // Implement Web Push API
    // This would use a library like web-push
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      data: notification.data,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
    });
    
    // Send push notification using web-push library
    // await webpush.sendNotification(subscription, payload);
  }
}
```

## Presence Manager

```typescript
// src/lib/presence/presence-manager.ts
import { Redis } from 'ioredis';

interface PresenceInfo {
  userId: string;
  workspaceId: string;
  lastSeen: Date;
  status: 'online' | 'away' | 'offline';
}

class PresenceManager {
  private redis: Redis;
  private heartbeatInterval: NodeJS.Timeout;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.startHeartbeat();
  }
  
  async updatePresence(userId: string, workspaceId: string): Promise<void> {
    const key = `presence:${userId}:${workspaceId}`;
    const presence: PresenceInfo = {
      userId,
      workspaceId,
      lastSeen: new Date(),
      status: 'online',
    };
    
    await this.redis.setex(key, 300, JSON.stringify(presence)); // 5 minutes TTL
    
    // Publish presence update
    await this.redis.publish('presence:updates', JSON.stringify(presence));
  }
  
  async getPresence(userId: string, workspaceId: string): Promise<PresenceInfo | null> {
    const key = `presence:${userId}:${workspaceId}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    return JSON.parse(data);
  }
  
  async getWorkspacePresence(workspaceId: string): Promise<PresenceInfo[]> {
    const keys = await this.redis.keys(`presence:*:${workspaceId}`);
    
    if (keys.length === 0) return [];
    
    const values = await this.redis.mget(keys);
    const presences: PresenceInfo[] = [];
    
    for (const value of values) {
      if (value) {
        presences.push(JSON.parse(value));
      }
    }
    
    return presences;
  }
  
  async removePresence(userId: string, workspaceId: string): Promise<void> {
    const key = `presence:${userId}:${workspaceId}`;
    await this.redis.del(key);
    
    // Publish presence update
    await this.redis.publish('presence:updates', JSON.stringify({
      userId,
      workspaceId,
      status: 'offline',
      lastSeen: new Date(),
    }));
  }
  
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      await this.checkOfflineUsers();
    }, 60000); // Check every minute
  }
  
  private async checkOfflineUsers(): Promise<void> {
    const keys = await this.redis.keys('presence:*');
    const now = Date.now();
    const timeout = 300000; // 5 minutes
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (!data) continue;
      
      const presence: PresenceInfo = JSON.parse(data);
      const lastSeen = new Date(presence.lastSeen).getTime();
      
      if (now - lastSeen > timeout) {
        // User is offline
        await this.redis.del(key);
        
        await this.redis.publish('presence:updates', JSON.stringify({
          userId: presence.userId,
          workspaceId: presence.workspaceId,
          status: 'offline',
          lastSeen: new Date(),
        }));
      }
    }
  }
  
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
```

## Frontend WebSocket Client

```typescript
// src/lib/websocket/websocket-client.ts

class SchedulingWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions: Set<string> = new Set();
  private eventHandlers: Map<string, Function[]> = new Map();
  
  constructor(
    private userId: string,
    private workspaceId: string,
    private wsUrl: string = `ws://localhost:8080?userId=${userId}&workspaceId=${workspaceId}`
  ) {
    this.connect();
  }
  
  private connect(): void {
    this.ws = new WebSocket(this.wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Resubscribe to channels
      if (this.subscriptions.size > 0) {
        this.send({
          type: 'subscribe',
          channels: Array.from(this.subscriptions),
        });
      }
    };
    
    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.handleReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'connected':
          console.log('Connected to WebSocket server');
          break;
        case 'subscribed':
          console.log('Subscribed to channels:', message.channels);
          break;
        case 'unsubscribed':
          console.log('Unsubscribed from channels:', message.channels);
          break;
        case 'event':
          this.handleEvent(message.event);
          break;
        case 'pong':
          // Heartbeat response
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }
  
  private handleEvent(event: SchedulingEvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];
    handlers.forEach(handler => handler(event));
  }
  
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }
  
  subscribe(channels: string[]): void {
    channels.forEach(channel => this.subscriptions.add(channel));
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'subscribe',
        channels,
      });
    }
  }
  
  unsubscribe(channels: string[]): void {
    channels.forEach(channel => this.subscriptions.delete(channel));
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'unsubscribe',
        channels,
      });
    }
  }
  
  on(eventType: string, handler: Function): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }
  
  off(eventType: string, handler: Function): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  
  startHeartbeat(): void {
    setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000); // Send ping every 30 seconds
  }
  
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

## Usage Example

```typescript
// Example usage in a React component
import { useEffect, useState } from 'react';
import { SchedulingWebSocketClient } from '@/lib/websocket/websocket-client';

function MeetingList({ workspaceId, userId }) {
  const [meetings, setMeetings] = useState([]);
  const [wsClient, setWsClient] = useState(null);
  
  useEffect(() => {
    // Initialize WebSocket client
    const client = new SchedulingWebSocketClient(userId, workspaceId);
    setWsClient(client);
    
    // Subscribe to meeting updates
    client.subscribe([
      `workspace:${workspaceId}:meetings`,
      `workspace:${workspaceId}:sync`,
    ]);
    
    // Set up event handlers
    client.on('meeting.created', (event) => {
      setMeetings(prev => [...prev, event.data]);
    });
    
    client.on('meeting.updated', (event) => {
      setMeetings(prev =>
        prev.map(m => m.id === event.data.id ? event.data : m)
      );
    });
    
    client.on('meeting.deleted', (event) => {
      setMeetings(prev => prev.filter(m => m.id !== event.data.meetingId));
    });
    
    client.on('sync.completed', (event) => {
      console.log('Sync completed:', event.data);
      // Refresh meetings
      fetchMeetings();
    });
    
    // Start heartbeat
    client.startHeartbeat();
    
    return () => {
      client.disconnect();
    };
  }, [workspaceId, userId]);
  
  // ... rest of component
}
```

## Testing Strategy

### Unit Tests
- WebSocket connection handling
- Message parsing and routing
- Subscription management
- Event publishing and handling

### Integration Tests
- Real-time event broadcasting
- Multi-client synchronization
- Presence tracking
- Notification delivery

### End-to-End Tests
- User creates meeting → Other users see update
- Meeting status changes → Real-time notification
- Sync completes → Status update broadcast
- User goes offline → Presence update

## Performance Considerations

### Optimization Strategies
1. **Connection Pooling**: Reuse WebSocket connections
2. **Message Batching**: Batch multiple updates
3. **Selective Subscriptions**: Only subscribe to needed channels
4. **Presence Throttling**: Throttle presence updates

### Monitoring
- Track active connections
- Monitor message throughput
- Alert on high latency
- Track reconnection rates

## Security Considerations

### Best Practices
1. **Authenticate all connections**
2. **Validate all messages**
3. **Rate limit subscriptions**
4. **Encrypt sensitive data**
5. **Implement proper error handling**

## Next Steps
1. Implement WebSocket server
2. Create event publisher
3. Build notification service
4. Implement presence manager
5. Create frontend WebSocket client
6. Set up Redis Pub/Sub
7. Implement error handling and reconnection
8. Write comprehensive tests
9. Set up monitoring and alerting
