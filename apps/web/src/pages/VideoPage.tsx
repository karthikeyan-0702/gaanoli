import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Heart,
  Share2,
  Clock,
  Send,
  Trash2,
  ArrowLeft,
  DownloadCloud,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDuration } from '../lib/utils';
import { getThumbnailSrc } from '../utils/imageProxy';
import { apiUrl, getYoutubeDownloadUrl, getYoutubeStreamUrl } from '../lib/mediaUrls';
import { privacyPlaybackHint, streamSourceLabel } from '../lib/privacy';
import { useToast } from '../components/ui/Toast';
import { api } from '../services/api';
import { VideoWithUserData, VideoNote } from '@gatube/shared';
import { useAuth } from '../contexts/AuthContext';

export function VideoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, info } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const pendingSeekRef = useRef(0);
  const recoveryAttemptsRef = useRef(0);
  const { role } = useAuth();

  const [noteText, setNoteText] = useState('');
  const [quality, setQuality] = useState('720p');
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 1. Fetch live video details
  const { data: video, isLoading, isError } = useQuery<VideoWithUserData>({
    queryKey: ['video', id],
    queryFn: () => api.getVideo(id!),
    enabled: Boolean(id),
    placeholderData: keepPreviousData
  });

  // 2. Fetch live timestamped notes
  const { data: notes = [] } = useQuery<VideoNote[]>({
    queryKey: ['notes', id],
    queryFn: () => api.getNotes(id!),
    enabled: Boolean(id),
    placeholderData: keepPreviousData
  });

  // 3. Favorite toggle mutation
  const favoriteMutation = useMutation({
    mutationFn: () =>
      video?.isFavorite ? api.removeFavorite(video.id) : api.addFavorite(video!.id),
    onSuccess: (data) => {
      queryClient.setQueryData<VideoWithUserData>(['video', id], (old) => {
        if (!old) return old;
        return { ...old, isFavorite: data.isFavorite };
      });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      if (data.isFavorite) success('Saved to Favorites', video?.title);
      else info('Removed from Favorites', video?.title);
    }
  });

  // 5. Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: (newNote: { content: string; timestampSeconds: number }) =>
      api.createNote(video!.id, newNote.content, newNote.timestampSeconds),
    onSuccess: (savedNote) => {
      queryClient.setQueryData<VideoNote[]>(['notes', id], (old = []) => [...old, savedNote]);
      setNoteText('');
      success('Note Saved', `Note added at ${formatDuration(savedNote.timestampSeconds || 0)}`);
    }
  });

  // 6. Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => api.deleteNote(noteId),
    onSuccess: (_, noteId) => {
      queryClient.setQueryData<VideoNote[]>(['notes', id], (old = []) =>
        old.filter((n) => n.id !== noteId)
      );
      info('Note Removed', 'Note deleted');
    }
  });

  // 7. Track playback progress periodically for HTML5 player
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !video) return;

    // Restore last position if available
    if (video.lastPositionSeconds && video.lastPositionSeconds > 0) {
      videoEl.currentTime = video.lastPositionSeconds;
    }

    let lastSent = 0;
    const handleTimeUpdate = () => {
      const current = Math.floor(videoEl.currentTime);
      // Throttle update to once every 10 seconds
      if (current - lastSent >= 10 && videoEl.duration > 0) {
        lastSent = current;
        api.updateHistory(video.id, current, Math.floor(videoEl.duration)).catch(() => {});
      }
    };

    videoEl.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [video]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleLoadStart = () => {
      setIsLoadingMedia(true);
      setMediaError(false);
    };
    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(videoEl.duration) ? videoEl.duration : 0);
      setIsLoadingMedia(false);
      if (pendingSeekRef.current > 0 && Number.isFinite(videoEl.duration)) {
        videoEl.currentTime = Math.min(pendingSeekRef.current, videoEl.duration);
        pendingSeekRef.current = 0;
      }
      videoEl.play().catch(() => {});
    };
    const handleTimeUpdate = () => setCurrentTime(videoEl.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleWaiting = () => {
      setIsBuffering(true);
      window.setTimeout(() => {
        if (videoEl.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA || recoveryAttemptsRef.current >= 2) return;
        recoveryAttemptsRef.current += 1;
        const resumeAt = videoEl.currentTime;
        videoEl.load();
        videoEl.currentTime = resumeAt;
        videoEl.play().catch(() => {});
      }, 4000);
    };
    const handlePlaying = () => {
      recoveryAttemptsRef.current = 0;
      setIsBuffering(false);
    };
    const handleError = () => {
      setIsLoadingMedia(false);
      setIsBuffering(false);
      setMediaError(true);
      setIsPlaying(false);
    };
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === playerRef.current);

    videoEl.addEventListener('loadstart', handleLoadStart);
    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoEl.addEventListener('timeupdate', handleTimeUpdate);
    videoEl.addEventListener('play', handlePlay);
    videoEl.addEventListener('pause', handlePause);
    videoEl.addEventListener('ended', handleEnded);
    videoEl.addEventListener('waiting', handleWaiting);
    videoEl.addEventListener('playing', handlePlaying);
    videoEl.addEventListener('error', handleError);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      videoEl.removeEventListener('loadstart', handleLoadStart);
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
      videoEl.removeEventListener('play', handlePlay);
      videoEl.removeEventListener('pause', handlePause);
      videoEl.removeEventListener('ended', handleEnded);
      videoEl.removeEventListener('waiting', handleWaiting);
      videoEl.removeEventListener('playing', handlePlaying);
      videoEl.removeEventListener('error', handleError);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [video?.id, quality]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (!videoRef.current) return;
      if (event.key === ' ' || event.key.toLowerCase() === 'k') {
        event.preventDefault();
        togglePlayback();
      } else if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        toggleMute();
      } else if (event.key === 'ArrowLeft') {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      } else if (event.key === 'ArrowRight') {
        videoRef.current.currentTime = Math.min(videoRef.current.duration || Infinity, videoRef.current.currentTime + 5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !video) return;

    const currentSeconds = videoRef.current
      ? Math.floor(videoRef.current.currentTime)
      : Math.floor(video.durationSeconds * 0.1);

    addNoteMutation.mutate({
      content: noteText.trim(),
      timestampSeconds: currentSeconds
    });
  };

  const seekTo = (seconds: number) => {
    const videoEl = videoRef.current;
    if (videoEl) {
      const maxTime = Number.isFinite(videoEl.duration) ? videoEl.duration : duration;
      const nextTime = Math.max(0, Math.min(seconds, maxTime || seconds));
      videoEl.currentTime = nextTime;
      videoEl.play().catch(() => {});
    }
    info('Seek', `Jumped to ${formatDuration(seconds)}`);
  };

  const togglePlayback = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl.play().catch(() => setMediaError(true));
    } else {
      videoEl.pause();
    }
  };

  const toggleMute = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    setVolume(videoEl.muted ? 0 : videoEl.volume || 1);
  };

  const handleVolumeChange = (value: number) => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.volume = value;
    videoEl.muted = value === 0;
    setVolume(value);
  };

  const toggleFullscreen = async () => {
    if (!playerRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await playerRef.current.requestFullscreen();
    } catch {
      info('Fullscreen unavailable', 'Fullscreen is not supported by this browser.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-full aspect-video rounded-lg" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (isError || !video) {
    return (
      <div className="p-8 text-center space-y-3">
        <h2 className="text-base font-semibold text-rose-300">Video not found</h2>
        <p className="text-xs text-gt-text-secondary">The video may have been deleted or the URL is invalid.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/discover')}>
          Back to Discover
        </Button>
      </div>
    );
  }

  // Determine media stream source
  const videoStreamSrc = video.playbackUrl?.startsWith('/')
    ? apiUrl(video.playbackUrl)
    : video.playbackUrl || '';
  const description = video.description || 'No description provided for this media.';
  const hasLongDescription = description.length > 600;

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs text-gt-text-secondary hover:text-gt-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      </div>

      {/* Main Grid: Player on left, Notes/Sidebar on right */}
      <div className={`grid grid-cols-1 ${role !== 'guest' ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : 'lg:grid-cols-1 max-w-4xl mx-auto'} gap-6`}>
        <div className="min-w-0 space-y-4">
          {/* Player Container */}
          <div
            ref={playerRef}
            className="group/player relative w-full aspect-video min-h-[220px] bg-black rounded-2xl overflow-hidden border border-gt-border shadow-card outline-none focus-within:ring-2 focus-within:ring-brand-500"
            onDoubleClick={toggleFullscreen}
          >
            <video
              key={video.id + quality}
              ref={videoRef}
              className="absolute inset-0 block w-full h-full object-contain bg-black"
              poster={getThumbnailSrc(video)}
              playsInline
              preload="auto"
              autoPlay
              muted
              aria-label={`Video player for ${video.title}`}
              onClick={togglePlayback}
              onLoadedMetadata={(event) => {
                const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
                setDuration(nextDuration);
                setIsLoadingMedia(false);
                if (pendingSeekRef.current > 0 && nextDuration > 0) {
                  event.currentTarget.currentTime = Math.min(pendingSeekRef.current, nextDuration);
                  pendingSeekRef.current = 0;
                }
                event.currentTarget.play().catch(() => {});
              }}
              onDurationChange={(event) => {
                const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
                if (nextDuration > 0) setDuration(nextDuration);
              }}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            >
              {video.source === 'youtube' ? (
                <source
                  src={getYoutubeStreamUrl(video.sourceId, quality)}
                  type="video/mp4"
                />
              ) : (
                videoStreamSrc && <source src={videoStreamSrc} type="video/mp4" />
              )}
              Your browser does not support video playback.
            </video>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/75 opacity-0 transition-opacity group-hover/player:opacity-100 group-focus-within/player:opacity-100" />

            {isLoadingMedia && !mediaError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25" role="status" aria-label="Loading video">
                <Loader2 className="h-10 w-10 animate-spin text-white" />
              </div>
            )}

            {isBuffering && !isLoadingMedia && !mediaError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20" role="status" aria-label="Buffering video">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}

            {mediaError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
                <AlertCircle className="h-9 w-9 text-rose-400" />
                <p className="text-sm font-medium text-white">This video could not be played.</p>
                <button
                  type="button"
                  onClick={() => {
                    setMediaError(false);
                    setIsLoadingMedia(true);
                    videoRef.current?.load();
                  }}
                  className="rounded-lg border border-white/25 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/10"
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoadingMedia && !mediaError && !isPlaying && (
              <button
                type="button"
                onClick={togglePlayback}
                className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/95 p-4 text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Play video"
              >
                <Play className="h-7 w-7" fill="currentColor" />
              </button>
            )}

            <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 p-3 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/player:opacity-100 sm:group-focus-within/player:opacity-100">
              <input
                type="range"
                min="0"
                max={duration || 1}
                step="0.1"
                value={Math.min(currentTime, duration || 1)}
                onChange={(event) => {
                  const nextTime = Number(event.target.value);
                  if (videoRef.current && duration > 0) videoRef.current.currentTime = nextTime;
                  setCurrentTime(nextTime);
                }}
                disabled={duration <= 0 || mediaError}
                aria-label="Seek video"
                aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
                className="player-range h-1.5 w-full cursor-pointer accent-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex items-center gap-3 text-white">
                <button type="button" onClick={togglePlayback} className="rounded p-1.5 hover:bg-white/15" aria-label={isPlaying ? 'Pause video' : 'Play video'}>
                  {isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
                </button>
                <span className="min-w-[88px] text-xs tabular-nums">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
                <button type="button" onClick={toggleMute} className="rounded p-1.5 hover:bg-white/15" aria-label={volume === 0 ? 'Unmute video' : 'Mute video'}>
                  {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(event) => handleVolumeChange(Number(event.target.value))}
                  aria-label="Volume"
                  className="player-range hidden w-20 cursor-pointer accent-brand-500 sm:block"
                />
                <button type="button" onClick={toggleFullscreen} className="ml-auto rounded p-1.5 hover:bg-white/15" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Video Metadata & Actions */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h1 className="text-base sm:text-lg font-bold text-gt-text leading-snug">
                  {video.title}
                </h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/discover?q=${encodeURIComponent(video.channelTitle)}`)}
                    className="text-xs font-medium text-brand-300 hover:text-brand-200 hover:underline transition-colors cursor-pointer"
                  >
                    {video.channelTitle}
                  </button>
                  <span className="text-gt-text-muted">•</span>
                  <Badge variant={video.source === 'youtube' ? 'neutral' : 'success'}>
                    {streamSourceLabel(video.source)}
                  </Badge>
                  <span className="text-gt-text-muted">•</span>
                  <span className="text-xs text-gt-text-secondary font-medium">
                    Duration: {formatDuration(video.durationSeconds)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap mt-2 sm:mt-0">
                {video.source === 'youtube' && (
                  <select
                    value={quality}
                    onChange={(e) => {
                      pendingSeekRef.current = videoRef.current?.currentTime || currentTime;
                      setIsLoadingMedia(true);
                      setQuality(e.target.value);
                    }}
                    className="bg-gt-surface border border-gt-border text-xs rounded px-2 py-1.5 text-gt-text outline-none focus:border-brand-500 cursor-pointer"
                  >
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p Data Saver</option>
                    <option value="360p">360p Low</option>
                  </select>
                )}

                {role !== 'guest' && (
                  <>
                    <Button
                      variant={video.isFavorite ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => favoriteMutation.mutate()}
                      isLoading={favoriteMutation.isPending}
                      leftIcon={<Heart className={`w-3.5 h-3.5 ${video.isFavorite ? 'fill-current' : ''}`} />}
                    >
                      {video.isFavorite ? 'Favorited' : 'Favorite'}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(getYoutubeDownloadUrl(video.sourceId, quality), '_blank', 'noopener,noreferrer');
                        success('Download Started', 'Your video download has begun.');
                      }}
                      leftIcon={<DownloadCloud className="w-3.5 h-3.5" />}
                    >
                      Download
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        success('Link Copied', 'Video link copied to clipboard');
                      }}
                      leftIcon={<Share2 className="w-3.5 h-3.5" />}
                    >
                      Share
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Description Card */}
            <Card className="p-4 space-y-2 bg-gt-surface/60">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-gt-text-secondary">Description</h3>
                {hasLongDescription && (
                  <button
                    type="button"
                    onClick={() => setShowFullDescription((current) => !current)}
                    className="shrink-0 text-[11px] font-medium text-brand-400 hover:text-brand-300"
                  >
                    {showFullDescription ? 'Show less' : 'Show full description'}
                  </button>
                )}
              </div>
              <p className={`text-xs text-gt-text-secondary whitespace-pre-line leading-relaxed ${showFullDescription ? 'max-h-96 overflow-y-auto pr-2' : 'max-h-28 overflow-hidden'}`}>
                {description}
              </p>
            </Card>
          </div>
        </div>

        {/* Right Sidebar: Timestamped Notes */}
        {role !== 'guest' && (
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-gt-border pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-400" />
                  <h3 className="text-xs font-semibold text-gt-text ">
                    Notes
                  </h3>
                </div>
                <span className="text-[11px] text-gt-text-secondary">{notes.length} notes</span>
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="space-y-2">
                <Input
                  placeholder="Add a note at the current time..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rightIcon={
                    <button
                      type="submit"
                      disabled={addNoteMutation.isPending}
                      className="text-brand-400 hover:text-brand-300 p-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  }
                />
              </form>

              {/* Notes List */}
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {notes.length === 0 ? (
                  <p className="text-xs text-gt-text-muted py-4 text-center">
                    No notes yet. Add one while watching!
                  </p>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="group p-2.5 rounded bg-gt-surface border border-gt-border space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => seekTo(note.timestampSeconds || 0)}
                          className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 hover:underline flex items-center gap-1"
                        >
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(note.timestampSeconds || 0)}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gt-text-secondary hover:text-rose-400 rounded transition-opacity"
                          title="Delete note"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-gt-text-secondary leading-snug">{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Video Info */}
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gt-text-secondary ">
                Video Info
              </h3>
              <div className="text-[11px] text-gt-text-secondary space-y-1.5 leading-relaxed">
                <p>
                  <strong>Source:</strong>{' '}
                  {streamSourceLabel(video.source)}
                </p>
                <p>
                  <strong>Playback:</strong>{' '}
                  {privacyPlaybackHint(video.source)}
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
