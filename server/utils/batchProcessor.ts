import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

interface BatchJob {
  id: string;
  file: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: string;
}

interface BatchProcessorOptions {
  maxConcurrency?: number;
  retryAttempts?: number;
  timeout?: number;
  onProgress?: (job: BatchJob, overall: { completed: number; total: number; percentage: number }) => void;
  onJobComplete?: (job: BatchJob) => void;
  onJobError?: (job: BatchJob, error: Error) => void;
}

export class BatchProcessor extends EventEmitter {
  private jobs: Map<string, BatchJob> = new Map();
  private activeJobs: Set<string> = new Set();
  private options: Required<BatchProcessorOptions>;
  private processingStartTime?: number;

  constructor(options: BatchProcessorOptions = {}) {
    super();
    this.options = {
      maxConcurrency: options.maxConcurrency || 3,
      retryAttempts: options.retryAttempts || 2,
      timeout: options.timeout || 30000, // 30 seconds
      onProgress: options.onProgress || (() => {}),
      onJobComplete: options.onJobComplete || (() => {}),
      onJobError: options.onJobError || (() => {})
    };
  }

  addJob(id: string, file: any): void {
    const job: BatchJob = {
      id,
      file,
      status: 'pending',
      progress: 0
    };
    this.jobs.set(id, job);
  }

  async processBatch(processor: (file: any, updateProgress: (progress: number) => void) => Promise<any>): Promise<Map<string, BatchJob>> {
    if (this.jobs.size === 0) {
      throw new Error('No jobs to process');
    }

    this.processingStartTime = performance.now();
    const pendingJobs = Array.from(this.jobs.values()).filter(job => job.status === 'pending');
    
    // Process jobs with concurrency limit
    const promises: Promise<void>[] = [];
    let jobIndex = 0;

    while (jobIndex < pendingJobs.length || this.activeJobs.size > 0) {
      // Start new jobs if we haven't hit the concurrency limit
      while (this.activeJobs.size < this.options.maxConcurrency && jobIndex < pendingJobs.length) {
        const job = pendingJobs[jobIndex];
        this.activeJobs.add(job.id);
        
        const promise = this.processJob(job, processor)
          .finally(() => {
            this.activeJobs.delete(job.id);
          });
        
        promises.push(promise);
        jobIndex++;
      }

      // Wait for at least one job to complete before checking again
      if (this.activeJobs.size >= this.options.maxConcurrency) {
        await Promise.race(promises.filter(p => p));
      } else {
        break;
      }
    }

    // Wait for all remaining jobs to complete
    await Promise.allSettled(promises);

    this.emit('batchComplete', {
      total: this.jobs.size,
      completed: Array.from(this.jobs.values()).filter(j => j.status === 'completed').length,
      failed: Array.from(this.jobs.values()).filter(j => j.status === 'failed').length,
      duration: performance.now() - (this.processingStartTime || 0)
    });

    return this.jobs;
  }

  private async processJob(job: BatchJob, processor: (file: any, updateProgress: (progress: number) => void) => Promise<any>): Promise<void> {
    let attempts = 0;
    const maxAttempts = this.options.retryAttempts + 1;

    while (attempts < maxAttempts) {
      try {
        job.status = 'processing';
        job.startTime = performance.now();
        job.progress = 0;
        
        this.updateProgress(job);

        // Create progress callback
        const updateProgress = (progress: number) => {
          job.progress = Math.max(0, Math.min(100, progress));
          this.updateProgress(job);
        };

        // Process with timeout
        const result = await Promise.race([
          processor(job.file, updateProgress),
          this.createTimeoutPromise(this.options.timeout)
        ]);

        job.status = 'completed';
        job.progress = 100;
        job.endTime = performance.now();
        job.result = result;
        
        this.updateProgress(job);
        this.options.onJobComplete(job);
        this.emit('jobComplete', job);
        
        return; // Success, exit retry loop

      } catch (error) {
        attempts++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempts >= maxAttempts) {
          // Final failure
          job.status = 'failed';
          job.endTime = performance.now();
          job.error = errorMessage;
          
          this.updateProgress(job);
          this.options.onJobError(job, error as Error);
          this.emit('jobError', job, error);
          
          return; // Give up
        } else {
          // Retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Processing timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  private updateProgress(job: BatchJob): void {
    const completedJobs = Array.from(this.jobs.values()).filter(j => j.status === 'completed').length;
    const totalJobs = this.jobs.size;
    const overallProgress = {
      completed: completedJobs,
      total: totalJobs,
      percentage: Math.round((completedJobs / totalJobs) * 100)
    };
    
    this.options.onProgress(job, overallProgress);
    this.emit('progress', job, overallProgress);
  }

  getJobStatus(id: string): BatchJob | undefined {
    return this.jobs.get(id);
  }

  getAllJobs(): BatchJob[] {
    return Array.from(this.jobs.values());
  }

  getCompletedJobs(): BatchJob[] {
    return Array.from(this.jobs.values()).filter(job => job.status === 'completed');
  }

  getFailedJobs(): BatchJob[] {
    return Array.from(this.jobs.values()).filter(job => job.status === 'failed');
  }

  getPendingJobs(): BatchJob[] {
    return Array.from(this.jobs.values()).filter(job => job.status === 'pending');
  }

  clear(): void {
    this.jobs.clear();
    this.activeJobs.clear();
  }

  getBatchStatistics(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    averageProcessingTime: number;
    totalProcessingTime: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.startTime && j.endTime);
    
    const processingTimes = completedJobs.map(job => (job.endTime! - job.startTime!));
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
      : 0;
    
    const totalProcessingTime = this.processingStartTime 
      ? performance.now() - this.processingStartTime 
      : 0;

    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      averageProcessingTime,
      totalProcessingTime
    };
  }
}