import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toast';
import { AppLayout } from './layouts/AppLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
// Lazy loaded routes for fast initial page load
const HomePage = React.lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const DiscoverPage = React.lazy(() => import('./pages/DiscoverPage').then(m => ({ default: m.DiscoverPage })));
const LibraryPage = React.lazy(() => import('./pages/LibraryPage').then(m => ({ default: m.LibraryPage })));
const PlaylistsPage = React.lazy(() => import('./pages/PlaylistsPage').then(m => ({ default: m.PlaylistsPage })));
const HistoryPage = React.lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const DownloadsPage = React.lazy(() => import('./pages/DownloadsPage').then(m => ({ default: m.DownloadsPage })));
const VideoPage = React.lazy(() => import('./pages/VideoPage').then(m => ({ default: m.VideoPage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const GuestHomePage = React.lazy(() => import('./pages/GuestHomePage').then(m => ({ default: m.GuestHomePage })));

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      <span className="text-sm text-gt-text-secondary animate-pulse">Loading...</span>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5 // 5 minutes
    }
  }
});

function AppRoutes() {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (role === null) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    );
  }

  if (role === 'guest') {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<GuestHomePage />} />
            <Route path="video/:id" element={<VideoPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="playlists" element={<PlaylistsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="downloads" element={<DownloadsPage />} />
          <Route path="video/:id" element={<VideoPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
