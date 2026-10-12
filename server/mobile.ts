import { createHash, randomBytes } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import type { PoolClient } from 'pg';
import cors from 'cors';
import { pool } from './db';
import { storage } from './storage';
import { mobileLoginSchema, quickProposalSchema, reportMonthSchema, type QuickProposalInput } from '../shared/mobile-contract';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const ownerEmail = () => (process.env.MOBILE_OWNER_EMAIL || (process.env.NODE_ENV === 'development' ? 'admin@dev.mastergreen.local' : '')).toLowerCase();
const wrap = (handler: RequestHandler): RequestHandler => (req, res, next) => { Promise.resolve(handler(req, res, next)).catch(() => res.status(500).json({ message: 'Não foi possível concluir. Tente novamente.' })); };
const attempts = new Map<string, { count: number; until: number }>();

// A transação também protege a associação do cliente contra envios simultâneos.
export async function saveQuickProposal(client: PoolClient, userId: string, input: QuickProposalInput) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`mobile:${userId}`]);
  const payloadHash = hash(JSON.stringify(input));
  const existing = await client.query('SELECT id, payload_hash FROM mobile_quick_proposals WHERE user_id=$1 AND client_id=$2', [userId, input.clientId]);
  if (existing.rows[0]) return { id: existing.rows[0].id, replayed: true, conflict: existing.rows[0].payload_hash !== payloadHash };
  const digits = (value: string) => value.replace(/\D/g, '');
  const document = digits(input.customer.document);
  const phone = digits(input.customer.phone);
  const match = await client.query(`SELECT id FROM customers WHERE
    ($1 <> '' AND regexp_replace(coalesce(cpf_cnpj,''), '[^0-9]', '', 'g')=$1) OR
    ($2 <> '' AND regexp_replace(phone, '[^0-9]', '', 'g')=$2 AND lower(trim(name))=lower(trim($3)))
    ORDER BY created_at LIMIT 1`, [document, phone, input.customer.name]);
  let customerId = match.rows[0]?.id;
  if (!customerId) {
    const customer = await client.query(`INSERT INTO customers (name,phone,city,cpf_cnpj,address,created_by_id)
      VALUES ($1,$2,'',$3,$4,$5) RETURNING id`, [input.customer.name, input.customer.phone, input.customer.document, input.customer.address, userId]);
    customerId = customer.rows[0].id;
  }
  const result = await client.query(`INSERT INTO mobile_quick_proposals
    (client_id,user_id,customer_id,customer_snapshot,proposal_date,freight,warranty,payment,discount_percent,total_cents,payload_hash)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
  [input.clientId, userId, customerId, input.customer, input.proposalDate, input.freight, input.warranty, input.payment, input.discountPercent, input.totalCents, payloadHash]);
  return { id: result.rows[0].id, replayed: false, conflict: false };
}

export async function getMobileData(month: string) {
  const [customers, products, quick, detailed, summary] = await Promise.all([
    pool.query(`SELECT id,name,phone,email,cpf_cnpj AS document,address,city,state FROM customers ORDER BY name`),
    pool.query(`SELECT id,name,category,description,price_per_m2 AS "pricePerM2" FROM products ORDER BY name`),
    pool.query(`SELECT id,client_id AS "clientId", customer_snapshot AS customer, proposal_date AS date,
      freight,warranty,payment,discount_percent::float AS "discountPercent",total_cents AS "totalCents",
      created_at AS "receivedAt",'mobile' AS source,'Enviada' AS status FROM mobile_quick_proposals ORDER BY proposal_date DESC,created_at DESC`),
    pool.query(`SELECT q.id,json_build_object('name',c.name) AS customer,to_char(q.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS date,
      round(q.total*100)::bigint::float AS "totalCents",'web' AS source,q.status
      FROM quotations q JOIN customers c ON c.id=q.customer_id WHERE coalesce(q.admin_calculated,0)=0 ORDER BY q.created_at DESC`),
    pool.query(`SELECT count(*)::int AS "approvedCount",coalesce(sum(total),0)::float AS "approvedRevenue"
      FROM quotations WHERE status='approved' AND coalesce(admin_calculated,0)=0 AND to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo','YYYY-MM')=$1`, [month]),
  ]);
  const monthly = quick.rows.filter((row) => row.date.startsWith(month));
  return { customers: customers.rows, products: products.rows, quickProposals: quick.rows,
    history: [...quick.rows, ...detailed.rows].sort((a,b) => b.date.localeCompare(a.date)),
    summary: { month, quickCount: monthly.length, quickTotalCents: monthly.reduce((sum, row) => sum + row.totalCents, 0), ...summary.rows[0] },
    updatedAt: new Date().toISOString() };
}

