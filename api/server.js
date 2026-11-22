'use strict';
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const path = require('node:path');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const pool = require('./db');

const SECRET = process.env.SESSION_SECRET || '';
if (SECRET.length < 32 || SECRET.includes('COLOQUE_AQUI')) throw new Error('Gere uma chave aleatória e configure SESSION_SECRET com pelo menos 32 caracteres no .env');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '30kb' }));
app.use(cookieParser());
const originGuard = (req, res, next) => {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ erro: 'Origem da requisição não permitida.' });
  if (req.method !== 'DELETE' && !req.is('application/json')) return res.status(415).json({ erro: 'Envie JSON (Content-Type: application/json).' });
  next();
};
app.use('/api', originGuard);
const limit = (max, windowMs = 15 * 60 * 1000) => rateLimit({ windowMs, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, message: { erro: 'Muitas tentativas. Aguarde e tente novamente.' } });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (res, status, erro) => res.status(status).json({ erro });
const COOKIE = 'hc_session';
const cookieConfig = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 8 * 60 * 60 * 1000 };
const BLOOD = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
const SLOTS = new Set(['08:00', '09:30', '11:00', '14:00', '15:30']);
const SQL_USER = `id, perfil, ativo, nome, documento AS doc, telefone AS tel, email, tipo_sanguineo AS tipo,
  to_char(ultima_doacao, 'YYYY-MM-DD') AS ultima, ultima_info AS "ultimaInfo",
  aviso_whatsapp AS whats, aviso_email AS "avisoEmail", aviso_sms AS sms`;
const adaptUser = (u) => u && ({
  id: u.id, perfil: u.perfil, ativo: u.ativo, nome: u.nome, doc: u.doc,
  tel: u.tel, email: u.email || '', tipo: u.tipo, ultima: u.ultima, ultimaInfo: u.ultimaInfo,
  canais: { whats: u.whats, email: u.avisoEmail, sms: u.sms }
});
const isoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().startsWith(v);
const digits = (v) => String(v || '').replace(/\D/g, '');
const validPassword = (s) => typeof s === 'string' && s.length >= 8 && s.length <= 72 && /[A-Za-z]/.test(s) && /\d/.test(s);
const today = () => new Date().toLocaleDateString('sv', { timeZone: 'America/Fortaleza' });
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

app.use('/api', wrap(async (req, _res, next) => {
  req.auth = null;
  const token = req.cookies[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
      const { rows } = await pool.query(`SELECT ${SQL_USER} FROM usuarios WHERE id = $1 AND ativo`, [payload.sub]);
      req.auth = adaptUser(rows[0]);
    } catch (_) { /* sessão ausente, expirada ou revogada */ }
  }
  next();
}));
const auth = (req, res, next) => req.auth ? next() : fail(res, 401, 'Entre na sua conta para continuar.');
const manager = (req, res, next) => req.auth?.perfil === 'gerente' ? next() : fail(res, 403, 'Acesso restrito ao gerente.');

app.get('/api/saude', wrap(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, banco: 'conectado' });
}));

app.get('/api/bootstrap', wrap(async (req, res) => {
  if (!req.auth) return res.json({ current: null, users: [], alerts: [], stock: {}, appts: [] });
  const gerente = req.auth.perfil === 'gerente';
  const [users, alerts, stock, appts, destinations] = await Promise.all([
    gerente ? pool.query(`SELECT ${SQL_USER} FROM usuarios ORDER BY nome`) : Promise.resolve({ rows: [] }),
    pool.query(`SELECT id, tipo_sanguineo AS tipo, urgencia AS nivel, bolsas_necessarias AS faltam,
               to_char(prazo, 'YYYY-MM-DD') AS prazo, status, to_char(criado_em, 'YYYY-MM-DD') AS "criadoEm"
               FROM alertas ORDER BY criado_em DESC`),
    pool.query('SELECT tipo_sanguineo AS tipo, nivel FROM estoque'),
    gerente ? pool.query(`SELECT id, usuario_id AS "userId", alerta_id AS "alertId", to_char(data_agendada, 'YYYY-MM-DD') AS data,
                  to_char(hora_agendada, 'HH24:MI') AS hora, status FROM agendamentos ORDER BY data_agendada DESC`)
      : pool.query(`SELECT id, usuario_id AS "userId", alerta_id AS "alertId", to_char(data_agendada, 'YYYY-MM-DD') AS data,
                  to_char(hora_agendada, 'HH24:MI') AS hora, status FROM agendamentos WHERE usuario_id = $1 ORDER BY data_agendada DESC`, [req.auth.id]),
    gerente ? pool.query('SELECT alerta_id AS aid, usuario_id AS uid FROM alerta_destinatarios') : Promise.resolve({ rows: [] }),
  ]);
  const stockNames = { estavel: 'Estável', alerta: 'Alerta', critico: 'Crítico' };
  const apptNames = { agendada: 'Agendada', cancelada: 'Cancelada', concluida: 'Concluída' };
  const destByAlert = new Map();
  for (const row of destinations.rows) { const arr = destByAlert.get(row.aid) || []; arr.push(row.uid); destByAlert.set(row.aid, arr); }
  res.json({
    current: req.auth, users: gerente ? users.rows.map(adaptUser) : [req.auth],
    alerts: alerts.rows.map((a) => ({ ...a, destinatarios: gerente ? (destByAlert.get(a.id) || []) : null })),
    stock: Object.fromEntries(stock.rows.map((s) => [s.tipo, stockNames[s.nivel]])),
    appts: appts.rows.map((a) => ({ ...a, status: apptNames[a.status] || a.status }))
  });
}));

