import { useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { quickProposalEditSchema, type EditableQuickProposal, type QuickProposalEdit } from '@shared/quick-proposal-edit';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const formSchema = quickProposalEditSchema.omit({ totalCents: true, discountPercent: true }).extend({
  total: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Informe o valor sem separador de milhar, com até 2 casas decimais.')
    .refine(value => Number(value.replace(',', '.')) > 0 && Number(value.replace(',', '.')) <= 10_000_000, 'Informe um valor entre R$ 0,01 e R$ 10.000.000,00.'),
  discount: z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Informe um percentual válido.').refine(value => Number(value.replace(',', '.')) <= 100, 'O desconto deve estar entre 0 e 100%.'),
});
type Values = z.infer<typeof formSchema>;

/** Summary variant of the existing quotation editor: no invented items, costs or profits. */
export function QuickProposalFields({ proposal, onSubmit, onCancel, isLoading }: {
  proposal: EditableQuickProposal; onSubmit: (data: QuickProposalEdit) => void; onCancel: () => void; isLoading: boolean;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(formSchema), mode: 'onBlur',
    defaultValues: {
      revision: proposal.revision, customer: {name:proposal.customer.name,contact:proposal.customer.contact || '',phone:proposal.customer.phone || '',document:proposal.customer.document || '',address:proposal.customer.address || ''},
      proposalDate: proposal.date, freight: proposal.freight, warranty: proposal.warranty, payment: proposal.payment,
      total: (proposal.totalCents / 100).toFixed(2).replace('.', ','), discount: String(proposal.discountPercent),
    },
  });
  const field = (name: FieldPath<Values>, label: string, type = 'text', maxLength = 250) => (
    <FormField key={name} control={form.control} name={name} render={({field}) => (
      <FormItem><FormLabel>{label}</FormLabel><FormControl>
        <Input {...field} value={typeof field.value === 'string' ? field.value : ''} type={type} maxLength={maxLength} />
      </FormControl><FormMessage /></FormItem>
    )} />
  );
  return <Form {...form}><form className="space-y-6" onSubmit={form.handleSubmit(values => {
    const { total, discount, ...data } = values;
    onSubmit(quickProposalEditSchema.parse({...data,totalCents:Math.round(Number(total.replace(',', '.')) * 100),discountPercent:Number(discount.replace(',', '.'))}));
  })}>
    <div className="rounded-lg border bg-green-50 p-4 space-y-2">
      <div className="flex items-center gap-3"><Badge>App</Badge><strong>{proposal.quotationNumber}</strong></div>
      <p className="text-sm">Edite os dados recebidos do aplicativo. O número e a origem serão mantidos.</p>
    </div>
    <fieldset disabled={isLoading} className="space-y-6">
      <section className="space-y-4"><h2 className="text-lg font-semibold">Dados do cliente</h2>
        <p className="text-sm text-muted-foreground">Estas informações pertencem a esta proposta. Alterá-las não modifica o cadastro geral do cliente nem outras propostas.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {field('customer.name', 'Nome do cliente')}{field('customer.contact', 'Contato')}
          {field('customer.phone', 'Telefone', 'tel', 40)}{field('customer.document', 'CPF / CNPJ', 'text', 30)}
          <div className="sm:col-span-2">{field('customer.address', 'Endereço', 'text', 1000)}</div>
        </div>
      </section>
      <section className="space-y-4"><h2 className="text-lg font-semibold">Condições da proposta</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {field('proposalDate', 'Data da proposta', 'date')}{field('payment', 'Condições de pagamento')}
          {field('freight', 'Frete')}{field('warranty', 'Garantia')}
        </div>
      </section>
      <section className="space-y-4"><h2 className="text-lg font-semibold">Resumo financeiro</h2>
        <p className="text-sm text-muted-foreground">O app enviou apenas o resumo. Os itens detalhados e os custos desta proposta não estão disponíveis no servidor.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {field('total', 'Valor final da proposta (R$)', 'text', 14)}{field('discount', 'Desconto já aplicado (%)', 'text', 6)}
        </div>
        <p className="text-sm text-muted-foreground">O valor final já inclui o desconto informado. Alterar o percentual não aplica um novo desconto automaticamente; confira e ajuste o valor final, se necessário.</p>
      </section>
    </fieldset>
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando…' : 'Salvar alterações'}</Button><Button type="button" variant="outline" disabled={isLoading} onClick={onCancel}>Cancelar</Button></div>
  </form></Form>;
}
