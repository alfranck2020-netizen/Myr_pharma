import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';

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
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { dark, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const email = session?.user?.email || '';
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div style={styles.app}>
      {/* SIDEBAR */}
      <aside style={{ ...styles.sidebar, ...(mobileOpen ? styles.sidebarOpen : {}) }}>
        <div style={styles.sbLogo}>
          <div style={styles.sbIcon}>M</div>
          <div>
            <div style={styles.sbName}>MYR PHARMA</div>
            <div style={styles.sbSub}>District de Santé</div>
          </div>
        </div>

        {NAV.map(group => (
          <div key={group.group} style={styles.sbSection}>
            <div style={styles.sbLabel}>{group.group}</div>
            {group.items.map(item => {
              const active = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
              return (
                <div
                  key={item.path}
                  style={{ ...styles.navItem, ...(active ? styles.navActive : {}) }}
                  onClick={() => { navigate(item.path); setMobileOpen(false); }}
                >
                  <span style={styles.navIco}>{item.icon}</span>
                  {item.label}
                </div>
              );
            })}
          </div>
        ))}

        <div style={styles.sbFoot}>
          <div style={styles.avatar}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.uName}>Point Focal</div>
            <div style={styles.uRole} title={email}>{email}</div>
          </div>
          <button
            onClick={handleLogout}
            style={styles.logoutBtn}
            title="Déconnexion"
          >⏻</button>
        </div>
      </aside>

      {/* OVERLAY mobile */}
      {mobileOpen && (
        <div style={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* MAIN */}
      <div style={styles.main}>
        {/* MOBILE TOPBAR */}
        <div style={styles.mobileBar}>
          <button style={styles.menuBtn} onClick={() => setMobileOpen(o => !o)}>☰</button>
          <span style={styles.mobileTitle}>MYR PHARMA</span>
          <button style={styles.themeBtn} onClick={toggle}>{dark ? '☀️' : '🌙'}</button>
        </div>

        {/* DESKTOP THEME TOGGLE */}
        <button
          style={styles.desktopTheme}
          onClick={toggle}
          title="Changer le thème"
        >{dark ? '☀️' : '🌙'}</button>

        {children}
      </div>
    </div>
  );
}

const styles = {
  app: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: 220, background: 'var(--teal-900)',
    display: 'flex', flexDirection: 'column',
    flexShrink: 0, height: '100vh',
    position: 'sticky', top: 0,
    overflowY: 'auto', zIndex: 200,
    transition: 'transform 0.25s',
  },
  sidebarOpen: { transform: 'translateX(0)' },
  sbLogo: {
    padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
  },
  sbIcon: {
    width: 32, height: 32, background: 'var(--amber)', borderRadius: 7,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
  },
  sbName: { fontSize: 13, fontWeight: 700, color: '#fff' },
  sbSub:  { fontSize: 9, color: 'var(--teal-200)', letterSpacing: '1.5px', textTransform: 'uppercase' },
  sbSection: { padding: '12px 8px 2px' },
  sbLabel: {
    fontSize: 9, fontWeight: 700, letterSpacing: '2px',
    textTransform: 'uppercase', color: 'var(--teal-200)',
    padding: '0 6px', marginBottom: 3,
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 8px', borderRadius: 6,
    color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s', marginBottom: 1,
  },
  navActive: { background: 'var(--amber)', color: '#fff', fontWeight: 600 },
  navIco: { fontSize: 14, width: 18, textAlign: 'center' },
  sbFoot: {
    marginTop: 'auto', padding: '12px 10px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
  },
  avatar: {
    width: 28, height: 28, background: 'var(--teal-500)', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
  },
  uName: { fontSize: 11, fontWeight: 600, color: '#fff' },
  uRole: { fontSize: 9, color: 'var(--teal-200)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn: {
    background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)',
    width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' },
  mobileBar: {
    display: 'none', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', background: 'var(--teal-900)',
    '@media(maxWidth:768px)': { display: 'flex' },
  },
  menuBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' },
  mobileTitle: { color: '#fff', fontWeight: 700, fontSize: 14 },
  themeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' },
  desktopTheme: {
    position: 'absolute', top: 12, right: 16, zIndex: 10,
    width: 32, height: 32, borderRadius: '50%',
    border: '1px solid var(--border)', background: 'var(--surface)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontSize: 15,
  },
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.4)', zIndex: 150,
  },
};