app.post('/api/auth/login', limit(10), wrap(async (req, res) => {
  const doc = digits(req.body?.doc), senha = req.body?.senha;
  if (!doc || typeof senha !== 'string') return fail(res, 400, 'Informe documento e senha.');
  const { rows } = await pool.query('SELECT id, senha_hash, ativo FROM usuarios WHERE documento = $1', [doc]);
  const row = rows[0];
  const valid = row ? await bcrypt.compare(senha, row.senha_hash) : false;
  if (!valid) return fail(res, 401, 'CPF/RG ou senha incorretos.');
  if (!row.ativo) return fail(res, 403, 'Conta inativa. Procure o hemocentro.');
  res.cookie(COOKIE, jwt.sign({ sub: row.id }, SECRET, { algorithm: 'HS256', expiresIn: '8h' }), cookieConfig);
  res.json({ ok: true });
}));
app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE, { path: '/', sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.json({ ok: true });
});

app.post('/api/usuarios', limit(40, 60 * 60 * 1000), wrap(async (req, res) => {
  const d = req.body || {}, doc = digits(d.doc), tel = digits(d.tel), email = (d.email || '').trim().toLowerCase();
  if (req.auth && req.auth.perfil !== 'gerente') return fail(res, 403, 'Doadores não podem cadastrar outras contas.');
  if (typeof d.nome !== 'string' || d.nome.trim().length < 3 || d.nome.length > 100 ||
    !/^\d{7,11}$/.test(doc) || !/^[1-9]{2}\d{8,9}$/.test(tel) || !BLOOD.has(d.tipo) ||
    (email && (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) || email.length > 120)) ||
    !validPassword(d.senha) || (d.ultima && !isoDate(d.ultima)) ||
    (d.ultima && d.ultima > today()) || (d.ultimaInfo && !['nunca', 'desconhecida'].includes(d.ultimaInfo)) ||
    (!!d.ultima && !!d.ultimaInfo) || (!d.ultima && !d.ultimaInfo)) return fail(res, 400, 'Confira os dados de cadastro.');
  const hash = await bcrypt.hash(d.senha, 12);
  const { rows } = await pool.query(`INSERT INTO usuarios
    (nome, documento, telefone, email, tipo_sanguineo, ultima_doacao, ultima_info, senha_hash, aviso_email)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${SQL_USER}`,
    [d.nome.trim(), doc, tel, email || null, d.tipo, d.ultima || null, d.ultimaInfo || null, hash, !!email]);
  res.status(201).json({ user: adaptUser(rows[0]) });
}));

