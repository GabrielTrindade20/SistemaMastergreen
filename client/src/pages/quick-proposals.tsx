import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type QuickData = {
  quickProposals: { id: string; customer: { name: string; phone: string }; date: string; totalCents: number; freight: string; warranty: string; payment: string; discountPercent: number }[];
  summary: { month: string; quickCount: number; quickTotalCents: number };
};
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function QuickProposals() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState('');
  const query = useQuery<QuickData>({ queryKey: [`/api/quick-proposals?month=${month}`],staleTime:30000,refetchInterval:30000,refetchOnWindowFocus:true });
  const rows = (query.data?.quickProposals || []).filter(row => row.date.startsWith(month) && `${row.customer.name} ${row.customer.phone}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
    <header className="space-y-2 pr-12"><h1 className="text-3xl font-bold text-[#002b17]">Propostas do aplicativo</h1>
      <p className="text-gray-600">Propostas rápidas enviadas pelo celular. O valor é preservado, sem recálculo, produtos ou custos.</p></header>
    <div className="flex flex-wrap gap-4 items-end">
      <label className="space-y-1">Mês<Input aria-label="Mês das propostas" type="month" value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }} /></label>
      <label className="space-y-1 flex-1 min-w-48">Buscar cliente<Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou telefone" /></label>
      <Button onClick={() => void query.refetch()} disabled={query.isFetching}>Atualizar</Button>
    </div>
    {query.isLoading ? <p role="status">Carregando propostas…</p> : query.isError ? <p role="alert">Não foi possível carregar. Verifique a conexão e tente atualizar.</p> : <>
      <Card><CardHeader><CardTitle>Resumo do mês</CardTitle></CardHeader><CardContent className="space-y-2">
        <p className="text-2xl font-bold">{money(query.data?.summary.quickTotalCents || 0)}</p>
        <p>{query.data?.summary.quickCount || 0} propostas enviadas — não representa vendas aprovadas.</p>
        <p className="text-sm text-gray-600">Custos e lucro: não informados. Esses valores não entram nos indicadores financeiros das propostas detalhadas.</p>
      </CardContent></Card>
      {!rows.length && <p>Nenhuma proposta encontrada neste período.</p>}
      <div className="grid lg:grid-cols-2 gap-4">{rows.map(row => <Card key={row.id}><CardHeader><CardTitle role="heading" aria-level={2}>{row.customer.name}</CardTitle></CardHeader><CardContent className="space-y-2">
        <p>{row.date.split('-').reverse().join('/')} · Enviada pelo app</p><p className="text-2xl font-bold">{money(row.totalCents)}</p>
        <p>Telefone: {row.customer.phone || 'Não informado'}</p>
        <p>Frete: {row.freight || 'Não informado'} · Garantia: {row.warranty || 'Não informada'}</p>
        <p>Pagamento: {row.payment || 'Não informado'} · Desconto: {row.discountPercent}%</p>
      </CardContent></Card>)}</div>
    </>}
  </main>;
}
