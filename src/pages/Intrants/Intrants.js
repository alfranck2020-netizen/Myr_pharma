import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import IntrantModal from './IntrantModal';
import LotsPanel from './LotsPanel';
import './Intrants.css';

const CATS = [
  { code: null,    label: 'Tous' },
  { code: 'ARV_A', label: 'ARV Adultes' },
  { code: 'ARV_P', label: 'ARV Pédiatriques' },
  { code: 'TEST',  label: 'Tests & Réactifs' },
  { code: 'MIO',   label: 'M. Infect. Opp.' },
];

const CAT_CHIP = {
  ARV_A: 'chip-arv-a',
  ARV_P: 'chip-arv-p',
  TEST:  'chip-test',
  MIO:   'chip-mio',
};

function StockBadge({ stock, seuil }) {
  if (stock === 0)       return <span className="badge badge-red">Rupture</span>;
  if (stock < seuil)     return <span className="badge badge-orange">Faible</span>;
  return <span className="badge badge-green">OK</span>;
}

function StockBar({ stock, seuil }) {
  if (!seuil) return <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>;
  const pct = Math.min((stock / seuil) * 100, 100);
  const cls = stock === 0 ? 'prog-danger' : stock < seuil ? 'prog-warn' : 'prog-ok';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div className="prog-wrap" style={{ width: 52, height: 5 }}>
        <div className={`prog-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
        {stock} / {seuil}
      </span>
    </div>
  );
}

export default function Intrants() {
  const [intrants, setIntrants] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState(null);
  const [modal, setModal]       = useState(null); // null | 'add' | intrant (edit)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('intrants')
      .select('*, categories_intrants(code, nom)')
      .order('sigle');
    setIntrants(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh selected intrant data after lot changes
  async function refreshSelected(intrantId) {
    const { data } = await supabase
      .from('intrants')
      .select('*, categories_intrants(code, nom)')
      .eq('id', intrantId)
      .single();
    if (data) setSelected(data);
    load();
  }

  const filtered = intrants.filter(i => {
    if (!showInactive && !i.actif) return false;
    if (catFilter && i.categories_intrants?.code !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        i.sigle?.toLowerCase().includes(q) ||
        i.nom_dci?.toLowerCase().includes(q) ||
        i.code_intrant?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    total: intrants.filter(i => i.actif).length,
    rupture: intrants.filter(i => i.actif && i.stock_dispo === 0).length,
    faible: intrants.filter(i => i.actif && i.stock_dispo > 0 && i.stock_dispo < i.seuil_reappro).length,
  };

  function handleRowClick(intrant) {
    setSelected(s => s?.id === intrant.id ? null : intrant);
  }

  function afterSave() {
    setModal(null);
    load();
  }

  return (
    <div className="int-page">
      {/* Header */}
      <div className="int-header">
        <div>
          <h1 className="page-title">Intrants</h1>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
              {counts.total} produit{counts.total !== 1 ? 's' : ''}
            </span>
            {counts.rupture > 0 && (
              <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>
                ● {counts.rupture} en rupture
              </span>
            )}
            {counts.faible > 0 && (
              <span style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600 }}>
                ● {counts.faible} en stock faible
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>
          + Nouvel intrant
        </button>
      </div>

      {/* Filter bar */}
      <div className="int-filters">
        <div className="int-tabs">
          {CATS.map(c => (
            <button
              key={c.code ?? 'all'}
              className={`int-tab ${catFilter === c.code ? 'int-tab-active' : ''}`}
              onClick={() => setCatFilter(c.code)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          className="int-search"
          placeholder="🔍 Rechercher sigle, DCI, code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Afficher inactifs
        </label>
      </div>

      {/* Body */}
      <div className={`int-body ${selected ? 'int-body-split' : ''}`}>
        {/* Intrants table */}
        <div className="card int-list-card">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>
              Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
              <p style={{ fontSize: 15 }}>Aucun intrant trouvé.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>
                {search ? 'Modifiez votre recherche.' : 'Cliquez sur « + Nouvel intrant » pour commencer.'}
              </p>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sigle / Code</th>
                    <th>DCI / Forme</th>
                    <th>Catégorie</th>
                    <th>Cond.</th>
                    <th>Stock / Seuil</th>
                    <th style={{ textAlign: 'right' }}>CMM</th>
                    <th>Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(i => {
                    const catCode = i.categories_intrants?.code;
                    const isSelected = selected?.id === i.id;
                    return (
                      <tr
                        key={i.id}
                        onClick={() => handleRowClick(i)}
                        className={isSelected ? 'selected' : ''}
                        style={{ opacity: i.actif ? 1 : 0.5 }}
                      >
                        <td>
                          <strong style={{ fontSize: 13 }}>{i.sigle}</strong>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                            {i.code_intrant}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13 }}>{i.nom_dci}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{i.forme_galenique}</div>
                        </td>
                        <td>
                          {catCode
                            ? <span className={`chip ${CAT_CHIP[catCode] ?? ''}`}>{catCode}</span>
                            : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
                          }
                        </td>
                        <td style={{ color: 'var(--text-2)', fontSize: 12 }}>
                          {i.conditionnement || '—'}
                        </td>
                        <td>
                          <StockBar stock={i.stock_dispo} seuil={i.seuil_reappro} />
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                          {i.cmm > 0 ? Number(i.cmm).toFixed(1) : '—'}
                        </td>
                        <td>
                          <StockBadge stock={i.stock_dispo} seuil={i.seuil_reappro} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={e => { e.stopPropagation(); setModal(i); }}
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

        {/* Lots panel (slide-in on selection) */}
        {selected && (
          <LotsPanel
            intrant={selected}
            onClose={() => setSelected(null)}
            onReload={() => refreshSelected(selected.id)}
          />
        )}
      </div>

      {/* Add / Edit intrant modal */}
      {modal && (
        <IntrantModal
          intrant={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  );
}