app.patch('/api/usuarios/:id', auth, wrap(async (req, res) => {
  const d = req.body || {}, gerente = req.auth.perfil === 'gerente', id = req.params.id;
  if (!gerente && id !== req.auth.id) return fail(res, 403, 'Você só pode alterar seus próprios dados.');
  const permitted = new Set(['nome', 'tel', 'email', 'tipo', 'canais', ...(gerente ? ['ativo', 'ultima', 'ultimaInfo'] : [])]);
  const keys = Object.keys(d);
  if (!keys.length || keys.some((k) => !permitted.has(k))) return fail(res, 400, 'Alteração não permitida.');
  if (gerente && (keys.includes('ativo') || keys.includes('ultima') || keys.includes('ultimaInfo'))) {
    const r = await pool.query('SELECT perfil FROM usuarios WHERE id=$1', [id]);
    if (!r.rows.length || r.rows[0].perfil !== 'doador') return fail(res, 403, 'Esta alteração só é permitida para doadores.');
  }
  const set = [], vals = [];
  const add = (col, value) => { vals.push(value); set.push(`${col}=$${vals.length}`); };
  if ('nome' in d) { if (typeof d.nome !== 'string' || d.nome.trim().length < 3 || d.nome.length > 100) return fail(res, 400, 'Nome inválido.'); add('nome', d.nome.trim()); }
  if ('tel' in d) { const tel = digits(d.tel); if (!/^[1-9]{2}\d{8,9}$/.test(tel)) return fail(res, 400, 'Telefone inválido.'); add('telefone', tel); }
  if ('email' in d) { const e = (d.email || '').trim().toLowerCase(); if (e && (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e) || e.length > 120)) return fail(res, 400, 'E-mail inválido.'); add('email', e || null); }
  if ('tipo' in d) { if (!BLOOD.has(d.tipo)) return fail(res, 400, 'Tipo sanguíneo inválido.'); add('tipo_sanguineo', d.tipo); }
  if ('ativo' in d) { if (typeof d.ativo !== 'boolean') return fail(res, 400, 'Situação inválida.'); add('ativo', d.ativo); }
  if ('ultima' in d) { if (d.ultima !== null && (!isoDate(d.ultima) || d.ultima > today())) return fail(res, 400, 'Data inválida.'); add('ultima_doacao', d.ultima); }
  if ('ultimaInfo' in d) { if (d.ultimaInfo !== null && !['nunca', 'desconhecida'].includes(d.ultimaInfo)) return fail(res, 400, 'Informação inválida.'); add('ultima_info', d.ultimaInfo); }
  if ('canais' in d) {
    const c = d.canais;
    if (!c || ['whats', 'email', 'sms'].some((k) => typeof c[k] !== 'boolean')) return fail(res, 400, 'Canais inválidos.');
    add('aviso_whatsapp', c.whats); add('aviso_email', c.email); add('aviso_sms', c.sms);
  }
  vals.push(id);
  const { rows } = await pool.query(`UPDATE usuarios SET ${set.join(',')} WHERE id=$${vals.length} RETURNING ${SQL_USER}`, vals);
  if (!rows.length) return fail(res, 404, 'Usuário não encontrado.');
  res.json({ user: adaptUser(rows[0]) });
}));

app.delete('/api/usuarios/:id', auth, manager, wrap(async (req, res) => {
  if (req.params.id === req.auth.id) return fail(res, 400, 'Não é possível excluir sua própria conta.');
  const { rowCount } = await pool.query(`DELETE FROM usuarios WHERE id=$1 AND perfil='doador'`, [req.params.id]);
  if (!rowCount) return fail(res, 404, 'Doador não encontrado.');
  res.json({ ok: true });
}));

app.post('/api/auth/change-password', auth, limit(10), wrap(async (req, res) => {
  const atual = req.body?.atual, nova = req.body?.nova;
  if (typeof atual !== 'string' || !validPassword(nova) || atual === nova) return fail(res, 400, 'Informe uma nova senha válida e diferente da atual.');
  const { rows } = await pool.query('SELECT senha_hash FROM usuarios WHERE id=$1', [req.auth.id]);
  if (!rows.length || !(await bcrypt.compare(atual, rows[0].senha_hash))) return fail(res, 401, 'Senha atual incorreta.');
  await pool.query('UPDATE usuarios SET senha_hash=$1 WHERE id=$2', [await bcrypt.hash(nova, 12), req.auth.id]);
  res.json({ ok: true });
}));

app.patch('/api/estoque/:tipo', auth, manager, wrap(async (req, res) => {
  const t = req.params.tipo, level = { 'Estável': 'estavel', 'Alerta': 'alerta', 'Crítico': 'critico' }[req.body?.nivel];
  if (!BLOOD.has(t) || !level) return fail(res, 400, 'Tipo ou nível inválido.');
  const { rowCount } = await pool.query('UPDATE estoque SET nivel=$1, atualizado_por=$2 WHERE tipo_sanguineo=$3', [level, req.auth.id, t]);
  if (!rowCount) return fail(res, 404, 'Tipo não encontrado no estoque.');
  res.json({ ok: true });
}));

