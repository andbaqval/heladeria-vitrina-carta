import { FAMILY_NAMES } from '../domain';
import { statusClass, statusLabel } from './status';

function ProductEditor({ draft, setDraft, editingId, onSubmit, onCancel }) {
  return (
    <section className="editor">
      <div className="section-heading">
        <div><p className="eyebrow">Catálogo</p><h2>{editingId ? 'Editar producto' : 'Nuevo producto'}</h2></div>
        {editingId && <button className="text-button" onClick={onCancel}>Cancelar edición</button>}
      </div>
      <form onSubmit={onSubmit}>
        <label>Nombre<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ej. Limón y albahaca" /></label>
        <div className="form-row">
          <label>Tipo<select value={draft.type} disabled={Boolean(editingId)} onChange={(event) => setDraft({ ...draft, type: event.target.value, family: '', price: '' })}><option value="sabor">Sabor</option><option value="postre">Postre helado</option></select></label>
          {draft.type === 'sabor'
            ? <label>Familia<select value={draft.family} onChange={(event) => setDraft({ ...draft, family: event.target.value })}><option value="">Elegir familia</option>{FAMILY_NAMES.map((family) => <option key={family}>{family}</option>)}</select></label>
            : <label>Precio en pesos<input type="number" min="1" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="680" /></label>}
        </div>
        {editingId && draft.type === 'sabor' && (
          <label>Estado de vitrina
            <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
              <option value="in_vitrina">En vitrina</option>
              <option value="agotado">Agotado hoy</option>
              <option value="temporada">Fuera de temporada</option>
            </select>
          </label>
        )}
        <label>Motivo<input value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="Motivo del cambio" /></label>
        <button className="primary" type="submit">{editingId ? 'Guardar cambios' : 'Agregar producto'}</button>
      </form>
    </section>
  );
}

function HistoryPanel({ events }) {
  return (
    <div className="history">
      <div className="section-heading"><div><p className="eyebrow">Trazabilidad</p><h2>Historial de movimientos</h2></div></div>
      {events.length ? events.slice(-12).reverse().map((event) => (
        <article className="history-item" key={event.id}>
          <div><b>{event.id}</b><small>{event.commandId}</small></div>
          <p>{event.reason}</p>
          <span>{event.actorProfile} · {new Date(event.date).toLocaleString('es-UY')}</span>
        </article>
      )) : <p className="empty">Sin movimientos registrados.</p>}
    </div>
  );
}

function OperationsPanel({ state, onExportCsv, onExportJson, onRestoreJson }) {
  return (
    <div className="controls">
      <div className="section-heading"><div><p className="eyebrow">Control</p><h2>Conciliación y exportación</h2></div></div>
      <div className="reconcile">
        <span><b>{state.entities.length}</b> entidades</span>
        <span><b>{state.events.length}</b> eventos</span>
        <span><b>{state.commandsApplied.length}</b> comandos</span>
      </div>
      <p className="access-note">Perfiles locales de demostración; no son autenticación real ni sincronización entre dispositivos.</p>
      <div className="export-actions">
        <button onClick={onExportCsv}>Exportar CSV</button>
        <button onClick={onExportJson}>Exportar copia JSON</button>
        <label className="upload">Restaurar copia JSON<input type="file" accept=".json,application/json" onChange={onRestoreJson} /></label>
      </div>
    </div>
  );
}

function ProposalsPanel({ proposals, entities, profile, onDecide }) {
  return (
    <section className="proposals">
      <div className="section-heading"><div><p className="eyebrow">Revisión</p><h2>Propuestas</h2></div></div>
      {proposals.map((proposal) => {
        const entity = entities.find((item) => item.id === proposal.entityId);
        return (
          <article className="proposal-row" key={proposal.id}>
            <div><b>{proposal.id}</b><small>{entity?.name || proposal.entityId} · revisión {proposal.fromRevision}</small></div>
            <p>{proposal.reason}</p>
            <span className={`proposal-state ${proposal.state}`}>{proposal.state}</span>
            {profile === 'Revisor' && proposal.state === 'pendiente' && (
              <div className="proposal-actions">
                <button onClick={() => onDecide(proposal.id, 'rechazar')}>Rechazar</button>
                {proposal.creator !== 'Revisor' && <button className="approve" onClick={() => onDecide(proposal.id, 'aprobar')}>Aprobar</button>}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

function ProductListPanel({ entities, profile, onEdit, onRequestDelete }) {
  return (
    <section className="catalogue-manager">
      <div className="section-heading"><div><p className="eyebrow">Base local</p><h2>Productos registrados</h2></div></div>
      {entities.map((item) => (
        <article className="manager-row" key={item.id}>
          <div><b>{item.name}</b><small>{item.type === 'sabor' ? item.family : `Postre · $${item.price}`}</small></div>
          <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
          {profile === 'Operación' && <div className="row-actions"><button onClick={() => onEdit(item)}>Editar</button><button className="danger" onClick={() => onRequestDelete(item.id)}>Eliminar</button></div>}
        </article>
      ))}
    </section>
  );
}

export default function ManagementView({
  state,
  profile,
  draft,
  setDraft,
  editingId,
  onSubmitProduct,
  onResetDraft,
  onEdit,
  onRequestDelete,
  onExportCsv,
  onExportJson,
  onRestoreJson,
  onDecide,
}) {
  return (
    <main className="management">
      {profile === 'Operación' && (
        <ProductEditor draft={draft} setDraft={setDraft} editingId={editingId} onSubmit={onSubmitProduct} onCancel={onResetDraft} />
      )}

      <section className="management-grid">
        <HistoryPanel events={state.events} />
        <OperationsPanel state={state} onExportCsv={onExportCsv} onExportJson={onExportJson} onRestoreJson={onRestoreJson} />
      </section>

      <ProposalsPanel proposals={state.proposals} entities={state.entities} profile={profile} onDecide={onDecide} />
      <ProductListPanel entities={state.entities} profile={profile} onEdit={onEdit} onRequestDelete={onRequestDelete} />
    </main>
  );
}
