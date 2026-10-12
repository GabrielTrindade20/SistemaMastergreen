import { jsPDF } from 'jspdf';
import type { CompanyProfile } from '@shared/company-profile';

export type ProposalDocument = {
  number:string;date:string;customer:string;customerDetails:string[];
  items:{description:string;quantity:number;unit:string;unitPrice:number;total:number}[];
  total:number;discountPercent?:number;conditions:[string,string][];note?:string;
  responsibleName?:string;responsibleRole?:string;
  title?:string;
};
const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}).replace(/\u00a0/g,' ');
// Brand palette: forest oklch(31% .065 158), green oklch(46% .10 154),
// pale oklch(97% .01 155). RGB equivalents for jsPDF's print engine.
export function renderProposalDocument(data:ProposalDocument,company:CompanyProfile,logo?:string) {
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const left=18,right=192,width=174,bottom=267;
  let y=20;
  const text=(value:string,x:number,yy:number,size=10,bold=false,color:[number,number,number]=[29,47,38])=>{
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);doc.text(value,x,yy);
  };
  const nextPage=()=>{doc.addPage();y=23;doc.setFontSize(10);text(doc.splitTextToSize(company.name,95)[0],left,15,10,true);text('PROPOSTA · '+data.number,120,15,8);doc.setDrawColor(205,222,213);doc.line(left,18,right,18);};
  const ensure=(height:number)=>{if(y+height>bottom)nextPage();};
  const paragraph=(value:string,size=10,bold=false)=>{
    if(!value)return;
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);
    const lines=doc.splitTextToSize(value,width) as string[];
    const lineHeight=Math.max(5,size*.42);
    for(const line of lines){ensure(lineHeight);text(line,left,y,size,bold);y+=lineHeight;}
  };
  doc.setProperties({title:'Proposta '+data.number,author:company.name});
  doc.setFillColor(15,78,47);doc.rect(0,0,210,4,'F');
  if(logo){try{doc.addImage(logo,'PNG',left,13,20,20);}catch{/* Text identity remains available. */}}
  doc.setFont('helvetica','bold');doc.setFontSize(22);
  const brandLines=doc.splitTextToSize(company.name,logo?88:108) as string[];
  brandLines.forEach((line,i)=>text(line,logo?43:left,23+i*8,22,true,[15,78,47]));
  text('PROPOSTA COMERCIAL',right-53,19,9,true);
  text(data.number,right-53,25,9);text(data.date,right-53,31,9);
  y=Math.max(43,31+brandLines.length*8);
  paragraph(company.socialName,9,true);
  paragraph([company.cnpj?'CNPJ '+company.cnpj:'',company.phone,company.email].filter(Boolean).join('  |  '),9);
  paragraph(company.address,9);
  if(data.title){y+=4;paragraph(data.title,12,true);}
  y+=7;paragraph('PREPARADA PARA',8,true);paragraph(data.customer,16,true);y+=2;
  data.customerDetails.filter(Boolean).forEach(value=>paragraph(value,10));y+=9;
  const header=()=>{
    ensure(13);doc.setFillColor(15,78,47);doc.rect(left,y,width,10,'F');
    text('DESCRIÇÃO',left+3,y+6.5,9,true,[255,255,255]);text('QTD.',117,y+6.5,9,true,[255,255,255]);text('UNITÁRIO',141,y+6.5,9,true,[255,255,255]);text('TOTAL',174,y+6.5,9,true,[255,255,255]);y+=10;
  };
  if(data.items.length){
    header();
    data.items.forEach((item,index)=>{
      doc.setFontSize(10);doc.setFont('helvetica','normal');
      const lines=doc.splitTextToSize(item.description,88) as string[];
      // Split even an exceptionally long description across pages without clipping.
      let offset=0;
      while(offset<lines.length){
        if(y+13>bottom){nextPage();header();}
        const capacity=Math.max(1,Math.floor((bottom-y-6)/5));
        const chunk=lines.slice(offset,offset+capacity),height=Math.max(13,chunk.length*5+6);
        if(index%2===0){doc.setFillColor(241,247,243);doc.rect(left,y,width,height,'F');}
        chunk.forEach((line,i)=>text(line,left+3,y+6+i*5,10));
        if(offset===0){
          text(item.quantity.toLocaleString('pt-BR',{maximumFractionDigits:2})+' '+item.unit,117,y+6,9);
          doc.setFontSize(9);text(money(item.unitPrice),169-doc.getTextWidth(money(item.unitPrice)),y+6,9);
          text(money(item.total),right-3-doc.getTextWidth(money(item.total)),y+6,9,true);
        }
        y+=height;offset+=chunk.length;
        doc.setDrawColor(217,228,221);doc.line(left,y,right,y);
      }
    });
  } else {paragraph('Resumo da proposta enviada pelo aplicativo',12,true);paragraph('Os itens detalhados não foram enviados ao sistema.',10);}
  y+=8;ensure(27);
  if(data.discountPercent){paragraph('Desconto aplicado: '+data.discountPercent.toLocaleString('pt-BR')+'%',10);}
  doc.setFillColor(15,78,47);doc.roundedRect(100,y,92,22,2,2,'F');
  text('VALOR TOTAL',105,y+7,8,true,[255,255,255]);
  text(money(data.total),105,y+16,19,true,[255,255,255]);y+=33;
  ensure(20);paragraph('CONDIÇÕES DA PROPOSTA',10,true);y+=2;
  for(const [label,value] of data.conditions)if(value)paragraph(label+': '+value,10);
  if(data.note){y+=4;paragraph(data.note,9);}
  y+=8;ensure(20);paragraph('DADOS PARA PAGAMENTO',10,true);
  if(company.pixKey)paragraph('PIX: '+company.pixKey,10);
  if(company.pixBeneficiary)paragraph('Beneficiário: '+company.pixBeneficiary,9);
  y+=10;ensure(22);
  doc.setDrawColor(175,198,185);doc.line(left,y,left+75,y);y+=7;
  paragraph(data.responsibleName||company.responsibleName,11,true);
  paragraph(data.responsibleRole||company.responsibleRole,9);
  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    doc.setPage(page);doc.setDrawColor(31,124,71);doc.setLineWidth(1);doc.line(left,277,right,277);
    const footer=[company.name,company.phone,company.email].filter(Boolean).join('  |  ');
    doc.setFontSize(8);const lines=doc.splitTextToSize(footer,145) as string[];
    lines.slice(0,2).forEach((line,i)=>text(line,left,283+i*4,8));
    text(page+' / '+pages,183,283,8);
  }
  return doc;
}