app.post('/api/alertas', auth, manager, wrap(async (req, res) => {
  const a = req.body || {};
  if (!BLOOD.has(a.tipo) || !['urgente', 'moderado'].includes(a.nivel) || !Number.isInteger(a.faltam) ||
    a.faltam < 1 || a.faltam > 500 || !isoDate(a.prazo) || a.prazo < today() || a.prazo > addDays(today(), 30))
    return fail(res, 400, 'Confira os dados do alerta.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`INSERT INTO alertas (tipo_sanguineo, urgencia, bolsas_necessarias, prazo, criado_por)
      VALUES ($1,$2,$3,$4,$5) RETURNING id`, [a.tipo, a.nivel, a.faltam, a.prazo, req.auth.id]);
    const id = rows[0].id;
    await client.query(`INSERT INTO alerta_destinatarios (alerta_id, usuario_id)
      SELECT $1, u.id FROM usuarios u JOIN compatibilidade_sanguinea c
      ON c.tipo_doador = u.tipo_sanguineo WHERE c.tipo_receptor=$2
      AND u.perfil='doador' AND u.ativo
      AND ((u.ultima_doacao IS NULL AND u.ultima_info IS DISTINCT FROM 'desconhecida')
      OR u.ultima_doacao <= CURRENT_DATE - 60)`, [id, a.tipo]);
    await client.query('COMMIT');
    res.status(201).json({ id });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}));

app.patch('/api/alertas/:id/encerrar', auth, manager, wrap(async (req, res) => {
  const { rowCount } = await pool.query(`UPDATE alertas SET status='encerrado' WHERE id=$1`, [req.params.id]);
  if (!rowCount) return fail(res, 404, 'Alerta não encontrado.');
  res.json({ ok: true });
}));

app.post('/api/agendamentos', auth, wrap(async (req, res) => {
  if (req.auth.perfil !== 'doador') return fail(res, 403, 'Apenas doadores podem agendar.');
  const a = req.body || {};
  if (typeof a.alertId !== 'string' || !isoDate(a.data) || !SLOTS.has(a.hora)) return fail(res, 400, 'Data ou horário inválido.');
  const { rows: eligible } = await pool.query(`SELECT a.id FROM alertas a
      JOIN compatibilidade_sanguinea c ON a.tipo_sanguineo=c.tipo_receptor
      JOIN usuarios u ON u.tipo_sanguineo=c.tipo_doador
      WHERE a.id=$1 AND a.status='ativo' AND a.prazo >= CURRENT_DATE
      AND $2::date BETWEEN CURRENT_DATE AND a.prazo
      AND u.id=$3 AND u.perfil='doador' AND u.ativo
      AND ((u.ultima_doacao IS NULL AND u.ultima_info IS DISTINCT FROM 'desconhecida')
      OR u.ultima_doacao <= CURRENT_DATE - 60)`, [a.alertId, a.data, req.auth.id]);
  if (!eligible.length) return fail(res, 403, 'Você não está apto para agendar este alerta.');
  const { rows } = await pool.query(`INSERT INTO agendamentos (usuario_id, alerta_id, data_agendada, hora_agendada)
    VALUES ($1,$2,$3,$4) RETURNING id`, [req.auth.id, a.alertId, a.data, a.hora]);
  res.status(201).json({ id: rows[0].id });
}));

app.patch('/api/agendamentos/:id/cancelar', auth, wrap(async (req, res) => {
  const { rowCount } = await pool.query(`UPDATE agendamentos SET status='cancelada' WHERE id=$1 AND usuario_id=$2 AND status='agendada'`, [req.params.id, req.auth.id]);
  if (!rowCount) return fail(res, 404, 'Agendamento ativo não encontrado.');
  res.json({ ok: true });
}));

// Recuperação: 5 dígitos, expira após 10 minutos; sem SMTP usa o terminal SOMENTE em desenvolvimento local.
const smtpReady = !!(process.env.SMTP_HOST && process.env.SMTP_FROM);
const mailer = smtpReady ? nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
}) : null;

app.post('/api/recuperacao/iniciar', limit(5, 60 * 60 * 1000), wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return fail(res, 400, 'E-mail inválido.');
  if (!smtpReady && process.env.NODE_ENV === 'production') return fail(res, 503, 'Recuperação temporariamente indisponível.');
  const { rows } = await pool.query('SELECT id FROM usuarios WHERE lower(email)=$1 AND ativo', [email]);
  if (rows.length) {
    const code = String(crypto.randomInt(10000, 100000));
    await pool.query(`INSERT INTO recuperacoes_senha (usuario_id,codigo_hash,expira_em)
      VALUES ($1,$2,now()+interval '10 minutes')`, [rows[0].id, await bcrypt.hash(code, 10)]);
    if (mailer) {
      await mailer.sendMail({
        from: process.env.SMTP_FROM, to: email, subject: 'Código de recuperação - Alerta Hemocentro',
        text: `Seu código é ${code}. Ele expira em 10 minutos. Se você não solicitou a recuperação, ignore este e-mail.`
      });
    } else {
      console.log(`[DESENVOLVIMENTO] Código de recuperação para ${email}: ${code}`);
    }
  }
  res.json({ ok: true }); // Não revela se o e-mail existe.
}));

const recoveryQuery = `SELECT r.id, r.codigo_hash, r.tentativas, r.verificado_em
   FROM recuperacoes_senha r JOIN usuarios u ON u.id=r.usuario_id
   WHERE lower(u.email)=$1 AND r.usado_em IS NULL AND r.expira_em>now()
   ORDER BY r.criado_em DESC LIMIT 1 FOR UPDATE OF r`;
async function verifyRecovery(email, code, setVerified) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(recoveryQuery, [email]);
    const r = rows[0];
    if (!r || r.tentativas >= 5) { await client.query('ROLLBACK'); return false; }
    const correct = await bcrypt.compare(code, r.codigo_hash);
    if (!correct) {
      await client.query('UPDATE recuperacoes_senha SET tentativas=tentativas+1 WHERE id=$1', [r.id]);
      await client.query('COMMIT'); return false;
    }
    if (setVerified) await client.query('UPDATE recuperacoes_senha SET verificado_em=now() WHERE id=$1', [r.id]);
    await client.query('COMMIT');
    return { id: r.id, verified: !!r.verificado_em || setVerified };
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}
app.post('/api/recuperacao/verificar', limit(10), wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase(), code = String(req.body?.code || '');
  if (!/^\d{5}$/.test(code) || !await verifyRecovery(email, code, true)) return fail(res, 400, 'Código inválido ou expirado.');
  res.json({ ok: true });
}));
app.post('/api/recuperacao/redefinir', limit(10), wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase(), code = String(req.body?.code || '');
  if (!validPassword(req.body?.nova) || !/^\d{5}$/.test(code)) return fail(res, 400, 'Código ou senha inválida.');
  const result = await verifyRecovery(email, code, false);
  if (!result || !result.verified) return fail(res, 400, 'Código inválido, expirado ou não verificado.');
  // Atualização na mesma transação, impedindo reutilização em solicitações simultâneas.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT r.id FROM recuperacoes_senha r JOIN usuarios u ON u.id=r.usuario_id
      WHERE r.id=$1 AND lower(u.email)=$2 AND r.usado_em IS NULL AND r.verificado_em IS NOT NULL
      AND r.expira_em>now() FOR UPDATE OF r`, [result.id, email]);
    if (!rows.length) { await client.query('ROLLBACK'); return fail(res, 400, 'Código expirado ou já usado.'); }
    await client.query('UPDATE usuarios SET senha_hash=$1 WHERE id=(SELECT usuario_id FROM recuperacoes_senha WHERE id=$2)', [await bcrypt.hash(req.body.nova, 12), result.id]);
    await client.query('UPDATE recuperacoes_senha SET usado_em=now() WHERE id=$1', [result.id]);
    await client.query('COMMIT'); res.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}));

