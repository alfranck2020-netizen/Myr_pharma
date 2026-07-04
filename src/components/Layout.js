import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import './Layout.css';

const NAV = [
  { group: 'Principal', items: [
    { path: '/',            icon: '⊞', label: 'Tableau de bord' },
    { path: '/intrants',    icon: '📦', label: 'Stock & Intrants' },
    { path: '/inventaire',  icon: '📋', label: 'Inventaire' },
  ]},
  { group: 'Commandes', items: [
    { path: '/centres-sante',   icon: '🏥', label: 'Centres de Santé' },
    { path: '/fournisseurs',    icon: '🚚', label: 'Fournisseurs' },
    { path: '/bons-commande',   icon: '📄', label: 'Bons de commande' },
  ]},
  { group: 'Mouvements', items: [
    { path: '/entrees',  icon: '↑', label: 'Entrées stock' },
    { path: '/sorties',  icon: '↓', label: 'Sorties stock' },
    { path: '/rapports', icon: '📊', label: 'Rapports' },
  ]},
  { group: 'Système', items: [
    { path: '/configuration', icon: '⚙', label: 'Configuration' },
  ]},
];

export default function Layout({ children, session }) {
  const navigate   = useNavigate();
  const { pathname } = useLocation();
  const { dark, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const email    = session?.user?.email || '';
  const initials = email.slice(0, 2).toUpperCase();

  function navTo(path) {
    navigate(path);
    setMobileOpen(false);
  }

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
        <div className="sb-logo">
          <div className="sb-icon">M</div>
          <div>
            <div className="sb-name">MYR PHARMA</div>
            <div className="sb-sub">District de Santé</div>
          </div>
        </div>

        {NAV.map(group => (
          <div key={group.group} className="sb-section">
            <div className="sb-label">{group.group}</div>
            {group.items.map(item => {
              const active = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
              return (
                <div
                  key={item.path}
                  className={`nav-item${active ? ' active' : ''}`}
                  onClick={() => navTo(item.path)}
                >
                  <span className="nav-ico">{item.icon}</span>
                  {item.label}
                </div>
              );
            })}
          </div>
        ))}

        <div className="sb-foot">
          <div className="sb-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sb-uname">Point Focal</div>
            <div className="sb-urole" title={email}>{email}</div>
          </div>
          <button className="sb-logout" onClick={handleLogout} title="Déconnexion">⏻</button>
        </div>
      </aside>

      {/* OVERLAY mobile — clique pour fermer */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* MAIN */}
      <div className="main-content">
        {/* MOBILE TOPBAR */}
        <div className="mobile-bar">
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(o => !o)}>☰</button>
          <span className="mobile-title">MYR PHARMA</span>
          <button className="mobile-theme-btn" onClick={toggle}>{dark ? '☀️' : '🌙'}</button>
        </div>

        {/* DESKTOP THEME TOGGLE */}
        <button className="desktop-theme" onClick={toggle} title="Changer le thème">
          {dark ? '☀️' : '🌙'}
        </button>

        {children}
      </div>
    </div>
  );
}
