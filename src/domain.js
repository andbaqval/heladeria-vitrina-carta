export const STORAGE_KEY = 'heladeria-vitrina-carta:v2';

export const FAMILY_NAMES = [
  'Frutales al agua',
  'Frutas a la crema',
  'Cremas',
  'Dulce de leche',
  'Chocolate',
  'Sin azúcar',
];

export const POT_SIZES = [
  { name: 'Pote 1/4 litro', price: 410 },
  { name: 'Pote 1/2 litro', price: 580 },
  { name: 'Pote 1 litro', price: 980 },
  { name: 'Pote 1,5 litros', price: 1340 },
  { name: 'Pote 2 litros', price: 1560 },
];

function id(name) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function createSeed() {
  const flavors = [
    ['Frutales al agua', 'Limón'], ['Frutales al agua', 'Frambuesa'],
    ['Frutales al agua', 'Mango'], ['Frutales al agua', 'Maracuyá'],
    ['Frutas a la crema', 'Frutilla'], ['Frutas a la crema', 'Arándanos'],
    ['Frutas a la crema', 'Banana split'], ['Frutas a la crema', 'Piña colada'],
    ['Cremas', 'Vainilla'], ['Cremas', 'Tiramisú'], ['Cremas', 'Crema del cielo'],
    ['Cremas', 'Sambayón'], ['Cremas', 'Pistacho'],
    ['Dulce de leche', 'Dulce de leche'], ['Dulce de leche', 'Dulce de leche granizado'],
    ['Dulce de leche', 'Dulce de leche con nueces'],
    ['Chocolate', 'Chocolate'], ['Chocolate', 'Chocolate con almendras'],
    ['Chocolate', 'Nocciolatto'], ['Chocolate', 'Chocolate granizado'],
    ['Sin azúcar', 'Crema'], ['Sin azúcar', 'Café'], ['Sin azúcar', 'Frutilla'],
    ['Sin azúcar', 'Chocolate'],
  ].map(([family, name]) => ({
    id: `fl-${id(name)}-${id(family)}`,
    type: 'sabor',
    name,
    family,
    price: null,
    status: 'in_vitrina',
    outSince: null,
  }));

  const outNow = ['Mango', 'Sambayón'];
  const outSeason = ['Piña colada', 'Arándanos', 'Crema del cielo'];
  const today = localDateKey();
  flavors.forEach((flavor) => {
    if (outNow.includes(flavor.name)) {
      flavor.status = 'agotado';
      flavor.outSince = today;
    }
    if (outSeason.includes(flavor.name)) flavor.status = 'temporada';
  });

  const desserts = [
    ['cassata-chica', 'Cassata chica', 680],
    ['cassata-grande', 'Cassata grande', 1150],
    ['torta-helada-chica', 'Torta helada chica', 950],
    ['torta-helada-grande', 'Torta helada grande', 1550],
    ['tronco-helado', 'Tronco helado', 1550],
    ['omelette-surprise-grande', 'Omelette surprise grande', 1550],
  ].map(([recordId, name, price]) => ({
    id: recordId,
    type: 'postre',
    name,
    family: null,
    price,
    status: 'in_vitrina',
    outSince: null,
  }));

  return {
    schemaVersion: 2,
    revision: 1,
    entities: [...flavors, ...desserts],
    events: [],
    commandsApplied: [],
    proposals: [],
  };
}

export function migrateSnapshot(input) {
  if (!input || typeof input !== 'object') throw new Error('La copia está truncada o no es válida.');
  if (input.schemaVersion === 1) {
    if (!Array.isArray(input.entities)) throw new Error('Falta la lista de entidades.');
    const ids = input.entities.map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw new Error('Hay ids repetidos en la copia.');
    for (const item of input.entities) {
      if (!item.id || !item.name || !['sabor', 'postre'].includes(item.type)) {
        throw new Error('Hay una entidad con referencias o campos inválidos.');
      }
    }
    return {
      schemaVersion: 2,
      revision: 1,
      entities: input.entities.map((item) => ({ ...item, status: item.status || 'in_vitrina', outSince: item.outSince || null })),
      events: [],
      commandsApplied: [],
      proposals: [],
    };
  }
  validateSnapshot(input);
  return input;
}

export function validateSnapshot(state) {
  if (!state || state.schemaVersion !== 2) throw new Error('Versión de esquema desconocida.');
  if (!Array.isArray(state.entities) || !Array.isArray(state.events) || !Array.isArray(state.commandsApplied)) {
    throw new Error('La copia está incompleta.');
  }
  const ids = state.entities.map((item) => item.id);
  if (ids.some((value) => !value) || new Set(ids).size !== ids.length) throw new Error('Hay ids repetidos.');
  const entityIds = new Set(ids);
  for (const item of state.entities) {
    if (!item.name || !['sabor', 'postre'].includes(item.type)) throw new Error('Hay entidades con referencias inválidas.');
    if (item.type === 'sabor' && !item.family) throw new Error(`El sabor ${item.name} no tiene familia.`);
  }
  for (const event of state.events) {
    if (!entityIds.has(event.entityId)) throw new Error(`El evento ${event.id} refiere una entidad inexistente.`);
  }
  for (const command of state.commandsApplied) {
    if (!command.id || !command.entityId || !entityIds.has(command.entityId)) throw new Error('Hay un comando con referencias inválidas.');
  }
  return true;
}

