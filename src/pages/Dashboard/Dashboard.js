import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—';

// French month abbreviations
const MOIS_FR = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];

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

// ── Chart helpers ──────────────────────────────────────────────────────────
function ChartCard({ title, sub, children, minH = 220 }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div>
          <span className="card-title">{title}</span>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
      <div style={{ padding: '16px 12px', flex: 1, minHeight: minH }}>
        {children}
      </div>
    </div>
  );
}

// Custom tooltip shared style
function ChartTooltip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-sm)', padding: '8px 12px', fontSize: 12,
      boxShadow: 'var(--shadow)',
    }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontVariantNumeric: 'tabular-nums' }}>
          {p.name} : <strong>{fmt ? fmt(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const d90   = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
      const d30   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const mois1 = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

      // 6 months ago (first day)
      const sixAgo = new Date();
      sixAgo.setMonth(sixAgo.getMonth() - 5);
      sixAgo.setDate(1);
      const sixAgoStr = sixAgo.toISOString().slice(0, 10);

      const [
        { data: intrants },
        { data: lotsExp },
        { data: bcEn },
        { data: cs },
        { data: recentMvts },
        { count: mvtsMois },
        { data: mvtsRaw },
        { data: topCmmRaw },
        { data: bcsAll },
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
        // For monthly chart: last 6 months
        supabase.from('mouvements_stock')
          .select('type_mvt,quantite,date_mouvement')
          .gte('date_mouvement', sixAgoStr)
          .order('date_mouvement'),
        // Top CMM
        supabase.from('intrants')
          .select('sigle,cmm,stock_dispo')
          .eq('actif', true)
          .gt('cmm', 0)
          .order('cmm', { ascending: false })
          .limit(8),
        // BCs for service rate per CS
        supabase.from('bons_commande')
          .select('id_cs,statut,centres_sante(code_cs,nom)')
          .eq('type_bc', 'cs_district'),
      ]);

      // ── Existing calculations ──────────────────────────────────────────
      const ruptures = (intrants || []).filter(i => i.stock_dispo === 0);
      const faibles  = (intrants || []).filter(i => i.stock_dispo > 0 && i.seuil_reappro > 0 && i.stock_dispo < i.seuil_reappro);
      const lotsExp30 = (lotsExp || []).filter(l => l.date_perexp <= d30);

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

      // ── Chart 1: Stock status donut ────────────────────────────────────
      const okCount = (intrants || []).length - ruptures.length - faibles.length;
      const stockDonut = [
        { name: 'Stock OK',  value: okCount,        fill: '#2d7d46' },
        { name: 'Faible',    value: faibles.length, fill: '#c97a1a' },
        { name: 'Rupture',   value: ruptures.length, fill: '#c0392b' },
      ].filter(d => d.value > 0);

      // ── Chart 2: Monthly movements (last 6 months) ─────────────────────
      const monthMap = {};
      // Pre-fill all 6 months so even empty months show
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toISOString().slice(0, 7);
        monthMap[key] = { mois: MOIS_FR[d.getMonth()], entrees: 0, sorties: 0 };
      }
      (mvtsRaw || []).forEach(m => {
        const key = m.date_mouvement.slice(0, 7);
        if (monthMap[key]) {
          if (m.type_mvt === 'entree') monthMap[key].entrees += m.quantite;
          else monthMap[key].sorties += m.quantite;
        }
      });
      const mvtsMensuels = Object.values(monthMap);

      // ── Chart 3: Top CMM ───────────────────────────────────────────────
      const topCmm = (topCmmRaw || []).map(i => ({
        sigle: i.sigle,
        cmm:   Number(i.cmm),
      }));

      // ── Chart 4: Service rate per CS ───────────────────────────────────
      const csMap = {};
      (bcsAll || []).forEach(bc => {
        if (!bc.id_cs) return;
        if (!csMap[bc.id_cs]) csMap[bc.id_cs] = {
          code: bc.centres_sante?.code_cs ?? '?',
          total: 0, livrees: 0,
        };
        csMap[bc.id_cs].total++;
        if (bc.statut === 'livree') csMap[bc.id_cs].livrees++;
      });
      const tauxCS = Object.values(csMap)
        .filter(c => c.total > 0)
        .map(c => ({ code: c.code, taux: Math.round((c.livrees / c.total) * 100), total: c.total }))
        .sort((a, b) => b.taux - a.taux)
        .slice(0, 8);

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
        // charts
        stockDonut,
        mvtsMensuels,
        topCmm,
        tauxCS,
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
        <StatCard label="BC en attente"       value={d.bcEnAttente}   unit="commandes"   />
      </div>

      {/* ── CHARTS ROW 1 ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>

        {/* Chart 1: Stock status donut */}
        <ChartCard
          title="Santé du stock"
          sub={`${d.totalIntrants} intrants actifs`}
          minH={240}
        >
          {d.stockDonut.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-3)', fontSize: 13 }}>
              Aucune donnée
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={d.stockDonut}
                  cx="50%"
                  cy="45%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {d.stockDonut.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => (
                    <ChartTooltip active={active} payload={payload} />
                  )}
                />
                <Legend
                  iconType="circle"
                  iconSize={9}
                  formatter={(value, entry) => (
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {value} ({entry.payload.value})
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 2: Monthly movements */}
        <ChartCard
          title="Mouvements mensuels"
          sub="Entrées vs Sorties — 6 derniers mois"
          minH={240}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.mvtsMensuels} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="mois"
                tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                content={({ active, payload, label }) => (
                  <ChartTooltip active={active} payload={payload} label={label} />
                )}
              />
              <Legend
                iconType="circle"
                iconSize={9}
                formatter={v => <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{v}</span>}
              />
              <Bar dataKey="entrees" name="Entrées" fill="#0d9090" radius={[3,3,0,0]} />
              <Bar dataKey="sorties" name="Sorties" fill="#e07b39" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── CHARTS ROW 2 ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Chart 3: Top CMM (horizontal bars) */}
        <ChartCard
          title="Top consommation mensuelle (CMM)"
          sub="Produits classés par consommation moyenne mensuelle"
          minH={d.topCmm.length * 36 + 40}
        >
          {d.topCmm.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: 'var(--text-3)', fontSize: 13 }}>
              Aucune CMM renseignée
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, d.topCmm.length * 36 + 20)}>
              <BarChart
                data={d.topCmm}
                layout="vertical"
                barCategoryGap="25%"
                margin={{ left: 0, right: 24, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="sigle"
                  width={70}
                  tick={{ fontSize: 11, fill: 'var(--text-2)', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip active={active} payload={payload} label={label} fmt={v => `${v} u/mois`} />
                  )}
                />
                <Bar dataKey="cmm" name="CMM" fill="#0a6b6b" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 4: Service rate per CS */}
        <ChartCard
          title="Taux de service par CS"
          sub="% de bons de commande entièrement livrés"
          minH={220}
        >
          {d.tauxCS.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--text-3)', fontSize: 13 }}>
              Aucun bon de commande enregistré
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, d.tauxCS.length * 36 + 40)}>
              <BarChart
                data={d.tauxCS}
                layout="vertical"
                barCategoryGap="25%"
                margin={{ left: 0, right: 40, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={v => `${v}%`}
                  tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="code"
                  width={52}
                  tick={{ fontSize: 11, fill: 'var(--text-2)', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload}
                      label={label}
                      fmt={v => `${v}%`}
                    />
                  )}
                />
                <Bar
                  dataKey="taux"
                  name="Taux de service"
                  radius={[0,3,3,0]}
                  label={{ position: 'right', fontSize: 11, fill: 'var(--text-2)', formatter: v => `${v}%` }}
                >
                  {d.tauxCS.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.taux >= 80 ? '#2d7d46' : entry.taux >= 50 ? '#c97a1a' : '#c0392b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── BOTTOM: alerts list + recent movements ───────────────────────── */}
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
