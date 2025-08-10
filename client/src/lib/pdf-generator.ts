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
  const pageWidth = doc.internal.pageSize.width;
  
  // Configurações de cores
  const greenColor = [0, 123, 23]; // Verde MasterGreen
  const textColor = [0, 0, 0];
  
  let yPosition = 20;
  
  // Informações da empresa centralizada (como no PDF original)
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const empresaInfo = [
    'Razão Social: Rocha Comércio e Instalação de Grama Sintética',
    'CNPJ: 36.347.491/0001-99',
    'Endereço: QNN 24 Conjunto E Lote 14, Ceilândia Sul - DF',
    'Telefone: (61) 98412-4179',
    'E-mail: mastergreendf@gmail.com'
  ];
  
  empresaInfo.forEach(info => {
    const textWidth = doc.getTextWidth(info);
    doc.text(info, (pageWidth - textWidth) / 2, yPosition);
    yPosition += 8;
  });
  
  yPosition += 15;
  
  // Título da proposta centralizado
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const title = data.pdfTitle || 'PROPOSTA TESTE';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPosition);
  
  yPosition += 25;
  
  // Dados do cliente (exatamente como no PDF original)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ao ${data.customerName}`, 20, yPosition);
  yPosition += 7;
  doc.text(`A/C: ${data.customerName}`, 20, yPosition);
  yPosition += 7;
  if (data.customerPhone) {
    doc.text(`Telefone: ${data.customerPhone}`, 20, yPosition);
    yPosition += 7;
  }
  if (data.customerAddress) {
    doc.text(`Endereço: ${data.customerAddress}`, 20, yPosition);
    yPosition += 7;
  }
  if (data.customerAddress) {
    doc.text(`CNPJ: 058.619.271-97`, 20, yPosition);
    yPosition += 7;
  }
  doc.text(`Data da Proposta: ${new Date().toLocaleDateString('pt-BR')}`, 20, yPosition);
  
  yPosition += 25;
  
  // Cabeçalho da tabela (exatamente como no PDF original)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ITEM', 25, yPosition);
  doc.text('QTD.', 50, yPosition);
  doc.text('DESCRIÇÃO DO PRODUTO', 90, yPosition);
  doc.text('VALOR', 145, yPosition);
  doc.text('VALOR', 170, yPosition);
  
  yPosition += 5;
  doc.text('(m²)', 50, yPosition);
  doc.text('UNIT.', 145, yPosition);
  doc.text('TOTAL', 170, yPosition);
  
  yPosition += 15;
  
  // Itens da tabela
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  
  data.items.forEach((item, index) => {
    doc.text((index + 1).toString(), 30, yPosition);
    doc.text(item.quantity.toString(), 55, yPosition);
    doc.text(item.productName, 70, yPosition);
    doc.text(`R$ ${item.unitPrice.toFixed(0)}`, 150, yPosition);
    doc.text(`R$ ${item.total.toFixed(2).replace('.', ',')}`, 175, yPosition);
    
    yPosition += 15;
  });
  
  yPosition += 10;
  
  // Total (alinhado à direita como no PDF original)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`R$ ${data.finalTotal.toFixed(2).replace('.', ',')}`, 175, yPosition);
  
  yPosition += 20;
  
  // Dados da Proposta (exatamente como no PDF original)
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Dados da Proposta:', 20, yPosition);
  yPosition += 10;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const dadosProposta = [
    '',
    'Descrição do produto: Grama sintética de 20mm Com Instalação',
    'Prazo de garantia: GARANTIA DE 10 ANOS',
    'Forma de pagamento: 50% de entrada + 50% na entrega.',
    'Frete: Incluso',
    'Tributos: incluso no preço.',
    `Validade desta proposta: ${Math.ceil((new Date(data.validUntil).getTime() - new Date().getTime()) / (1000 * 3600 * 24))} dias.`
  ];
  
  dadosProposta.forEach(info => {
    doc.text(info, 20, yPosition);
    yPosition += 8;
  });
  
  yPosition += 10;
  
  // Dados para pagamento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Dados para pagamento:', 20, yPosition);
  yPosition += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.text('PIX: 36.347.491/0001-99 - CNPJ em nome da Rocha Comércio e Instalação de Grama Sintética', 20, yPosition);
  
  yPosition += 25;
  
  // Assinatura (exatamente como no PDF original)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${data.responsibleName || 'José Newton'}`, 20, yPosition);
  yPosition += 8;
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.responsiblePosition || 'Administrador'}`, 20, yPosition);
  
  // Observações no final se existirem
  if (data.notes) {
    yPosition += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('OBSERVAÇÕES:', 20, yPosition);
    yPosition += 10;
    doc.setFont('helvetica', 'normal');
    
    // Quebrar texto das observações em múltiplas linhas
    const splitNotes = doc.splitTextToSize(data.notes, 170);
    doc.text(splitNotes, 20, yPosition);
  }
  
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