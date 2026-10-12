import { z } from 'zod';

const shortText = z.string().trim().max(250);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Data inválida');

export const quickProposalSchema = z.object({
  clientId: z.string().uuid(),
  customer: z.object({
    name: shortText.min(1), contact: shortText.default(''),
    phone: z.string().trim().max(40).default(''),
    document: z.string().trim().max(30).default(''),
    address: z.string().trim().max(1000).default(''),
  }).strict(),
  proposalDate: dateOnly,
  freight: shortText, warranty: shortText, payment: shortText,
  discountPercent: z.number().finite().min(0).max(100),
  totalCents: z.number().int().positive().max(1_000_000_000),
}).strict();

export type QuickProposalInput = z.infer<typeof quickProposalSchema>;
export const mobileLoginSchema = z.object({
  email: z.string().trim().email().max(250), password: z.string().min(1).max(500),
}).strict();
export const reportMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const reportRangeSchema = z.object({from:dateOnly,to:dateOnly}).strict().refine(value=>value.from<=value.to&&value.from>='2000-01-01'&&value.to<='2100-12-31','Período inválido (2000 a 2100)');
