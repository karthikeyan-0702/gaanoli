import { useNavigate } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="w-16 h-16 rounded-full bg-brand-950/80 border border-brand-800 text-brand-400 flex items-center justify-center mb-4">
        <Compass className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-bold text-gt-text ">404</h1>
      <h2 className="text-sm font-semibold text-gt-text mt-1">Page Not Found</h2>
      <p className="text-xs text-gt-text-secondary max-w-sm mt-2 leading-relaxed">
        The video or destination you requested does not exist, or has been removed from the platform.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={() => navigate('/')} leftIcon={<Home className="w-3.5 h-3.5" />}>
          Return Home
        </Button>
      </div>
    </div>
  );
}
