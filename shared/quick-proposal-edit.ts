import { z } from 'zod';
import { quickProposalSchema } from './mobile-contract';
import { quickProposalDetailsSchema } from './quick-proposal-details';

// The original mobile payload/hash remains the idempotency key, not the editable state.
export const quickProposalEditSchema = quickProposalSchema.omit({ clientId: true, items: true }).extend({
  revision: z.string().regex(/^[a-f0-9]{64}$/, 'Reabra a proposta antes de salvar.'),
  webDetails: quickProposalDetailsSchema.optional(),
}).strict();

export type QuickProposalEdit = z.infer<typeof quickProposalEditSchema>;
export type EditableQuickProposal = Omit<QuickProposalEdit, 'proposalDate'> & {
  id: string;
  quotationNumber: string;
  date: string;
};
