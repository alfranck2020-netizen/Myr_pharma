import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—';

// ── Sub-components ─────────────────────────────────────────────────────────
function AlertCard({ type, icon, count, label }) {
  const C = {
    danger:  { border: 'var(--red)',     bg: 'var(--red-l)',    text: 'var(--red)' },
    warning: { border: 'var(--orange)',  bg: 'var(--orange-l)', text: 'var(--orange)' },
    info:    { border: 'var(--teal-500)', bg: 'var(--teal-50)', text: 'var(--teal-700)' },
    ok:      { border: 'var(--green)',   bg: 'var(--green-l)',  text: 'var(--green)' },
  }[type];
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `4px solid ${C.border}`, borderRadius: 'var(--r)',
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: 'var(--shadow)',
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 8, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 30, fontWeight: 800, color: C.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {count}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, sub }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const d90   = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
      const d30   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const mois1 = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

      const [
        { data: intrants },
        { data: lotsExp },
        { data: bcEn },
        { data: cs },
        { data: recentMvts },
        { count: mvtsMois },
      ] = await Promise.all([
        supabase.from('intrants').select('id,sigle,nom_dci,stock_dispo,seuil_reappro').eq('actif', true),
        supabase.from('lots')
          .select('id,num_lot,date_perexp,qte_dispo,intrants(sigle)')
          .eq('etat_lot', 'en_cours')
          .gte('date_perexp', today)
          .lte('date_perexp', d90)
          .order('date_perexp')
          .limit(20),
        supabase.from('bons_commande').select('id').eq('statut', 'en_attente'),
        supabase.from('centres_sante').select('id').eq('actif', true),
        supabase.from('mouvements_stock')
          .select('id,type_mvt,quantite,date_mouvement,source,intrants(sigle),centres_sante(code_cs)')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('mouvements_stock')
          .select('id', { count: 'exact', head: true })
          .gte('date_mouvement', mois1),
      ]);

      const ruptures = (intrants || []).filter(i => i.stock_dispo === 0);
      const faibles  = (intrants || []).filter(i => i.stock_dispo > 0 && i.seuil_reappro > 0 && i.stock_dispo < i.seuil_reappro);
      const lotsExp30 = (lotsExp || []).filter(l => l.date_perexp <= d30);

      // Build alert rows (top items, most urgent first)
      const alertRows = [
        ...ruptures.slice(0, 4).map(i => ({ level: 'danger', text: `${i.sigle} — Rupture de stock`, sub: i.nom_dci })),
        ...lotsExp30.slice(0, 3).map(l => {
          const days = Math.round((new Date(l.date_perexp) - new Date()) / 86400000);
          return { level: 'warning', text: `${l.intrants?.sigle} — Lot ${l.num_lot}`, sub: `Périme dans ${days} j (${fmtDate(l.date_perexp)})` };
        }),
        ...faibles.slice(0, 3).map(i => ({
          level: 'warning', text: `${i.sigle} — Stock faible`,
          sub: `${i.stock_dispo} unités (seuil : ${i.seuil_reappro})`,
        })),
      ];

      setData({
        totalIntrants: (intrants || []).length,
        ruptures: ruptures.length,
        faibles: faibles.length,
        lotsExp: (lotsExp || []).length,
        lotsExp30: lotsExp30.length,
        bcEnAttente: (bcEn || []).length,
        centres: (cs || []).length,
        mvtsMois: mvtsMois || 0,
        alertRows,
        recentMvts: recentMvts || [],
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'var(--text-2)', textAlign: 'center', marginTop: 40 }}>
        Chargement du tableau de bord…
      </div>
    );
  }

  const d = data;
  const sessionLabel = (() => {
    const now = new Date();
    const m = now.getMonth();
    // 4-month sessions: Jan-Apr, May-Aug, Sep-Dec
    const sessions = [
      [0, 3, 'Janvier – Avril'],
      [4, 7, 'Mai – Août'],
      [8, 11, 'Septembre – Décembre'],
    ];
    const [, , label] = sessions.find(([s, e]) => m >= s && m <= e);
    return `${label} ${now.getFullYear()}`;
  })();

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title + session */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Tableau de bord</h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            Vue d'ensemble — Stock & Approvisionnements
          </p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 20,
          background: 'var(--amber-l)', color: 'var(--amber-d)',
          border: '1px solid rgba(224,123,57,0.25)',
        }}>
          ⬡ Session {sessionLabel}
        </span>
      </div>

      {/* Alert bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <AlertCard
          type={d.ruptures > 0 ? 'danger' : 'ok'}
          icon={d.ruptures > 0 ? '⚠' : '✓'}
          count={d.ruptures}
          label={d.ruptures > 0 ? 'Rupture(s) de stock' : 'Aucune rupture'}
        />
        <AlertCard
          type={d.lotsExp > 0 ? 'warning' : 'ok'}
          icon="📅"
          count={d.lotsExp}
          label="Lots expirant dans 90 jours"
        />
        <AlertCard
          type={d.bcEnAttente > 0 ? 'info' : 'ok'}
          icon="📦"
          count={d.bcEnAttente}
          label="Bons de commande en attente"
        />
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <StatCard label="Intrants actifs"     value={d.totalIntrants} unit="produits"    sub={`${d.faibles} en stock faible`} />
        <StatCard label="Centres de santé"    value={d.centres}       unit="CS actifs"   />
        <StatCard label="Mouvements ce mois"  value={d.mvtsMois}      unit="mvts"        />
        <StatCard label="BC en attente"        value={d.bcEnAttente}   unit="commandes"   />
      </div>

      {/* Bottom: alerts list + recent movements */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Alertes stock</span>
            {d.alertRows.length === 0 && <span className="badge badge-green">Tout OK</span>}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {d.alertRows.length === 0 ? (
              <div style={{ padding: '20px 18px', color: 'var(--text-3)', fontSize: 13, textAlign: 'center' }}>
                Aucune alerte active. Stock en bon état.
              </div>
            ) : (
              d.alertRows.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
                  borderBottom: i < d.alertRows.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: a.level === 'danger' ? 'var(--red)' : 'var(--orange)',
                  }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.text}</div>
                    {a.sub && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.sub}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent movements */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Mouvements récents</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {d.recentMvts.length === 0 ? (
              <div style={{ padding: '20px 18px', color: 'var(--text-3)', fontSize: 13, textAlign: 'center' }}>
                Aucun mouvement enregistré.
              </div>
            ) : (
              d.recentMvts.map((m, i) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 18px',
                  borderBottom: i < d.recentMvts.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      fontSize: 16, width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: m.type_mvt === 'entree' ? 'var(--green-l)' : 'var(--red-l)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {m.type_mvt === 'entree' ? '↓' : '↑'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.intrants?.sigle ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {fmtDate(m.date_mouvement)}
                        {m.centres_sante && ` · ${m.centres_sante.code_cs}`}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums',
                    color: m.type_mvt === 'entree' ? 'var(--green)' : 'var(--red)',
                  }}>
                    {m.type_mvt === 'entree' ? '+' : '-'}{m.quantite}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
