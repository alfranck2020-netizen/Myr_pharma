import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// ── Helpers ────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—';
const genNum   = type => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const n = String(Math.floor(Math.random() * 900) + 100);
  return `BC-${type === 'cs_district' ? 'CS' : 'F'}-${y}${m}-${n}`;
};

const TYPE_LABEL = { cs_district: 'CS → District', district_fournisseur: 'District → Fournisseur' };
const STATUT_BADGE = {
  en_attente: 'badge-orange', livree: 'badge-green',
  partielle: 'badge-teal', annulee: 'badge-red',
};
const STATUT_LABEL = {
  en_attente: 'En attente', livree: 'Livrée',
  partielle: 'Partielle', annulee: 'Annulée',
};

const sInline = {
  padding: '4px 7px', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
  outline: 'none', width: '100%', minWidth: 0,
};

// ── TYPE CHOOSER (step 1 for new BC) ──────────────────────────────────────
function TypeChooser({ onChoose, onCancel }) {
  return (
    <div style={sOverlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ ...sModal, maxWidth: 420 }}>
        <div className="card-header">
          <span className="card-title">Nouveau bon de commande</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>✕</button>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Choisissez le type de bon de commande :</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              className="card"
              style={{ border: '2px solid var(--teal-200)', padding: 20, cursor: 'pointer', textAlign: 'left', background: 'none' }}
              onClick={() => onChoose('cs_district')}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>🏥</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>CS → District</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                Commande d'un centre de santé auprès du district
              </div>
            </button>
            <button
              className="card"
              style={{ border: '2px solid var(--amber-l)', padding: 20, cursor: 'pointer', textAlign: 'left', background: 'none' }}
              onClick={() => onChoose('district_fournisseur')}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>🚚</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>District → Fournisseur</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                Commande du district auprès de son fournisseur (QAC auto)
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STATUS UPDATE MODAL ────────────────────────────────────────────────────
function StatutModal({ bc, onClose, onSaved }) {
  const [statut, setStatut]           = useState(bc.statut);
  const [dateLivraison, setDateLiv]   = useState(bc.date_livraison ?? todayStr());
  const [saving, setSaving]           = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from('bons_commande').update({
      statut, date_livraison: dateLivraison || null,
      updated_at: new Date().toISOString(),
    }).eq('id', bc.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div style={sOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...sModal, maxWidth: 360 }}>
        <div className="card-header">
          <span className="card-title">Statut du bon de commande</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>Statut</label>
            <select value={statut} onChange={e => setStatut(e.target.value)}>
              {Object.entries(STATUT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {(statut === 'livree' || statut === 'partielle') && (
            <div className="field">
              <label>Date de livraison</label>
              <input type="date" value={dateLivraison} onChange={e => setDateLiv(e.target.value)} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Mettre à jour'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FORM VIEW ──────────────────────────────────────────────────────────────
function FormView({ bc, typePre, onBack }) {
  const isNew  = !bc;
  const type   = bc?.type_bc ?? typePre;

  const [centres, setCentres]         = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);

  const [header, setHeader] = useState({
    numero_bc:    bc?.numero_bc    ?? genNum(type),
    date_commande: bc?.date_commande ?? todayStr(),
    id_cs:         bc?.id_cs        ?? '',
    id_fournisseur: bc?.id_fournisseur ?? '',
    periode_debut: bc?.periode_debut ?? '',
    periode_fin:   bc?.periode_fin   ?? '',
    nb_patients:   bc?.nb_patients   ?? 0,
    notes:         bc?.notes         ?? '',
  });
  const [lines, setLines]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    async function init() {
      const [{ data: c }, { data: f }] = await Promise.all([
        supabase.from('centres_sante').select('id,nom,code_cs').eq('actif', true).order('nom'),
        supabase.from('fournisseurs').select('id,nom').eq('actif', true).order('nom'),
      ]);
      setCentres(c || []);
      setFournisseurs(f || []);

      if (!isNew) {
        // Load existing lines
        const { data: lignes } = await supabase
          .from('bons_commande_lignes')
          .select('*, intrants(sigle, nom_dci, stock_dispo, cmm, file_active)')
          .eq('id_bon_commande', bc.id);
        if (lignes) {
          setLines(lignes.map(l => ({
            id:                 l.id,
            id_intrant:         l.id_intrant,
            sigle:              l.intrants?.sigle    ?? '',
            nom_dci:            l.intrants?.nom_dci  ?? '',
            file_active:        l.file_active,
            sdu:                l.sdu,
            cmm_bm:             l.cmm_bm,
            qac:                l.qac,
            quantite_commandee: l.quantite_commandee,
            quantite_livree:    l.quantite_livree,
            observation:        l.observation ?? '',
          })));
        }
      } else if (type === 'district_fournisseur') {
        // Pre-fill with all active intrants + auto-calculate QAC
        const { data: intrants } = await supabase
          .from('intrants')
          .select('id, sigle, nom_dci, stock_dispo, cmm, file_active, seuil_reappro')
          .eq('actif', true)
          .order('sigle');
        if (intrants) {
          setLines(intrants.map(i => {
            const sdu   = i.stock_dispo;
            const cmm   = Number(i.cmm) || 0;
            const qac   = Math.max(0, Math.round(cmm * 4 - sdu));
            return {
              id_intrant:         i.id,
              sigle:              i.sigle,
              nom_dci:            i.nom_dci,
              file_active:        i.file_active ?? 0,
              sdu,
              cmm_bm:             cmm,
              qac,
              quantite_commandee: qac,
              quantite_livree:    0,
              observation:        '',
            };
          }));
        }
      }
      // For cs_district: start with empty lines (user adds)
      setLoading(false);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (idx, field, value) => {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Recalc QAC when sdu or cmm_bm changes (fournisseur only)
      if (type === 'district_fournisseur' && (field === 'sdu' || field === 'cmm_bm')) {
        const sdu = field === 'sdu' ? Number(value) : Number(next[idx].sdu);
        const cmm = field === 'cmm_bm' ? Number(value) : Number(next[idx].cmm_bm);
        next[idx].qac = Math.max(0, Math.round(cmm * 4 - sdu));
        if (field !== 'quantite_commandee') next[idx].quantite_commandee = next[idx].qac;
      }
      return next;
    });
  };

  // Add intrant line (CS orders only)
  const [intrantSearch, setIntrantSearch] = useState('');
  const [allIntrants, setAllIntrants]     = useState([]);

  useEffect(() => {
    if (type !== 'cs_district') return;
    supabase.from('intrants').select('id,sigle,nom_dci,stock_dispo,cmm,file_active')
      .eq('actif', true).order('sigle')
      .then(({ data }) => setAllIntrants(data || []));
  }, [type]);

  function addIntrant(intrant) {
    if (lines.find(l => l.id_intrant === intrant.id)) return;
    setLines(prev => [...prev, {
      id_intrant:         intrant.id,
      sigle:              intrant.sigle,
      nom_dci:            intrant.nom_dci,
      file_active:        intrant.file_active ?? 0,
      sdu:                intrant.stock_dispo ?? 0,
      cmm_bm:             Number(intrant.cmm) || 0,
      qac:                0,
      quantite_commandee: 0,
      quantite_livree:    0,
      observation:        '',
    }]);
    setIntrantSearch('');
  }

  function removeLine(idx) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!header.numero_bc.trim() || !header.date_commande) {
      setError('Numéro et date sont obligatoires.'); return;
    }
    if (type === 'cs_district' && !header.id_cs) {
      setError('Veuillez sélectionner le centre de santé.'); return;
    }
    if (type === 'district_fournisseur' && !header.id_fournisseur) {
      setError('Veuillez sélectionner le fournisseur.'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        numero_bc:      header.numero_bc.trim(),
        type_bc:        type,
        id_cs:          header.id_cs          || null,
        id_fournisseur: header.id_fournisseur || null,
        date_commande:  header.date_commande,
        periode_debut:  header.periode_debut  || null,
        periode_fin:    header.periode_fin    || null,
        nb_patients:    Number(header.nb_patients) || 0,
        notes:          header.notes.trim()   || null,
        statut:         bc?.statut            ?? 'en_attente',
        updated_at:     new Date().toISOString(),
      };
      let bcId = bc?.id;
      if (!bcId) {
        const { data, error: e } = await supabase.from('bons_commande').insert(payload).select().single();
        if (e) throw e;
        bcId = data.id;
      } else {
        const { error: e } = await supabase.from('bons_commande').update(payload).eq('id', bcId);
        if (e) throw e;
        await supabase.from('bons_commande_lignes').delete().eq('id_bon_commande', bcId);
      }
      const lignesPayload = lines.map(l => ({
        id_bon_commande:    bcId,
        id_intrant:         l.id_intrant,
        file_active:        Number(l.file_active) || 0,
        sdu:                Number(l.sdu)          || 0,
        cmm_bm:             Number(l.cmm_bm)       || 0,
        qac:                Number(l.qac)           || 0,
        quantite_commandee: Number(l.quantite_commandee) || 0,
        quantite_livree:    Number(l.quantite_livree)    || 0,
        observation:        l.observation || null,
      }));
      if (lignesPayload.length > 0) {
        const { error: e } = await supabase.from('bons_commande_lignes').insert(lignesPayload);
        if (e) throw e;
      }
      onBack();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Chargement…</div>;

  const filteredIntrants = allIntrants.filter(i => {
    if (lines.find(l => l.id_intrant === i.id)) return false;
    if (!intrantSearch) return true;
    const q = intrantSearch.toLowerCase();
    return i.sigle?.toLowerCase().includes(q) || i.nom_dci?.toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Retour</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>
          {isNew ? 'Nouveau BC' : `BC ${header.numero_bc}`}
        </h1>
        <span className="badge badge-teal">{TYPE_LABEL[type]}</span>
      </div>

      {/* Header */}
      <div className="card">
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10 }}>
            <div className="field">
              <label>Numéro BC</label>
              <input value={header.numero_bc} onChange={e => setHeader(h => ({ ...h, numero_bc: e.target.value }))} />
            </div>
            <div className="field">
              <label>Date commande</label>
              <input type="date" value={header.date_commande} onChange={e => setHeader(h => ({ ...h, date_commande: e.target.value }))} />
            </div>
            {type === 'cs_district' ? (
              <div className="field">
                <label>Centre de santé *</label>
                <select value={header.id_cs} onChange={e => setHeader(h => ({ ...h, id_cs: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {centres.map(c => <option key={c.id} value={c.id}>{c.code_cs} — {c.nom}</option>)}
                </select>
              </div>
            ) : (
              <div className="field">
                <label>Fournisseur *</label>
                <select value={header.id_fournisseur} onChange={e => setHeader(h => ({ ...h, id_fournisseur: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label>Période début</label>
              <input type="date" value={header.periode_debut} onChange={e => setHeader(h => ({ ...h, periode_debut: e.target.value }))} />
            </div>
            <div className="field">
              <label>Période fin</label>
              <input type="date" value={header.periode_fin} onChange={e => setHeader(h => ({ ...h, periode_fin: e.target.value }))} />
            </div>
            <div className="field field-num">
              <label>Nb patients</label>
              <input type="number" min="0" value={header.nb_patients} onChange={e => setHeader(h => ({ ...h, nb_patients: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Notes</label>
            <input value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} placeholder="Observations…" />
          </div>
        </div>
      </div>

      {/* Add intrant row (CS orders) */}
      {type === 'cs_district' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <input
              style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }}
              placeholder="🔍 Ajouter un intrant…"
              value={intrantSearch}
              onChange={e => setIntrantSearch(e.target.value)}
            />
            {intrantSearch && filteredIntrants.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', boxShadow: 'var(--shadow-md)',
                maxHeight: 180, overflowY: 'auto',
              }}>
                {filteredIntrants.slice(0, 10).map(i => (
                  <div key={i.id}
                    onClick={() => addIntrant(i)}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-50)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <strong>{i.sigle}</strong>
                    <span style={{ color: 'var(--text-2)', marginLeft: 8, fontSize: 12 }}>{i.nom_dci}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{lines.length} intrant{lines.length !== 1 ? 's' : ''} ajouté{lines.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Lines table */}
      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header">
          <span className="card-title">Lignes du bon de commande ({lines.length})</span>
          {type === 'district_fournisseur' && (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>QAC = (CMM × 4) − SDU</span>
          )}
        </div>
        {lines.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            {type === 'cs_district'
              ? 'Utilisez la recherche ci-dessus pour ajouter des intrants à la commande.'
              : 'Aucun intrant actif trouvé.'}
          </div>
        ) : (
          <div className="tbl-wrap" style={{ flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Intrant</th>
                  <th style={{ textAlign: 'center', width: 80 }}>File active</th>
                  <th style={{ textAlign: 'center', width: 80 }}>SDU</th>
                  <th style={{ textAlign: 'center', width: 80 }}>CMM</th>
                  {type === 'district_fournisseur' && (
                    <th style={{ textAlign: 'center', width: 80 }}>QAC</th>
                  )}
                  <th style={{ textAlign: 'center', width: 100 }}>Qté commandée</th>
                  <th style={{ textAlign: 'center', width: 100 }}>Qté livrée</th>
                  <th>Obs.</th>
                  {type === 'cs_district' && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong style={{ fontSize: 13 }}>{line.sigle}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{line.nom_dci}</div>
                    </td>
                    <td>
                      <input type="number" min="0" style={{ ...sInline, textAlign: 'center', width: 70 }}
                        value={line.file_active} onChange={e => setLine(idx, 'file_active', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" min="0" style={{ ...sInline, textAlign: 'center', width: 70 }}
                        value={line.sdu} onChange={e => setLine(idx, 'sdu', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" min="0" step="0.1" style={{ ...sInline, textAlign: 'center', width: 70 }}
                        value={line.cmm_bm} onChange={e => setLine(idx, 'cmm_bm', e.target.value)} />
                    </td>
                    {type === 'district_fournisseur' && (
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--teal-700)', fontSize: 14 }}>
                        {line.qac}
                      </td>
                    )}
                    <td>
                      <input type="number" min="0" style={{ ...sInline, textAlign: 'center', width: 80, fontWeight: 700 }}
                        value={line.quantite_commandee} onChange={e => setLine(idx, 'quantite_commandee', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" min="0" style={{ ...sInline, textAlign: 'center', width: 80 }}
                        value={line.quantite_livree} onChange={e => setLine(idx, 'quantite_livree', e.target.value)} />
                    </td>
                    <td>
                      <input style={{ ...sInline, minWidth: 100 }} value={line.observation}
                        onChange={e => setLine(idx, 'observation', e.target.value)} placeholder="—" />
                    </td>
                    {type === 'cs_district' && (
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => removeLine(idx)} title="Retirer">✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: 'var(--red)', fontSize: 12, background: 'var(--red-l)', padding: '8px 12px', borderRadius: 'var(--r-sm)' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onBack}>Annuler</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : isNew ? 'Créer le bon de commande' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}

// ── LIST VIEW ──────────────────────────────────────────────────────────────
function ListView({ onNew, onOpen }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all'); // 'all' | 'cs_district' | 'district_fournisseur'
  const [statutModal, setStatutModal] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bons_commande')
      .select('*, centres_sante(nom,code_cs), fournisseurs(nom)')
      .order('date_commande', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? items : items.filter(i => i.type_bc === filter);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Bons de Commande</h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {items.length} bon{items.length !== 1 ? 's' : ''} de commande
          </p>
        </div>
        <button className="btn btn-primary" onClick={onNew}>+ Nouveau BC</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 3, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 3, width: 'fit-content' }}>
        {[['all', 'Tous'], ['cs_district', 'CS → District'], ['district_fournisseur', 'District → Fournisseur']].map(([v, l]) => (
          <button key={v}
            style={{ padding: '5px 12px', border: 'none', borderRadius: 'calc(var(--r-sm) - 2px)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: filter === v ? 'var(--teal-700)' : 'transparent', color: filter === v ? '#fff' : 'var(--text-2)', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
            onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            <p>Aucun bon de commande.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Cliquez sur « + Nouveau BC » pour commencer.</p>
          </div>
        ) : (
          <div className="tbl-wrap" style={{ flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>CS / Fournisseur</th>
                  <th>Statut</th>
                  <th>Date livraison</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(bc => (
                  <tr key={bc.id} onClick={() => onOpen(bc)}>
                    <td><strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{bc.numero_bc}</strong></td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{TYPE_LABEL[bc.type_bc]}</span>
                    </td>
                    <td style={{ fontSize: 13 }}>{fmtDate(bc.date_commande)}</td>
                    <td style={{ fontSize: 13 }}>
                      {bc.type_bc === 'cs_district'
                        ? (bc.centres_sante ? `${bc.centres_sante.code_cs} — ${bc.centres_sante.nom}` : '—')
                        : (bc.fournisseurs?.nom ?? '—')}
                    </td>
                    <td>
                      <span className={`badge ${STATUT_BADGE[bc.statut]}`}>{STATUT_LABEL[bc.statut]}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtDate(bc.date_livraison)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" title="Modifier le statut"
                        onClick={e => { e.stopPropagation(); setStatutModal(bc); }}>
                        ⟳
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {statutModal && (
        <StatutModal
          bc={statutModal}
          onClose={() => setStatutModal(null)}
          onSaved={() => { setStatutModal(null); load(); }}
        />
      )}
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function BonsCommande() {
  const [view, setView]   = useState('list'); // 'list' | 'chooser' | 'form'
  const [selected, setSelected] = useState(null);
  const [typeNew, setTypeNew]   = useState(null);

  if (view === 'chooser') {
    return <TypeChooser
      onChoose={type => { setTypeNew(type); setView('form'); }}
      onCancel={() => setView('list')}
    />;
  }

  if (view === 'form') {
    return <FormView
      bc={selected}
      typePre={typeNew}
      onBack={() => { setSelected(null); setTypeNew(null); setView('list'); }}
    />;
  }

  return (
    <ListView
      onNew={() => { setSelected(null); setView('chooser'); }}
      onOpen={bc => { setSelected(bc); setView('form'); }}
    />
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
  width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto',
};
