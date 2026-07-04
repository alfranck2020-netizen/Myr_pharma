import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—';

const TYPE_LABELS = {
  dispensaire: { label: 'Dispensaire', badge: 'badge-teal' },
  ccs:         { label: 'CCS',         badge: 'badge-teal' },
  hopital:     { label: 'Hôpital',     badge: 'badge-green' },
};

const STATUT_LABELS = {
  en_attente: { label: 'En attente', cls: 'badge-amber' },
  livree:     { label: 'Livrée',     cls: 'badge-green' },
  partielle:  { label: 'Partielle',  cls: 'badge-teal' },
  annulee:    { label: 'Annulée',    cls: 'badge-red' },
};

const EMPTY = { code_cs: '', nom: '', contact: '', localisation: '', type_centre: 'dispensaire', actif: true };

// ── Modal CRUD ──────────────────────────────────────────────────────────────
function CSModal({ cs, onClose, onSaved }) {
  const [form, setForm] = useState(cs ? {
    code_cs:      cs.code_cs,
    nom:          cs.nom,
    contact:      cs.contact ?? '',
    localisation: cs.localisation ?? '',
    type_centre:  cs.type_centre ?? 'dispensaire',
    actif:        cs.actif !== false,
  } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.code_cs.trim() || !form.nom.trim()) {
      setError('Code et nom du centre sont obligatoires.'); return;
    }
    setSaving(true); setError('');
    const payload = {
      code_cs:      form.code_cs.trim().toUpperCase(),
      nom:          form.nom.trim(),
      contact:      form.contact.trim() || null,
      localisation: form.localisation.trim() || null,
      type_centre:  form.type_centre,
      actif:        form.actif,
      updated_at:   new Date().toISOString(),
    };
    let err;
    if (cs) {
      ({ error: err } = await supabase.from('centres_sante').update(payload).eq('id', cs.id));
    } else {
      ({ error: err } = await supabase.from('centres_sante').insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div style={sOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={sModal}>
        <div className="card-header">
          <span className="card-title">{cs ? 'Modifier le centre' : 'Nouveau centre de santé'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Code CS *</label>
              <input value={form.code_cs} onChange={e => set('code_cs', e.target.value)} placeholder="Ex: CS001" />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={form.type_centre} onChange={e => set('type_centre', e.target.value)}>
                <option value="dispensaire">Dispensaire</option>
                <option value="ccs">Centre Communautaire de Santé (CCS)</option>
                <option value="hopital">Hôpital</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Nom du centre *</label>
            <input value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Ex: Centre de Santé de Bafoussam" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Contact</label>
              <input value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="Téléphone" />
            </div>
            <div className="field">
              <label>Localisation</label>
              <input value={form.localisation} onChange={e => set('localisation', e.target.value)} placeholder="Quartier / Village" />
            </div>
          </div>

          {cs && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.actif} onChange={e => set('actif', e.target.checked)} />
              Centre actif
            </label>
          )}

          {error && (
            <p style={{ color: 'var(--red)', fontSize: 12, background: 'var(--red-l)', padding: '8px 10px', borderRadius: 'var(--r-sm)' }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Enregistrement...' : cs ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Statistics Panel ────────────────────────────────────────────────────────
function MiniStat({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-sm)', padding: '10px 14px', flex: 1, minWidth: 90,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

function CSStatsPanel({ cs, onClose, onEdit }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cs) return;
    setLoading(true);

    async function load() {
      const mois1 = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

      const [
        { data: bcs },
        { data: mvtsMois },
        { data: recentMvts },
      ] = await Promise.all([
        // All BCs for this CS
        supabase
          .from('bons_commande')
          .select('id, numero_bc, date_commande, statut, date_livraison')
          .eq('id_cs', cs.id)
          .eq('type_bc', 'cs_district')
          .order('date_commande', { ascending: false })
          .limit(50),

        // Movements this month (sorties to this CS)
        supabase
          .from('mouvements_stock')
          .select('id, quantite, date_mouvement, intrants(sigle)')
          .eq('type_mvt', 'sortie')
          .eq('id_cs', cs.id)
          .gte('date_mouvement', mois1)
          .order('date_mouvement', { ascending: false }),

        // Recent movements (last 8)
        supabase
          .from('mouvements_stock')
          .select('id, type_mvt, quantite, date_mouvement, motif, intrants(sigle)')
          .eq('id_cs', cs.id)
          .order('date_mouvement', { ascending: false })
          .limit(8),
      ]);

      const allBcs = bcs || [];
      const livrees = allBcs.filter(b => b.statut === 'livree').length;
      const tauxService = allBcs.length > 0 ? Math.round((livrees / allBcs.length) * 100) : null;

      // Fetch BC lines properly using the BC IDs
      let topProduits = [];
      if (allBcs.length > 0) {
        const bcIds = allBcs.map(b => b.id);
        const { data: allLignes } = await supabase
          .from('bons_commande_lignes')
          .select('id_intrant, quantite_commandee, quantite_livree, intrants(sigle, nom_dci)')
          .in('id_bon_commande', bcIds);

        // Aggregate by intrant
        const byIntrant = {};
        (allLignes || []).forEach(l => {
          if (!l.id_intrant) return;
          if (!byIntrant[l.id_intrant]) {
            byIntrant[l.id_intrant] = {
              sigle: l.intrants?.sigle ?? '—',
              nom_dci: l.intrants?.nom_dci ?? '',
              totalCommande: 0,
              totalLivre: 0,
              count: 0,
            };
          }
          byIntrant[l.id_intrant].totalCommande += l.quantite_commandee || 0;
          byIntrant[l.id_intrant].totalLivre    += l.quantite_livree    || 0;
          byIntrant[l.id_intrant].count         += 1;
        });

        topProduits = Object.values(byIntrant)
          .sort((a, b) => b.totalCommande - a.totalCommande)
          .slice(0, 6);
      }

      setStats({
        totalBcs:    allBcs.length,
        livrees,
        tauxService,
        sortiesMois: (mvtsMois || []).reduce((s, m) => s + (m.quantite || 0), 0),
        recentBcs:   allBcs.slice(0, 5),
        recentMvts:  recentMvts || [],
        topProduits,
      });
      setLoading(false);
    }

    load();
  }, [cs]);

  const typeInfo = TYPE_LABELS[cs.type_centre] ?? { label: cs.type_centre, badge: 'badge-teal' };

  return (
    <div style={{
      width: 380, flexShrink: 0, background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--r)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontFamily: 'monospace', fontWeight: 700, fontSize: 11,
              background: 'var(--teal-50)', color: 'var(--teal-700)',
              padding: '2px 7px', borderRadius: 4, border: '1px solid var(--border)',
            }}>{cs.code_cs}</span>
            <span className={`badge ${typeInfo.badge}`}>{typeInfo.label}</span>
            {!cs.actif && <span className="badge badge-red">Inactif</span>}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, color: 'var(--text)' }}>{cs.nom}</div>
          {(cs.localisation || cs.contact) && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
              {[cs.localisation, cs.contact].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Modifier">✎</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose} title="Fermer">✕</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
          Chargement des statistiques…
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* KPI row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MiniStat label="Total BCs" value={stats.totalBcs} />
            <MiniStat label="Livrés" value={stats.livrees} color="var(--green)" />
            <MiniStat
              label="Taux service"
              value={stats.tauxService !== null ? `${stats.tauxService}%` : '—'}
              color={stats.tauxService >= 80 ? 'var(--green)' : stats.tauxService >= 50 ? 'var(--orange)' : 'var(--red)'}
            />
            <MiniStat label="Sorties/mois" value={stats.sortiesMois} color="var(--teal-700)" />
          </div>

          {/* Top produits */}
          {stats.topProduits.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                Produits les plus commandés
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stats.topProduits.map((p, i) => {
                  const tauxP = p.totalCommande > 0 ? Math.round((p.totalLivre / p.totalCommande) * 100) : 0;
                  return (
                    <div key={i} style={{
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)', padding: '8px 10px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{p.sigle}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6 }}>{p.nom_dci}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                          {p.totalCommande} unités
                        </span>
                      </div>
                      <div className="prog-wrap">
                        <div className="prog-fill" style={{ width: `${Math.min(tauxP, 100)}%`, background: tauxP >= 80 ? 'var(--green)' : tauxP >= 50 ? 'var(--orange)' : 'var(--red)' }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                        Livré : {p.totalLivre} / {p.totalCommande} ({tauxP}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent BCs */}
          {stats.recentBcs.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                Derniers bons de commande
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {stats.recentBcs.map((bc, i) => {
                  const s = STATUT_LABELS[bc.statut] ?? { label: bc.statut, cls: 'badge-teal' };
                  return (
                    <div key={bc.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px',
                      background: i % 2 === 0 ? 'var(--bg)' : 'transparent',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 12,
                    }}>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{bc.numero_bc}</span>
                        <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{fmtDate(bc.date_commande)}</span>
                      </div>
                      <span className={`badge ${s.cls}`}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent movements */}
          {stats.recentMvts.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                Mouvements récents
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {stats.recentMvts.map((m, i) => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 10px',
                    background: i % 2 === 0 ? 'var(--bg)' : 'transparent',
                    borderRadius: 'var(--r-sm)',
                    fontSize: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        background: m.type_mvt === 'entree' ? 'var(--green-l)' : 'var(--red-l)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                        color: m.type_mvt === 'entree' ? 'var(--green)' : 'var(--red)',
                      }}>
                        {m.type_mvt === 'entree' ? '↓' : '↑'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{m.intrants?.sigle ?? '—'}</div>
                        <div style={{ color: 'var(--text-3)', fontSize: 10 }}>{fmtDate(m.date_mouvement)}</div>
                      </div>
                    </div>
                    <span style={{
                      fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      color: m.type_mvt === 'entree' ? 'var(--green)' : 'var(--red)',
                    }}>
                      {m.type_mvt === 'entree' ? '+' : '-'}{m.quantite}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.totalBcs === 0 && stats.recentMvts.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: '20px 0' }}>
              Aucune activité enregistrée pour ce centre.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function CentresSante() {
  const [centres, setCentres]  = useState([]);
  const [loading, setLoading]  = useState(true);
  const [search, setSearch]    = useState('');
  const [modal, setModal]      = useState(null);   // null | 'add' | cs-object (for edit)
  const [selected, setSelected] = useState(null);  // cs for stats panel
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('centres_sante').select('*').order('nom');
    setCentres(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = centres.filter(c => {
    if (!showInactive && !c.actif) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.nom?.toLowerCase().includes(q) || c.code_cs?.toLowerCase().includes(q) || c.localisation?.toLowerCase().includes(q);
    }
    return true;
  });

  const actifs = centres.filter(c => c.actif).length;

  function handleRowClick(c) {
    setSelected(prev => prev?.id === c.id ? null : c);
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Centres de Santé</h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {actifs} centre{actifs !== 1 ? 's' : ''} actif{actifs !== 1 ? 's' : ''}
            {selected && <> · <span style={{ color: 'var(--teal-700)' }}>Statistiques : {selected.nom}</span></>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Nouveau centre</button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['dispensaire', 'ccs', 'hopital'].map(type => {
          const count = centres.filter(c => c.actif && c.type_centre === type).length;
          if (!count) return null;
          return (
            <span key={type} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: 'var(--teal-50)', color: 'var(--teal-700)',
              border: '1px solid var(--border)',
            }}>
              {TYPE_LABELS[type]?.label} : {count}
            </span>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          style={{
            padding: '7px 12px', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', background: 'var(--surface)',
            color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
            outline: 'none', minWidth: 220,
          }}
          placeholder="🔍 Rechercher nom, code, localisation..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Afficher inactifs
        </label>
      </div>

      {/* Body: table + stats panel */}
      <div style={{ display: 'flex', gap: 14, flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Table */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Chargement...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
              <p>Aucun centre trouvé.</p>
              {!search && <p style={{ fontSize: 12, marginTop: 4 }}>Cliquez sur « + Nouveau centre » pour commencer.</p>}
            </div>
          ) : (
            <div className="tbl-wrap" style={{ flex: 1 }}>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom</th>
                    <th>Type</th>
                    {!selected && <th>Localisation</th>}
                    {!selected && <th>Contact</th>}
                    <th>Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const typeInfo = TYPE_LABELS[c.type_centre] ?? { label: c.type_centre, badge: 'badge-teal' };
                    const isSelected = selected?.id === c.id;
                    return (
                      <tr
                        key={c.id}
                        style={{
                          opacity: c.actif ? 1 : 0.55,
                          cursor: 'pointer',
                          background: isSelected ? 'var(--teal-50)' : undefined,
                          borderLeft: isSelected ? '3px solid var(--teal-500)' : '3px solid transparent',
                        }}
                        onClick={() => handleRowClick(c)}
                      >
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{c.code_cs}</span>
                        </td>
                        <td><strong style={{ fontSize: 13 }}>{c.nom}</strong></td>
                        <td>
                          <span className={`badge ${typeInfo.badge}`}>{typeInfo.label}</span>
                        </td>
                        {!selected && <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.localisation || '—'}</td>}
                        {!selected && <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.contact || '—'}</td>}
                        <td>
                          {c.actif
                            ? <span className="badge badge-green">Actif</span>
                            : <span className="badge badge-red">Inactif</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={e => { e.stopPropagation(); setModal(c); }}
                            title="Modifier"
                          >
                            ✎
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats panel */}
        {selected && (
          <CSStatsPanel
            cs={selected}
            onClose={() => setSelected(null)}
            onEdit={() => { setModal(selected); }}
          />
        )}
      </div>

      {modal && (
        <CSModal
          cs={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
            // Refresh selected if it was the edited one
            if (selected && modal !== 'add' && modal?.id === selected.id) {
              setSelected(null);
            }
          }}
        />
      )}
    </div>
  );
}

const sOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 16,
};
const sModal = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--r)', boxShadow: 'var(--shadow-md)',
  width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
};
