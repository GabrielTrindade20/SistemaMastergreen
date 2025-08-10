import jsPDF from 'jspdf';

export interface PDFQuotationData {
  quotationNumber: string;
  pdfTitle?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  validUntil: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount?: number;
  discountPercent?: number;
  finalTotal: number;
  shippingIncluded?: boolean;
  warrantyText?: string;
  responsibleName?: string;
  responsiblePosition?: string;
  notes?: string;
}

export function generateQuotationPDF(data: PDFQuotationData): { blob: Blob; filename: string } {
  const doc = new jsPDF();
  
  // Configurações
  const primaryColor = [0, 43, 23]; // #002b17
  const textColor = [0, 0, 0];
  const grayColor = [128, 128, 128];
  
  let yPosition = 20;
  
  // Cabeçalho da empresa
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('MG MASTERGREEN', 20, yPosition);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('CNPJ: 36.347.401/0001-99', 20, yPosition + 8);
  doc.text('Especialista em Grama Sintética, Capachos de Vinil e Piso Tátil', 20, yPosition + 15);
  
  yPosition += 35;
  
  // Título da proposta
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const title = data.pdfTitle || 'Proposta Comercial';
  doc.text(title, 20, yPosition);
  
  yPosition += 15;
  
  // Informações da proposta
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Proposta: ${data.quotationNumber}`, 20, yPosition);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 120, yPosition);
  yPosition += 7;
  doc.text(`Válida até: ${new Date(data.validUntil).toLocaleDateString('pt-BR')}`, 20, yPosition);
  
  yPosition += 20;
  
  // Dados do cliente
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', 20, yPosition);
  yPosition += 10;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${data.customerName}`, 20, yPosition);
  if (data.customerPhone) {
    yPosition += 7;
    doc.text(`Telefone: ${data.customerPhone}`, 20, yPosition);
  }
  if (data.customerEmail) {
    yPosition += 7;
    doc.text(`Email: ${data.customerEmail}`, 20, yPosition);
  }
  if (data.customerAddress) {
    yPosition += 7;
    doc.text(`Endereço: ${data.customerAddress}`, 20, yPosition);
  }
  
  yPosition += 20;
  
  // Itens da proposta
  doc.setFont('helvetica', 'bold');
  doc.text('ITENS DA PROPOSTA', 20, yPosition);
  yPosition += 15;
  
  // Cabeçalho da tabela
  doc.setFillColor(240, 240, 240);
  doc.rect(20, yPosition - 5, 170, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Produto', 25, yPosition);
  doc.text('Qtd', 110, yPosition);
  doc.text('Valor Unit.', 130, yPosition);
  doc.text('Total', 165, yPosition);
  
  yPosition += 10;
  
  // Itens
  doc.setFont('helvetica', 'normal');
  data.items.forEach((item) => {
    doc.text(item.productName, 25, yPosition);
    doc.text(`${item.quantity} m²`, 110, yPosition);
    doc.text(`R$ ${item.unitPrice.toFixed(2)}`, 130, yPosition);
    doc.text(`R$ ${item.total.toFixed(2)}`, 165, yPosition);
    yPosition += 7;
  });
  
  yPosition += 10;
  
  // Totais
  doc.setFont('helvetica', 'bold');
  doc.text(`Subtotal: R$ ${data.subtotal.toFixed(2)}`, 130, yPosition);
  
  if (data.discount && data.discount > 0) {
    yPosition += 7;
    doc.text(`Desconto (${data.discountPercent}%): -R$ ${data.discount.toFixed(2)}`, 130, yPosition);
  }
  
  yPosition += 7;
  doc.setFontSize(11);
  doc.text(`TOTAL: R$ ${data.finalTotal.toFixed(2)}`, 130, yPosition);
  
  yPosition += 20;
  
  // Informações adicionais
  if (data.shippingIncluded) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('✓ Frete incluso no valor', 20, yPosition);
    yPosition += 7;
  }
  
  if (data.warrantyText) {
    doc.text(`✓ Garantia: ${data.warrantyText}`, 20, yPosition);
    yPosition += 7;
  }
  
  if (data.notes) {
    yPosition += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES:', 20, yPosition);
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    
    // Quebrar texto das observações em múltiplas linhas
    const splitNotes = doc.splitTextToSize(data.notes, 170);
    doc.text(splitNotes, 20, yPosition);
    yPosition += splitNotes.length * 5;
  }
  
  // Assinatura
  yPosition += 20;
  doc.setFont('helvetica', 'bold');
  doc.text('RESPONSÁVEL PELA PROPOSTA', 20, yPosition);
  yPosition += 10;
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.responsibleName || 'MG MasterGreen'}`, 20, yPosition);
  if (data.responsiblePosition) {
    yPosition += 7;
    doc.text(data.responsiblePosition, 20, yPosition);
  }
  
  // Rodapé
  yPosition = 280;
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.setFontSize(8);
  doc.text('Esta proposta é válida por 7 dias a partir da data de emissão.', 20, yPosition);
  doc.text('MG MasterGreen - Transformando espaços com qualidade e inovação', 20, yPosition + 5);
  
  // Gerar blob e nome do arquivo
  const pdfBlob = doc.output('blob');
  const filename = data.pdfTitle 
    ? `${data.pdfTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.pdf`
    : `Proposta_${data.quotationNumber.replace('#', '')}.pdf`;
  
  return { blob: pdfBlob, filename };
}

// Função para compartilhar PDF
export function shareQuotationPDF(data: PDFQuotationData) {
  const { blob, filename } = generateQuotationPDF(data);
  
  if (navigator.share && navigator.canShare) {
    // Use Web Share API se disponível (mobile)
    const file = new File([blob], filename, { type: 'application/pdf' });
    
    if (navigator.canShare({ files: [file] })) {
      navigator.share({
        title: data.pdfTitle || 'Proposta Comercial',
        text: `Proposta ${data.quotationNumber} - MG MasterGreen`,
        files: [file]
      }).catch(console.error);
    } else {
      // Fallback para download
      downloadPDF(blob, filename);
    }
  } else {
    // Fallback para download
    downloadPDF(blob, filename);
  }
}

// Função para download direto
export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}