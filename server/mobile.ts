import { createHash, randomBytes } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import type { PoolClient } from 'pg';
import cors from 'cors';
import { pool } from './db';
import { storage } from './storage';
import { mobileLoginSchema, quickProposalSchema, reportMonthSchema, reportRangeSchema, type QuickProposalInput } from '../shared/mobile-contract';
import { loadReportRows } from './reporting';
import { previousPeriod, summarizeReports } from '../shared/report-metrics';
import { getCompanyProfile } from './company-profile';
import { quickProposalDetailsSchema } from '../shared/quick-proposal-details';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const ownerEmail = () => (process.env.MOBILE_OWNER_EMAIL || (process.env.NODE_ENV === 'development' ? 'admin@dev.mastergreen.local' : '')).toLowerCase();
const wrap = (handler: RequestHandler): RequestHandler => (req, res, next) => { Promise.resolve(handler(req, res, next)).catch(() => res.status(500).json({ message: 'Não foi possível concluir. Tente novamente.' })); };
const attempts = new Map<string, { count: number; until: number }>();
class MissingCustomerError extends Error {}

// A transação também protege a associação do cliente contra envios simultâneos.
export async function saveQuickProposal(client: PoolClient, userId: string, input: QuickProposalInput) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`mobile:${userId}`]);
  const payloadHash = hash(JSON.stringify(input));
  const { items, ...summary } = input;
  const details = items ? quickProposalDetailsSchema.parse({
    version:1, pricingMode:'manual', manualTotalCents:input.totalCents,
    validUntil:input.proposalDate, notes:'', pdfTitle:'Proposta comercial',
    responsibleName:'', responsiblePosition:'', shippingIncluded:input.freight.toLowerCase()==='incluso',
    invoicePercent:4.5, tithePercent:0,
    items:items.map(item=>({...item,unitCost:0})), costs:[],
  }) : null;
  const existing = await client.query('SELECT id, quotation_number AS "quotationNumber", payload_hash FROM mobile_quick_proposals WHERE user_id=$1 AND client_id=$2', [userId, input.clientId]);
  if (existing.rows[0]) {
    const row=existing.rows[0];
    const legacyEnrichment=!!items && row.payload_hash===hash(JSON.stringify(summary));
    if(legacyEnrichment) {
      // Only untouched legacy summaries can be enriched. Never overwrite a web edit,
      // original hash, identity or financial total, including on repeated retries.
      await client.query(`UPDATE mobile_quick_proposals SET web_details=$1 WHERE id=$2 AND web_details IS NULL
        AND customer_snapshot=$3::jsonb AND proposal_date=$4 AND freight=$5 AND warranty=$6 AND payment=$7
        AND discount_percent=$8 AND total_cents=$9`,[JSON.stringify(details),row.id,JSON.stringify(input.customer),input.proposalDate,input.freight,input.warranty,input.payment,input.discountPercent,input.totalCents]);
    }
    return {id:row.id,quotationNumber:row.quotationNumber,replayed:true,conflict:row.payload_hash!==payloadHash&&!legacyEnrichment};
  }
  const digits = (value: string) => value.replace(/\D/g, '');
  const document = digits(input.customer.document);
  const phone = digits(input.customer.phone);
  const selected = input.customerId ? await client.query('SELECT id FROM customers WHERE id=$1',[input.customerId]) : null;
  if(selected && !selected.rows[0]) throw new MissingCustomerError('Cliente selecionado não encontrado. Atualize os clientes e selecione novamente.');
  const match = selected || await client.query(`SELECT id FROM customers WHERE
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
    (client_id,user_id,customer_id,customer_snapshot,proposal_date,freight,warranty,payment,discount_percent,total_cents,payload_hash,web_details)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, quotation_number AS "quotationNumber"`,
  [input.clientId, userId, customerId, input.customer, input.proposalDate, input.freight, input.warranty, input.payment, input.discountPercent, input.totalCents, payloadHash,details?JSON.stringify(details):null]);
  return { id: result.rows[0].id, quotationNumber: result.rows[0].quotationNumber, replayed: false, conflict: false };
}

export async function getMobileData(month: string) {
  const [customers, products, quick, detailed, company, costs] = await Promise.all([
    pool.query(`SELECT id,name,phone,email,cpf_cnpj AS document,address,number,neighborhood,zip_code AS "zipCode",city,state FROM customers ORDER BY name`),
    pool.query(`SELECT id,name,category,description,price_per_m2 AS "pricePerM2" FROM products ORDER BY name`),
    pool.query(`SELECT id,quotation_number AS "quotationNumber",client_id AS "clientId", customer_snapshot AS customer, proposal_date AS date,
      freight,warranty,payment,discount_percent::float AS "discountPercent",total_cents AS "totalCents",web_details AS "webDetails",
      created_at AS "receivedAt",'mobile' AS source,'Enviada' AS status FROM mobile_quick_proposals ORDER BY proposal_date DESC,created_at DESC`),
    loadReportRows({isAdmin:true}),
    getCompanyProfile(),
    pool.query('SELECT id,name,description,value FROM costs ORDER BY name'),
  ]);
  const monthly = quick.rows.filter((row) => row.date.startsWith(month));
  const approved=detailed.filter(row=>row.businessDate.startsWith(month)&&row.quotationStatus==='approved');
  return { customers: customers.rows, products: products.rows, company, costs:costs.rows, quickProposals: quick.rows,
    history: [...quick.rows, ...detailed.map(row=>({id:row.quotationId,customer:{name:row.customerName||'Cliente'},date:row.businessDate,totalCents:Math.round(row.quotationTotal*100),source:'web',status:row.quotationStatus}))].sort((a,b) => b.date.localeCompare(a.date)),
    summary: { month, quickCount: monthly.length, quickTotalCents: monthly.reduce((sum, row) => sum + row.totalCents, 0),approvedCount:approved.length,approvedRevenue:approved.reduce((sum,row)=>sum+row.quotationTotal,0) },
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
  router.use(['/auth/logout','/data','/proposals','/summary'],wrap(async (req, res, next) => {
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
  router.get('/summary',wrap(async(req,res)=>{
    const parsed=reportRangeSchema.safeParse(req.query);
    if(!parsed.success){res.status(400).json({message:'Informe um período válido, com início e fim entre 2000 e 2100.'});return;}
    const {from,to}=parsed.data,previous=previousPeriod(from,to);
    const rows=await loadReportRows({isAdmin:true,fromDay:previous.from,toDay:to});
    const current=summarizeReports(rows,from,to),before=summarizeReports(rows,previous.from,previous.to);
    const quick=await pool.query('SELECT count(*)::int AS count,coalesce(sum(total_cents),0)::float AS "totalCents" FROM mobile_quick_proposals WHERE proposal_date >= $1 AND proposal_date <= $2',[from,to]);
    res.json({from,to,...current,quick:quick.rows[0],previous:{...previous,approvedCents:before.approvedCents,changePercent:before.approvedCents>0?Math.round((current.approvedCents-before.approvedCents)/before.approvedCents*1000)/10:null},updatedAt:new Date().toISOString()});
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
      res.status(result.replayed ? 200 : 201).json({ id: result.id, quotationNumber: result.quotationNumber, clientId: input.data.clientId, replayed: result.replayed });
    } catch (error) { await client.query('ROLLBACK');
      if(error instanceof MissingCustomerError){res.status(400).json({message:error.message});return;}
      throw error;
    } finally { client.release(); }
  }));
  return router;
}
