import React, { useState } from 'react';
import styles from './Login.module.css';

interface LoginProps {
  onLoginSuccess: (token: string, user: { id: string; username: string }) => void;
  switchToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, switchToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Inloggen mislukt');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user && data.user.id) {
        localStorage.setItem('userId', data.user.id);
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Er is een onbekende fout opgetreden tijdens het inloggen.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.glowIndigo}></div>
      <div className={styles.glowViolet}></div>

      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Welkom terug</h2>
          <p className={styles.subtitle}>Log in op je GG-Portal omgeving</p>
        </div>
        
        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Gebruikersnaam</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Voer je gebruikersnaam in"
              className={styles.input}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Wachtwoord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className={styles.input}
            />
          </div>
          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? 'Bezig met inloggen...' : 'Inloggen'}
          </button>
        </form>

        <div className={styles.footerText}>
          Nog geen account?{' '}
          <button onClick={switchToRegister} className={styles.linkButton}>
            Registreer hier
          </button>
        </div>
      </div>
    </div>
  );
};