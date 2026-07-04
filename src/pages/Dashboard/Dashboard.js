export default function Dashboard() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Tableau de bord</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
          Vue d'ensemble — Stock & Approvisionnements
        </p>
      </div>

      {/* ALERTES */}
      <div style={styles.alertBar}>
        <AlertCard type="danger" icon="⚠" count={4} label="Ruptures de stock imminentes" />
        <AlertCard type="warning" icon="📅" count={7} label="Lots expirant dans 90 jours" />
        <AlertCard type="info" icon="🏥" count={3} label="CS en attente de livraison" />
      </div>

      {/* STATS */}
      <div style={styles.statsRow}>
        <StatCard eyebrow="Intrants en stock" value="38" unit="produits" trend="↑ 2 nouveaux ce mois" trendType="up" />
        <StatCard eyebrow="Taux de service" value="87" unit="%" trend="↑ +4% vs session préc." trendType="up" />
        <StatCard eyebrow="Taux de péremption" value="2.3" unit="%" trend="↓ –0.8% vs session préc." trendType="down" />
        <StatCard eyebrow="Commandes CS reçues" value="9" unit="/ 12" trend="3 CS non encore reçus" trendType="neu" />
      </div>

      {/* SESSION */}
      <div style={styles.sessionBadge}>
        <span style={styles.sessionPill}>⬡ Session Juillet – Octobre 2026</span>
      </div>
    </div>
  );
}

function AlertCard({ type, icon, count, label }) {
  const colors = {
    danger:  { border: 'var(--red)',    ico: 'var(--red-l)',    text: 'var(--red)' },
    warning: { border: 'var(--orange)', ico: 'var(--orange-l)', text: 'var(--orange)' },
    info:    { border: 'var(--teal-500)', ico: 'var(--teal-50)', text: 'var(--teal-700)' },
  }[type];

  return (
    <div style={{ ...styles.alertCard, borderLeftColor: colors.border }}>
      <div style={{ ...styles.alertIco, background: colors.ico }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: colors.text, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function StatCard({ eyebrow, value, unit, trend, trendType }) {
  const trendColor = { up: 'var(--green)', down: 'var(--red)', neu: 'var(--text-3)' }[trendType];
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
        {eyebrow}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, marginTop: 6, color: trendColor }}>{trend}</div>
    </div>
  );
}

const styles = {
  alertBar: {
    display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
    gap: 12, marginBottom: 20,
  },
  alertCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--r)', padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 14,
    boxShadow: 'var(--shadow)', borderLeft: '4px solid transparent',
  },
  alertIco: {
    width: 40, height: 40, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
  },
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
    gap: 12, marginBottom: 20,
  },
  sessionBadge: { display: 'flex', justifyContent: 'flex-end' },
  sessionPill: {
    fontSize: 11, fontWeight: 700, padding: '4px 12px',
    borderRadius: 20, background: 'var(--amber-l)',
    color: 'var(--amber-d)', border: '1px solid rgba(224,123,57,0.25)',
  },
};
