# Scheduling Integration Module - Synchronization Service Architecture

## Overview
This document details the architecture for the synchronization service that manages bidirectional data flow between the CRM system and external calendar/meeting platforms (Cal.com, Zoom, Google Meet). The service ensures data consistency, handles conflicts, and provides real-time updates.

## Synchronization Architecture

### Core Principles
1. **Event-Driven**: React to changes in real-time
2. **Conflict Resolution**: Handle conflicting updates intelligently
3. **Idempotency**: Safe to retry operations
4. **Scalability**: Handle multiple integrations concurrently
5. **Observability**: Track all sync operations

### Components
1. **Sync Orchestrator**: Manages sync operations across all integrations
2. **Conflict Resolver**: Handles data conflicts
3. **Sync Queue**: Queues sync operations for processing
4. **Sync Scheduler**: Schedules periodic syncs
5. **Sync Monitor**: Monitors sync health and performance

### Data Flow
```
External Platform (Cal.com/Zoom/Google)
    ↓ (Webhook/Change Event)
Sync Orchestrator
    ↓ (Process Event)
Conflict Resolver
    ↓ (Resolve Conflicts)
Sync Queue
    ↓ (Queue Operation)
Sync Worker
    ↓ (Execute Sync)
CRM Database
    ↓ (Notify)
Real-time Update Service
```

## Sync Orchestrator

```typescript
// src/lib/sync/sync-orchestrator.ts
interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'meeting' | 'attendee' | 'booking';
  integrationId: string;
  platform: 'calcom' | 'zoom' | 'google';
  data: any;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  maxRetries: number;
  scheduledFor: Date;
  createdAt: Date;
}

interface SyncResult {
  operationId: string;
  status: 'success' | 'failed' | 'partial';
  data?: any;
  error?: string;
  duration: number;
}

class SyncOrchestrator {
  private syncQueue: SyncQueue;
  private conflictResolver: ConflictResolver;
  private syncWorkers: Map<string, SyncWorker>;
  
  constructor() {
    this.syncQueue = new SyncQueue();
    this.conflictResolver = new ConflictResolver();
    this.syncWorkers = new Map();
  }
  
  async initialize(): Promise<void> {
    // Initialize sync workers for each active integration
    const integrations = await prisma.calendarIntegration.findMany({
      where: {
        isActive: true,
        syncEnabled: true,
      },
    });
    
    for (const integration of integrations) {
      await this.startWorker(integration.id, integration.type);
    }
    
    // Start queue processor
    this.startQueueProcessor();
  }
  
  async startWorker(integrationId: string, platform: string): Promise<void> {
    let worker: SyncWorker;
    
    switch (platform) {
      case 'calcom':
        worker = new CalcomSyncWorker(integrationId);
        break;
      case 'zoom':
        worker = new ZoomSyncWorker(integrationId);
        break;
      case 'google':
        worker = new GoogleSyncWorker(integrationId);
        break;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
    
    this.syncWorkers.set(integrationId, worker);
    await worker.start();
  }
  
  async stopWorker(integrationId: string): Promise<void> {
    const worker = this.syncWorkers.get(integrationId);
    if (worker) {
      await worker.stop();
      this.syncWorkers.delete(integrationId);
    }
  }
  
  async queueOperation(operation: SyncOperation): Promise<string> {
    const operationId = await this.syncQueue.enqueue(operation);
    return operationId;
  }
  
  async syncMeeting(
    integrationId: string,
    meetingId: string,
    direction: 'import' | 'export' | 'bidirectional'
  ): Promise<SyncResult> {
    const integration = await prisma.calendarIntegration.findUnique({
      where: { id: integrationId },
    });
    
    if (!integration) {
      throw new Error('Integration not found');
    }
    
    const worker = this.syncWorkers.get(integrationId);
    if (!worker) {
      throw new Error('Sync worker not found');
    }
    
    const startTime = Date.now();
    
    try {
      let result: any;
      
      switch (direction) {
        case 'import':
          result = await worker.importMeeting(meetingId);
          break;
        case 'export':
          result = await worker.exportMeeting(meetingId);
          break;
        case 'bidirectional':
          result = await worker.syncMeeting(meetingId);
          break;
      }
      
      return {
        operationId: `manual-${meetingId}`,
        status: 'success',
        data: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        operationId: `manual-${meetingId}`,
        status: 'failed',
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }
  
  async syncAllMeetings(
    integrationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SyncResult> {
    const integration = await prisma.calendarIntegration.findUnique({
      where: { id: integrationId },
    });
    
    if (!integration) {
      throw new Error('Integration not found');
    }
    
    const worker = this.syncWorkers.get(integrationId);
    if (!worker) {
      throw new Error('Sync worker not found');
    }
    
    const startTime = Date.now();
    
    try {
      const result = await worker.syncAllMeetings(startDate, endDate);
      
      return {
        operationId: `full-sync-${integrationId}`,
        status: 'success',
        data: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        operationId: `full-sync-${integrationId}`,
        status: 'failed',
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }
  
  private startQueueProcessor(): void {
    setInterval(async () => {
      await this.processQueue();
    }, 5000); // Process queue every 5 seconds
  }
  
  private async processQueue(): Promise<void> {
    const operations = await this.syncQueue.dequeue(10); // Process up to 10 operations
    
    for (const operation of operations) {
      await this.processOperation(operation);
    }
  }
  
  private async processOperation(operation: SyncOperation): Promise<void> {
    const worker = this.syncWorkers.get(operation.integrationId);
    if (!worker) {
      console.error(`No worker found for integration: ${operation.integrationId}`);
      return;
    }
    
    try {
      await worker.processOperation(operation);
      await this.syncQueue.markComplete(operation.id);
    } catch (error) {
      operation.retryCount++;
      
      if (operation.retryCount >= operation.maxRetries) {
        await this.syncQueue.markFailed(operation.id, error.message);
      } else {
        // Exponential backoff
        const delay = Math.pow(2, operation.retryCount) * 1000;
        operation.scheduledFor = new Date(Date.now() + delay);
        await this.syncQueue.requeue(operation);
      }
    }
  }
}
```

