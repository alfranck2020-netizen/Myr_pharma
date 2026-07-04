import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Configuration() {
  const [form, setForm] = useState({ region: '', aire_sante: '', district: '', nom_structure: '' });
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    supabase.from('configuration').select('*').limit(1).single()
      .then(({ data }) => {
        if (data) {
          setRecordId(data.id);
          setForm({
            region:        data.region ?? '',
            aire_sante:    data.aire_sante ?? '',
            district:      data.district ?? '',
            nom_structure: data.nom_structure ?? '',
          });
        }
        setLoading(false);
      });
  }, []);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  async function save(e) {
    e.preventDefault();
    setSaving(true); setError(''); setSaved(false);
    const payload = { ...form, updated_at: new Date().toISOString() };
    let err;
    if (recordId) {
      ({ error: err } = await supabase.from('configuration').update(payload).eq('id', recordId));
    } else {
      const { data, error: e2 } = await supabase.from('configuration').insert(payload).select().single();
      err = e2;
      if (data) setRecordId(data.id);
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-2)' }}>Chargement...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Configuration</h1>
      <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>
        Informations du district de santé
      </p>

      <form className="card" onSubmit={save}>
        <div className="card-header">
          <span className="card-title">Identification du district</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Région</label>
              <input value={form.region} onChange={e => set('region', e.target.value)}
                placeholder="Ex: Région du Centre" />
            </div>
            <div className="field">
              <label>Aire de santé</label>
              <input value={form.aire_sante} onChange={e => set('aire_sante', e.target.value)}
                placeholder="Ex: Aire de Santé Nord" />
            </div>
          </div>

          <div className="field">
            <label>District de santé</label>
            <input value={form.district} onChange={e => set('district', e.target.value)}
              placeholder="Ex: District de Santé de Bafoussam" />
          </div>

          <div className="field">
            <label>Nom de la structure (pharmacie du district)</label>
            <input value={form.nom_structure} onChange={e => set('nom_structure', e.target.value)}
              placeholder="Ex: Pharmacie du District de Santé de Bafoussam" />
          </div>

          {error && (
            <p style={{ color: 'var(--red)', fontSize: 12, background: 'var(--red-l)', padding: '8px 10px', borderRadius: 'var(--r-sm)' }}>
              {error}
            </p>
          )}
          {saved && (
            <p style={{ color: 'var(--green)', fontSize: 12, background: 'var(--green-l)', padding: '8px 10px', borderRadius: 'var(--r-sm)' }}>
              Configuration enregistrée avec succès.
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
