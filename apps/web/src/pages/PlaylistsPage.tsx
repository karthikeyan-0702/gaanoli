import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ListVideo, Play, MoreVertical, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Dropdown } from '../components/ui/Dropdown';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { api } from '../services/api';
import { Playlist } from '@gatube/shared';

export function PlaylistsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, info } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');

  // 1. Fetch live playlists
  const { data: playlists = [], isLoading } = useQuery<Playlist[]>({
    queryKey: ['playlists'],
    queryFn: () => api.getPlaylists()
  });

  // 2. Create playlist mutation
  const createMutation = useMutation({
    mutationFn: () => api.createPlaylist(playlistName.trim(), playlistDesc.trim()),
    onSuccess: (newPl) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      setPlaylistName('');
      setPlaylistDesc('');
      setIsCreateOpen(false);
      success('Playlist Created', `"${newPl.name}" is ready for videos.`);
    }
  });

  // 3. Delete playlist mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePlaylist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      info('Playlist Deleted', 'Playlist removed from your library.');
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gt-text ">Playlists</h1>
          <p className="text-xs text-gt-text-secondary mt-0.5">
            Curate and manage your organized video collections
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          New Playlist
        </Button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Skeleton className="h-36 rounded-md" />
          <Skeleton className="h-36 rounded-md" />
        </div>
      ) : playlists.length === 0 ? (
        <EmptyState
          icon={<ListVideo className="w-6 h-6 text-brand-400" />}
          title="No playlists yet"
          description="Create your first playlist to group videos into custom ordered sets."
          actionLabel="Create Playlist"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        /* Playlists Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {playlists.map((pl) => (
            <Card
              key={pl.id}
              className="group p-4 flex flex-col justify-between hover:border-gt-hover transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded bg-brand-950/70 border border-brand-800 text-brand-400 flex items-center justify-center shrink-0">
                    <ListVideo className="w-5 h-5" />
                  </div>
                  <Dropdown
                    trigger={
                      <button
                        type="button"
                        className="p-1 text-gt-text-secondary hover:text-gt-text hover:bg-gt-hover rounded"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    }
                    items={[
                      {
                        id: 'delete',
                        label: 'Delete Playlist',
                        icon: <Trash2 className="w-3.5 h-3.5" />,
                        danger: true,
                        onClick: () => deleteMutation.mutate(pl.id)
                      }
                    ]}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gt-text group-hover:text-brand-300 transition-colors line-clamp-1">
                    {pl.name}
                  </h3>
                  <p className="text-xs text-gt-text-secondary mt-1 line-clamp-2 leading-relaxed">
                    {pl.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-gt-border flex items-center justify-between">
                <span className="text-[11px] text-gt-text-secondary">
                  {pl.videoCount} {pl.videoCount === 1 ? 'video' : 'videos'}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Play className="w-3 h-3" />}
                  onClick={() => navigate('/discover')}
                >
                  Explore
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Playlist Modal */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Playlist"
        description="Organize videos into custom ordered collections."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              isLoading={createMutation.isPending}
            >
              Save Playlist
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="Playlist Title"
            placeholder="e.g. Distributed Architecture"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            autoFocus
          />
          <Input
            label="Description (Optional)"
            placeholder="Brief overview of this collection..."
            value={playlistDesc}
            onChange={(e) => setPlaylistDesc(e.target.value)}
          />
        </form>
      </Dialog>
    </div>
  );
}
