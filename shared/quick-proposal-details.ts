import { z } from 'zod';
import { quickProposalSchema } from './mobile-contract';

const amount = z.number().finite().min(0).max(10_000_000);
const percent = z.number().finite().min(0).max(100);
// Versioned document snapshot: line order and historical prices belong to this proposal,
// not to current catalogue prices. Saved atomically with the existing mobile summary.
export const quickProposalDetailsSchema = z.object({
  version: z.literal(1),
  pricingMode: z.enum(['manual', 'items']),
  manualTotalCents: z.number().int().min(1).max(1_000_000_000),
  validUntil: quickProposalSchema.shape.proposalDate,
  notes: z.string().max(5000), pdfTitle: z.string().max(250),
  responsibleName: z.string().max(250), responsiblePosition: z.string().max(250),
  shippingIncluded: z.boolean(), invoicePercent: percent, tithePercent: percent,
  items: z.array(z.object({
    productId: z.string().uuid().nullable(), name: z.string().trim().min(1).max(500),
    unit: z.enum(['m²', 'un', 'm', 'serviço']).optional(),
    quantity: amount.positive(), unitCost: amount, unitPrice: amount,
  }).strict()).max(100),
  costs: z.array(z.object({
    costId: z.string().uuid().nullable(), name: z.string().trim().min(1).max(500),
    unitValue: amount, quantity: amount, calculationType: z.enum(['fixed','percentage']),
    percentageValue: percent, productId: z.string().uuid().nullable(),
    supplier: z.string().max(500), description: z.string().max(2000),
  }).strict()).max(100),
}).strict().superRefine((value, ctx) => {
  if(value.pricingMode === 'items' && !value.items.length) ctx.addIssue({code:'custom',path:['items'],message:'Adicione os itens antes de recalcular o valor.'});
  value.costs.forEach((cost,index) => {
    if(cost.productId && !value.items.some(item => item.productId === cost.productId)) ctx.addIssue({code:'custom',path:['costs',index,'productId'],message:'Selecione um produto da proposta ou custo geral.'});
  });
});
export type QuickProposalDetails = z.infer<typeof quickProposalDetailsSchema>;
const round = (value:number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function quickCostTotal(cost: QuickProposalDetails['costs'][number]) {
  return round(cost.unitValue * (cost.calculationType === 'percentage' ? cost.percentageValue / 100 : cost.quantity));
}
export function calculateQuickDetails(details: QuickProposalDetails, discountPercent:number) {
  const itemsSubtotal = round(details.items.reduce((sum,item) => sum + round(item.quantity * item.unitPrice),0));
  const discount = details.pricingMode === 'items' ? round(itemsSubtotal * discountPercent / 100) : 0;
  const total = details.pricingMode === 'manual' ? details.manualTotalCents / 100 : round(itemsSubtotal - discount);
  const totalCosts = round(details.items.reduce((sum,item) => sum + round(item.quantity * item.unitCost),0) + details.costs.reduce((sum,cost) => sum + quickCostTotal(cost),0));
  const invoiceAmount = round(total * details.invoicePercent / 100);
  const totalWithInvoice = round(totalCosts + invoiceAmount);
  const companyProfit = round(total - totalWithInvoice);
  const tithe = round(companyProfit * details.tithePercent / 100);
  return {subtotal:details.pricingMode === 'manual' ? total : itemsSubtotal,total,finalTotal:total,discount,
    totalCosts,totalWithoutInvoice:totalCosts,invoicePercent:details.invoicePercent,invoiceAmount,totalWithInvoice,
    companyProfit,profitPercent:total > 0 ? companyProfit / total * 100 : 0,tithe,netProfit:round(companyProfit-tithe)};
}
