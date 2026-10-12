import type { QuotationWithDetails } from '@shared/schema';
import type { CompanyProfile } from '@shared/company-profile';
import { formatDocument, formatPhone } from './calculations';
import { renderProposalDocument, type ProposalDocument } from './proposal-document';
import logoMasterGreen from '@assets/mastergreen-logo.png';
import type { QuickProposalDetails } from '@shared/quick-proposal-details';

export type CompanyInfo = CompanyProfile;
export type QuickProposalRow = {id:string;quotationNumber:string;customer:{name:string;phone:string;contact?:string;document?:string;address?:string};date:string;totalCents:number;freight:string;warranty:string;payment:string;discountPercent:number;webDetails?:QuickProposalDetails|null};

export async function getImageAsBase64(path:string):Promise<string>{
  const response=await fetch(path);if(!response.ok)return '';
  return new Promise((resolve,reject)=>{response.blob().then(blob=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=reject;reader.readAsDataURL(blob);},reject);});
}
async function companyProfile():Promise<CompanyProfile>{
  const response=await fetch('/api/company-profile',{credentials:'include'});
  if(!response.ok)throw new Error('Não foi possível carregar os dados da empresa. Tente novamente antes de gerar o PDF.');
  return response.json();
}
async function output(data:ProposalDocument,company:CompanyProfile,fileName?:string){
  const logo=await getImageAsBase64(logoMasterGreen).catch(()=>'');
  const doc=renderProposalDocument(data,company,logo);
  const blob=doc.output('blob');if(fileName)doc.save(fileName.replace(/[<>:"/\\|?*]/g,'-'));return blob;
}
const date=(value:string|Date)=>new Date(value).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
export async function generateProposalPDF(q:QuotationWithDetails,fileName?:string):Promise<Blob>{
  const company=await companyProfile();
  const c=q.customer;
  return output({number:q.quotationNumber,date:date(q.createdAt||new Date()),customer:c.name,
    customerDetails:[formatPhone(c.phone||''),c.cpfCnpj?formatDocument(c.cpfCnpj):'',[c.address,c.number,c.neighborhood,c.city,c.state,c.zipCode].filter(Boolean).join(' · ')],
    items:q.items.map(item=>({description:item.product.name,quantity:Number(item.quantity),unit:'m²',unitPrice:Number(item.unitPrice),total:Number(item.subtotal)})),
    total:Number(q.total),conditions:[['Garantia',q.warrantyText||'Não informada'],['Pagamento',company.paymentTerms],['Frete',q.shippingIncluded?'Incluso no valor':'Não incluso'],['Tributos','Inclusos no preço'],['Validade',date(q.validUntil)]],
    responsibleName:q.responsibleName||company.responsibleName,responsibleRole:q.responsiblePosition||company.responsibleRole,
  },company,fileName);
}
export async function generateQuickProposalPDF(q:QuickProposalRow,fileName?:string):Promise<Blob>{
  const company=await companyProfile();
  const details=q.webDetails;
  return output({number:q.quotationNumber,date:q.date.split('-').reverse().join('/'),customer:q.customer.name,
    customerDetails:[q.customer.contact?'A/C: '+q.customer.contact:'',q.customer.phone,q.customer.document||'',q.customer.address||''],
    items:details?.items.map(item=>({description:item.name,quantity:item.quantity,unit:item.unit||'m²',unitPrice:item.unitPrice,total:Math.round(item.quantity*item.unitPrice*100)/100})) || [],total:q.totalCents/100,discountPercent:q.discountPercent,
    conditions:[['Garantia',q.warranty],['Pagamento',q.payment],['Frete',q.freight],...(details ? [['Validade',details.validUntil.split('-').reverse().join('/')] as [string,string]] : [])],
    title:details?.pdfTitle,responsibleName:details?.responsibleName,responsibleRole:details?.responsiblePosition,
    note:details ? [details.notes,details.pricingMode==='manual'?'Valor final negociado. Os itens discriminados são referências e não recalculam o total.':''].filter(Boolean).join('\n') : 'Resumo financeiro recebido do aplicativo. Itens e custos não estão disponíveis neste documento.',
  },company,fileName);
}
export async function shareProposalPDF(q:QuotationWithDetails,method:'whatsapp'|'email'|'download'){
  await generateProposalPDF(q,'proposta-'+q.quotationNumber+'.pdf');
  if(method==='whatsapp')window.open('https://web.whatsapp.com/send?text='+encodeURIComponent('Olá! Segue a proposta '+q.quotationNumber+'. Anexe o PDF baixado.'),'_blank','noopener');
  if(method==='email')window.location.href='mailto:'+encodeURIComponent(q.customer.email||'')+'?subject='+encodeURIComponent('Proposta '+q.quotationNumber)+'&body='+encodeURIComponent('Segue a proposta solicitada. Anexe o PDF baixado.');
}
export const generateQuotationPDF=generateProposalPDF;
export const shareQuotationPDF=shareProposalPDF;
