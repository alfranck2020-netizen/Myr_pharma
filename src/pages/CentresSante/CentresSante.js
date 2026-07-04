import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const TYPE_LABELS = {
  dispensaire: { label: 'Dispensaire', badge: 'badge-teal' },
  ccs:         { label: 'CCS',         badge: 'badge-teal' },
  hopital:     { label: 'Hôpital',     badge: 'badge-green' },
};

const EMPTY = { code_cs: '', nom: '', contact: '', localisation: '', type_centre: 'dispensaire', actif: true };

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

export default function CentresSante() {
  const [centres, setCentres]  = useState([]);
  const [loading, setLoading]  = useState(true);
  const [search, setSearch]    = useState('');
  const [modal, setModal]      = useState(null);
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

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Centres de Santé</h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {actifs} centre{actifs !== 1 ? 's' : ''} actif{actifs !== 1 ? 's' : ''}
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
                  <th>Localisation</th>
                  <th>Contact</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const typeInfo = TYPE_LABELS[c.type_centre] ?? { label: c.type_centre, badge: 'badge-teal' };
                  return (
                    <tr key={c.id} style={{ opacity: c.actif ? 1 : 0.55 }} onClick={() => setModal(c)}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{c.code_cs}</span>
                      </td>
                      <td><strong style={{ fontSize: 13 }}>{c.nom}</strong></td>
                      <td>
                        <span className={`badge ${typeInfo.badge}`}>{typeInfo.label}</span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.localisation || '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.contact || '—'}</td>
                      <td>
                        {c.actif
                          ? <span className="badge badge-green">Actif</span>
                          : <span className="badge badge-red">Inactif</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setModal(c); }} title="Modifier">
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

      {modal && (
        <CSModal
          cs={modal === 'add' ? null : modal}
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
  width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
};
