import { useState } from 'react';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateQuickProposalPDF, type QuickProposalRow } from '@/lib/pdf-generator';
import { formatCurrency } from '@/lib/calculations';

export function QuickProposalDialog({proposal,onClose}:{proposal:QuickProposalRow|null;onClose:()=>void}){
  const [,setLocation]=useLocation();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function download(){if(!proposal)return;setBusy(true);setError('');try{await generateQuickProposalPDF(proposal,'proposta-'+proposal.quotationNumber+'.pdf');}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível gerar o PDF.');}finally{setBusy(false);}}
  return <Dialog open={!!proposal} onOpenChange={open=>{if(!open){setError('');onClose();}}}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Proposta do aplicativo</DialogTitle><DialogDescription>Dados atuais da proposta, incluindo alterações salvas no sistema web.</DialogDescription></DialogHeader>{proposal&&<>
    <div className="flex justify-between items-center"><Badge>App</Badge><span className="text-sm text-slate-600">{proposal.quotationNumber} · {proposal.date.split('-').reverse().join('/')}</span></div>
    <div className="rounded-xl bg-green-50 p-5"><p className="text-sm text-green-800">Cliente</p><h2 className="text-2xl font-semibold break-words">{proposal.customer.name}</h2><p className="text-3xl font-bold text-green-900 mt-3">{formatCurrency(proposal.totalCents/100)}</p><p className="text-sm text-green-800 mt-1">Valor proposto · envio não significa aprovação</p></div>
    <dl className="grid sm:grid-cols-2 gap-4">{[['Contato',proposal.customer.contact],['Telefone',proposal.customer.phone],['CPF / CNPJ',proposal.customer.document],['Endereço',proposal.customer.address],['Frete',proposal.freight],['Garantia',proposal.warranty],['Pagamento',proposal.payment],['Desconto aplicado',proposal.discountPercent+'%']].map(([label,value])=><div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="font-medium whitespace-pre-wrap break-words">{value||'Não informado'}</dd></div>)}</dl>
    {proposal.webDetails ? <div className="border-t pt-4 space-y-2"><p className="text-sm text-slate-600">Detalhamento da proposta: {proposal.webDetails.items.length} produto(s) e {proposal.webDetails.costs.length} custo(s). Custos internos não aparecem no PDF comercial.</p>{proposal.webDetails.items.map((item,index)=><p key={index} className="text-sm">{item.name} · {item.quantity} {item.unit||'m²'} · {formatCurrency(item.unitPrice)}/{item.unit||'m²'}</p>)}</div> : <p className="text-sm text-slate-600 border-t pt-4">Esta proposta contém o resumo enviado pelo app. Abra a edição para complementar produtos, custos e condições no sistema.</p>}
    {error&&<p role="alert" className="text-red-700">{error}</p>}<div className="flex flex-wrap gap-3"><Button onClick={()=>{onClose();setLocation(`/orcamentos/novo?edit=${proposal.id}&source=app`);}}>Editar proposta</Button><Button variant="outline" disabled={busy} onClick={()=>void download()}>{busy?'Preparando…':proposal.webDetails?'Baixar PDF':'Baixar PDF do resumo'}</Button><Button variant="outline" onClick={onClose}>Fechar</Button></div>
  </>}</DialogContent></Dialog>;
}