export function createMobileRouter() {
  const router = Router();
  router.use(cors({ origin(origin, callback) {
    const allowed=(process.env.MOBILE_WEB_ORIGINS||'').split(',').filter(Boolean);
    const dev=process.env.NODE_ENV==='development'&&!!origin&&/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}):8081$/.test(origin);
    callback(null,!origin||dev||allowed.includes(origin));
  },methods:['GET','POST','OPTIONS'],allowedHeaders:['Content-Type','Authorization'] }));
  router.post('/auth/login', wrap(async (req, res) => {
    const parsed = mobileLoginSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Informe e-mail e senha válidos.' }); return; }
    const now = Date.now();
    attempts.forEach((value,key) => { if (value.until < now) attempts.delete(key); });
    const key = req.ip || 'unknown';
    const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
    if (attempt.count >= 10 || attempts.size > 10000) { res.status(429).json({ message: 'Muitas tentativas. Aguarde 15 minutos.' }); return; }
    attempt.count++; attempts.set(key, attempt);
    const user = await storage.authenticateUser(parsed.data.email, parsed.data.password);
    if (!user || user.type !== 'admin' || user.email.toLowerCase() !== ownerEmail()) { res.status(401).json({ message: 'E-mail ou senha inválidos para o aplicativo.' }); return; }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(now + 30 * 24 * 60 * 60_000).toISOString();
    await pool.query('INSERT INTO mobile_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [hash(token), user.id, expiresAt]);
    attempts.delete(key);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ token, expiresAt, user: { id: user.id, name: user.name, email: user.email } });
  }));
  router.use(['/auth/logout','/data','/proposals'],wrap(async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) { res.status(401).json({ message: 'Entre novamente para sincronizar.' }); return; }
    const result = await pool.query(`SELECT u.id FROM mobile_sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>now() AND u.type='admin' AND lower(u.email)=$2`, [hash(token), ownerEmail()]);
    if (!result.rows[0]) { res.status(401).json({ message: 'Sessão encerrada. Entre novamente para sincronizar.' }); return; }
    res.locals.mobileUserId = result.rows[0].id;
    res.locals.mobileTokenHash = hash(token);
    res.setHeader('Cache-Control', 'no-store');
    next();
  }));
  router.post('/auth/logout', wrap(async (_req, res) => {
    await pool.query('UPDATE mobile_sessions SET expires_at=now() WHERE token_hash=$1', [res.locals.mobileTokenHash]);
    res.json({ ok: true });
  }));
  router.get('/data', wrap(async (req,res) => {
    const month = reportMonthSchema.safeParse(req.query.month || new Date().toISOString().slice(0,7));
    if (!month.success) { res.status(400).json({ message: 'Mês inválido.' }); return; }
    res.json(await getMobileData(month.data));
  }));
  router.post('/proposals', wrap(async (req,res) => {
    const input = quickProposalSchema.safeParse(req.body);
    if (!input.success) { res.status(400).json({ message: 'Confira os dados da proposta.', errors: input.error.flatten() }); return; }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await saveQuickProposal(client, res.locals.mobileUserId, input.data);
      if (result.conflict) { await client.query('ROLLBACK'); res.status(409).json({ message: 'Este identificador já foi enviado com outros dados.' }); return; }
      await client.query('COMMIT');
      res.status(result.replayed ? 200 : 201).json({ id: result.id, clientId: input.data.clientId, replayed: result.replayed });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }));
  return router;
}
