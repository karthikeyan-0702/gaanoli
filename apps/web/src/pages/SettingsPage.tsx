import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Wifi,
  HardDrive,
  RefreshCw,
  Film,
  CheckCircle2,
  XCircle,
  Shield
} from 'lucide-react';
import { isPrivacyMode, useRelativeApi } from '../lib/mediaUrls';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { formatBytes } from '../lib/utils';
import { api } from '../services/api';
import { useToast } from '../components/ui/Toast';

export function SettingsPage() {
  const { success, error } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch live system readiness
  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.getReadiness()
  });

  // Fetch live storage metrics
  const { data: storageStats, refetch: refetchStorage } = useQuery({
    queryKey: ['storage-stats'],
    queryFn: () => api.getStorageStats()
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchHealth(), refetchStorage()]);
      success('Refreshed', 'Everything is up to date.');
    } catch (err) {
      error('Connection Issue', 'Could not reach the server. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const isDbHealthy = healthData?.services?.database?.isHealthy;
  const isRedisHealthy = healthData?.services?.redis?.isHealthy;
  const isStorageHealthy = healthData?.services?.storage?.isHealthy;
  const isAllHealthy = isDbHealthy && isRedisHealthy && isStorageHealthy;

  const usedBytes = storageStats?.usedBytes || 0;
  const maxBytes = storageStats?.maxBytes || 26214400000;
  const storagePercent = Math.min(100, Math.round((usedBytes / maxBytes) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gt-text ">Settings</h1>
          <p className="text-xs text-gt-text-secondary mt-0.5">
            Check your connection, storage, and app status
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Connection Status */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-gt-border pb-3">
            <div className="flex items-center gap-2.5">
              <Wifi className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-gt-text">Connection Status</h2>
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${isAllHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isAllHealthy ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Disconnected</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-gt-border text-gt-text-secondary">
              <span>Server</span>
              <span className={`font-medium ${isDbHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isDbHealthy ? 'Running' : 'Offline'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gt-border text-gt-text-secondary">
              <span>Background Tasks</span>
              <span className={`font-medium ${isRedisHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isRedisHealthy ? 'Running' : 'Offline'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gt-border text-gt-text-secondary">
              <span>Storage</span>
              <span className={`font-medium ${isStorageHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isStorageHealthy ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div className="flex justify-between py-1 text-gt-text-secondary">
              <span>Overall</span>
              <span className={`font-medium ${isAllHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isAllHealthy ? 'Everything looks good' : 'Some services may be unavailable'}
              </span>
            </div>
          </div>
        </Card>

        {/* Storage Usage */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-gt-border pb-3">
            <div className="flex items-center gap-2.5">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-gt-text">Storage</h2>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-gt-text-secondary mb-1">
                <span>Space Used</span>
                <span className="text-gt-text">
                  {formatBytes(usedBytes)} / {formatBytes(maxBytes)} ({storagePercent}%)
                </span>
              </div>
              <ProgressBar value={storagePercent} size="sm" barClassName="bg-brand-500" />
            </div>

            <div className="flex justify-between py-1 border-b border-gt-border text-gt-text-secondary">
              <span>Saved Videos</span>
              <span className="text-gt-text">{storageStats?.fileCount || 0} files</span>
            </div>
            <div className="flex justify-between py-1 text-gt-text-secondary">
              <span>Storage Location</span>
              <span className="text-gt-text">Local device</span>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between border-b border-gt-border pb-3">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-gt-text">Private streaming</h2>
            </div>
            <span className="text-xs font-medium text-emerald-400">
              {isPrivacyMode() && useRelativeApi() ? 'Enabled' : 'Review settings'}
            </span>
          </div>
          <div className="space-y-2 text-xs text-gt-text-secondary leading-relaxed">
            <p>
              Video and thumbnails are loaded only from your GaanOli API — not from blocked sites in the browser.
              Use <strong className="text-gt-text">VITE_USE_RELATIVE_API=true</strong> so the network only sees your app host.
            </p>
            <p>
              For campus networks (e.g. Sophos): run the API on a home PC or VPS, open the web app through that
              server&apos;s HTTPS URL on Wi‑Fi. YouTube traffic stays on that machine, not in your browser.
            </p>
            <p className="text-gt-text-muted">
              Device-level antivirus or SSL inspection can still see traffic. Follow your institution&apos;s acceptable use policy.
            </p>
          </div>
        </Card>

        {/* Supported Formats */}
        <Card className="p-4 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between border-b border-gt-border pb-3">
            <div className="flex items-center gap-2.5">
              <Film className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-gt-text">About GaanOli</h2>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-gt-border text-gt-text-secondary">
              <span>YouTube Videos</span>
              <span className="text-gt-text">Stream directly (no download)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gt-border text-gt-text-secondary">
              <span>Direct Video Links</span>
              <span className="text-emerald-400 font-medium">Download and watch offline</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gt-border text-gt-text-secondary">
              <span>Supported Formats</span>
              <span className="text-gt-text">MP4, WebM, MKV, MOV</span>
            </div>
            <div className="flex justify-between py-1 text-gt-text-secondary">
              <span>Version</span>
              <span className="text-gt-text">GaanOli 1.0</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
