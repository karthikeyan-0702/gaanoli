import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Video } from '@gatube/shared';
import { api } from '../services/api';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDuration } from '../lib/utils';
import { Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { getThumbnailSrc } from '../utils/imageProxy';

export function GuestHomePage() {
  const { logout } = useAuth();
  // Automatically search for the required bhajans
  const { data: videos = [], isLoading, isFetching } = useQuery<Video[]>({
    queryKey: ['videos', 'sathya sai baba bhajans'],
    queryFn: () => api.searchVideos('sathya sai baba bhajans'),
    placeholderData: keepPreviousData
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gt-text">Sathya Sai Baba Bhajans</h1>
          <p className="text-sm text-gt-text-secondary mt-1">
            Divine Bhajans & Devotional Songs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          Sign Out
        </Button>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 transition-opacity duration-300 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="w-full aspect-video rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          : videos.map((video) => (
              <Link key={video.id} to={`/video/${video.id}`} className="group block">
                <Card className="overflow-hidden border-transparent hover:border-gt-border bg-transparent hover:bg-gt-surface transition-all p-2 -m-2 rounded-xl">
                  {/* Thumbnail */}
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gt-surface mb-3">
                    <img
                      src={getThumbnailSrc(video)}
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-4 h-4 text-white ml-0.5 fill-current" />
                      </div>
                    </div>

                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 rounded text-xs font-medium text-white backdrop-blur-sm">
                      {formatDuration(video.durationSeconds)}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div>
                    <h3
                      className="font-semibold text-gt-text leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors"
                      title={video.title}
                    >
                      {video.title}
                    </h3>
                    <p className="text-xs text-gt-text-secondary mt-1.5 line-clamp-1">
                      {video.channelTitle}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
      </div>
    </div>
  );
}
