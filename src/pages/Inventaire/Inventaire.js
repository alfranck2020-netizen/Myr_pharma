import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// ── Helpers ────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—';

function genNumero() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const n = String(Math.floor(Math.random() * 900) + 100);
  return `INV-${y}${m}-${n}`;
}

const sInline = {
  padding: '4px 7px', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
  outline: 'none', width: '100%', minWidth: 0,
};

// ── LIST VIEW ──────────────────────────────────────────────────────────────
function ListView({ onNew, onOpen }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('inventaires')
      .select('*, sessions(nom)')
      .order('date_inventaire', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false); });
  }, []);

  async function del(inv, e) {
    e.stopPropagation();
    if (inv.statut === 'valide') return;
    if (!window.confirm(`Supprimer l'inventaire ${inv.numero} ?`)) return;
    await supabase.from('inventaires').delete().eq('id', inv.id);
    setItems(p => p.filter(i => i.id !== inv.id));
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Inventaires</h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {items.length} inventaire{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={onNew}>+ Nouvel inventaire</button>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Chargement...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            <p>Aucun inventaire enregistré.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Cliquez sur « + Nouvel inventaire » pour commencer.</p>
          </div>
        ) : (
          <div className="tbl-wrap" style={{ flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Date</th>
                  <th>Session</th>
                  <th>Statut</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(inv => (
                  <tr key={inv.id} onClick={() => onOpen(inv)}>
                    <td><strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.numero}</strong></td>
                    <td style={{ fontSize: 13 }}>{fmtDate(inv.date_inventaire)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{inv.sessions?.nom || '—'}</td>
                    <td>
                      {inv.statut === 'valide'
                        ? <span className="badge badge-green">Validé</span>
                        : <span className="badge badge-orange">Brouillon</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 200 }}>{inv.notes || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {inv.statut !== 'valide' && (
                        <button className="btn btn-danger btn-sm" onClick={e => del(inv, e)} title="Supprimer">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FORM VIEW (create / edit brouillon / view validé) ─────────────────────
function FormView({ inventaire, onBack }) {
  const isReadOnly  = inventaire?.statut === 'valide';
  const isNew       = !inventaire;

  const [header, setHeader] = useState({
    numero:          inventaire?.numero         ?? genNumero(),
    date_inventaire: inventaire?.date_inventaire ?? todayStr(),
    notes:           inventaire?.notes           ?? '',
  });
  const [lines, setLines]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError]       = useState('');

  // Build lines: for new inventory pre-fill from lots (FEFO); for existing load from DB
  useEffect(() => {
    async function init() {
      if (!isNew) {
        const { data: lignes } = await supabase
          .from('inventaire_lignes')
          .select('*, intrants(sigle, nom_dci)')
          .eq('id_inventaire', inventaire.id);
        if (lignes) {
          setLines(lignes.map(l => ({
            id: l.id,
            id_intrant:    l.id_intrant,
            sigle:         l.intrants?.sigle   ?? '',
            nom_dci:       l.intrants?.nom_dci ?? '',
            id_lot:        l.id_lot,
            num_lot:       l.num_lot       ?? '',
            date_perexp:   l.date_perexp   ?? '',
            qs:            l.qs,
            sdu:           l.sdu,
            observation:   l.observation  ?? '',
          })));
        }
      } else {
        // Fetch intrants + their active lots (FEFO)
        const [{ data: intrants }, { data: lots }] = await Promise.all([
          supabase.from('intrants').select('id, sigle, nom_dci').eq('actif', true).order('sigle'),
          supabase.from('lots').select('*').eq('etat_lot', 'en_cours')
            .gte('date_perexp', todayStr()).order('date_perexp'),
        ]);

        if (intrants) {
          const lotMap = {};
          (lots || []).forEach(l => {
            if (!lotMap[l.id_intrant]) lotMap[l.id_intrant] = [];
            lotMap[l.id_intrant].push(l);
          });

          const newLines = [];
          intrants.forEach(int => {
            const intLots = lotMap[int.id] || [];
            if (intLots.length === 0) {
              newLines.push({
                id_intrant: int.id, sigle: int.sigle, nom_dci: int.nom_dci,
                id_lot: null, num_lot: '', date_perexp: '',
                qs: 0, sdu: 0, observation: '',
              });
            } else {
              intLots.forEach(lot => {
                newLines.push({
                  id_intrant:  int.id,
                  sigle:       int.sigle,
                  nom_dci:     int.nom_dci,
                  id_lot:      lot.id,
                  num_lot:     lot.num_lot,
                  date_perexp: lot.date_perexp,
                  qs:          lot.qte_dispo,
                  sdu:         lot.qte_dispo,
                  observation: '',
                });
              });
            }
          });
          setLines(newLines);
        }
      }
      setLoading(false);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setLine(idx, field, value) {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function buildPayload(statut) {
    return {
      numero:          header.numero.trim(),
      date_inventaire: header.date_inventaire,
      notes:           header.notes.trim() || null,
      statut,
    };
  }

  function buildLignes(invId) {
    return lines.map(l => ({
      id_inventaire: invId,
      id_intrant:    l.id_intrant,
      id_lot:        l.id_lot   || null,
      num_lot:       l.num_lot  || null,
      date_perexp:   l.date_perexp || null,
      qs:            Number(l.qs)  || 0,
      sdu:           Number(l.sdu) || 0,
      observation:   l.observation || null,
    }));
  }

  async function upsertInventaire(statut, extra = {}) {
    const payload = { ...buildPayload(statut), ...extra };
    if (!inventaire) {
      const { data, error: e } = await supabase.from('inventaires').insert(payload).select().single();
      if (e) throw e;
      return data.id;
    } else {
      const { error: e } = await supabase.from('inventaires').update(payload).eq('id', inventaire.id);
      if (e) throw e;
      return inventaire.id;
    }
  }

  async function saveDraft() {
    setSaving(true); setError('');
    try {
      const invId = await upsertInventaire('brouillon');
      if (!inventaire) {
        const { error: e } = await supabase.from('inventaire_lignes').insert(buildLignes(invId));
        if (e) throw e;
      } else {
        await supabase.from('inventaire_lignes').delete().eq('id_inventaire', invId);
        const { error: e } = await supabase.from('inventaire_lignes').insert(buildLignes(invId));
        if (e) throw e;
      }
      onBack();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  async function validate() {
    if (!window.confirm('Valider cet inventaire ? Le stock sera mis à jour et l\'inventaire ne pourra plus être modifié.')) return;
    setValidating(true); setError('');
    try {
      const invId = await upsertInventaire('valide', { validated_at: new Date().toISOString() });
      if (inventaire) await supabase.from('inventaire_lignes').delete().eq('id_inventaire', invId);
      const { error: e } = await supabase.from('inventaire_lignes').insert(buildLignes(invId));
      if (e) throw e;

      // Update lots qte_dispo → triggers recalc stock on intrants
      for (const line of lines) {
        if (line.id_lot) {
          await supabase.from('lots')
            .update({ qte_dispo: Number(line.sdu) || 0, updated_at: new Date().toISOString() })
            .eq('id', line.id_lot);
        }
      }
      onBack();
    } catch (e) { setError(e.message); }
    setValidating(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>
        {isNew ? 'Préparation de l\'inventaire…' : 'Chargement…'}
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Retour</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>
          {isReadOnly ? `Inventaire ${header.numero}` : isNew ? 'Nouvel inventaire' : `Modifier ${header.numero}`}
        </h1>
        {isReadOnly && <span className="badge badge-green">Validé</span>}
      </div>

      {/* Header card */}
      <div className="card">
        <div className="card-body" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Numéro</label>
            <input value={header.numero} disabled={isReadOnly}
              onChange={e => setHeader(h => ({ ...h, numero: e.target.value }))} />
          </div>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Date de l'inventaire</label>
            <input type="date" value={header.date_inventaire} disabled={isReadOnly}
              onChange={e => setHeader(h => ({ ...h, date_inventaire: e.target.value }))} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>Notes</label>
            <input value={header.notes} disabled={isReadOnly}
              onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))}
              placeholder="Observations générales…" />
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header">
          <span className="card-title">Lignes d'inventaire ({lines.length} intrant{lines.length !== 1 ? 's' : ''})</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            QS = quantité physique · SDU = stock dispo utilisable · Écart = QS − SDU
          </span>
        </div>
        <div className="tbl-wrap" style={{ flex: 1 }}>
          <table>
            <thead>
              <tr>
                <th>Intrant</th>
                <th>N° Lot</th>
                <th>Date pér.</th>
                <th style={{ textAlign: 'center', width: 80 }}>QS</th>
                <th style={{ textAlign: 'center', width: 80 }}>SDU</th>
                <th style={{ textAlign: 'center', width: 70 }}>Écart</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const ecart = (Number(line.qs) || 0) - (Number(line.sdu) || 0);
                const ecartColor = ecart === 0 ? 'var(--text-3)' : ecart > 0 ? 'var(--orange)' : 'var(--red)';
                return (
                  <tr key={idx}>
                    <td>
                      <strong style={{ fontSize: 13 }}>{line.sigle}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{line.nom_dci}</div>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      {isReadOnly
                        ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{line.num_lot || '—'}</span>
                        : <input style={sInline} value={line.num_lot}
                            onChange={e => setLine(idx, 'num_lot', e.target.value)} placeholder="N° lot" />}
                    </td>
                    <td style={{ minWidth: 130 }}>
                      {isReadOnly
                        ? <span style={{ fontSize: 12 }}>{fmtDate(line.date_perexp)}</span>
                        : <input type="date" style={sInline} value={line.date_perexp}
                            onChange={e => setLine(idx, 'date_perexp', e.target.value)} />}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isReadOnly
                        ? <strong>{line.qs}</strong>
                        : <input type="number" min="0" style={{ ...sInline, textAlign: 'center', fontWeight: 700, width: 70 }}
                            value={line.qs} onChange={e => setLine(idx, 'qs', e.target.value)} />}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isReadOnly
                        ? <strong>{line.sdu}</strong>
                        : <input type="number" min="0" style={{ ...sInline, textAlign: 'center', fontWeight: 700, width: 70 }}
                            value={line.sdu} onChange={e => setLine(idx, 'sdu', e.target.value)} />}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
                      <span style={{ color: ecartColor }}>
                        {ecart > 0 ? `+${ecart}` : ecart}
                      </span>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      {isReadOnly
                        ? <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{line.observation || '—'}</span>
                        : <input style={sInline} value={line.observation}
                            onChange={e => setLine(idx, 'observation', e.target.value)} placeholder="—" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <p style={{ color: 'var(--red)', fontSize: 12, background: 'var(--red-l)', padding: '8px 12px', borderRadius: 'var(--r-sm)' }}>
          {error}
        </p>
      )}

      {/* Actions */}
      {!isReadOnly && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onBack}>Annuler</button>
          <button className="btn btn-amber" onClick={saveDraft} disabled={saving || validating}>
            {saving ? 'Enregistrement…' : 'Enregistrer brouillon'}
          </button>
          <button className="btn btn-primary" onClick={validate} disabled={saving || validating}>
            {validating ? 'Validation…' : '✓ Valider & mettre à jour le stock'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function Inventaire() {
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [selected, setSelected] = useState(null); // inventory for form

  if (view === 'form') {
    return (
      <FormView
        inventaire={selected}
        onBack={() => { setSelected(null); setView('list'); }}
      />
    );
  }

  return (
    <ListView
      onNew={() => { setSelected(null); setView('form'); }}
      onOpen={inv => { setSelected(inv); setView('form'); }}
    />
  );
}
