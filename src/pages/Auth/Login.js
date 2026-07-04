import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError('Email ou mot de passe incorrect.');
    setLoading(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>M</div>
          <div>
            <div style={styles.logoName}>MYR PHARMA</div>
            <div style={styles.logoSub}>Gestion des Approvisionnements</div>
          </div>
        </div>

        <div style={styles.divider} />

        <h1 style={styles.title}>Connexion</h1>
        <p style={styles.subtitle}>Accès réservé au Point Focal du District</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="field">
            <label>Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <p style={styles.footer}>District de Santé · Session sécurisée</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r)',
    boxShadow: 'var(--shadow-md)',
    padding: '36px 32px',
    width: '100%',
    maxWidth: 400,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 14,
    marginBottom: 4,
  },
  logoIcon: {
    width: 48, height: 48,
    background: 'var(--amber)',
    borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, fontWeight: 800, color: '#fff',
    flexShrink: 0,
  },
  logoName: { fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 },
  logoSub:  { fontSize: 11, color: 'var(--text-2)', marginTop: 3 },
  divider: { height: 1, background: 'var(--border)', margin: '24px 0' },
  title:    { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 12, color: 'var(--text-2)', marginBottom: 24 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  error: {
    background: 'var(--red-l)',
    color: 'var(--red)',
    border: '1px solid rgba(192,57,43,0.2)',
    borderRadius: 'var(--r-sm)',
    padding: '8px 12px',
    fontSize: 12, fontWeight: 600,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: 'var(--text-3)',
    marginTop: 24,
  },
};
