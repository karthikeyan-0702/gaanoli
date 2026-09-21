import { Response } from 'express';
import { logger } from '../../middleware/logger.js';

export interface PipelineEvent {
  type: 'download.started' | 'download.progress' | 'download.processing' | 'download.completed' | 'download.failed';
  jobId: string;
  videoId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

class PipelineEventBroadcaster {
  private clients: Set<Response> = new Set();

  public registerClient(res: Response): () => void {
    this.clients.add(res);
    logger.debug('SSE Client connected', { totalClients: this.clients.size });

    // Send initial keepalive
    res.write(`: keepalive\n\n`);

    const cleanup = () => {
      this.clients.delete(res);
      logger.debug('SSE Client disconnected', { totalClients: this.clients.size });
    };

    res.on('close', cleanup);
    return cleanup;
  }

  public broadcast(event: Omit<PipelineEvent, 'timestamp'>): void {
    const fullEvent: PipelineEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    const payload = `event: ${event.type}\ndata: ${JSON.stringify(fullEvent)}\n\n`;

    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (err) {
        logger.warn('Failed to write to SSE client', { error: err instanceof Error ? err.message : err });
        this.clients.delete(client);
      }
    }
  }
}

export const eventBroadcaster = new PipelineEventBroadcaster();
