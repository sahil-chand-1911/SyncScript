import { useState, useEffect } from 'react';
import Auth from './pages/Auth';
import Editor from './pages/Editor';
import './App.css';

/**
 * Root Application Component.
 * Handles authentication state and renders either the Auth page or the Editor.
 */
function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  /**
   * On mount, check localStorage for an existing session.
   */
  useEffect(() => {
    const savedToken = localStorage.getItem('syncscript_token');
    const savedUser = localStorage.getItem('syncscript_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (newToken: string, newUser: { name: string; email: string }) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('syncscript_token');
    localStorage.removeItem('syncscript_user');
    setToken(null);
    setUser(null);
  };

  // If authenticated, show the Editor; otherwise show the Auth page
  if (token && user) {
    return <Editor token={token} user={user} onLogout={handleLogout} />;
  }

  return <Auth onLogin={handleLogin} />;
}

export default App;
