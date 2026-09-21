import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart, DownloadCloud, Clock, ListVideo, Play } from 'lucide-react';
import { Tabs } from '../components/ui/Tabs';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { VideoCardSkeleton } from '../components/ui/Skeleton';
import { api } from '../services/api';
import { formatDuration } from '../lib/utils';
import { getThumbnailSrc } from '../utils/imageProxy';

export function LibraryPage() {
  const [activeTab, setActiveTab] = useState('favorites');
  const navigate = useNavigate();

  const { data: library, isLoading } = useQuery({
    queryKey: ['library'],
    queryFn: () => api.getLibrary()
  });

  const favorites = library?.favorites || [];
  const downloads = library?.downloads || [];
  const history = library?.history || [];
  const playlists = library?.playlists || [];

  const tabs = [
    { id: 'favorites', label: 'Favorites', icon: <Heart className="w-3.5 h-3.5" />, badge: favorites.length },
    { id: 'downloads', label: 'Downloads', icon: <DownloadCloud className="w-3.5 h-3.5" />, badge: downloads.length },
    { id: 'history', label: 'Recently Watched', icon: <Clock className="w-3.5 h-3.5" />, badge: history.length },
    { id: 'playlists', label: 'Playlists', icon: <ListVideo className="w-3.5 h-3.5" />, badge: playlists.length }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gt-text ">Your Media Library</h1>
          <p className="text-xs text-gt-text-secondary mt-0.5">
            Your favorites, downloads, history, and playlists
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs items={tabs} activeId={activeTab} onChange={setActiveTab} />

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          <VideoCardSkeleton />
          <VideoCardSkeleton />
          <VideoCardSkeleton />
        </div>
      )}

      {/* Content for active tab */}
      {!isLoading && activeTab === 'favorites' && (
        favorites.length === 0 ? (
          <EmptyState
            icon={<Heart className="w-6 h-6 text-brand-400" />}
            title="No favorite videos yet"
            description="Browse videos on the Discover page and click the heart icon to add them to your favorites."
            actionLabel="Discover Videos"
            onAction={() => navigate('/discover')}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            {favorites.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/video/${item.id}`)}
                className="group cursor-pointer glass-panel p-3 rounded-2xl hover:-translate-y-1 hover:shadow-card-hover transition-all duration-300 relative"
              >
                <div className="video-thumb relative aspect-video bg-black/40 rounded-xl mb-4">
                  <img
                    src={getThumbnailSrc(item)}
                    alt={item.title}
                    className="w-full h-full object-cover rounded-xl"
                    loading="lazy"
                  />
                  {item.durationSeconds > 0 && (
                    <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-md rounded-md text-[10px] font-bold tracking-wide text-white">
                      {formatDuration(item.durationSeconds)}
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
                    {item.channelTitle?.charAt(0)?.toUpperCase() || 'G'}
                  </div>
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 className="text-sm font-semibold text-gt-text leading-snug line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gt-text-secondary mt-1">{item.channelTitle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {!isLoading && activeTab === 'downloads' && (
        downloads.length === 0 ? (
          <EmptyState
            icon={<DownloadCloud className="w-6 h-6 text-emerald-400" />}
            title="No downloaded media"
            description="You haven't downloaded any videos yet. You can download videos from their video page."
            actionLabel="Browse Downloads"
            onAction={() => navigate('/downloads')}
          />
        ) : (
          <div className="space-y-3 pt-2">
            {downloads.map((video) => (
              <div key={video.id} className="glass-panel p-4 rounded-2xl flex items-center justify-between gap-4 hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-300">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gt-elevated border border-gt-border text-gt-text-secondary flex items-center justify-center shrink-0">
                    <DownloadCloud className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-gt-text truncate">{video.title}</h3>
                    <p className="text-[11px] text-gt-text-secondary mt-0.5">
                      {video.channelTitle} • {formatDuration(video.durationSeconds)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/video/${video.id}`)}
                  leftIcon={<Play className="w-3.5 h-3.5" />}
                >
                  Play Offline
                </Button>
              </div>
            ))}
          </div>
        )
      )}

      {!isLoading && activeTab === 'history' && (
        history.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-6 h-6 text-gt-text-secondary" />}
            title="No watch history"
            description="Videos you watch will appear here along with your saved playback progress."
            actionLabel="Discover Videos"
            onAction={() => navigate('/discover')}
          />
        ) : (
          <div className="space-y-2 pt-2">
            {history.map((h) => (
              <div
                key={h.id}
                onClick={() => navigate(`/video/${h.id}`)}
                className="glass-panel p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-300"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={getThumbnailSrc(h)}
                    alt={h.title}
                    className="w-16 h-10 rounded-lg object-cover shrink-0 bg-black/40 shadow-subtle"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-gt-text truncate">{h.title}</h3>
                    <p className="text-[11px] text-gt-text-secondary mt-0.5">
                      {formatDuration(h.lastPositionSeconds)} / {formatDuration(h.durationSeconds)} ({h.progressPercent}%)
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Resume</Button>
              </div>
            ))}
          </div>
        )
      )}

      {!isLoading && activeTab === 'playlists' && (
        playlists.length === 0 ? (
          <EmptyState
            icon={<ListVideo className="w-6 h-6 text-brand-400" />}
            title="No playlists created"
            description="Create custom collections to organize your videos into curated playlists."
            actionLabel="Go to Playlists"
            onAction={() => navigate('/playlists')}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => navigate('/playlists')}
                className="glass-panel p-4 rounded-2xl cursor-pointer hover:-translate-y-1 hover:shadow-card-hover transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gt-elevated border border-gt-border flex items-center justify-center text-gt-text-secondary shrink-0">
                    <ListVideo className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-gt-text truncate">{pl.name}</h3>
                    <p className="text-[11px] text-gt-text-secondary mt-0.5">
                      {pl.videoCount} {pl.videoCount === 1 ? 'video' : 'videos'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default LibraryPage;
