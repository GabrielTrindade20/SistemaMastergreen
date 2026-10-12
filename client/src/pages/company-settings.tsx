import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Save } from 'lucide-react';
import { defaultCompany, type CompanyProfile } from '@shared/company-profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

async function save(path:string,data:unknown) {
  const response=await fetch(path,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const result=await response.json();if(!response.ok)throw new Error(result.message||'Não foi possível salvar.');return result;
}
const fields:[Exclude<keyof CompanyProfile,'validityDays'>,string][]=[
  ['name','Nome da empresa'],['socialName','Razão social'],['cnpj','CPF / CNPJ'],['address','Endereço completo'],['phone','Telefone / WhatsApp'],['email','E-mail'],['pixKey','Chave PIX'],['pixBeneficiary','Beneficiário do PIX'],['responsibleName','Responsável padrão'],['responsibleRole','Cargo do responsável'],['paymentTerms','Pagamento padrão (propostas do web)'],
];
export default function CompanySettings(){
  const client=useQueryClient(),{toast}=useToast();
  const company=useQuery<CompanyProfile>({queryKey:['/api/company-profile']});
  const [draft,setDraft]=useState(defaultCompany),[dirty,setDirty]=useState(false);
  useEffect(()=>{if(company.data&&!dirty)setDraft(company.data);},[company.data,dirty]);
  const companySave=useMutation({mutationFn:()=>save('/api/company-profile',draft),onSuccess:data=>{client.setQueryData(['/api/company-profile'],data);setDirty(false);toast({title:'Dados da empresa salvos',description:'No celular, sincronize para receber as alterações.'});},onError:(error:Error)=>toast({title:'Não foi possível salvar',description:error.message,variant:'destructive'})});
  return <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-green-700">MasterGreen · Configurações</p><h1 className="text-3xl font-bold mt-2">Empresa e propostas</h1><p className="text-slate-600 mt-2">Uma identidade para os documentos do web e do aplicativo.</p></header>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2/> Dados que aparecem no PDF</CardTitle></CardHeader><CardContent>
      <p className="text-sm text-slate-600 mb-5">Os dados iniciais foram recuperados dos modelos existentes. Confira razão social, documento e PIX antes de enviar propostas. PDFs já compartilhados não são alterados; novas gerações usam a configuração atual. No app offline, vale a última sincronização.</p>
      {company.isError?<p role="alert" className="text-red-700">Falha ao carregar. <Button variant="outline" onClick={()=>void company.refetch()}>Tentar novamente</Button></p>:company.isLoading?<p>Carregando…</p>:<form onSubmit={event=>{event.preventDefault();companySave.mutate();}} className="space-y-5">
        <div className="grid md:grid-cols-2 gap-5">{fields.map(([key,label])=><div key={key} className={key==='address'||key==='paymentTerms'?'md:col-span-2':''}><Label htmlFor={'company-'+key}>{label}</Label><Input id={'company-'+key} className="mt-2" value={draft[key]} required={key==='name'||key==='socialName'} type={key==='email'?'email':'text'} maxLength={key==='address'||key==='paymentTerms'?1000:250} onChange={event=>{setDirty(true);setDraft({...draft,[key]:event.target.value});}}/></div>)}<div><Label htmlFor="company-validity">Validade padrão no app (dias)</Label><Input id="company-validity" type="number" min={1} max={365} required value={draft.validityDays} onChange={event=>{setDirty(true);setDraft({...draft,validityDays:Number(event.target.value)});}}/></div></div>
        <Button type="submit" disabled={companySave.isPending||!dirty}><Save className="w-4 h-4 mr-2"/>{companySave.isPending?'Salvando…':'Salvar dados da empresa'}</Button>
      </form>}
    </CardContent></Card>
  </main>;
}
