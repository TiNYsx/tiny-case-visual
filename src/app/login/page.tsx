'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function LoginPage() {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.push('/');
    }
  }, [session, router]);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password');
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Login failed after registration');
      } else {
        router.push('/');
      }
    } catch {
      setError('Something went wrong');
    }
    setLoading(false);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-8 rounded-2xl animate-pulse">
          <div className="text-text-secondary">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-grid bg-gradient-radial relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-primary pointer-events-none" />
      
      <div className="relative z-10 text-center max-w-md mx-auto px-6">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gradient mb-4">{t('app.name')}</h1>
          <p className="text-text-secondary text-lg">{t('app.tagline')}</p>
        </div>

        <div className="glass p-8 rounded-3xl">
          <h2 className="text-2xl font-semibold mb-2">
            {isRegister ? t('project.create') : t('auth.welcome')}
          </h2>
          <p className="text-text-muted mb-8">
            {isRegister ? t('auth.welcomeDesc') : t('auth.welcomeDesc')}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {isRegister ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <input
                type="text"
                placeholder={t('project.name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                required
                minLength={6}
              />
              <button
                type="submit"
                disabled={loading}
                className="glass-button w-full py-4 px-6 rounded-xl text-lg font-medium disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('project.create')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCredentialsLogin} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="glass-button w-full py-4 px-6 rounded-xl text-lg font-medium disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('auth.login')}
              </button>
            </form>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-glass text-text-muted">or</span>
            </div>
          </div>

          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="glass-button w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-lg font-medium"
          >
            <GoogleIcon />
            {t('auth.loginWithGoogle')}
          </button>

          <p className="mt-6 text-text-muted text-sm">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-accent hover:underline"
            >
              {isRegister ? t('auth.login') : 'Register'}
            </button>
          </p>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-accent/50 animate-pulse delay-100" />
        <div className="w-2 h-2 rounded-full bg-accent/30 animate-pulse delay-200" />
      </div>
    </div>
  );
}