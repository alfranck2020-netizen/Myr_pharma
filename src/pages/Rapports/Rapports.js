import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—';

async function loadConfig() {
  const { data } = await supabase.from('configuration').select('*').limit(1).single();
  return data;
}

// ── EXPORT: Excel (CSV via xlsx) ──────────────────────────────────────────
async function exportExcel(type) {
  const XLSX = await import('xlsx');
  let rows = [], filename = '';

  if (type === 'stock') {
    const { data } = await supabase
      .from('intrants')
      .select('*, categories_intrants(nom)')
      .eq('actif', true).order('sigle');
    rows = (data || []).map(i => ({
      'Code':           i.code_intrant,
      'Sigle':          i.sigle,
      'DCI':            i.nom_dci,
      'Catégorie':      i.categories_intrants?.nom ?? '',
      'Forme':          i.forme_galenique ?? '',
      'Conditionnement': i.conditionnement ?? '',
      'Stock dispo':    i.stock_dispo,
      'Seuil réappro':  i.seuil_reappro,
      'CMM':            Number(i.cmm).toFixed(2),
      'File active':    i.file_active,
      'Statut':         i.stock_dispo === 0 ? 'RUPTURE' : i.stock_dispo < i.seuil_reappro ? 'FAIBLE' : 'OK',
    }));
    filename = `stock_intrants_${new Date().toISOString().slice(0,10)}.xlsx`;
  } else if (type === 'lots') {
    const { data } = await supabase
      .from('lots')
      .select('*, intrants(sigle,nom_dci)')
      .order('date_perexp');
    rows = (data || []).map(l => ({
      'Intrant':      l.intrants?.sigle ?? '',
      'DCI':          l.intrants?.nom_dci ?? '',
      'N° Lot':       l.num_lot,
      'Date fab.':    fmtDate(l.date_fab),
      'Date pér.':    fmtDate(l.date_perexp),
      'Réception':    fmtDate(l.date_recep),
      'Qté lot':      l.qte_lot,
      'Qté dispo':    l.qte_dispo,
      'État':         l.etat_lot,
    }));
    filename = `lots_${new Date().toISOString().slice(0,10)}.xlsx`;
  } else if (type === 'mouvements') {
    const { data } = await supabase
      .from('mouvements_stock')
      .select('*, intrants(sigle), lots(num_lot), centres_sante(nom), fournisseurs(nom)')
      .order('date_mouvement', { ascending: false })
      .limit(1000);
    rows = (data || []).map(m => ({
      'Date':       fmtDate(m.date_mouvement),
      'Type':       m.type_mvt === 'entree' ? 'Entrée' : 'Sortie',
      'Source':     m.source,
      'Intrant':    m.intrants?.sigle ?? '',
      'Lot':        m.lots?.num_lot ?? '',
      'Quantité':   m.type_mvt === 'entree' ? m.quantite : -m.quantite,
      'CS':         m.centres_sante?.nom ?? '',
      'Fournisseur': m.fournisseurs?.nom ?? '',
      'Motif':      m.motif ?? '',
    }));
    filename = `mouvements_${new Date().toISOString().slice(0,10)}.xlsx`;
  } else if (type === 'bons_commande') {
    const { data } = await supabase
      .from('bons_commande')
      .select('*, centres_sante(nom,code_cs), fournisseurs(nom)')
      .order('date_commande', { ascending: false });
    rows = (data || []).map(bc => ({
      'Numéro':      bc.numero_bc,
      'Type':        bc.type_bc === 'cs_district' ? 'CS → District' : 'District → Fournisseur',
      'Date':        fmtDate(bc.date_commande),
      'CS':          bc.centres_sante ? `${bc.centres_sante.code_cs} — ${bc.centres_sante.nom}` : '',
      'Fournisseur': bc.fournisseurs?.nom ?? '',
      'Statut':      bc.statut,
      'Date livraison': fmtDate(bc.date_livraison),
      'Notes':       bc.notes ?? '',
    }));
    filename = `bons_commande_${new Date().toISOString().slice(0,10)}.xlsx`;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
  XLSX.writeFile(wb, filename);
}

// ── EXPORT: PDF ────────────────────────────────────────────────────────────
async function exportPDF(type) {
  const jsPDF  = (await import('jspdf')).default;
  const { default: autoTable } = await import('jspdf-autotable');
  const config = await loadConfig();

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const title = config?.nom_structure ?? 'Pharmacie du District';
  const dateStr = new Date().toLocaleDateString('fr-FR');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Édité le ${dateStr}`, 14, 22);

  let filename = 'rapport.pdf';

  if (type === 'stock') {
    const { data } = await supabase
      .from('intrants').select('*, categories_intrants(nom)').eq('actif', true).order('sigle');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('État des stocks — Intrants', 14, 30);

    autoTable(doc, {
      startY: 35,
      head: [['Code', 'Sigle', 'DCI', 'Catégorie', 'Stock', 'Seuil', 'CMM', 'Statut']],
      body: (data || []).map(i => [
        i.code_intrant,
        i.sigle,
        i.nom_dci,
        i.categories_intrants?.nom ?? '',
        i.stock_dispo,
        i.seuil_reappro,
        Number(i.cmm).toFixed(1),
        i.stock_dispo === 0 ? 'RUPTURE' : i.stock_dispo < i.seuil_reappro ? 'FAIBLE' : 'OK',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 107, 107] },
      didParseCell(data) {
        if (data.column.index === 7) {
          const v = data.cell.raw;
          if (v === 'RUPTURE') data.cell.styles.textColor = [192, 57, 43];
          if (v === 'FAIBLE')  data.cell.styles.textColor = [201, 124, 26];
          if (v === 'OK')      data.cell.styles.textColor = [45, 125, 70];
        }
      },
    });
    filename = `stock_intrants_${new Date().toISOString().slice(0,10)}.pdf`;
  } else if (type === 'lots') {
    const { data } = await supabase
      .from('lots').select('*, intrants(sigle,nom_dci)').order('date_perexp');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('État des lots', 14, 30);
    autoTable(doc, {
      startY: 35,
      head: [['Intrant', 'N° Lot', 'Date fabrication', 'Date péremption', 'Réception', 'Qté lot', 'Qté dispo', 'État']],
      body: (data || []).map(l => [
        l.intrants?.sigle ?? '',
        l.num_lot,
        fmtDate(l.date_fab),
        fmtDate(l.date_perexp),
        fmtDate(l.date_recep),
        l.qte_lot,
        l.qte_dispo,
        l.etat_lot,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 107, 107] },
    });
    filename = `lots_${new Date().toISOString().slice(0,10)}.pdf`;
  }

  doc.save(filename);
}

// ── REPORT CARDS ──────────────────────────────────────────────────────────
const REPORTS = [
  {
    id: 'stock',
    title: 'État des Stocks',
    desc: 'Vue complète de tous les intrants actifs avec leurs niveaux de stock, seuils et statuts.',
    icon: '📊',
  },
  {
    id: 'lots',
    title: 'État des Lots',
    desc: 'Liste de tous les lots avec dates de péremption, quantités et état (FEFO).',
    icon: '🏷',
  },
  {
    id: 'mouvements',
    title: 'Mouvements de Stock',
    desc: 'Historique des entrées et sorties de stock (1000 derniers mouvements).',
    icon: '↕️',
    pdfDisabled: true,
  },
  {
    id: 'bons_commande',
    title: 'Bons de Commande',
    desc: 'Historique de tous les bons de commande (CS et fournisseurs).',
    icon: '📋',
    pdfDisabled: true,
  },
];

export default function Rapports() {
  const [busy, setBusy] = useState({});
  const [msg, setMsg]   = useState('');

  async function run(fn, key) {
    setBusy(b => ({ ...b, [key]: true }));
    setMsg('');
    try {
      await fn();
      setMsg('Export réussi.');
    } catch (e) {
      setMsg(`Erreur : ${e.message}`);
    }
    setBusy(b => ({ ...b, [key]: false }));
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Rapports & Exports</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 20 }}>
        Générez et téléchargez vos rapports en format PDF ou Excel.
      </p>

      {msg && (
        <div style={{
          marginBottom: 16, padding: '8px 14px',
          background: msg.startsWith('Erreur') ? 'var(--red-l)' : 'var(--green-l)',
          color: msg.startsWith('Erreur') ? 'var(--red)' : 'var(--green)',
          borderRadius: 'var(--r-sm)', fontSize: 13,
        }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
        {REPORTS.map(r => (
          <div key={r.id} className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{r.icon}</span>
                <span className="card-title">{r.title}</span>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.5 }}>
                {r.desc}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {!r.pdfDisabled && (
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busy[r.id + '_pdf']}
                    onClick={() => run(() => exportPDF(r.id), r.id + '_pdf')}
                  >
                    {busy[r.id + '_pdf'] ? '…' : '📄 PDF'}
                  </button>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy[r.id + '_xlsx']}
                  onClick={() => run(() => exportExcel(r.id), r.id + '_xlsx')}
                >
                  {busy[r.id + '_xlsx'] ? '…' : '📊 Excel'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick stats section */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Résumé rapide</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
          <QuickStat label="Inventaires validés" query={() => supabase.from('inventaires').select('id',{count:'exact',head:true}).eq('statut','valide')} />
          <QuickStat label="BC livrés" query={() => supabase.from('bons_commande').select('id',{count:'exact',head:true}).eq('statut','livree')} />
          <QuickStat label="Total mouvements" query={() => supabase.from('mouvements_stock').select('id',{count:'exact',head:true})} />
          <QuickStat label="Lots expirés" query={() => supabase.from('lots').select('id',{count:'exact',head:true}).eq('etat_lot','perime')} />
        </div>
      </div>
    </div>
  );
}

function QuickStat({ label, query }) {
  const [count, setCount] = useState('…');
  useEffect(() => {
    query().then(({ count: c }) => setCount(c ?? 0));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
    </div>
  );
}

