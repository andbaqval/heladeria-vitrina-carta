import { useEffect, useMemo, useState } from 'react';
import {
  FAMILY_NAMES,
  STORAGE_KEY,
  createSeed,
  decideProposal,
  executeCommand,
  localDateKey,
  migrateSnapshot,
  reopenByBusinessDate,
  saveSnapshot,
  validateSnapshot,
} from './domain';
import CatalogView from './components/CatalogView';
import DeleteDialog from './components/DeleteDialog';
import ManagementView from './components/ManagementView';
import ShowcaseView from './components/ShowcaseView';

const emptyDraft = { name: '', type: 'sabor', family: '', price: '', reason: '', status: 'in_vitrina' };

function makeSeedWithHistory() {
  const seed = createSeed();
  const appliedSeeds = [
    ['cmd-hist-001', 'limon', 'Limón marcado disponible'],
    ['cmd-hist-002', 'frambuesa', 'Frambuesa marcada disponible'],
    ['cmd-hist-003', 'vainilla', 'Vainilla revisada en vitrina'],
    ['cmd-hist-004', 'dulce-de-leche-chocolate', 'Precio histórico congelado'],
    ['cmd-hist-005', 'cassata-chica', 'Postre confirmado'],
  ];
  seed.commandsApplied = appliedSeeds.map(([id, entityId, reason], index) => ({
    id,
    type: 'edit_product',
    entityId: entityId.includes('limon') ? 'fl-limon-frutales-al-agua' : entityId.includes('frambuesa') ? 'fl-frambuesa-frutales-al-agua' : entityId.includes('vainilla') ? 'fl-vainilla-cremas' : entityId.includes('dulce') ? 'fl-dulce-de-leche-dulce-de-leche' : 'cassata-chica',
    actorProfile: 'Operación',
    date: new Date(2026, 10, 20 + index).toISOString(),
    expectedRevision: index + 1,
    data: { reason },
  }));
  seed.rejectedCommands = [{
    id: 'cmd-hist-006',
    type: 'delete_product',
    entityId: 'fl-mango-frutales-al-agua',
    actorProfile: 'Operación',
    date: new Date(2026, 10, 25).toISOString(),
    expectedRevision: 6,
    data: { reason: 'Intento rechazado: no se autorizó la eliminación' },
  }];
  seed.revision = 6;
  seed.events = seed.commandsApplied.map((command, index) => ({
    id: `evt-${command.id}`,
    commandId: command.id,
    entityId: command.entityId,
    date: command.date,
    actorProfile: 'Operación',
    reason: command.data.reason,
    before: { status: 'in_vitrina' },
    after: { status: 'in_vitrina' },
    effect: 'Registro sintético aplicado',
  }));
  seed.proposals = [
    {
      id: 'prop-001',
      entityId: 'fl-limon-frutales-al-agua',
      fromRevision: 6,
      changes: { status: 'agotado' },
      reason: 'Agotar Limón por fin de turno',
      creator: 'Operación',
      state: 'pendiente',
      decision: null,
      decisor: null,
    },
    {
      id: 'prop-002',
      entityId: 'cassata-chica',
      fromRevision: 5,
      changes: { price: 700 },
      reason: 'Ajustar precio publicado',
      creator: 'Revisor',
      state: 'rechazada',
      decision: 'rechazar',
      decisor: 'Auditor',
    },
  ];
  seed.lastBusinessDate = localDateKey();
  return seed;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = makeSeedWithHistory();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    } catch (error) {
      console.error(error);
    }
    return seed;
  }
  try {
    const migrated = migrateSnapshot(JSON.parse(raw));
    const reopened = reopenByBusinessDate(migrated);
    if (reopened !== migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(reopened));
    return reopened;
  } catch (error) {
    console.error(error);
    return makeSeedWithHistory();
  }
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [profile, setProfile] = useState('Operación');
  const [tab, setTab] = useState('carta');
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setState((current) => reopenByBusinessDate(current));
  }, []);

  const saveState = (next, successText = 'Cambios guardados') => {
    try {
      saveSnapshot(next);
      setState(next);
      setError('');
      setNotice(successText);
      setTimeout(() => setNotice(''), 2600);
      return true;
    } catch (saveError) {
      setError(`No se pudo guardar: ${saveError.message}. Conservamos el borrador y el estado anterior.`);
      return false;
    }
  };

  const runCommand = (command, successText) => {
    try {
      const result = executeCommand(state, command);
      saveState(result.state, result.duplicate ? 'Esta operación ya fue aplicada una sola vez.' : successText);
    } catch (commandError) {
      setError(commandError.message);
    }
  };

  const visibleEntities = useMemo(() => {
    const term = search.trim().toLowerCase();
    return state.entities.filter((item) => {
      if (term && !item.name.toLowerCase().includes(term)) return false;
      if (familyFilter !== 'Todas' && item.family !== familyFilter) return false;
      if (statusFilter === 'En vitrina' && item.status !== 'in_vitrina') return false;
      if (statusFilter === 'Agotado hoy' && item.status !== 'agotado') return false;
      if (statusFilter === 'Fuera de temporada' && item.status !== 'temporada') return false;
      return true;
    });
  }, [state.entities, search, familyFilter, statusFilter]);

  const alerts = FAMILY_NAMES.map((family) => {
    const familyItems = state.entities.filter((item) => item.type === 'sabor' && item.family === family);
    const inShowcase = familyItems.filter((item) => item.status === 'in_vitrina').length;
    return { family, inShowcase, total: familyItems.length };
  }).filter((item) => item.inShowcase < 3);

  const openNew = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setError('');
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      type: item.type,
      family: item.family || '',
      price: item.price ?? '',
      reason: 'Corrección de datos del producto',
      status: item.status,
    });
    setTab('gestion');
  };

  const submitProduct = (event) => {
    event.preventDefault();
    if (profile !== 'Operación') {
      setError('Este perfil no puede cambiar datos. Operación usa el flujo de carga y edición.');
      return;
    }
    const existing = editingId ? state.entities.find((item) => item.id === editingId) : null;
    if (existing) {
      runCommand({
        id: `cmd-${Date.now()}`,
        type: 'edit_product',
        entityId: existing.id,
        actorProfile: profile,
        date: new Date().toISOString(),
        expectedRevision: state.revision,
        data: { name: draft.name, family: draft.family, price: draft.price, status: draft.type === 'sabor' ? draft.status : undefined, reason: draft.reason || 'Corrección de datos del producto' },
      }, 'Producto actualizado');
    } else {
      const name = draft.name.trim();
      if (!name) return setError('El nombre es obligatorio.');
      if (draft.type === 'sabor' && !draft.family) return setError('Los sabores requieren una familia.');
      if (draft.type === 'postre' && (!Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0)) return setError('El postre requiere un precio mayor que 0.');
      const duplicate = state.entities.find((item) =>
        item.type === draft.type &&
        (draft.type === 'postre' || item.family === draft.family) &&
        item.name.trim().toLowerCase() === name.toLowerCase()
      );
      if (duplicate) return setError('Ya existe un producto con ese nombre en la misma familia.');
      const entity = {
        id: `${draft.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: draft.type,
        name,
        family: draft.type === 'sabor' ? draft.family : null,
        price: draft.type === 'postre' ? Number(draft.price) : null,
        status: 'in_vitrina',
        outSince: null,
      };
      const next = {
        ...state,
        revision: state.revision + 1,
        entities: [...state.entities, entity],
      };
      saveState(next, 'Producto creado');
      setDraft(emptyDraft);
    }
  };

  const setStatus = (item, status) => {
    if (profile !== 'Operación') return setError('Este perfil no puede cambiar estados.');
    if (item.status === 'temporada' && status === 'in_vitrina') {
      return setError('Un sabor fuera de temporada solo se reactiva desde Editar.');
    }
    runCommand({
      id: `cmd-${item.id}-${Date.now()}`,
      type: 'set_status',
      entityId: item.id,
      actorProfile: profile,
      date: new Date().toISOString(),
      expectedRevision: state.revision,
      data: {
        status,
        reason: status === 'agotado' ? 'Agotado en el turno' : status === 'temporada' ? 'Retiro fuera de temporada' : 'Reactivación manual',
      },
    }, 'Estado actualizado');
  };

  const deleteProduct = () => {
    if (profile !== 'Operación') return setError('Este perfil no puede eliminar datos.');
    runCommand({
      id: `cmd-delete-${deleteId}-${Date.now()}`,
      type: 'delete_product',
      entityId: deleteId,
      actorProfile: profile,
      date: new Date().toISOString(),
      expectedRevision: state.revision,
      data: { reason: 'Retiro confirmado del catálogo' },
    }, 'Producto eliminado');
    setDeleteId(null);
  };

  const decide = (proposalId, decision) => {
    try {
      const next = decideProposal(state, proposalId, decision, profile);
      saveState(next, decision === 'aprobar' ? 'Propuesta aprobada y aplicada' : 'Propuesta rechazada');
    } catch (proposalError) {
      setError(proposalError.message);
    }
  };

  const exportCsv = () => {
    const rows = [['Nombre', 'Tipo', 'Familia', 'Estado', 'Precio']];
    visibleEntities.forEach((item) => rows.push([
      item.name,
      item.type,
      item.family || '',
      item.status,
      item.price ?? '',
    ]));
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    downloadFile(csv, 'text/csv;charset=utf-8', 'vitrina-catalogo.csv');
  };

  const exportJson = () => {
    downloadFile(JSON.stringify({ exportVersion: 2, exportedAt: new Date().toISOString(), snapshot: state }, null, 2), 'application/json', 'vitrina-copia.json');
  };

  const restoreJson = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const snapshot = parsed.snapshot || parsed;
        const restored = migrateSnapshot(snapshot);
        validateSnapshot(restored);
        if (!window.confirm('¿Querés reemplazar la copia local por este archivo? Esta acción no admite restauración parcial.')) return;
        saveState(restored, 'Copia restaurada con validación');
      } catch (restoreError) {
        setError(`Restauración rechazada: ${restoreError.message}. La copia anterior quedó intacta.`);
      }
    };
    reader.readAsText(file);
  };

  const resetDraft = () => {
    setDraft(emptyDraft);
    setEditingId(null);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Heladería artesanal</p>
          <h1>Vitrina <span>&amp; carta</span></h1>
        </div>
        <label className="profile-select">
          Perfil de demo
          <select value={profile} onChange={(event) => setProfile(event.target.value)}>
            <option>Operación</option>
            <option>Revisor</option>
            <option>Auditor</option>
          </select>
        </label>
      </header>

      <nav className="tabs" aria-label="Pantallas">
        <button className={tab === 'carta' ? 'active' : ''} onClick={() => setTab('carta')}>Carta</button>
        <button className={tab === 'vitrina' ? 'active' : ''} onClick={() => setTab('vitrina')}>Vitrina</button>
        <button className={tab === 'gestion' ? 'active' : ''} onClick={() => setTab('gestion')}>Gestión</button>
      </nav>

      {(notice || error) && (
        <div className={error ? 'toast error' : 'toast'} role="status">
          {error || notice}
          {error && <button onClick={() => setError('')} aria-label="Cerrar">×</button>}
        </div>
      )}

      {tab === 'carta' && (
        <CatalogView
          entities={visibleEntities}
          profile={profile}
          search={search}
          onSearchChange={setSearch}
          familyFilter={familyFilter}
          onFamilyFilterChange={setFamilyFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onEdit={openEdit}
        />
      )}

      {tab === 'vitrina' && <ShowcaseView entities={state.entities} alerts={alerts} profile={profile} onSetStatus={setStatus} />}

      {tab === 'gestion' && (
        <ManagementView
          state={state}
          profile={profile}
          draft={draft}
          setDraft={setDraft}
          editingId={editingId}
          onSubmitProduct={submitProduct}
          onResetDraft={resetDraft}
          onEdit={openEdit}
          onRequestDelete={setDeleteId}
          onExportCsv={exportCsv}
          onExportJson={exportJson}
          onRestoreJson={restoreJson}
          onDecide={decide}
        />
      )}

      {deleteId && <DeleteDialog onCancel={() => setDeleteId(null)} onConfirm={deleteProduct} />}
    </div>
  );
}

function downloadFile(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
