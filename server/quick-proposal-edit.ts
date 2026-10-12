import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { EditableQuickProposal, QuickProposalEdit } from '../shared/quick-proposal-edit';
import { calculateQuickDetails } from '../shared/quick-proposal-details';

const projection = `id, quotation_number AS "quotationNumber", customer_snapshot AS customer,
  proposal_date AS date, freight, warranty, payment, discount_percent::float AS "discountPercent",
  total_cents AS "totalCents", web_details AS "webDetails", xmin::text AS "rowVersion"`;

function editable(row: any): EditableQuickProposal {
  const revision = createHash('sha256').update(JSON.stringify(row)).digest('hex');
  const { rowVersion: _version, ...data } = row;
  return { ...data, webDetails:data.webDetails || undefined, revision };
}

export async function getQuickProposal(client: PoolClient, id: string) {
  const result = await client.query(`SELECT ${projection} FROM mobile_quick_proposals WHERE id=$1`, [id]);
  return result.rows[0] ? editable(result.rows[0]) : null;
}

// Caller owns the transaction. Row lock + revision check prevents lost updates.
export async function editQuickProposal(client: PoolClient, id: string, input: QuickProposalEdit) {
  const result = await client.query(`SELECT ${projection} FROM mobile_quick_proposals WHERE id=$1 FOR UPDATE`, [id]);
  if (!result.rows[0]) return { kind: 'missing' } as const;
  if (editable(result.rows[0]).revision !== input.revision) return { kind: 'conflict' } as const;
  // An older browser cannot overwrite a proposal whose full details were already saved.
  if (result.rows[0].webDetails && !input.webDetails) return { kind: 'conflict' } as const;
  const totalCents = input.webDetails ? Math.round(calculateQuickDetails(input.webDetails,input.discountPercent).total * 100) : input.totalCents;
  if(totalCents < 1 || totalCents > 1_000_000_000) return { kind: 'invalid' } as const;
  const updated = await client.query(`UPDATE mobile_quick_proposals SET
    customer_snapshot=$2, proposal_date=$3, freight=$4, warranty=$5, payment=$6,
    discount_percent=$7, total_cents=$8, web_details=$9 WHERE id=$1 RETURNING ${projection}`,
  [id, input.customer, input.proposalDate, input.freight, input.warranty, input.payment, input.discountPercent, totalCents, input.webDetails || null]);
  // Never update client_id, payload_hash, number, customer master or create a second quotation.
  return { kind: 'updated', proposal: editable(updated.rows[0]) } as const;
}
