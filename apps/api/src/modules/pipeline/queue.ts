import { Queue } from 'bullmq';
import { redisClient } from '../../queues/redis.js';

export interface MediaDownloadJobData {
  jobId: string;
  userId: string;
  videoId: string;
  mediaUrl: string;
  title: string;
}

export const MEDIA_QUEUE_NAME = 'media-download-queue';

export const mediaQueue = new Queue<MediaDownloadJobData>(MEDIA_QUEUE_NAME, {
  connection: redisClient as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: false,
    removeOnFail: false
  }
});
