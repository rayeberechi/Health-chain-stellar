export interface SorobanTxJob {
  contractMethod: string;
  args: unknown[];
  idempotencyKey: string;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

export interface SorobanTxResult {
  jobId: string;
  transactionHash?: string;
  status: 'pending' | 'completed' | 'failed' | 'dlq';
  error?: string;
  retryCount: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface QueueMetrics {
  queueDepth: number;
  failedJobs: number;
  dlqCount: number;
  processingRate: number;
}
