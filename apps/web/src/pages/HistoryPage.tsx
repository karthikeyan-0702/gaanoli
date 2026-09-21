import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { History, Play, Trash2, X } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDuration } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { api } from '../services/api';
import { getThumbnailSrc } from '../utils/imageProxy';
import { WatchHistoryItem } from '@gatube/shared';

export function HistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { info, success } = useToast();

  // 1. Fetch live history
  const { data: history = [], isLoading } = useQuery<WatchHistoryItem[]>({
    queryKey: ['history'],
    queryFn: () => api.getHistory()
  });

  // 2. Remove single item
  const removeMutation = useMutation({
    mutationFn: (id: string) => api.deleteHistoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['watch-history'] });
      info('History Updated', 'Removed item from watch history');
    }
  });

  // 3. Clear all history
  const clearMutation = useMutation({
    mutationFn: () => api.clearHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['watch-history'] });
      success('History Cleared', 'All watch history records removed.');
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gt-text  flex items-center gap-2">
            <History className="w-5 h-5 text-brand-400" />
            <span>Watch History</span>
          </h1>
          <p className="text-xs text-gt-text-secondary mt-0.5">
            Pick up where you left off
          </p>
        </div>

        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearMutation.mutate()}
            isLoading={clearMutation.isPending}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            className="text-gt-text-secondary hover:text-rose-400 border-gt-border"
          >
            Clear History
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
        </div>
      ) : history.length === 0 ? (
        <EmptyState
          icon={<History className="w-6 h-6 text-gt-text-secondary" />}
          title="Your watch history is clear"
          description="Start watching videos on GaanOli to keep track of your position and resume whenever you want."
          actionLabel="Discover Videos"
          onAction={() => navigate('/discover')}
        />
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <Card
              key={item.id}
              className="p-3 sm:p-4 hover:border-gt-hover transition-all flex flex-col sm:flex-row gap-4 justify-between"
            >
              <div
                className="flex flex-col sm:flex-row gap-4 flex-1 cursor-pointer"
                onClick={() => navigate(`/video/${item.videoId}`)}
              >
                <div className="relative w-full sm:w-44 aspect-video bg-gt-surface shrink-0 rounded overflow-hidden">
                  <img
                    src={getThumbnailSrc(item.video)}
                    alt={item.video.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/80 rounded text-[10px] text-gt-text">
                    {formatDuration(item.video.durationSeconds)}
                  </span>
                </div>

                <div className="flex flex-col justify-between flex-1 space-y-2">
                  <div>
                    <h3 className="text-xs font-semibold text-gt-text hover:text-brand-300 transition-colors">
                      {item.video.title}
                    </h3>
                    <p className="text-[11px] text-gt-text-secondary mt-0.5">{item.video.channelTitle}</p>
                    <span className="text-[10px] text-gt-text-muted mt-1 inline-block">
                      Watched {new Date(item.lastWatchedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="w-full max-w-xs space-y-1">
                    <ProgressBar value={item.progressPercent} size="sm" barClassName="bg-brand-500" />
                    <div className="flex justify-between text-[10px] text-gt-text-secondary font-mono">
                      <span>{formatDuration(item.lastPositionSeconds)}</span>
                      <span>{item.progressPercent}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-gt-border pt-2 sm:pt-0 sm:pl-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/video/${item.videoId}`)}
                  leftIcon={<Play className="w-3.5 h-3.5" />}
                >
                  Resume
                </Button>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(item.id)}
                  className="p-1.5 text-gt-text-secondary hover:text-rose-400 hover:bg-gt-hover rounded"
                  title="Remove from history"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
