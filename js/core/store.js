/* Comunicação com o back-end PostgreSQL.
   Leituras usam um retrato em memória recebido de /api/bootstrap;
   escritas são requisições HTTP e atualizam esse retrato depois de confirmadas.
   Nenhuma informação de usuário/senha é gravada no localStorage. */
(function (HC) {
  'use strict';
  const { today } = HC.u;
  const empty = () => ({ current: null, users: [], alerts: [], stock: {}, appts: [] });
  let state = empty();

  const slot = (key) => {
    let memory = null;
    return {
      get() { try { return JSON.parse(sessionStorage.getItem(key)); } catch (_) { return memory; } },
      set(v) { memory = v; try { sessionStorage.setItem(key, JSON.stringify(v)); } catch (_) { /* use memory */ } },
      clear() { memory = null; try { sessionStorage.removeItem(key); } catch (_) { /* ignore */ } },
    };
  };

  async function request(url, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await fetch('/api' + url, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (_) {
      throw new Error('Não foi possível acessar o servidor. Confira se a API está ligada.');
    }
    let result;
    try { result = await response.json(); } catch (_) { throw new Error('O servidor respondeu de forma inesperada.'); }
    if (!response.ok) {
      const error = new Error(result.erro || 'Não foi possível concluir a operação.');
      error.status = response.status;
      throw error;
    }
    return result;
  }

  async function refresh() {
    state = await request('/bootstrap');
    return state;
  }
  async function write(path, method, body) {
    const result = await request(path, { method, body });
    await refresh();
    return result;
  }

  HC.api = {
    request, refresh,
    currentUser: () => state.current,
    users: () => state.users,
    donors: () => state.users.filter((u) => u.perfil === 'doador'),
    getUser: (id) => state.users.find((u) => u.id === id) || null,
    findByDoc: (doc) => state.users.find((u) => u.doc === doc) || null,
    findByEmail: (email) => state.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null,

    async login(doc, senha) {
      try {
        await request('/auth/login', { method: 'POST', body: { doc, senha } });
        await refresh();
        return { ok: true, user: state.current };
      } catch (error) {
        // Erros conhecidos de credenciais são tratados na tela; falhas de servidor são exibidas.
        if (error.status === 401) return { ok: false };
        if (error.status === 403) return { ok: false, inactive: true };
        throw error;
      }
    },
    async logout() {
      await request('/auth/logout', { method: 'POST', body: {} });
      state = empty();
    },
    async createUser(data) {
      const result = await request('/usuarios', { method: 'POST', body: data });
      if (state.current?.perfil === 'gerente') await refresh();
      return result.user;
    },
    async updateUser(id, patch) {
      const r = await write('/usuarios/' + encodeURIComponent(id), 'PATCH', patch);
      return r.user;
    },
    async deleteUser(id) { await write('/usuarios/' + encodeURIComponent(id), 'DELETE'); },
    async changePassword(atual, nova) { await request('/auth/change-password', { method: 'POST', body: { atual, nova } }); },

    appts: (userId) => state.appts.filter((a) => a.userId === userId).sort((a, b) => b.data.localeCompare(a.data)),
    getAppt: (id) => state.appts.find((a) => a.id === id) || null,
    activeAppt: (userId, alertId) => state.appts.find((a) => a.userId === userId && a.alertId === alertId && a.status === 'Agendada') || null,
    async createAppt(data) {
      const result = await write('/agendamentos', 'POST', { alertId: data.alertId, data: data.data, hora: data.hora });
      return this.getAppt(result.id);
    },
    async cancelAppt(id) { await write('/agendamentos/' + encodeURIComponent(id) + '/cancelar', 'PATCH', {}); },

    alerts: () => state.alerts,
    activeAlerts: () => state.alerts.filter((a) => a.status === 'ativo' && a.prazo >= today()),
    getAlert: (id) => state.alerts.find((a) => a.id === id) || null,
    async createAlert(data) {
      const result = await write('/alertas', 'POST', {
        tipo: data.tipo, nivel: data.nivel, faltam: data.faltam, prazo: data.prazo,
      });
      return this.getAlert(result.id);
    },
    async closeAlert(id) { await write('/alertas/' + encodeURIComponent(id) + '/encerrar', 'PATCH', {}); },

    stock: () => state.stock,
    async setStock(tipo, nivel) {
      await write('/estoque/' + encodeURIComponent(tipo), 'PATCH', { nivel });
    },

    recoveryStart: (email) => request('/recuperacao/iniciar', { method: 'POST', body: { email } }),
    recoveryVerify: (email, code) => request('/recuperacao/verificar', { method: 'POST', body: { email, code } }),
    recoveryReset: (email, code, nova) => request('/recuperacao/redefinir', { method: 'POST', body: { email, code, nova } }),
    recovery: slot('hc:rec'),
    flash: slot('hc:flash'),
  };
})(window.HC = window.HC || {});
