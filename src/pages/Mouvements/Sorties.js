import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const SOURCES_SORTIE = [
  { val: 'livraison_cs', label: 'Livraison CS' },
  { val: 'peremption',   label: 'Péremption' },
  { val: 'perte',        label: 'Perte' },
  { val: 'autre',        label: 'Autre' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—';

function SortieModal({ onClose, onSaved }) {
  const [intrants, setIntrants] = useState([]);
  const [lots, setLots]         = useState([]);
  const [centres, setCentres]   = useState([]);
  const [form, setForm] = useState({
    id_intrant: '', id_lot: '', quantite: 1,
    source: 'livraison_cs', motif: '',
    date_mouvement: todayStr(),
    id_cs: '', observation: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('intrants').select('id,sigle,nom_dci').eq('actif', true).order('sigle'),
      supabase.from('centres_sante').select('id,nom,code_cs').eq('actif', true).order('nom'),
    ]).then(([{ data: i }, { data: c }]) => {
      setIntrants(i || []);
      setCentres(c || []);
    });
  }, []);

  useEffect(() => {
    if (!form.id_intrant) { setLots([]); return; }
    supabase.from('lots').select('id,num_lot,date_perexp,qte_dispo')
      .eq('id_intrant', form.id_intrant)
      .eq('etat_lot', 'en_cours')
      .order('date_perexp') // FEFO
      .then(({ data }) => {
        setLots(data || []);
        setForm(f => ({ ...f, id_lot: '' }));
      });
  }, [form.id_intrant]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedLot = lots.find(l => l.id === form.id_lot);
  const maxQty = selectedLot ? selectedLot.qte_dispo : undefined;

  async function save() {
    const qty = Number(form.quantite);
    if (!form.id_intrant || qty <= 0) {
      setError('Intrant et quantité (> 0) sont obligatoires.'); return;
    }
    if (selectedLot && qty > selectedLot.qte_dispo) {
      setError(`Quantité insuffisante dans ce lot (dispo : ${selectedLot.qte_dispo}).`); return;
    }
    setSaving(true); setError('');
    try {
      const { error: e1 } = await supabase.from('mouvements_stock').insert({
        type_mvt:       'sortie',
        motif:          form.motif || form.source,
        id_intrant:     form.id_intrant,
        id_lot:         form.id_lot || null,
        quantite:       qty,
        date_mouvement: form.date_mouvement,
        source:         form.source,
        id_cs:          form.id_cs || null,
        observation:    form.observation || null,
      });
      if (e1) throw e1;

      // Decrement lot stock (triggers recalc on intrant)
      if (form.id_lot && selectedLot) {
        await supabase.from('lots').update({
          qte_dispo: Math.max(0, selectedLot.qte_dispo - qty),
          updated_at: new Date().toISOString(),
        }).eq('id', selectedLot.id);
      }
      onSaved();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  return (
    <div style={sOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={sModal}>
        <div className="card-header">
          <span className="card-title">Nouvelle sortie de stock</span>
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
              <label>Lot (FEFO recommandé)</label>
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

          {selectedLot && (
            <div style={{
              padding: '8px 12px', background: 'var(--teal-50)',
              borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--teal-700)',
            }}>
              Stock disponible dans ce lot : <strong>{selectedLot.qte_dispo}</strong> unités
              · Péremption : <strong>{fmtDate(selectedLot.date_perexp)}</strong>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className="field field-num">
              <label>Quantité *</label>
              <input type="number" min="1" max={maxQty} value={form.quantite}
                onChange={e => set('quantite', e.target.value)} />
            </div>
            <div className="field">
              <label>Source</label>
              <select value={form.source} onChange={e => set('source', e.target.value)}>
                {SOURCES_SORTIE.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={form.date_mouvement} onChange={e => set('date_mouvement', e.target.value)} />
            </div>
          </div>

          {form.source === 'livraison_cs' && (
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
            <input value={form.motif} onChange={e => set('motif', e.target.value)}
              placeholder="Description de la sortie" />
          </div>

          {error && (
            <p style={{ color: 'var(--red)', fontSize: 12, background: 'var(--red-l)', padding: '8px 10px', borderRadius: 'var(--r-sm)' }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn btn-amber" onClick={save} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer la sortie'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sorties() {
  const [mvts, setMvts]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('mouvements_stock')
      .select('*, intrants(sigle), lots(num_lot), centres_sante(nom,code_cs)')
      .eq('type_mvt', 'sortie')
      .order('date_mouvement', { ascending: false })
      .limit(100);
    setMvts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmtSource = s => ({
    livraison_cs: 'Livraison CS', peremption: 'Péremption',
    perte: 'Perte', autre: 'Autre',
  }[s] ?? s);

  const srcBadge = s => s === 'peremption' || s === 'perte' ? 'badge-red' : 'badge-orange';

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Sorties de stock</h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {mvts.length} mouvement{mvts.length !== 1 ? 's' : ''} (100 derniers)
          </p>
        </div>
        <button className="btn btn-amber" onClick={() => setModal(true)}>+ Nouvelle sortie</button>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Chargement...</div>
        ) : mvts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            <p>Aucune sortie enregistrée.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Cliquez sur « + Nouvelle sortie » pour commencer.</p>
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
                  <th>Centre de santé</th>
                  <th>Motif</th>
                </tr>
              </thead>
              <tbody>
                {mvts.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(m.date_mouvement)}</td>
                    <td><strong style={{ fontSize: 13 }}>{m.intrants?.sigle || '—'}</strong></td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{m.lots?.num_lot || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
                      -{m.quantite}
                    </td>
                    <td>
                      <span className={`badge ${srcBadge(m.source)}`}>{fmtSource(m.source)}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {m.centres_sante ? `${m.centres_sante.code_cs} — ${m.centres_sante.nom}` : '—'}
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
        <SortieModal
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
