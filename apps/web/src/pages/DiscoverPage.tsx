import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { Play, Filter } from 'lucide-react';
import { formatDuration } from '../lib/utils';
import { getThumbnailSrc } from '../utils/imageProxy';
import { isPrivacyMode, streamSourceLabel } from '../lib/privacy';
import { api } from '../services/api';
import { Video } from '@gatube/shared';

export function DiscoverPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = searchParams.get('q') || '';
  const initialOrder = searchParams.get('order') || 'relevance';
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [debouncedTerm, setDebouncedTerm] = useState(initialQuery);
  const [order, setOrder] = useState(initialOrder);
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      if (searchTerm.trim() || order !== 'relevance') {
        const params: Record<string, string> = {};
        if (searchTerm.trim()) params.q = searchTerm.trim();
        if (order !== 'relevance') params.order = order;
        setSearchParams(params, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, setSearchParams]);

  // Sync URL params
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const o = searchParams.get('order') || 'relevance';
    if (q !== searchTerm) setSearchTerm(q);
    if (o !== order) setOrder(o);
  }, [searchParams]);

  // Query: useInfiniteQuery for pagination
  const { 
    data, 
    isLoading, 
    isFetching,
    isFetchingNextPage, 
    hasNextPage, 
    fetchNextPage 
  } = useInfiniteQuery<{ data: Video[], nextPageToken?: string }>({
    queryKey: ['discover-videos', debouncedTerm, sourceFilter, order],
    queryFn: ({ pageParam = undefined }) => api.searchVideos(debouncedTerm, sourceFilter, 50, order, pageParam as string | undefined),
    getNextPageParam: (lastPage) => lastPage.nextPageToken || undefined,
    initialPageParam: undefined,
    placeholderData: keepPreviousData
  });

  const videos = data?.pages.flatMap((page) => page.data) || [];

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.unobserve(target);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'youtube', label: isPrivacyMode() ? 'Streams' : 'YouTube' },
    { id: 'authorized_source', label: 'Direct links' }
  ];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gt-text-muted" />
            <div className="flex gap-1.5">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSourceFilter(f.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    sourceFilter === f.id
                      ? 'bg-gt-text text-gt-bg'
                      : 'glass-panel text-gt-text-secondary hover:text-gt-text hover:bg-gt-hover'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-gt-text-muted font-medium">Sort by:</span>
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="bg-gt-surface border border-gt-border text-sm rounded-xl px-3 py-1.5 text-gt-text outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Upload Date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
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
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gt-surface flex items-center justify-center mb-4">
            <Play className="w-7 h-7 text-gt-text-muted" />
          </div>
          <h3 className="text-base font-medium text-gt-text mb-1">
            {debouncedTerm ? 'No results found' : 'No videos yet'}
          </h3>
          <p className="text-sm text-gt-text-muted max-w-sm">
            {debouncedTerm
              ? `No videos match "${debouncedTerm}". Try a different search or add a video from the home page.`
              : 'Add a video URL from the home page to get started.'}
          </p>
        </div>
      ) : (
        <>
          {debouncedTerm && (
            <p className="text-sm text-gt-text-muted">
              {videos.length} result{videos.length !== 1 ? 's' : ''} for "{debouncedTerm}"
            </p>
          )}
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 transition-opacity duration-300 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
            {videos.map((video) => (
              <div
                key={video.id}
                className="group cursor-pointer glass-panel p-3 rounded-2xl hover:-translate-y-1 hover:shadow-card-hover transition-all duration-300"
                onClick={() => navigate(`/video/${video.id}`)}
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gt-text-muted">
                        {streamSourceLabel(video.source)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Loading Indicator for next page */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Sentinel element for intersection observer */}
      <div ref={observerTarget} className="h-4" />
    </div>
  );
}