## Sync Queue

```typescript
// src/lib/sync/sync-queue.ts
import { Redis } from 'ioredis';

class SyncQueue {
  private redis: Redis;
  private queueName = 'sync:operations';
  private processingName = 'sync:processing';
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }
  
  async enqueue(operation: SyncOperation): Promise<string> {
    const operationId = operation.id || `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const operationWithId = {
      ...operation,
      id: operationId,
      createdAt: operation.createdAt || new Date(),
    };
    
    // Add to Redis list based on priority
    const listName = `${this.queueName}:${operation.priority}`;
    await this.redis.lpush(listName, JSON.stringify(operationWithId));
    
    return operationId;
  }
  
  async dequeue(limit: number = 10): Promise<SyncOperation[]> {
    const operations: SyncOperation[] = [];
    
    // Try to get operations from high, normal, and low priority queues
    const priorities: Array<'high' | 'normal' | 'low'> = ['high', 'normal', 'low'];
    
    for (const priority of priorities) {
      const listName = `${this.queueName}:${priority}`;
      
      while (operations.length < limit) {
        const data = await this.redis.rpop(listName);
        if (!data) break;
        
        const operation = JSON.parse(data) as SyncOperation;
        
        // Check if operation is scheduled for now or in the past
        if (operation.scheduledFor <= new Date()) {
          operations.push(operation);
          
          // Move to processing queue
          await this.redis.lpush(this.processingName, JSON.stringify(operation));
        } else {
          // Put back in queue
          await this.redis.lpush(listName, JSON.stringify(operation));
          break;
        }
      }
    }
    
    return operations;
  }
  
  async markComplete(operationId: string): Promise<void> {
    // Remove from processing queue
    await this.redis.lrem(this.processingName, 0, operationId);
    
    // Log completion
    await this.logOperation(operationId, 'completed');
  }
  
  async markFailed(operationId: string, error: string): Promise<void> {
    // Remove from processing queue
    await this.redis.lrem(this.processingName, 0, operationId);
    
    // Log failure
    await this.logOperation(operationId, 'failed', error);
  }
  
  async requeue(operation: SyncOperation): Promise<void> {
    // Remove from processing queue
    await this.redis.lrem(this.processingName, 0, operation.id);
    
    // Add back to queue
    await this.enqueue(operation);
  }
  
  async getQueueLength(): Promise<{ high: number; normal: number; low: number }> {
    const [high, normal, low] = await Promise.all([
      this.redis.llen(`${this.queueName}:high`),
      this.redis.llen(`${this.queueName}:normal`),
      this.redis.llen(`${this.queueName}:low`),
    ]);
    
    return { high, normal, low };
  }
  
  async getProcessingCount(): Promise<number> {
    return this.redis.llen(this.processingName);
  }
  
  private async logOperation(
    operationId: string,
    status: string,
    error?: string
  ): Promise<void> {
    const logKey = `sync:log:${operationId}`;
    const logEntry = {
      operationId,
      status,
      error,
      timestamp: new Date().toISOString(),
    };
    
    await this.redis.setex(logKey, 86400, JSON.stringify(logEntry)); // Keep for 24 hours
  }
}
```

## Conflict Resolver

```typescript
// src/lib/sync/conflict-resolver.ts

