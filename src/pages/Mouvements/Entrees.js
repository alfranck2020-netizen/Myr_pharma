import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const SOURCES_ENTREE = [
  { val: 'fournisseur', label: 'Fournisseur' },
  { val: 'retour_cs',   label: 'Retour CS' },
  { val: 'don',         label: 'Don' },
  { val: 'autre',       label: 'Autre' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—';

function EntreeModal({ onClose, onSaved }) {
  const [intrants, setIntrants]       = useState([]);
  const [lots, setLots]               = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [centres, setCentres]         = useState([]);
  const [form, setForm] = useState({
    id_intrant: '', id_lot: '', quantite: 1,
    source: 'fournisseur', motif: '',
    date_mouvement: todayStr(),
    id_fournisseur: '', id_cs: '', observation: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('intrants').select('id,sigle,nom_dci').eq('actif', true).order('sigle'),
      supabase.from('fournisseurs').select('id,nom').eq('actif', true).order('nom'),
      supabase.from('centres_sante').select('id,nom,code_cs').eq('actif', true).order('nom'),
    ]).then(([{ data: i }, { data: f }, { data: c }]) => {
      setIntrants(i || []);
      setFournisseurs(f || []);
      setCentres(c || []);
    });
  }, []);

  useEffect(() => {
    if (!form.id_intrant) { setLots([]); return; }
    supabase.from('lots').select('id,num_lot,date_perexp,qte_dispo')
      .eq('id_intrant', form.id_intrant)
      .neq('etat_lot', 'perime')
      .order('date_perexp')
      .then(({ data }) => {
        setLots(data || []);
        setForm(f => ({ ...f, id_lot: '' }));
      });
  }, [form.id_intrant]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.id_intrant || !form.quantite || Number(form.quantite) <= 0) {
      setError('Intrant et quantité (> 0) sont obligatoires.'); return;
    }
    setSaving(true); setError('');
    try {
      const qty = Number(form.quantite);
      // Insert mouvement
      const { error: e1 } = await supabase.from('mouvements_stock').insert({
        type_mvt:       'entree',
        motif:          form.motif || form.source,
        id_intrant:     form.id_intrant,
        id_lot:         form.id_lot || null,
        quantite:       qty,
        date_mouvement: form.date_mouvement,
        source:         form.source,
        id_fournisseur: form.id_fournisseur || null,
        id_cs:          form.id_cs || null,
        observation:    form.observation || null,
      });
      if (e1) throw e1;

      // Update lot stock (triggers recalc on intrant)
      if (form.id_lot) {
        const lot = lots.find(l => l.id === form.id_lot);
        if (lot) {
          await supabase.from('lots').update({
            qte_dispo: lot.qte_dispo + qty,
            qte_lot:   lot.qte_lot + qty,
            updated_at: new Date().toISOString(),
          }).eq('id', lot.id);
        }
      }
      onSaved();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  return (
    <div style={sOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={sModal}>
        <div className="card-header">
          <span className="card-title">Nouvelle entrée de stock</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Intrant *</label>
              <select value={form.id_intrant} onChange={e => set('id_intrant', e.target.value)}>
                <option value="">— Choisir —</option>
                {intrants.map(i => <option key={i.id} value={i.id}>{i.sigle} — {i.nom_dci}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Lot (facultatif)</label>
              <select value={form.id_lot} onChange={e => set('id_lot', e.target.value)} disabled={!form.id_intrant}>
                <option value="">— Sans lot spécifique —</option>
                {lots.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.num_lot} · Pér. {fmtDate(l.date_perexp)} · Dispo: {l.qte_dispo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className="field field-num">
              <label>Quantité *</label>
              <input type="number" min="1" value={form.quantite} onChange={e => set('quantite', e.target.value)} />
            </div>
            <div className="field">
              <label>Source</label>
              <select value={form.source} onChange={e => set('source', e.target.value)}>
                {SOURCES_ENTREE.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={form.date_mouvement} onChange={e => set('date_mouvement', e.target.value)} />
            </div>
          </div>

          {form.source === 'fournisseur' && (
            <div className="field">
              <label>Fournisseur</label>
              <select value={form.id_fournisseur} onChange={e => set('id_fournisseur', e.target.value)}>
                <option value="">— Choisir —</option>
                {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </div>
          )}

          {form.source === 'retour_cs' && (
            <div className="field">
              <label>Centre de santé</label>
              <select value={form.id_cs} onChange={e => set('id_cs', e.target.value)}>
                <option value="">— Choisir —</option>
                {centres.map(c => <option key={c.id} value={c.id}>{c.code_cs} — {c.nom}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label>Motif / Observation</label>
            <input value={form.motif} onChange={e => set('motif', e.target.value)} placeholder="Description de l'entrée" />
          </div>

          {error && (
            <p style={{ color: 'var(--red)', fontSize: 12, background: 'var(--red-l)', padding: '8px 10px', borderRadius: 'var(--r-sm)' }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer l\'entrée'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Entrees() {
  const [mvts, setMvts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('mouvements_stock')
      .select('*, intrants(sigle), lots(num_lot), centres_sante(nom,code_cs), fournisseurs(nom)')
      .eq('type_mvt', 'entree')
      .order('date_mouvement', { ascending: false })
      .limit(100);
    setMvts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmtSource = s => ({ fournisseur: 'Fournisseur', retour_cs: 'Retour CS', don: 'Don', autre: 'Autre' }[s] ?? s);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Entrées de stock</h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {mvts.length} mouvement{mvts.length !== 1 ? 's' : ''} (100 derniers)
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nouvelle entrée</button>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Chargement...</div>
        ) : mvts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            <p>Aucune entrée enregistrée.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Cliquez sur « + Nouvelle entrée » pour commencer.</p>
          </div>
        ) : (
          <div className="tbl-wrap" style={{ flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Intrant</th>
                  <th>Lot</th>
                  <th style={{ textAlign: 'right' }}>Quantité</th>
                  <th>Source</th>
                  <th>Fournisseur / CS</th>
                  <th>Motif</th>
                </tr>
              </thead>
              <tbody>
                {mvts.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(m.date_mouvement)}</td>
                    <td><strong style={{ fontSize: 13 }}>{m.intrants?.sigle || '—'}</strong></td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{m.lots?.num_lot || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--teal-700)', fontVariantNumeric: 'tabular-nums' }}>
                      +{m.quantite}
                    </td>
                    <td>
                      <span className="badge badge-teal">{fmtSource(m.source)}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {m.fournisseurs?.nom || m.centres_sante?.nom || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{m.motif || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <EntreeModal
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); load(); }}
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
  width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto',
};
