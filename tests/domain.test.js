import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSeed,
  executeCommand,
  reopenByBusinessDate,
  migrateSnapshot,
  validateSnapshot,
  decideProposal,
  saveSnapshot,
} from '../src/domain.js';

const find = (state, name) => state.entities.find((item) => item.name === name);

test('semilla contiene el catálogo y sus estados iniciales', () => {
  const seed = createSeed();
  assert.equal(seed.entities.filter((item) => item.type === 'sabor').length, 24);
  assert.equal(seed.entities.filter((item) => item.type === 'postre').length, 6);
  assert.equal(find(seed, 'Mango').status, 'agotado');
  assert.equal(find(seed, 'Sambayón').status, 'agotado');
  assert.equal(find(seed, 'Piña colada').status, 'temporada');
  assert.equal(find(seed, 'Arándanos').status, 'temporada');
  assert.equal(find(seed, 'Crema del cielo').status, 'temporada');
});

test('reapertura cambia agotados por fecha y conserva fuera de temporada; es idempotente', () => {
  const seed = createSeed();
  seed.entities = seed.entities.map((item) =>
    item.name === 'Limón' || item.name === 'Sambayón'
      ? { ...item, status: 'agotado', outSince: '2026-11-23' }
      : item
  );
  const date = new Date(2026, 10, 24, 12);
  const reopened = reopenByBusinessDate(seed, date);
  assert.equal(find(reopened, 'Limón').status, 'in_vitrina');
  assert.equal(find(reopened, 'Piña colada').status, 'temporada');
  assert.equal(find(reopened, 'Sambayón').status, 'in_vitrina');
  assert.equal(reopenByBusinessDate(reopened, date), reopened);
});

test('mismo id y datos aplica una sola vez; mismo id con datos distintos se rechaza', () => {
  const seed = createSeed();
  const lemon = find(seed, 'Limón');
  const command = {
    id: 'cmd-test-1',
    type: 'set_status',
    entityId: lemon.id,
    actorProfile: 'Operación',
    date: new Date(2026, 10, 24).toISOString(),
    expectedRevision: seed.revision,
    data: { status: 'agotado', reason: 'Fin de turno' },
  };
  const first = executeCommand(seed, command);
  assert.equal(first.state.revision, seed.revision + 1);
  const second = executeCommand(first.state, command);
  assert.equal(second.duplicate, true);
  assert.equal(second.state.events.length, first.state.events.length);
  assert.throws(
    () => executeCommand(first.state, { ...command, data: { status: 'temporada', reason: 'Cambio distinto' } }),
    /otros datos/
  );
});

test('revisión desactualizada, requisito inválido y Auditor no cambian el estado', () => {
  const seed = createSeed();
  const lemon = find(seed, 'Limón');
  assert.throws(() => executeCommand(seed, {
    id: 'cmd-old', type: 'set_status', entityId: lemon.id, actorProfile: 'Operación',
    expectedRevision: seed.revision - 1, data: { status: 'agotado', reason: 'Prueba' },
  }), /desactualizada/);

  assert.throws(() => executeCommand(seed, {
    id: 'cmd-invalid', type: 'edit_product', entityId: lemon.id, actorProfile: 'Operación',
    expectedRevision: seed.revision, data: { name: 'Limón', family: '', reason: 'Prueba' },
  }), /familia/);

  assert.throws(() => executeCommand(seed, {
    id: 'cmd-auditor', type: 'set_status', entityId: lemon.id, actorProfile: 'Auditor',
    expectedRevision: seed.revision, data: { status: 'agotado', reason: 'Prueba' },
  }), /Auditor/);
});

test('nombre repetido en la misma familia se rechaza', () => {
  const seed = createSeed();
  const lemon = find(seed, 'Limón');
  assert.throws(() => executeCommand(seed, {
    id: 'cmd-name', type: 'edit_product', entityId: lemon.id, actorProfile: 'Operación',
    expectedRevision: seed.revision,
    data: { name: 'Frambuesa', family: 'Frutales al agua', reason: 'Corrección' },
  }), /Ya existe/);
});

