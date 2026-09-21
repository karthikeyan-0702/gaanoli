import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Plus, Clock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { ProgressBar } from '../components/ui/ProgressBar';
import { formatDuration } from '../lib/utils';
import { getThumbnailSrc } from '../utils/imageProxy';
import { streamSourceLabel } from '../lib/privacy';
import { useToast } from '../components/ui/Toast';
import { api } from '../services/api';
import type { Video } from '@gatube/shared';

function VideoCard({ video, onClick }: { video: Video; onClick: () => void }) {
  return (
    <div
      className="group cursor-pointer glass-panel p-3 rounded-2xl hover:-translate-y-1 hover:shadow-card-hover transition-all duration-300"
      onClick={onClick}
    >
      <div className="video-thumb relative aspect-video bg-black/40 rounded-xl mb-4">
        <img
          src={getThumbnailSrc(video)}
          alt={video.title}
          className="w-full h-full object-cover rounded-xl"
          loading="lazy"
        />
        {video.durationSeconds > 0 && (
          <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-md rounded-md text-[10px] font-bold tracking-wide text-white">
            {formatDuration(video.durationSeconds)}
          </span>
        )}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 rounded-xl">
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center pl-1 transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-6 h-6 fill-gt-bg text-gt-bg" />
          </div>
        </div>
      </div>
      <div className="flex gap-3 px-1">
        <div className="w-10 h-10 rounded-full bg-gt-elevated flex items-center justify-center text-sm font-bold text-gt-text-secondary shrink-0 mt-0.5">
          {video.channelTitle?.charAt(0)?.toUpperCase() || 'G'}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gt-text leading-snug line-clamp-2">
            {video.title}
          </h3>
          <p className="text-xs text-gt-text-muted mt-1">{video.channelTitle}</p>
          <p className="text-xs text-gt-text-muted">
            {streamSourceLabel(video.source)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');

  // Personalized feed
  const { data: feedVideos = [], isLoading: feedLoading } = useQuery<Video[]>({
    queryKey: ['feed'],
    queryFn: () => api.getFeed()
  });

  // Continue watching
  const { data: historyItems = [] } = useQuery({
    queryKey: ['watch-history'],
    queryFn: () => api.getHistory()
  });

  // Import
  const importMutation = useMutation({
    mutationFn: (url: string) => api.importVideo(url),
    onSuccess: (video) => {
      success('Video Added', `"${video.title}" is ready to watch.`);
      setIsImportOpen(false);
      setImportUrl('');
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      navigate(`/video/${video.id}`);
    },
    onError: (err: Error) => {
      error('Import Failed', err.message);
    }
  });

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;
    try {
      new URL(importUrl);
      importMutation.mutate(importUrl.trim());
    } catch {
      error('Invalid URL', 'Please enter a valid video URL.');
    }
  };

  const continueWatching = historyItems
    .filter(item => !item.isCompleted && item.progressPercent > 5)
    .slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gt-text-muted" />
              <h2 className="text-lg font-semibold text-gt-text">Continue watching</h2>
            </div>
            <button
              onClick={() => navigate('/history')}
              className="text-sm text-brand-400 hover:text-brand-300 font-medium"
            >
              View all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-2">
            {continueWatching.map((item) => (
              <div
                key={item.id}
                className="group flex gap-3 p-2 rounded-lg hover:bg-gt-hover cursor-pointer transition-colors"
                onClick={() => navigate(`/video/${item.videoId}`)}
              >
                <div className="relative w-40 aspect-video bg-gt-surface rounded-lg overflow-hidden shrink-0">
                  <img
                    src={getThumbnailSrc(item.video)}
                    alt={item.video.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute bottom-1 right-1 px-1 py-px bg-black/80 rounded text-[10px] font-medium text-white">
                    {formatDuration(item.video.durationSeconds)}
                  </span>
                  {/* Progress bar overlay at bottom */}
                  <div className="absolute bottom-0 left-0 right-0">
                    <ProgressBar value={item.progressPercent} size="sm" barClassName="bg-brand-500" className="rounded-none h-1" />
                  </div>
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <h3 className="text-sm font-medium text-gt-text line-clamp-2 leading-snug">
                    {item.video.title}
                  </h3>
                  <p className="text-xs text-gt-text-muted mt-1">
                    {item.video.channelTitle}
                  </p>
                  <p className="text-xs text-gt-text-muted">
                    {formatDuration(item.lastPositionSeconds)} watched
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* For You — Personalized Feed */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gt-text">
            {continueWatching.length > 0 ? 'Recommended for you' : 'Your videos'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add video
          </Button>
        </div>

        {feedLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse glass-panel p-3 rounded-2xl">
                <div className="aspect-video bg-white/5 rounded-xl mb-4" />
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-2 mt-1">
                    <div className="h-3.5 bg-white/5 rounded-full w-full" />
                    <div className="h-3.5 bg-white/5 rounded-full w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : feedVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gt-surface flex items-center justify-center mb-4">
              <Play className="w-7 h-7 text-gt-text-muted" />
            </div>
            <h3 className="text-base font-medium text-gt-text mb-1">No videos yet</h3>
            <p className="text-sm text-gt-text-muted mb-4 max-w-sm">
              Add a YouTube link or a direct video URL to get started.
            </p>
            <Button variant="primary" size="md" onClick={() => setIsImportOpen(true)}>
              Add your first video
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {feedVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={() => navigate(`/video/${video.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Import Dialog */}
      <Dialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Add a video"
        description="Paste a YouTube link or direct video URL to add it to GaanOli."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsImportOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleImport}
              isLoading={importMutation.isPending}
            >
              Add Video
            </Button>
          </>
        }
      >
        <form onSubmit={handleImport} className="space-y-3">
          <Input
            label="Video URL"
            placeholder="https://www.youtube.com/watch?v=... or direct MP4 URL"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-gt-text-muted">
            YouTube videos will stream directly. Direct links (MP4, WebM) can be downloaded.
          </p>
        </form>
      </Dialog>
    </div>
  );
}