interface Conflict {
  localData: any;
  remoteData: any;
  conflictFields: string[];
  lastModifiedLocal: Date;
  lastModifiedRemote: Date;
}

interface ResolutionStrategy {
  strategy: 'local_wins' | 'remote_wins' | 'manual' | 'merge';
  resolution?: any;
}

class ConflictResolver {
  async resolveConflict(
    conflict: Conflict,
    strategy: ResolutionStrategy
  ): Promise<any> {
    switch (strategy.strategy) {
      case 'local_wins':
        return conflict.localData;
      
      case 'remote_wins':
        return conflict.remoteData;
      
      case 'manual':
        throw new Error('Manual resolution required');
      
      case 'merge':
        return this.mergeData(conflict.localData, conflict.remoteData, conflict.conflictFields);
      
      default:
        throw new Error(`Unknown resolution strategy: ${strategy.strategy}`);
    }
  }
  
  async detectConflict(localData: any, remoteData: any): Promise<Conflict | null> {
    const conflictFields: string[] = [];
    
    // Compare fields
    const fieldsToCompare = ['title', 'description', 'startTime', 'endTime', 'location'];
    
    for (const field of fieldsToCompare) {
      if (this.fieldChanged(localData[field], remoteData[field])) {
        conflictFields.push(field);
      }
    }
    
    if (conflictFields.length === 0) {
      return null; // No conflict
    }
    
    return {
      localData,
      remoteData,
      conflictFields,
      lastModifiedLocal: localData.updatedAt || localData.createdAt,
      lastModifiedRemote: remoteData.updatedAt || remoteData.createdAt,
    };
  }
  
  private fieldChanged(localValue: any, remoteValue: any): boolean {
    if (localValue === undefined || remoteValue === undefined) {
      return false;
    }
    
    if (localValue instanceof Date && remoteValue instanceof Date) {
      return Math.abs(localValue.getTime() - remoteValue.getTime()) > 1000; // 1 second tolerance
    }
    
    return localValue !== remoteValue;
  }
  
  private mergeData(localData: any, remoteData: any, conflictFields: string[]): any {
    const merged = { ...localData };
    
    for (const field of conflictFields) {
      // Use the most recently modified value
      const localModified = localData.updatedAt || localData.createdAt;
      const remoteModified = remoteData.updatedAt || remoteData.createdAt;
      
      if (remoteModified > localModified) {
        merged[field] = remoteData[field];
      }
    }
    
    return merged;
  }
  
  async getResolutionStrategy(
    integrationId: string,
    conflictType: string
  ): Promise<ResolutionStrategy> {
    // Check if there's a custom resolution strategy for this integration
    const integration = await prisma.calendarIntegration.findUnique({
      where: { id: integrationId },
    });
    
    if (integration?.metadata) {
      const metadata = JSON.parse(integration.metadata);
      if (metadata.resolutionStrategies?.[conflictType]) {
        return metadata.resolutionStrategies[conflictType];
      }
    }
    
    // Default strategy: remote wins for external events, local wins for internal
    return {
      strategy: conflictType === 'external_event' ? 'remote_wins' : 'local_wins',
    };
  }
}
```

## Sync Worker (Base Class)

```typescript
// src/lib/sync/sync-worker.ts

abstract class SyncWorker {
  protected integrationId: string;
  protected tokenManager: TokenManager;
  
  constructor(integrationId: string) {
    this.integrationId = integrationId;
    this.tokenManager = new TokenManager();
  }
  
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract processOperation(operation: SyncOperation): Promise<void>;
  abstract importMeeting(meetingId: string): Promise<any>;
  abstract exportMeeting(meetingId: string): Promise<any>;
  abstract syncMeeting(meetingId: string): Promise<any>;
  abstract syncAllMeetings(startDate: Date, endDate: Date): Promise<any>;
  
  protected async getIntegration(): Promise<CalendarIntegration> {
    const integration = await prisma.calendarIntegration.findUnique({
      where: { id: this.integrationId },
    });
    
    if (!integration) {
      throw new Error('Integration not found');
    }
    
    return integration;
  }
  