const root = path.resolve(__dirname, '..');
// Sirva apenas os arquivos públicos do front, nunca os códigos da API nem .env.
app.get(['/', '/index.html'], (_req, res) => res.sendFile(path.join(root, 'index.html')));
app.use('/css', express.static(path.join(root, 'css'), { dotfiles: 'deny' }));
app.use('/js', express.static(path.join(root, 'js'), { dotfiles: 'deny' }));
app.use('/api', (_req, res) => fail(res, 404, 'Rota não encontrada.'));
app.use((err, _req, res, _next) => {
  if (err.code === '23505') return fail(res, 409, 'Registro já existente (documento, e-mail ou agendamento).');
  if (err.code === '23P01') return fail(res, 409, 'Você já possui um agendamento ativo dentro do intervalo mínimo de 60 dias. Escolha uma data posterior.');
  if (err.code === '23503') return fail(res, 409, 'Registro relacionado não encontrado.');
  if (err.code === '23514' || err.code === '22P02' || err.code === '22001') return fail(res, 400, 'Dados inválidos para o banco.');
  console.error('[API]', err);
  fail(res, 500, 'Ocorreu um erro no servidor. Confira o terminal.');
});
const port = Number(process.env.PORT || 3000);
if (require.main === module) {
  app.listen(port, '0.0.0.0', () => console.log(`Alerta Hemocentro: http://localhost:${port} | Teste: http://localhost:${port}/api/saude`));
}
module.exports = app;
