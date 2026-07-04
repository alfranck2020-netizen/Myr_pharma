import { useState } from 'react';
import { supabase } from '../../lib/supabase';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function LotModal({ lot, intrantId, onClose, onSaved }) {
  const [form, setForm] = useState(lot ? {
    num_lot:    lot.num_lot,
    date_fab:   lot.date_fab ?? '',
    date_perexp: lot.date_perexp,
    qte_lot:    lot.qte_lot,
    qte_dispo:  lot.qte_dispo,
    date_recep: lot.date_recep ?? todayStr(),
    observ_lot: lot.observ_lot ?? '',
  } : {
    num_lot: '', date_fab: '', date_perexp: '',
    qte_lot: 0, qte_dispo: 0,
    date_recep: todayStr(), observ_lot: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.num_lot.trim()) { setError('Le numéro de lot est obligatoire.'); return; }
    if (!form.date_perexp)    { setError('La date de péremption est obligatoire.'); return; }
    if (!lot && Number(form.qte_lot) <= 0) {
      setError('La quantité reçue doit être supérieure à 0.'); return;
    }
    setSaving(true);
    setError('');
    const qty = Number(form.qte_lot);
    const payload = {
      id_intrant:  intrantId,
      num_lot:     form.num_lot.trim().toUpperCase(),
      date_fab:    form.date_fab  || null,
      date_perexp: form.date_perexp,
      qte_lot:     qty,
      qte_dispo:   lot ? Number(form.qte_dispo) : qty,
      date_recep:  form.date_recep || null,
      observ_lot:  form.observ_lot.trim() || null,
      updated_at:  new Date().toISOString(),
    };
    let err;
    if (lot) {
      ({ error: err } = await supabase.from('lots').update(payload).eq('id', lot.id));
    } else {
      ({ error: err } = await supabase.from('lots').insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div style={sOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={sModal}>
        <div className="card-header">
          <span className="card-title">{lot ? 'Modifier le lot' : 'Nouveau lot'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>N° de lot *</label>
              <input value={form.num_lot} onChange={e => set('num_lot', e.target.value)}
                placeholder="Ex: LOT-2024-001" />
            </div>
            <div className="field">
              <label>Date de réception</label>
              <input type="date" value={form.date_recep} onChange={e => set('date_recep', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Date de fabrication</label>
              <input type="date" value={form.date_fab} onChange={e => set('date_fab', e.target.value)} />
            </div>
            <div className="field">
              <label>Date de péremption *</label>
              <input type="date" value={form.date_perexp} onChange={e => set('date_perexp', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: lot ? '1fr 1fr' : '1fr', gap: 10 }}>
            <div className="field field-num">
              <label>Quantité {lot ? 'totale du lot' : 'reçue'}</label>
              <input type="number" min="0" value={form.qte_lot}
                onChange={e => set('qte_lot', e.target.value)} />
            </div>
            {lot && (
              <div className="field field-num">
                <label>Quantité disponible</label>
                <input type="number" min="0" max={form.qte_lot} value={form.qte_dispo}
                  onChange={e => set('qte_dispo', e.target.value)} />
              </div>
            )}
          </div>

          <div className="field">
            <label>Observation</label>
            <textarea rows={2} value={form.observ_lot}
              onChange={e => set('observ_lot', e.target.value)}
              style={{ resize: 'vertical' }}
              placeholder="Notes optionnelles sur ce lot..." />
          </div>

          {error && (
            <p style={{ color: 'var(--red)', fontSize: 12, background: 'var(--red-l)', padding: '8px 10px', borderRadius: 'var(--r-sm)' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Enregistrement...' : lot ? 'Mettre à jour' : 'Ajouter le lot'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const sOverlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1100, padding: 16,
};
const sModal = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r)',
  boxShadow: 'var(--shadow-md)',
  width: '100%', maxWidth: 480,
  maxHeight: '90vh', overflowY: 'auto',
};
