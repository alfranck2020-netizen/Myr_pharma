import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import LotModal from './LotModal';

const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

function daysLeft(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr) - today) / 86400000);
}

function LotStatusBadge({ lot }) {
  const days = daysLeft(lot.date_perexp);
  if (days < 0) return <span className="badge badge-red">Périmé</span>;
  if (lot.qte_dispo === 0) return <span className="badge badge-orange">Épuisé</span>;
  if (days <= 90) return <span className="badge badge-orange">Bientôt périmé</span>;
  return <span className="badge badge-green">OK</span>;
}

function LotCard({ lot, onEdit, onDelete }) {
  const days = daysLeft(lot.date_perexp);
  const isExpired = days < 0;
  const isWarn    = !isExpired && days <= 90;

  return (
    <div className={`lot-card ${isExpired ? 'lot-card-expired' : isWarn ? 'lot-card-warn' : ''}`}>
      <div className="lot-card-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 13, fontFamily: 'monospace' }}>{lot.num_lot}</strong>
          <LotStatusBadge lot={lot} />
        </div>
        <div className="lot-card-actions">
          <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onEdit(lot); }} title="Modifier">
            ✎
          </button>
          <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); onDelete(lot); }} title="Supprimer">
            ✕
          </button>
        </div>
      </div>

      <div className="lot-card-meta">
        <div>
          <span style={{ color: 'var(--text-3)' }}>Péremption : </span>
          <span style={{
            fontWeight: 600,
            color: isExpired ? 'var(--red)' : isWarn ? 'var(--orange)' : 'var(--text)',
          }}>
            {fmtDate(lot.date_perexp)}
            {' '}
            <span style={{ fontWeight: 400, fontSize: 11 }}>
              {isExpired ? `(${-days} j dépassé)` : `(J-${days})`}
            </span>
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-3)' }}>Réception : </span>
          <span>{fmtDate(lot.date_recep)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
        <div>
          <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Qté lot </span>
          <strong>{lot.qte_lot}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Disponible </span>
          <strong style={{ color: lot.qte_dispo === 0 ? 'var(--red)' : 'var(--teal-700)' }}>
            {lot.qte_dispo}
          </strong>
        </div>
        {lot.date_fab && (
          <div>
            <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Fab. </span>
            <span>{fmtDate(lot.date_fab)}</span>
          </div>
        )}
      </div>

      {lot.observ_lot && (
        <p style={{ fontSize: 11, color: 'var(--text-2)', fontStyle: 'italic', margin: 0 }}>
          {lot.observ_lot}
        </p>
      )}
    </div>
  );
}

export default function LotsPanel({ intrant, onClose, onReload }) {
  const [lots, setLots]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | 'add' | lot object (edit)

  const loadLots = useCallback(async () => {
    const { data } = await supabase
      .from('lots')
      .select('*')
      .eq('id_intrant', intrant.id)
      .order('date_perexp'); // FEFO order
    setLots(data || []);
    setLoading(false);
  }, [intrant.id]);

  useEffect(() => { setLoading(true); loadLots(); }, [loadLots]);

  async function handleDelete(lot) {
    if (!window.confirm(`Supprimer le lot "${lot.num_lot}" ?`)) return;
    await supabase.from('lots').delete().eq('id', lot.id);
    loadLots();
    onReload();
  }

  function afterSave() {
    setModal(null);
    loadLots();
    onReload();
  }

  const stockColor = intrant.stock_dispo === 0 ? 'var(--red)'
    : intrant.stock_dispo < intrant.seuil_reappro ? 'var(--orange)'
    : 'var(--teal-700)';

  return (
    <>
      <div className="lots-panel">
        {/* Header */}
        <div className="lots-panel-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{intrant.sigle}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{intrant.nom_dci}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} title="Fermer">✕</button>
        </div>

        {/* Stock summary */}
        <div className="lots-panel-summary">
          <div className="lots-panel-stat">
            <span className="lots-panel-stat-label">Stock dispo</span>
            <span className="lots-panel-stat-val" style={{ color: stockColor }}>
              {intrant.stock_dispo}
            </span>
          </div>
          <div className="lots-panel-stat">
            <span className="lots-panel-stat-label">Seuil réappro</span>
            <span className="lots-panel-stat-val">{intrant.seuil_reappro}</span>
          </div>
          <div className="lots-panel-stat">
            <span className="lots-panel-stat-label">CMM</span>
            <span className="lots-panel-stat-val">
              {intrant.cmm > 0 ? Number(intrant.cmm).toFixed(1) : '—'}
            </span>
          </div>
          <div className="lots-panel-stat">
            <span className="lots-panel-stat-label">File active</span>
            <span className="lots-panel-stat-val">{intrant.file_active || '—'}</span>
          </div>
        </div>

        {/* Lots list */}
        <div className="lots-panel-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Lots — ordre FEFO ({lots.length})
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('add')}>
              + Lot
            </button>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 13, padding: '20px 0' }}>
              Chargement...
            </p>
          ) : lots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)' }}>
              <p style={{ fontSize: 13 }}>Aucun lot enregistré.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Cliquez sur «&nbsp;+ Lot&nbsp;» pour en ajouter un.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lots.map(lot => (
                <LotCard
                  key={lot.id}
                  lot={lot}
                  onEdit={l => setModal(l)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <LotModal
          lot={modal === 'add' ? null : modal}
          intrantId={intrant.id}
          onClose={() => setModal(null)}
          onSaved={afterSave}
        />
      )}
    </>
  );
}
