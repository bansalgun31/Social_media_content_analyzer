import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  category: string;
  metadata?: Record<string, any>;
  duration?: number;
  requestId?: string;
  userId?: string;
}

interface LoggerOptions {
  level: LogLevel;
  enableConsole: boolean;
  enableMemoryStore: boolean;
  maxMemoryEntries: number;
  categories: string[];
}

class Logger {
  private options: LoggerOptions;
  private memoryStore: LogEntry[] = [];
  private activeRequests: Map<string, { startTime: number; metadata: Record<string, any> }> = new Map();
  
  private readonly LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      level: options.level || 'info',
      enableConsole: options.enableConsole !== false,
      enableMemoryStore: options.enableMemoryStore !== false,
      maxMemoryEntries: options.maxMemoryEntries || 1000,
      categories: options.categories || ['upload', 'processing', 'validation', 'system', 'error']
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return this.LOG_LEVELS[level] >= this.LOG_LEVELS[this.options.level];
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    category: string,
    metadata?: Record<string, any>,
    requestId?: string,
    userId?: string,
    duration?: number
  ): LogEntry {
    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      message,
      category,
      metadata,
      duration,
      requestId,
      userId
    };
  }

  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    // Console output
    if (this.options.enableConsole) {
      const logMessage = this.formatConsoleMessage(entry);
      
      switch (entry.level) {
        case 'debug':
          console.debug(logMessage);
          break;
        case 'info':
          console.info(logMessage);
          break;
        case 'warn':
          console.warn(logMessage);
          break;
        case 'error':
          console.error(logMessage);
          break;
      }
    }

    // Memory store
    if (this.options.enableMemoryStore) {
      this.memoryStore.push(entry);
      
      // Limit memory usage
      if (this.memoryStore.length > this.options.maxMemoryEntries) {
        this.memoryStore = this.memoryStore.slice(-this.options.maxMemoryEntries);
      }
    }
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase().padEnd(5);
    const category = `[${entry.category}]`.padEnd(12);
    const requestId = entry.requestId ? `[${entry.requestId.slice(0, 8)}]` : '';
    const duration = entry.duration ? ` (${entry.duration.toFixed(2)}ms)` : '';
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    
    return `${timestamp} ${level} ${category} ${requestId} ${entry.message}${duration}${metadata}`;
  }

  // Public logging methods
  debug(message: string, category: string = 'system', metadata?: Record<string, any>, requestId?: string): void {
    const entry = this.createLogEntry('debug', message, category, metadata, requestId);
    this.writeLog(entry);
  }

  info(message: string, category: string = 'system', metadata?: Record<string, any>, requestId?: string): void {
    const entry = this.createLogEntry('info', message, category, metadata, requestId);
    this.writeLog(entry);
  }

  warn(message: string, category: string = 'system', metadata?: Record<string, any>, requestId?: string): void {
    const entry = this.createLogEntry('warn', message, category, metadata, requestId);
    this.writeLog(entry);
  }

  error(message: string, category: string = 'error', metadata?: Record<string, any>, requestId?: string): void {
    const entry = this.createLogEntry('error', message, category, metadata, requestId);
    this.writeLog(entry);
  }

  // Request tracking
  startRequest(requestId: string, metadata: Record<string, any> = {}): void {
    this.activeRequests.set(requestId, {
      startTime: performance.now(),
      metadata
    });
    
    this.info(`Request started`, 'upload', metadata, requestId);
  }

  endRequest(requestId: string, additionalMetadata: Record<string, any> = {}): void {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      this.warn(`Request ${requestId} not found in active requests`, 'system');
      return;
    }

    const duration = performance.now() - request.startTime;
    const metadata = { ...request.metadata, ...additionalMetadata, duration };
    
    const entry = this.createLogEntry('info', 'Request completed', 'upload', metadata, requestId, undefined, duration);
    this.writeLog(entry);
    this.activeRequests.delete(requestId);
  }

  // File processing specific methods
  logFileUpload(requestId: string, fileName: string, fileSize: number, mimeType: string): void {
    this.info(`File uploaded: ${fileName}`, 'upload', {
      fileName,
      fileSize,
      mimeType,
      fileSizeMB: Math.round(fileSize / (1024 * 1024) * 100) / 100
    }, requestId);
  }

  logFileValidation(requestId: string, fileName: string, isValid: boolean, error?: string): void {
    if (isValid) {
      this.info(`File validation passed: ${fileName}`, 'validation', { fileName }, requestId);
    } else {
      this.warn(`File validation failed: ${fileName}`, 'validation', { fileName, error }, requestId);
    }
  }

  logProcessingStart(requestId: string, fileName: string, processingType: string): void {
    this.info(`Processing started: ${fileName}`, 'processing', {
      fileName,
      processingType
    }, requestId);
  }

  logProcessingComplete(requestId: string, fileName: string, processingType: string, wordCount: number, characterCount: number, duration: number): void {
    this.info(`Processing completed: ${fileName}`, 'processing', {
      fileName,
      processingType,
      wordCount,
      characterCount,
      duration
    }, requestId);
  }

  logProcessingError(requestId: string, fileName: string, processingType: string, error: string, duration: number): void {
    this.error(`Processing failed: ${fileName}`, 'processing', {
      fileName,
      processingType,
      error,
      duration
    }, requestId);
  }

  // Batch processing methods
  logBatchStart(requestId: string, fileCount: number): void {
    this.info(`Batch processing started`, 'upload', {
      fileCount
    }, requestId);
  }

  logBatchProgress(requestId: string, completed: number, total: number): void {
    const percentage = Math.round((completed / total) * 100);
    this.debug(`Batch progress: ${completed}/${total} (${percentage}%)`, 'upload', {
      completed,
      total,
      percentage
    }, requestId);
  }

  logBatchComplete(requestId: string, stats: { total: number; completed: number; failed: number; duration: number }): void {
    this.info(`Batch processing completed`, 'upload', stats, requestId);
  }

  // Query methods
  getLogs(options: {
    level?: LogLevel;
    category?: string;
    requestId?: string;
    limit?: number;
    since?: Date;
  } = {}): LogEntry[] {
    let logs = [...this.memoryStore];

    if (options.level) {
      logs = logs.filter(log => this.LOG_LEVELS[log.level] >= this.LOG_LEVELS[options.level!]);
    }

    if (options.category) {
      logs = logs.filter(log => log.category === options.category);
    }

    if (options.requestId) {
      logs = logs.filter(log => log.requestId === options.requestId);
    }

    if (options.since) {
      logs = logs.filter(log => new Date(log.timestamp) >= options.since!);
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options.limit) {
      logs = logs.slice(0, options.limit);
    }

    return logs;
  }

  getRequestLogs(requestId: string): LogEntry[] {
    return this.getLogs({ requestId });
  }

  getErrorLogs(limit: number = 50): LogEntry[] {
    return this.getLogs({ level: 'error', limit });
  }

  getUploadStats(since?: Date): {
    totalUploads: number;
    successfulUploads: number;
    failedUploads: number;
    averageProcessingTime: number;
    totalFilesProcessed: number;
    errorRate: number;
  } {
    const logs = this.getLogs({ category: 'upload', since });
    
    const uploadStartLogs = logs.filter(log => log.message.includes('Request started'));
    const uploadCompleteLogs = logs.filter(log => log.message.includes('Request completed'));
    const uploadErrorLogs = logs.filter(log => log.level === 'error');
    
    const processingTimes = uploadCompleteLogs
      .filter(log => log.duration)
      .map(log => log.duration!);
    
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

    return {
      totalUploads: uploadStartLogs.length,
      successfulUploads: uploadCompleteLogs.length,
      failedUploads: uploadErrorLogs.length,
      averageProcessingTime,
      totalFilesProcessed: logs.filter(log => log.message.includes('File uploaded')).length,
      errorRate: uploadStartLogs.length > 0 ? (uploadErrorLogs.length / uploadStartLogs.length) * 100 : 0
    };
  }

  clearLogs(): void {
    this.memoryStore = [];
    this.activeRequests.clear();
  }

  getLogSummary(): {
    totalEntries: number;
    byLevel: Record<LogLevel, number>;
    byCategory: Record<string, number>;
    activeRequests: number;
    oldestEntry?: string;
    newestEntry?: string;
  } {
    const byLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    const byCategory: Record<string, number> = {};

    this.memoryStore.forEach(log => {
      byLevel[log.level]++;
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    });

    const timestamps = this.memoryStore.map(log => log.timestamp).sort();

    return {
      totalEntries: this.memoryStore.length,
      byLevel,
      byCategory,
      activeRequests: this.activeRequests.size,
      oldestEntry: timestamps[0],
      newestEntry: timestamps[timestamps.length - 1]
    };
  }
}

// Global logger instance
export const logger = new Logger({
  level: process.env.LOG_LEVEL as LogLevel || 'info',
  enableConsole: true,
  enableMemoryStore: true,
  maxMemoryEntries: 2000
});

// Export types for use in other modules
export type { LogEntry, LogLevel };