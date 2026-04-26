import { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

interface AuthProps {
  onLogin: (token: string, user: { name: string; email: string }) => void;
}

/**
 * Auth Page Component.
 * Toggles between Login and Register modes.
 * On success, stores the JWT and calls onLogin to redirect to the Editor.
 */
export default function Auth({ onLogin }: AuthProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const body = isRegister
      ? { name, email, password }
      : { email, password };

    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Something went wrong');
        setLoading(false);
        return;
      }

      // Persist token and user info
      localStorage.setItem('syncscript_token', data.token);
      localStorage.setItem('syncscript_user', JSON.stringify({ name: data.name, email: data.email }));
      onLogin(data.token, { name: data.name, email: data.email });
    } catch {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">📝 SyncScript</h1>
        <p className="auth-subtitle">
          {isRegister ? 'Create your account' : 'Sign in to collaborate'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="auth-toggle">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="auth-toggle-btn"
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}