  protected async logSync(
    operationType: string,
    status: string,
    metadata: any
  ): Promise<void> {
    await prisma.calendarSyncLog.create({
      data: {
        calendarIntegrationId: this.integrationId,
        operationType,
        status,
        ...metadata,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }
}
```

## Calcom Sync Worker

```typescript
// src/lib/sync/calcom-sync-worker.ts
import { SyncWorker } from './sync-worker';
import { EventSynchronizer } from '../calcom/event-synchronizer';

class CalcomSyncWorker extends SyncWorker {
  private eventSynchronizer: EventSynchronizer;
  
  constructor(integrationId: string) {
    super(integrationId);
    this.eventSynchronizer = new EventSynchronizer();
  }
  
  async start(): Promise<void> {
    // Start periodic sync
    setInterval(async () => {
      await this.periodicSync();
    }, 3600000); // Sync every hour
  }
  
  async stop(): Promise<void> {
    // Cleanup
  }
  
  async processOperation(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create':
        await this.handleCreate(operation);
        break;
      case 'update':
        await this.handleUpdate(operation);
        break;
      case 'delete':
        await this.handleDelete(operation);
        break;
    }
  }
  
  async importMeeting(meetingId: string): Promise<any> {
    const result = await this.eventSynchronizer.syncEvents(this.integrationId, {
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
      direction: 'import',
    });
    
    return result;
  }
  
  async exportMeeting(meetingId: string): Promise<any> {
    const result = await this.eventSynchronizer.syncEvents(this.integrationId, {
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      direction: 'export',
    });
    
    return result;
  }
  
  async syncMeeting(meetingId: string): Promise<any> {
    const result = await this.eventSynchronizer.syncEvents(this.integrationId, {
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      direction: 'bidirectional',
    });
    
    return result;
  }
  
  async syncAllMeetings(startDate: Date, endDate: Date): Promise<any> {
    const result = await this.eventSynchronizer.syncEvents(this.integrationId, {
      startDate,
      endDate,
      direction: 'bidirectional',
    });
    
    return result;
  }
  
  private async periodicSync(): Promise<void> {
    try {
      const integration = await this.getIntegration();
      
      if (!integration.syncEnabled || integration.syncStatus !== 'active') {
        return;
      }
      
      const result = await this.syncAllMeetings(
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      
      await this.logSync('periodic_sync', 'completed', result);
    } catch (error) {
      await this.logSync('periodic_sync', 'failed', { error: error.message });
    }
  }
  
  private async handleCreate(operation: SyncOperation): Promise<void> {
    // Handle create operation
  }
  
  private async handleUpdate(operation: SyncOperation): Promise<void> {
    // Handle update operation
  }
  
  private async handleDelete(operation: SyncOperation): Promise<void> {
    // Handle delete operation
  }
}
```

## Sync Scheduler

```typescript
// src/lib/sync/sync-scheduler.ts
import cron from 'node-cron';

class SyncScheduler {
  private orchestrator: SyncOrchestrator;
  
  constructor(orchestrator: SyncOrchestrator) {
    this.orchestrator = orchestrator;
  }
  
  start(): void {
    // Schedule hourly sync for all integrations
    cron.schedule('0 * * * *', async () => {
      await this.scheduleHourlySync();
    });
    
    // Schedule daily full sync at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.scheduleDailyFullSync();
    });
    
    // Schedule weekly cleanup at 3 AM on Sunday
    cron.schedule('0 3 * * 0', async () => {
      await this.scheduleWeeklyCleanup();
    });
  }
  
  private async scheduleHourlySync(): Promise<void> {
    const integrations = await prisma.calendarIntegration.findMany({
      where: {
        isActive: true,
        syncEnabled: true,
        syncFrequency: 'hourly',
      },
    });
    
    for (const integration of integrations) {
      await this.orchestrator.syncAllMeetings(
        integration.id,
        new Date(),
        new Date(Date.now() + 24 * 60 * 60 * 1000) // Next 24 hours
      );
    }
  }
  
  private async scheduleDailyFullSync(): Promise<void> {
    const integrations = await prisma.calendarIntegration.findMany({
      where: {
        isActive: true,
        syncEnabled: true,
        syncFrequency: {
          in: ['daily', 'hourly'],
        },
      },
    });
    
    for (const integration of integrations) {
      await this.orchestrator.syncAllMeetings(
        integration.id,
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
      );
    }
  }
  
  private async scheduleWeeklyCleanup(): Promise<void> {
    // Clean up old sync logs
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    await prisma.calendarSyncLog.deleteMany({
      where: {
        startedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });
  }
}
```

## Sync Monitor

```typescript
// src/lib/sync/sync-monitor.ts

class SyncMonitor {
  async getSyncHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: any;
  }> {
    const issues: string[] = [];
    const metrics: any = {};
    
    // Check active integrations
    const activeIntegrations = await prisma.calendarIntegration.findMany({
      where: {
        isActive: true,
        syncEnabled: true,
      },
    });
    
    metrics.activeIntegrations = activeIntegrations.length;
    
    // Check for failed integrations
    const failedIntegrations = activeIntegrations.filter(
      i => i.syncStatus === 'error'
    );
    
    if (failedIntegrations.length > 0) {
      issues.push(`${failedIntegrations.length} integration(s) in error state`);
    }
    
    metrics.failedIntegrations = failedIntegrations.length;
    
    // Check recent sync failures
    const recentFailures = await prisma.calendarSyncLog.findMany({
      where: {
        status: 'failed',
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });
    
    metrics.recentFailures = recentFailures.length;
    
    if (recentFailures.length > 10) {
      issues.push('High number of recent sync failures');
    }
    
    // Check queue length
    const queue = new SyncQueue();
    const queueLength = await queue.getQueueLength();
    const processingCount = await queue.getProcessingCount();
    
    metrics.queueLength = queueLength;
    metrics.processingCount = processingCount;
    
    if (queueLength.high > 100 || queueLength.normal > 500 || queueLength.low > 1000) {
      issues.push('Sync queue backlog detected');
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      metrics,
    };
  }
  
  async getSyncMetrics(integrationId?: string): Promise<any> {
    const where: any = {};
    
    if (integrationId) {
      where.calendarIntegrationId = integrationId;
    }
    
    const logs = await prisma.calendarSyncLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    
    const successful = logs.filter(l => l.status === 'completed');
    const failed = logs.filter(l => l.status === 'failed');
    
    const avgDuration = successful.reduce((sum, log) => sum + (log.durationMs || 0), 0) / successful.length;
    
    return {
      total: logs.length,
      successful: successful.length,
      failed: failed.length,
      successRate: (successful.length / logs.length) * 100,
      avgDuration,
      lastSync: logs[0]?.startedAt,
    };
  }
}
```

## API Endpoints

### Trigger Manual Sync
```typescript
// src/app/api/sync/trigger/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { integrationId, meetingId, direction } = body;
  
  const orchestrator = new SyncOrchestrator();
  
  let result;
  if (meetingId) {
    result = await orchestrator.syncMeeting(integrationId, meetingId, direction);
  } else {
    result = await orchestrator.syncAllMeetings(
      integrationId,
      new Date(),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );
  }
  
  return NextResponse.json(result);
}
```

### Get Sync Status
```typescript
// src/app/api/sync/status/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get('integrationId');
  
