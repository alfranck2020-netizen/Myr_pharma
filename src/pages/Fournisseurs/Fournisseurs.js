import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const EMPTY = { code_four: '', nom: '', nom_pf: '', contact_pf: '', actif: true };

function FournisseurModal({ fournisseur, onClose, onSaved }) {
  const [form, setForm] = useState(fournisseur ? {
    code_four:  fournisseur.code_four,
    nom:        fournisseur.nom,
    nom_pf:     fournisseur.nom_pf ?? '',
    contact_pf: fournisseur.contact_pf ?? '',
    actif:      fournisseur.actif !== false,
  } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.code_four.trim() || !form.nom.trim()) {
      setError('Code et nom du fournisseur sont obligatoires.'); return;
    }
    setSaving(true); setError('');
    const payload = {
      code_four:  form.code_four.trim().toUpperCase(),
      nom:        form.nom.trim(),
      nom_pf:     form.nom_pf.trim() || null,
      contact_pf: form.contact_pf.trim() || null,
      actif:      form.actif,
      updated_at: new Date().toISOString(),
    };
    let err;
    if (fournisseur) {
      ({ error: err } = await supabase.from('fournisseurs').update(payload).eq('id', fournisseur.id));
    } else {
      ({ error: err } = await supabase.from('fournisseurs').insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div style={sOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={sModal}>
        <div className="card-header">
          <span className="card-title">{fournisseur ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Code fournisseur *</label>
              <input value={form.code_four} onChange={e => set('code_four', e.target.value)} placeholder="Ex: MSP001" />
            </div>
            <div className="field">
              <label>Nom *</label>
              <input value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Ex: CENAME" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Nom du point focal</label>
              <input value={form.nom_pf} onChange={e => set('nom_pf', e.target.value)} placeholder="Nom complet" />
            </div>
            <div className="field">
              <label>Contact point focal</label>
              <input value={form.contact_pf} onChange={e => set('contact_pf', e.target.value)} placeholder="Téléphone / email" />
            </div>
          </div>
          {fournisseur && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.actif} onChange={e => set('actif', e.target.checked)} />
              Fournisseur actif
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
              {saving ? 'Enregistrement...' : fournisseur ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Fournisseurs() {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading]  = useState(true);
  const [search, setSearch]    = useState('');
  const [modal, setModal]      = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('fournisseurs').select('*').order('nom');
    setFournisseurs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = fournisseurs.filter(f => {
    if (!showInactive && !f.actif) return false;
    if (search) {
      const q = search.toLowerCase();
      return f.nom?.toLowerCase().includes(q) || f.code_four?.toLowerCase().includes(q) || f.nom_pf?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Fournisseurs</h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {fournisseurs.filter(f => f.actif).length} fournisseur{fournisseurs.filter(f => f.actif).length !== 1 ? 's' : ''} actif{fournisseurs.filter(f => f.actif).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Nouveau fournisseur</button>
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
          placeholder="🔍 Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Afficher inactifs
        </label>
      </div>

      {/* Table */}
      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Chargement...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            <p>Aucun fournisseur trouvé.</p>
            {!search && <p style={{ fontSize: 12, marginTop: 4 }}>Cliquez sur « + Nouveau fournisseur » pour commencer.</p>}
          </div>
        ) : (
          <div className="tbl-wrap" style={{ flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nom</th>
                  <th>Point focal</th>
                  <th>Contact</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => (
                  <tr key={f.id} style={{ opacity: f.actif ? 1 : 0.55 }} onClick={() => setModal(f)}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{f.code_four}</span>
                    </td>
                    <td><strong style={{ fontSize: 13 }}>{f.nom}</strong></td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{f.nom_pf || '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{f.contact_pf || '—'}</td>
                    <td>
                      {f.actif
                        ? <span className="badge badge-green">Actif</span>
                        : <span className="badge badge-red">Inactif</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setModal(f); }} title="Modifier">
                        ✎
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <FournisseurModal
          fournisseur={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
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
  width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto',
};
