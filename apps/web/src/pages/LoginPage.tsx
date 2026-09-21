import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gt-bg flex flex-col justify-center items-center px-4">
      <div className="max-w-md w-full space-y-8 bg-gt-surface p-8 rounded-xl border border-gt-border shadow-2xl">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 fill-white ml-1"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5 3.868v16.264a1 1 0 0 0 1.545.841l13.012-8.132a1 1 0 0 0 0-1.682L6.545 3.027A1 1 0 0 0 5 3.868z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gt-text">Welcome to GaanOli</h2>
          <p className="mt-2 text-sm text-gt-text-secondary">
            Please sign in to continue
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              id="username"
              name="username"
              type="text"
              required
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
            <Input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 text-center" role="alert">
              {error}
            </p>
          )}

          <div>
            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center"
              isLoading={submitting}
            >
              Sign in
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
