// Compatibility entry point: all proposal exports use the same configured template.
import type { QuotationWithDetails } from '@shared/schema';
import { generateProposalPDF as generate } from './pdf-generator';
export async function generateProposalPDF(quotation:QuotationWithDetails,fileName?:string):Promise<void>{
  await generate(quotation,fileName||`proposta-${quotation.quotationNumber}.pdf`);
}
