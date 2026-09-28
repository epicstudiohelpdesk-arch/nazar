export interface QueueJobOptions {
  readonly priority?: number;
  readonly delayMs?: number;
  readonly attempts?: number;
}

export interface IQueueService {
  enqueue<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: QueueJobOptions
  ): Promise<string>;
}

export const QUEUE_SERVICE_TOKEN = Symbol('IQueueService');
