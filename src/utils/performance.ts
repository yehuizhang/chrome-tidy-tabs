interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata: Record<string, unknown>;
}

class PerformanceTracker {
  private static instance: PerformanceTracker;
  private timers: Map<string, PerformanceMetrics> = new Map();

  private constructor() {}

  static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker();
    }
    return PerformanceTracker.instance;
  }

  startTimer(operation: string, metadata: Record<string, unknown> = {}) {
    console.log(`Performance: Starting ${operation}`);
    const uuid = crypto.randomUUID();
    const metric: PerformanceMetrics = {
      operation: operation,
      startTime: performance.now(),
      metadata: metadata,
    };
    this.timers.set(uuid, metric);
    return uuid;
  }

  endTimer(uuid: string, metadata: Record<string, unknown> = {}) {
    const metric = this.timers.get(uuid);
    if (!metric) {
      throw new Error(`Timer with UUID ${uuid} not found`);
    }
    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.metadata = { ...metric.metadata, ...metadata };

    this.timers.delete(uuid);

    console.log(
      `Performance: ${metric.operation} took ${metric.duration}ms to complete. Metadata: ${JSON.stringify(metric.metadata)}`
    );
  }

  async timeAsync<T>(
    operation: string,
    metadata: Record<string, unknown> = {},
    callback: () => Promise<T>
  ): Promise<T> {
    const timerId = this.startTimer(operation, metadata);
    try {
      const result = await callback();
      this.endTimer(timerId);
      return result;
    } catch (error: Error | unknown) {
      this.endTimer(timerId, {
        error:
          error instanceof Error ? error.message : `Unknown error. ${error}`,
      });
      throw error;
    }
  }

  timeSync<T>(
    operation: string,
    metadata: Record<string, unknown> = {},
    callback: () => T
  ) {
    const timerId = this.startTimer(operation, metadata);
    try {
      const result = callback();
      this.endTimer(timerId);
      return result;
    } catch (error: Error | unknown) {
      this.endTimer(timerId, {
        error:
          error instanceof Error ? error.message : `Unknown error. ${error}`,
      });
      throw error;
    }
  }

  clear() {
    this.timers.clear();
  }
}

const performanceTracker = PerformanceTracker.getInstance();

export const timeAsync = <T>(
  operation: string,
  metadata: Record<string, unknown> = {},
  callback: () => Promise<T>
) => performanceTracker.timeAsync(operation, metadata, callback);

export const timeSync = <T>(
  operation: string,
  metadata: Record<string, unknown> = {},
  callback: () => T
) => performanceTracker.timeSync(operation, metadata, callback);