export function saveSnapshot(state, storage = globalThis.localStorage, key = STORAGE_KEY) {
  validateSnapshot(state);
  storage.setItem(key, JSON.stringify(state));
  return state;
}

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function reopenByBusinessDate(state, date = new Date()) {
  const today = localDateKey(date);
  let changed = false;
  const entities = state.entities.map((item) => {
    if (item.status === 'agotado' && item.outSince && item.outSince !== today) {
      changed = true;
      return { ...item, status: 'in_vitrina', outSince: null };
    }
    return item;
  });
  return changed ? { ...state, entities } : state;
}

export function executeCommand(state, command) {
  if (!command.id || !command.entityId || !command.type) throw new Error('Falta el id, la entidad o el tipo de comando.');
  const existing = state.commandsApplied.find((item) => item.id === command.id);
  if (existing) {
    if (JSON.stringify(existing.data) !== JSON.stringify(command.data)) throw new Error('El id de operación ya existe con otros datos.');
    return { state, duplicate: true };
  }
  const entity = state.entities.find((item) => item.id === command.entityId);
  if (!entity) throw new Error('La entidad no existe.');
  if (command.expectedRevision !== state.revision) throw new Error('Revisión desactualizada. Actualizá los datos y volvé a revisar.');
  if (command.actorProfile === 'Auditor') throw new Error('Auditor no puede cambiar datos.');
  if (!command.data?.reason) throw new Error('El motivo es obligatorio.');

  let nextEntity = { ...entity };
  if (command.type === 'set_status') {
    if (!['in_vitrina', 'agotado', 'temporada'].includes(command.data.status)) throw new Error('Estado inválido.');
    nextEntity.status = command.data.status;
    nextEntity.outSince = command.data.status === 'agotado' ? localDateKey(command.date ? new Date(command.date) : new Date()) : null;
  } else if (command.type === 'edit_product') {
    const name = String(command.data.name || '').trim();
    if (!name) throw new Error('El nombre es obligatorio.');
    if (entity.type === 'sabor' && !command.data.family) throw new Error('El sabor requiere una familia.');
    if (entity.type === 'postre' && (!Number.isFinite(Number(command.data.price)) || Number(command.data.price) <= 0)) {
      throw new Error('El postre requiere un precio mayor que 0.');
    }
    const duplicate = state.entities.find((item) =>
      item.id !== entity.id &&
      item.type === entity.type &&
      (entity.type === 'postre' || item.family === command.data.family) &&
      item.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) throw new Error('Ya existe un producto con ese nombre en la misma familia.');
    nextEntity.name = name;
    if (entity.type === 'sabor') nextEntity.family = command.data.family;
    if (entity.type === 'postre') nextEntity.price = Number(command.data.price);
    if (entity.type === 'sabor' && command.data.status) {
      if (!['in_vitrina', 'agotado', 'temporada'].includes(command.data.status)) throw new Error('Estado inválido.');
      nextEntity.status = command.data.status;
      nextEntity.outSince = command.data.status === 'agotado'
        ? localDateKey(command.date ? new Date(command.date) : new Date())
        : null;
    }
  } else if (command.type === 'delete_product') {
    nextEntity = null;
  } else {
    throw new Error('Tipo de comando no válido.');
  }

  const revision = state.revision + 1;
  const entities = nextEntity
    ? state.entities.map((item) => item.id === entity.id ? nextEntity : item)
    : state.entities.filter((item) => item.id !== entity.id);
  const eventId = `evt-${command.id}`;
  const event = {
    id: eventId,
    commandId: command.id,
    entityId: entity.id,
    date: command.date || new Date().toISOString(),
    actorProfile: command.actorProfile,
    reason: command.data.reason,
    before: entity,
    after: nextEntity,
    effect: command.type === 'delete_product' ? 'Eliminación del catálogo' : `Cambio aplicado a ${entity.name}`,
  };
  return {
    duplicate: false,
    state: {
      ...state,
      revision,
      entities,
      events: [...state.events, event],
      commandsApplied: [...state.commandsApplied, command],
    },
  };
}

export function decideProposal(state, proposalId, decision, actorProfile) {
  if (actorProfile !== 'Revisor') throw new Error('Solo Revisor puede decidir propuestas.');
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal) throw new Error('La propuesta no existe.');
  if (proposal.state !== 'pendiente') throw new Error('La propuesta ya fue decidida.');
  if (!proposal.creator || proposal.creator === actorProfile) throw new Error('Revisor no puede aprobar una propuesta que él mismo creó.');
  if (proposal.fromRevision !== state.revision) throw new Error('La propuesta quedó desactualizada por una revisión nueva.');
  if (!['aprobar', 'rechazar'].includes(decision)) throw new Error('Decisión inválida.');

  const next = {
    ...state,
    proposals: state.proposals.map((item) => item.id === proposalId ? {
      ...item,
      state: decision === 'aprobar' ? 'aprobada' : 'rechazada',
      decision,
      decisor: actorProfile,
    } : item),
  };
  if (decision === 'rechazar') return { ...next, revision: state.revision + 1 };

  const command = {
    id: `cmd-${proposalId}-${Date.now()}`,
    type: proposal.changes.status ? 'set_status' : 'edit_product',
    entityId: proposal.entityId,
    actorProfile,
    date: new Date().toISOString(),
    expectedRevision: state.revision,
    data: {
      ...proposal.changes,
      reason: `Corrección aprobada: ${proposal.reason}`,
    },
  };
  const result = executeCommand(next, command);
  if (result.duplicate) return result.state;
  return result.state;
}