  const monitor = new SyncMonitor();
  const health = await monitor.getSyncHealth();
  const metrics = await monitor.getSyncMetrics(integrationId || undefined);
  
  return NextResponse.json({
    health,
    metrics,
  });
}
```

## Testing Strategy

### Unit Tests
- Sync queue operations
- Conflict resolution logic
- Sync worker methods
- Scheduler functionality

### Integration Tests
- Complete sync flow
- Conflict detection and resolution
- Queue processing
- Error handling and retries

### End-to-End Tests
- Manual sync trigger
- Periodic sync execution
- Conflict resolution
- Queue backlog handling

## Error Handling

### Common Errors
1. **Network failures**: Connection issues with external APIs
2. **Authentication failures**: Invalid or expired tokens
3. **Rate limiting**: Too many requests
4. **Data conflicts**: Conflicting updates

### Error Recovery
- Automatic retries with exponential backoff
- Token refresh on authentication failures
- Conflict resolution strategies
- Graceful degradation

## Performance Considerations

### Optimization Strategies
1. **Batch Processing**: Process multiple operations together
2. **Parallel Processing**: Process multiple integrations concurrently
3. **Caching**: Cache integration configurations
4. **Queue Prioritization**: Prioritize critical operations

### Monitoring
- Track sync duration
- Monitor error rates
- Alert on queue backlog
- Track success rates

## Security Considerations

### Best Practices
1. **Validate all operations**
2. **Implement rate limiting**
3. **Log all sync operations**
4. **Handle sensitive data carefully**
5. **Implement proper error handling**

## Next Steps
1. Implement sync orchestrator
2. Create sync queue with Redis
3. Build conflict resolver
4. Implement sync workers for each platform
5. Create sync scheduler
6. Build sync monitor
7. Implement error handling and retries
8. Write comprehensive tests
9. Set up monitoring and alerting
