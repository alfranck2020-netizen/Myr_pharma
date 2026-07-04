import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const EMPTY = {
  code_intrant: '', sigle: '', nom_dci: '',
  id_categorie: '', conditionnement: '', forme_galenique: '',
  seuil_reappro: 0, file_active: 0, actif: true,
};

export default function IntrantModal({ intrant, onClose, onSaved }) {
  const [form, setForm] = useState(intrant ? {
    code_intrant:   intrant.code_intrant,
    sigle:          intrant.sigle,
    nom_dci:        intrant.nom_dci,
    id_categorie:   intrant.id_categorie ?? '',
    conditionnement: intrant.conditionnement ?? '',
    forme_galenique: intrant.forme_galenique ?? '',
    seuil_reappro:  intrant.seuil_reappro ?? 0,
    file_active:    intrant.file_active ?? 0,
    actif:          intrant.actif !== false,
  } : EMPTY);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('categories_intrants').select('*').order('id')
      .then(({ data }) => setCategories(data || []));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.code_intrant.trim() || !form.sigle.trim() || !form.nom_dci.trim()) {
      setError('Code intrant, sigle et DCI sont obligatoires.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      code_intrant:    form.code_intrant.trim().toUpperCase(),
      sigle:           form.sigle.trim(),
      nom_dci:         form.nom_dci.trim(),
      id_categorie:    form.id_categorie ? Number(form.id_categorie) : null,
      conditionnement: form.conditionnement.trim() || null,
      forme_galenique: form.forme_galenique.trim() || null,
      seuil_reappro:   Number(form.seuil_reappro) || 0,
      file_active:     Number(form.file_active) || 0,
      actif:           form.actif,
      updated_at:      new Date().toISOString(),
    };
    let err;
    if (intrant) {
      ({ error: err } = await supabase.from('intrants').update(payload).eq('id', intrant.id));
    } else {
      ({ error: err } = await supabase.from('intrants').insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div style={sOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={sModal}>
        <div className="card-header">
          <span className="card-title">
            {intrant ? 'Modifier l\'intrant' : 'Nouvel intrant'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Code intrant *</label>
              <input value={form.code_intrant} onChange={e => set('code_intrant', e.target.value)}
                placeholder="Ex: ARV001" />
            </div>
            <div className="field">
              <label>Sigle *</label>
              <input value={form.sigle} onChange={e => set('sigle', e.target.value)}
                placeholder="Ex: TDF/3TC/DTG" />
            </div>
          </div>

          <div className="field">
            <label>DCI — Dénomination Commune Internationale *</label>
            <input value={form.nom_dci} onChange={e => set('nom_dci', e.target.value)}
              placeholder="Nom générique complet" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Catégorie</label>
              <select value={form.id_categorie} onChange={e => set('id_categorie', e.target.value)}>
                <option value="">— Choisir —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Forme galénique</label>
              <input value={form.forme_galenique} onChange={e => set('forme_galenique', e.target.value)}
                placeholder="Ex: Comprimé" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Conditionnement</label>
              <input value={form.conditionnement} onChange={e => set('conditionnement', e.target.value)}
                placeholder="Ex: 30 Cp" />
            </div>
            <div className="field field-num">
              <label>Seuil réappro</label>
              <input type="number" min="0" value={form.seuil_reappro}
                onChange={e => set('seuil_reappro', e.target.value)} />
            </div>
            <div className="field field-num">
              <label>File active</label>
              <input type="number" min="0" value={form.file_active}
                onChange={e => set('file_active', e.target.value)} />
            </div>
          </div>

          {intrant && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.actif} onChange={e => set('actif', e.target.checked)} />
              Intrant actif
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
              {saving ? 'Enregistrement...' : intrant ? 'Mettre à jour' : 'Créer l\'intrant'}
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
  zIndex: 1000, padding: 16,
};
const sModal = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r)',
  boxShadow: 'var(--shadow-md)',
  width: '100%', maxWidth: 560,
  maxHeight: '90vh', overflowY: 'auto',
};
