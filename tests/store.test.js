'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const storeJS = readFileSync(path.join(__dirname, '..', 'js', 'core', 'store.js'), 'utf8');
function createMock() {
  const account = { id: 'uuid-gerente', nome: 'Gerente Teste', perfil: 'gerente', doc: '12345678900', canais: { whats: true, email: false, sms: false } };
  const donor = { id: 'uuid-doador', nome: 'Doador Teste', perfil: 'doador', tipo: 'O+', ativo: true, doc: '11144477735', canais: { whats: true, email: true, sms: false } };
  const data = { current: null, users: [account, donor], alerts: [], stock: { 'O+': 'Alerta' }, appts: [] };
  const calls = [];
  const response = (status, value) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
  async function fetch(url, opts) {
    calls.push({ url, ...opts });
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    if (url === '/api/bootstrap') return response(200, { ...structuredClone(data), users: data.current ? (data.current.perfil === 'gerente' ? structuredClone(data.users) : [structuredClone(donor)]) : [] });
    if (url === '/api/auth/login') {
      if (body.senha === 'certa') { data.current = body.doc === '11144477735' ? donor : account; return response(200, { ok: true }); }
      return response(401, { erro: 'CPF/RG ou senha incorretos.' });
    }
    if (url === '/api/auth/logout') { data.current = null; return response(200, { ok: true }); }
    if (url === '/api/usuarios' && opts.method === 'POST') { const u = { ...body, id: 'novo-uuid', perfil: 'doador' }; data.users.push(u); return response(201, { user: u }); }
    if (url.startsWith('/api/usuarios/') && opts.method === 'PATCH') { const u = data.users.find((x) => x.id === url.slice('/api/usuarios/'.length)); Object.assign(u, body); if (data.current?.id === u.id) data.current = u; return response(200, { user: u }); }
    if (url.startsWith('/api/usuarios/') && opts.method === 'DELETE') { const id = url.slice('/api/usuarios/'.length); data.users.splice(data.users.findIndex((u) => u.id === id), 1); return response(200, { ok: true }); }
    if (url.startsWith('/api/estoque/')) { data.stock[decodeURIComponent(url.slice('/api/estoque/'.length))] = body.nivel; return response(200, { ok: true }); }
    if (url === '/api/alertas') { const a = { ...body, id: 'alerta-uuid', status: 'ativo', destinatarios: ['uuid-doador'] }; data.alerts.push(a); return response(201, { id: a.id }); }
    if (url === '/api/agendamentos') { const ap = { id: 'ag-uuid', userId: 'uuid-doador', alertId: body.alertId, data: body.data, hora: body.hora, status: 'Agendada' }; data.appts.push(ap); return response(201, { id: ap.id }); }
    if (url.endsWith('/cancelar')) { data.appts[0].status = 'Cancelada'; return response(200, { ok: true }); }
    if (url.endsWith('/encerrar')) { data.alerts[0].status = 'encerrado'; return response(200, { ok: true }); }
    return response(200, { ok: true });
  }
  const map = new Map();
  const ctx = {
    window: { HC: { u: { today: () => '2026-11-22' } } }, fetch, sessionStorage: {
      getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k),
    }
  };
  vm.runInNewContext(storeJS, ctx);
  return { api: ctx.window.HC.api, data, calls };
}

test('loads the real API snapshot, not demo data', async () => {
  const { api } = createMock();
  await api.refresh();
  assert.equal(api.currentUser(), null);
  assert.equal(api.alerts().length, 0);
  assert.equal(api.users().length, 0);
});

test('login, update, alert, scheduling and logout use HTTP and refresh cache', async () => {
  const { api, calls } = createMock();
  await api.refresh();
  assert.equal((await api.login('12345678900', 'errada')).ok, false);
  assert.equal((await api.login('12345678900', 'certa')).user.nome, 'Gerente Teste');
  assert.equal(api.donors().length, 1);
  await api.setStock('O+', 'Crítico');
  assert.equal(api.stock()['O+'], 'Crítico');
  const novo = await api.createUser({ nome: 'Novo Doador', senha: 'Senha123', tipo: 'O+' });
  assert.equal(api.getUser(novo.id).nome, 'Novo Doador');
  await api.updateUser(novo.id, { nome: 'Outro Nome' });
  assert.equal(api.getUser(novo.id).nome, 'Outro Nome');
  const a = await api.createAlert({ tipo: 'O+', nivel: 'urgente', faltam: 2, prazo: '2026-11-23' });
  assert.equal(api.getAlert(a.id).status, 'ativo');
  await api.closeAlert(a.id);
  assert.equal(api.getAlert(a.id).status, 'encerrado');
  await api.deleteUser(novo.id);
  assert.equal(api.getUser(novo.id), null);
  await api.logout();
  assert.equal(api.currentUser(), null);
  assert.ok(calls.some((c) => c.url === '/api/estoque/O%2B' && c.method === 'PATCH'));
  assert.ok(calls.some((c) => c.url === '/api/usuarios/novo-uuid' && c.method === 'DELETE'));
});

test('scheduling and cancellation reflect DB state after refresh', async () => {
  const { api } = createMock();
  await api.login('11144477735', 'certa');
  const ap = await api.createAppt({ alertId: 'alerta-uuid', data: '2026-11-23', hora: '08:00' });
  assert.equal(api.activeAppt('uuid-doador', 'alerta-uuid').id, ap.id);
  await api.cancelAppt(ap.id);
  assert.equal(api.activeAppt('uuid-doador', 'alerta-uuid'), null);
  assert.equal(api.getAppt(ap.id).status, 'Cancelada');
});
