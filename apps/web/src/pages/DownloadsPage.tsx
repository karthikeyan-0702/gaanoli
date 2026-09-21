import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DownloadCloud,
  CheckCircle2,
  Play,
  Trash2,
  HardDrive,
  Info,
  XCircle
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { formatBytes } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { api, DownloadsData } from '../services/api';
import { StorageStats } from '@gatube/shared';

export function DownloadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { info, success, error } = useToast();

  // 1. Fetch live downloads (active & completed)
  const { data: downloadsData } = useQuery<DownloadsData>({
    queryKey: ['downloads'],
    queryFn: () => api.getDownloads(),
    refetchInterval: 5000 // Poll fallback every 5s if SSE is not connected
  });

  // 2. Fetch live storage utilization
  const { data: storageStats } = useQuery<StorageStats>({
    queryKey: ['storage-stats'],
    queryFn: () => api.getStorageStats()
  });

  // 3. Connect to Server-Sent Events (SSE) for zero-latency progress updates
  useEffect(() => {
    const unsubscribe = api.subscribeDownloadEvents((event) => {
      if (event.type === 'download.progress') {
        queryClient.setQueryData<DownloadsData>(['downloads'], (old) => {
          if (!old) return old;
          return {
            ...old,
            active: old.active.map((j) =>
              j.id === event.jobId
                ? {
                    ...j,
                    progressPercent: event.data.progressPercent,
                    downloadedBytes: event.data.downloadedBytes,
                    totalBytes: event.data.totalBytes,
                    speedBytesPerSec: event.data.speedBytesPerSec,
                    etaSeconds: event.data.etaSeconds
                  }
                : j
            )
          };
        });
      } else if (event.type === 'download.completed' || event.type === 'download.failed') {
        queryClient.invalidateQueries({ queryKey: ['downloads'] });
        queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
        queryClient.invalidateQueries({ queryKey: ['library'] });

        if (event.type === 'download.completed') {
          success('Download Complete', 'Your video is ready to watch offline.');
        } else {
          error('Download Failed', event.data?.error || 'Something went wrong. Please try again.');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, success, error]);

  // 4. Cancel job mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelDownload(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads'] });
      info('Download Cancelled', 'Media file was removed from the download queue');
    }
  });

  // 5. Delete completed job mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDownload(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      success('Media Deleted', 'Offline file removed from storage');
    }
  });

  const activeJobs = downloadsData?.active || [];
  const completedJobs = downloadsData?.completed || [];

  const usedStorageBytes = storageStats?.usedBytes || 0;
  const maxStorageBytes = storageStats?.maxBytes || 26214400000;
  const storagePercent = Math.min(100, Math.round((usedStorageBytes / maxStorageBytes) * 100));

  return (
    <div className="space-y-6">
      {/* Header with Storage Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gt-text ">Downloads</h1>
          <p className="text-xs text-gt-text-secondary mt-0.5">
            Manage your saved videos for offline viewing
          </p>
        </div>

        {/* Real Storage Utilization Widget */}
        <div className="bg-gt-elevated border border-gt-border rounded-md px-4 py-2.5 w-full sm:w-80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1.5 text-gt-text-secondary font-medium">
              <HardDrive className="w-3.5 h-3.5 text-brand-400" />
              <span>Storage Used</span>
            </span>
            <span className="text-[11px] text-gt-text-secondary">
              {formatBytes(usedStorageBytes)} / {formatBytes(maxStorageBytes)}
            </span>
          </div>
          <ProgressBar value={storagePercent} size="sm" barClassName="bg-brand-500" />
        </div>
      </div>

      {/* Compliance Note */}
      <div className="flex items-start gap-2.5 p-3 rounded-md bg-gt-surface/60 border border-gt-border text-xs text-gt-text-secondary">
        <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
        <span>
          You can download videos from direct links (MP4, WebM) for offline viewing. YouTube videos are streamed directly and cannot be downloaded.
        </span>
      </div>

      {/* Active Downloads Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gt-text  flex items-center gap-2">
            <DownloadCloud className="w-4 h-4 text-brand-400" />
            <span>Downloading ({activeJobs.length})</span>
          </h2>
          {activeJobs.length > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              In Progress
            </span>
          )}
        </div>

        {activeJobs.length === 0 ? (
          <div className="p-8 text-center text-xs text-gt-text-muted bg-gt-elevated border border-gt-border rounded-md">
            No downloads in progress. Go to a video page and click "Download" to save it offline.
          </div>
        ) : (
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <Card key={job.id} className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-gt-text">{job.video?.title || 'Processing Video'}</h3>
                    <p className="text-[11px] text-gt-text-secondary">{job.video?.channelTitle || 'Authorized Media'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelMutation.mutate(job.id)}
                      isLoading={cancelMutation.isPending}
                      className="text-gt-text-secondary hover:text-rose-400"
                      leftIcon={<XCircle className="w-3.5 h-3.5" />}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <ProgressBar
                    value={job.progressPercent}
                    size="md"
                    barClassName="bg-brand-600"
                  />
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-gt-text-secondary gap-2">
                    <span>
                      {formatBytes(job.downloadedBytes)} / {formatBytes(job.totalBytes)} ({job.progressPercent}%)
                    </span>
                    <div className="flex items-center gap-3">
                      <span>Speed: {formatBytes(job.speedBytesPerSec)}/s</span>
                      <span>ETA: {job.etaSeconds}s</span>
                      <span className="uppercase text-[10px] px-1.5 py-0.2 rounded bg-gt-surface border border-gt-border text-brand-300">
                        {job.status}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Completed Downloads Section */}
      <section className="space-y-3 pt-2">
        <h2 className="text-sm font-semibold text-gt-text  flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Saved for Offline ({completedJobs.length})</span>
        </h2>

        {completedJobs.length === 0 ? (
          <div className="p-8 text-center text-xs text-gt-text-muted bg-gt-elevated border border-gt-border rounded-md">
            No saved videos yet. Download a video to watch it offline.
          </div>
        ) : (
          <div className="space-y-2">
            {completedJobs.map((item) => (
              <Card key={item.id} className="p-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-gt-text truncate">{item.video?.title || 'Downloaded Video'}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-gt-text-secondary mt-0.5 font-mono">
                    <span>{item.video?.channelTitle}</span>
                    <span>•</span>
                    <span>{formatBytes(item.downloadedBytes)}</span>
                    <span>•</span>
                    <span>Completed {item.completedAt ? new Date(item.completedAt).toLocaleTimeString() : ''}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/video/${item.videoId}`)}
                    leftIcon={<Play className="w-3.5 h-3.5" />}
                  >
                    Play Offline
                  </Button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="p-2 text-gt-text-secondary hover:text-rose-400 hover:bg-gt-hover rounded transition-colors"
                    title="Delete media file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
