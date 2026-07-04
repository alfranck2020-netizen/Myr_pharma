import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Intrants from './pages/Intrants/Intrants';
import CentresSante from './pages/CentresSante/CentresSante';
import Fournisseurs from './pages/Fournisseurs/Fournisseurs';
import Inventaire from './pages/Inventaire/Inventaire';
import BonsCommande from './pages/BonsCommande/BonsCommande';
import Entrees from './pages/Mouvements/Entrees';
import Sorties from './pages/Mouvements/Sorties';
import Rapports from './pages/Rapports/Rapports';
import Configuration from './pages/Configuration/Configuration';

import './styles/tokens.css';
import './styles/global.css';

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Loader />;
  if (!session) return <Login />;

  return (
    <BrowserRouter>
      <Layout session={session}>
        <Routes>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/intrants"      element={<Intrants />} />
          <Route path="/inventaire"    element={<Inventaire />} />
          <Route path="/centres-sante" element={<CentresSante />} />
          <Route path="/fournisseurs"  element={<Fournisseurs />} />
          <Route path="/bons-commande" element={<BonsCommande />} />
          <Route path="/entrees"       element={<Entrees />} />
          <Route path="/sorties"       element={<Sorties />} />
          <Route path="/rapports"      element={<Rapports />} />
          <Route path="/configuration" element={<Configuration />} />
          <Route path="*"              element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function Loader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid var(--border)',
          borderTop: '3px solid var(--teal-700)',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
          margin: '0 auto 12px',
        }} />
        <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Chargement...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
