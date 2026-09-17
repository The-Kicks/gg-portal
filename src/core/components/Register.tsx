import React, { useState } from 'react';
import styles from './Register.module.css';

interface RegisterProps {
  onRegisterSuccess: () => void;
  switchToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, switchToLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registreren mislukt');
      }

      alert('Account succesvol aangemaakt! Je kunt nu inloggen.');
      onRegisterSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Er is een onbekende fout opgetreden tijdens het registreren.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.glowEmerald}></div>
      <div className={styles.glowIndigo}></div>

      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Account aanmaken</h2>
          <p className={styles.subtitle}>Sluit je aan bij GG-Portal</p>
        </div>
        
        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleRegister} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Gebruikersnaam</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Kies een gebruikersnaam"
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
            {loading ? 'Bezig met registreren...' : 'Account aanmaken'}
          </button>
        </form>

        <div className={styles.footerText}>
          Al een account?{' '}
          <button onClick={switchToLogin} className={styles.linkButton}>
            Log hier in
          </button>
        </div>
      </div>
    </div>
  );
};