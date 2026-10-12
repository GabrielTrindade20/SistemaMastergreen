import { pool } from './db';
import type { Pool } from 'pg';

export type ReportFilters = {dateFrom?:Date;dateTo?:Date;fromDay?:string;toDay?:string;city?:string;state?:string;responsibleId?:string;customerStatus?:string;customerId?:string;userId?:string;isAdmin?:boolean};
// Admin reports count each original once, preferring its calculated financial version.
// Status follows the selected version; date remains the original creation date.
// Employee reports retain the original amounts and are always scoped to their owner.
export async function loadReportRows(filters:ReportFilters, connection:Pick<Pool,'query'>=pool) {
  if(!filters.isAdmin&&!filters.userId)return [];
  const params:unknown[]=[!!filters.isAdmin,filters.userId||null];
  const conditions=['q.rank=1'];
  const where=(sql:string,value:unknown)=>{params.push(value);conditions.push(sql.replace('?',`$${params.length}`));};
  if(filters.dateFrom)where("q.business_created_at AT TIME ZONE 'UTC' >= ?::timestamptz",filters.dateFrom.toISOString());
  if(filters.dateTo)where("q.business_created_at AT TIME ZONE 'UTC' <= ?::timestamptz",filters.dateTo.toISOString());
  if(filters.fromDay)where("(q.business_created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date >= ?::date",filters.fromDay);
  if(filters.toDay)where("(q.business_created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date <= ?::date",filters.toDay);
  if(filters.city)where('c.city ILIKE ?',`%${filters.city}%`);
  if(filters.state)where('c.state ILIKE ?',`%${filters.state}%`);
  if(filters.responsibleId)where('coalesce(q.responsible_id,q.user_id)::text = ?',filters.responsibleId);
  if(filters.customerId)where('c.id::text = ?',filters.customerId);
  if(filters.customerStatus)where('c.customer_status = ?',filters.customerStatus);
  const result=await connection.query(`WITH ranked AS (
    SELECT q.*,coalesce(o.created_at,q.created_at) AS business_created_at,
      q.status AS business_status,
      row_number() OVER (PARTITION BY coalesce(nullif(q.original_quotation_id,''),q.id::text)
        ORDER BY coalesce(q.admin_calculated,0) DESC,q.created_at DESC,q.id) AS rank
    FROM quotations q LEFT JOIN quotations o ON o.id::text=q.original_quotation_id
    WHERE $1::boolean OR (coalesce(q.admin_calculated,0)=0 AND q.user_id::text=$2)
  ) SELECT q.id AS "quotationId",q.quotation_number AS "quotationNumber",q.business_status AS "quotationStatus",
    q.total::float AS "quotationTotal",q.net_profit::float AS "quotationNetProfit",q.total_costs::float AS "quotationCosts",
    (q.total_costs>0) AS "hasRecordedCosts",
    q.business_created_at AT TIME ZONE 'UTC' AS "quotationCreatedAt",
    to_char(q.business_created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS "businessDate",
    q.branch AS "quotationBranch",c.id AS "customerId",c.name AS "customerName",c.email AS "customerEmail",
    c.phone AS "customerPhone",c.city AS "customerCity",c.state AS "customerState",c.customer_status AS "customerStatus",
    c.lead_origin AS "customerLeadOrigin",c.created_at AT TIME ZONE 'UTC' AS "customerCreatedAt",
    u.id AS "responsibleId",u.name AS "responsibleName",u.branch AS "responsibleBranch",u.commission_percent AS "commissionPercent"
    FROM ranked q LEFT JOIN customers c ON c.id=q.customer_id
    LEFT JOIN users u ON u.id=coalesce(q.responsible_id,q.user_id)
    WHERE ${conditions.join(' AND ')} ORDER BY q.business_created_at DESC`,params);
  return result.rows;
}
