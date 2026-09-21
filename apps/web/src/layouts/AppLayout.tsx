import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Home,
  Compass,
  Film,
  DownloadCloud,
  ListVideo,
  History,
  Settings,
  WifiOff,
  Menu,
  X
} from 'lucide-react';
import { SearchInput } from '../components/ui/SearchInput';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export function AppLayout() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { role } = useAuth();

  // Sync search input with URL on load/change
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
    else if (location.pathname !== '/discover') setSearchQuery('');
  }, [searchParams, location.pathname]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSearchSubmit = (val: string) => {
    setSearchQuery(val);
    if (val.trim()) {
      navigate(`/discover?q=${encodeURIComponent(val.trim())}`);
    }
  };

  const navItems = [
    { to: '/', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { to: '/discover', label: 'Discover', icon: <Compass className="w-5 h-5" /> },
    { to: '/library', label: 'Library', icon: <Film className="w-5 h-5" /> },
    { to: '/playlists', label: 'Playlists', icon: <ListVideo className="w-5 h-5" /> },
    { to: '/history', label: 'History', icon: <History className="w-5 h-5" /> },
    { to: '/downloads', label: 'Downloads', icon: <DownloadCloud className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gt-bg text-gt-text">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-950/80 text-amber-200 text-xs py-1.5 px-4 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>You're offline. Showing downloaded content only.</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 h-16 bg-gt-bg border-b border-gt-border px-4 sm:px-6 flex items-center gap-4 transition-all">
        {/* Mobile menu toggle */}
        {role !== 'guest' && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg hover:bg-gt-hover text-gt-text-secondary"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 shrink-0 group">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center group-hover:scale-105 transition-all duration-300">
            <svg
              className="w-4 h-4 fill-white ml-0.5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5 3.868v16.264a1 1 0 0 0 1.545.841l13.012-8.132a1 1 0 0 0 0-1.682L6.545 3.027A1 1 0 0 0 5 3.868z" />
            </svg>
          </div>
          <span className="font-display font-bold text-xl text-gradient hidden sm:block tracking-tight">GaanOli</span>
        </NavLink>

        {/* Search Bar — centered, visible on all pages for admins */}
        {role !== 'guest' && (
          <div className="flex-1 max-w-xl mx-auto hidden sm:block">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit(searchQuery);
              }}
              placeholder="Search videos..."
            />
          </div>
        )}

        {/* Right: Avatar / Logout */}
        <div className="flex items-center gap-2 ml-auto">
          {role === 'guest' ? (
            <div className="text-sm font-medium text-brand-300">Guest Mode</div>
          ) : (
            <NavLink
              to="/settings"
              className="w-9 h-9 rounded-full bg-gt-elevated border border-white/10 text-gt-text flex items-center justify-center text-sm font-semibold hover:bg-white/10 transition-colors shadow-subtle hover:shadow-glow"
            >
              A
            </NavLink>
          )}
        </div>
      </header>

      {role !== 'guest' && (
        <div className="sm:hidden border-b border-gt-border bg-gt-bg px-4 py-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearchSubmit(searchQuery);
            }}
            placeholder="Search videos..."
          />
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — Desktop */}
        {role !== 'guest' && (
          <aside className="hidden md:flex flex-col w-56 shrink-0 pt-4 pb-2 px-2 overflow-y-auto">
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'relative flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group',
                      isActive
                        ? 'bg-gt-hover text-gt-text font-semibold'
                        : 'text-gt-text-secondary hover:bg-gt-hover hover:text-gt-text'
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 w-1 h-6 bg-brand-500 rounded-r-full" />
                    )}
                    <span className={cn('transition-transform duration-300', isActive ? 'scale-110 text-brand-400' : 'group-hover:scale-110')}>{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-auto pt-4">
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group',
                    isActive
                      ? 'bg-gt-hover text-gt-text font-semibold'
                      : 'text-gt-text-secondary hover:bg-gt-hover hover:text-gt-text'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 w-1 h-6 bg-brand-500 rounded-r-full" />
                    )}
                    <span className={cn('transition-transform duration-300', isActive ? 'scale-110 text-brand-400' : 'group-hover:scale-110')}><Settings className="w-5 h-5" /></span>
                    <span>Settings</span>
                  </>
                )}
              </NavLink>
            </div>
          </aside>
        )}

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && role !== 'guest' && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-gt-bg p-4 flex flex-col shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center">
                  <svg className="w-4 h-4 fill-white ml-0.5" viewBox="0 0 24 24">
                    <path d="M5 3.868v16.264a1 1 0 0 0 1.545.841l13.012-8.132a1 1 0 0 0 0-1.682L6.545 3.027A1 1 0 0 0 5 3.868z" />
                  </svg>
                </div>
                <span className="font-bold text-lg">GaanOli</span>
              </div>
              <nav className="space-y-0.5 flex-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={cn(
                        'flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-gt-hover text-gt-text'
                          : 'text-gt-text-secondary hover:bg-gt-hover hover:text-gt-text'
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
              <NavLink
                to="/settings"
                className="flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-medium text-gt-text-secondary hover:bg-gt-hover"
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </NavLink>
            </aside>
          </>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 pb-20 md:pb-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {role !== 'guest' && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-gt-bg border-t border-gt-border flex items-center justify-around pb-safe">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-all duration-300',
                  isActive ? 'text-brand-400' : 'text-gt-text-muted hover:text-gt-text-secondary'
                )}
              >
                <span className={cn('p-1 transition-transform duration-300', isActive && 'scale-110 -translate-y-0.5')}>{item.icon}</span>
                <span className={cn('transition-opacity duration-300', isActive ? 'opacity-100' : 'opacity-70')}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