test('precio exige > 0 y fuera de temporada solo se reactiva por edición', () => {
  const seed = createSeed();
  const cassata = find(seed, 'Cassata chica');
  assert.throws(() => executeCommand(seed, {
    id: 'cmd-price', type: 'edit_product', entityId: cassata.id, actorProfile: 'Operación',
    expectedRevision: seed.revision,
    data: { name: 'Cassata chica', price: 0, reason: 'Corrección' },
  }), /precio mayor/);

  const pina = find(seed, 'Piña colada');
  const reactivated = executeCommand(seed, {
    id: 'cmd-edit-season', type: 'edit_product', entityId: pina.id, actorProfile: 'Operación',
    expectedRevision: seed.revision,
    data: { name: 'Piña colada', family: 'Frutas a la crema', status: 'in_vitrina', reason: 'Volvió la temporada' },
  }).state;
  assert.equal(find(reactivated, 'Piña colada').status, 'in_vitrina');
});

test('migración v1 conserva ids y copia válida; copia inválida se rechaza', () => {
  const seed = createSeed();
  const v1 = {
    schemaVersion: 1,
    entities: seed.entities.map((item) => ({ id: item.id, type: item.type, name: item.name, family: item.family, price: item.price })),
  };
  const migrated = migrateSnapshot(v1);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.revision, 1);
  assert.deepEqual(migrated.entities.map((item) => item.id), v1.entities.map((item) => item.id));
  assert.equal(migrated.events.length, 0);
  assert.equal(migrated.commandsApplied.length, 0);
  assert.doesNotThrow(() => validateSnapshot(migrated));
  assert.throws(() => migrateSnapshot({ schemaVersion: 2, revision: 1, entities: [{ id: 'x', type: 'sabor', name: 'X' }], events: [{ id: 'e', entityId: 'missing' }], commandsApplied: [] }), /familia|referencias/);
  assert.throws(() => migrateSnapshot({ schemaVersion: 2, entities: null }), /incompleta|desconocida/);
});

test('propuesta no cambia recursos y creador distinto puede decidir', () => {
  const seed = createSeed();
  seed.revision = 10;
  seed.proposals = [{
    id: 'prop-test',
    entityId: find(seed, 'Limón').id,
    fromRevision: 10,
    changes: { status: 'agotado' },
    reason: 'Fin de turno',
    creator: 'Operación',
    state: 'pendiente',
    decision: null,
    decisor: null,
  }];
  const before = JSON.stringify(seed.entities);
  const rejected = decideProposal(seed, 'prop-test', 'rechazar', 'Revisor');
  assert.equal(JSON.stringify(rejected.entities), before);
  assert.equal(rejected.proposals[0].decisor, 'Revisor');

  seed.proposals[0].state = 'pendiente';
  assert.throws(() => decideProposal(seed, 'prop-test', 'aprobar', 'Operación'), /Solo Revisor/);
  assert.throws(() => decideProposal(seed, 'prop-test', 'aprobar', 'Auditor'), /Solo Revisor/);
});

test('Revisor no aprueba propuesta creada por Revisor', () => {
  const seed = createSeed();
  seed.revision = 10;
  seed.proposals = [{
    id: 'prop-self',
    entityId: find(seed, 'Limón').id,
    fromRevision: 10,
    changes: { status: 'agotado' },
    reason: 'Corrección',
    creator: 'Revisor',
    state: 'pendiente',
  }];
  assert.throws(() => decideProposal(seed, 'prop-self', 'aprobar', 'Revisor'), /él mismo creó/);
});

test('fallo real del adaptador conserva el estado previo', () => {
  const seed = createSeed();
  const failingStorage = {
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  assert.throws(
    () => saveSnapshot(seed, failingStorage, 'test-key'),
    /QuotaExceededError/
  );
  assert.equal(find(seed, 'Limón').status, 'in_vitrina');
});
