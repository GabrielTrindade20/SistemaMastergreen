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
  
  // Logo "MG" estilizado no centro
  doc.setFillColor(greenColor[0], greenColor[1], greenColor[2]);
  const logoX = (pageWidth - 30) / 2;
  doc.rect(logoX, yPosition, 30, 20, 'F');
  
  doc.setTextColor(255, 255, 255); // Texto branco
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MG', logoX + 8, yPosition + 13);
  
  yPosition += 25;
  
  // Nome da empresa centralizado
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const companyName = 'MASTERGREEN';
  const companyNameWidth = doc.getTextWidth(companyName);
  doc.text(companyName, (pageWidth - companyNameWidth) / 2, yPosition);
  
  yPosition += 15;
  
  // Informações da empresa centralizada
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const empresaInfo = [
    'Razão Social: Rocha Comércio e Instalação de Grama Sintética',
    'CNPJ: 36.347.491/0001-99',
    'Endereço: QNN 24 Conjunto E Lote 14, Ceilândia Sul - DF',
    'Telefone: (61) 99415-3101',
    'E-mail: mastergreendf@gmail.com'
  ];
  
  empresaInfo.forEach(info => {
    const textWidth = doc.getTextWidth(info);
    doc.text(info, (pageWidth - textWidth) / 2, yPosition);
    yPosition += 6;
  });
  
  yPosition += 10;
  
  // Título da proposta centralizado
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const title = data.pdfTitle || 'PROPOSTA COMERCIAL';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPosition);
  
  yPosition += 20;
  
  // Dados do cliente (estilo da segunda imagem)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ao ${data.customerName}`, 20, yPosition);
  yPosition += 6;
  doc.text(`A/C: ${data.customerName}`, 20, yPosition);
  yPosition += 6;
  if (data.customerPhone) {
    doc.text(`Telefone: ${data.customerPhone}`, 20, yPosition);
    yPosition += 6;
  }
  if (data.customerAddress) {
    doc.text(`Endereço: ${data.customerAddress}`, 20, yPosition);
    yPosition += 6;
  }
  doc.text(`Data da Proposta: ${new Date().toLocaleDateString('pt-BR')}`, 20, yPosition);
  
  yPosition += 20;
  
  // Tabela de itens (estilo da segunda imagem)
  const tableStartY = yPosition;
  const tableX = 20;
  const tableWidth = 170;
  const rowHeight = 12;
  
  // Cabeçalho da tabela com bordas
  doc.setLineWidth(0.5);
  doc.rect(tableX, tableStartY, tableWidth, rowHeight);
  
  // Dividir colunas
  doc.line(tableX + 15, tableStartY, tableX + 15, tableStartY + rowHeight); // ITEM
  doc.line(tableX + 35, tableStartY, tableX + 35, tableStartY + rowHeight); // QTD
  doc.line(tableX + 100, tableStartY, tableX + 100, tableStartY + rowHeight); // DESCRIÇÃO
  doc.line(tableX + 130, tableStartY, tableX + 130, tableStartY + rowHeight); // VALOR UNIT
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ITEM', tableX + 2, tableStartY + 8);
  doc.text('QTD', tableX + 17, tableStartY + 8);
  doc.text('DESCRIÇÃO DO PRODUTO', tableX + 37, tableStartY + 8);
  doc.text('VALOR', tableX + 102, tableStartY + 8);
  doc.text('VALOR', tableX + 132, tableStartY + 8);
  doc.text('(m²)', tableX + 17, tableStartY + 4);
  doc.text('UNIT.', tableX + 105, tableStartY + 4);
  doc.text('TOTAL', tableX + 135, tableStartY + 4);
  
  yPosition = tableStartY + rowHeight;
  
  // Linhas dos itens
  doc.setFont('helvetica', 'normal');
  data.items.forEach((item, index) => {
    // Desenhar linha da tabela
    doc.rect(tableX, yPosition, tableWidth, rowHeight);
    
    // Dividir colunas
    doc.line(tableX + 15, yPosition, tableX + 15, yPosition + rowHeight);
    doc.line(tableX + 35, yPosition, tableX + 35, yPosition + rowHeight);
    doc.line(tableX + 100, yPosition, tableX + 100, yPosition + rowHeight);
    doc.line(tableX + 130, yPosition, tableX + 130, yPosition + rowHeight);
    
    // Conteúdo
    doc.text((index + 1).toString(), tableX + 7, yPosition + 8);
    doc.text(item.quantity.toString(), tableX + 22, yPosition + 8);
    doc.text(item.productName, tableX + 37, yPosition + 8);
    doc.text(`R$ ${item.unitPrice.toFixed(2)}`, tableX + 102, yPosition + 8);
    doc.text(`R$ ${item.total.toFixed(2)}`, tableX + 132, yPosition + 8);
    
    yPosition += rowHeight;
  });
  
  yPosition += 10;
  
  // Total em destaque verde (como na segunda imagem)
  const totalBoxX = pageWidth - 70;
  const totalBoxY = yPosition - 5;
  doc.setFillColor(greenColor[0], greenColor[1], greenColor[2]);
  doc.rect(totalBoxX, totalBoxY, 50, 15, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`R$ ${data.finalTotal.toFixed(2)}`, totalBoxX + 5, totalBoxY + 10);
  
  yPosition += 25;
  
  // Dados da Proposta (estilo da segunda imagem)
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Dados da Proposta:', 20, yPosition);
  yPosition += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const dadosProposta = [
    'Descrição do produto: Grama sintética de 20mm Com instalação',
    'Prazo de garantia: GARANTIA DE 10 ANOS',
    'Forma de pagamento: 50% de entrada + 50% na entrega',
    'Frete: Incluso',
    'Tributos: Incluso no preço',
    `Validade desta proposta: ${Math.ceil((new Date(data.validUntil).getTime() - new Date().getTime()) / (1000 * 3600 * 24))} dias`
  ];
  
  dadosProposta.forEach(info => {
    doc.text(info, 20, yPosition);
    yPosition += 6;
  });
  
  yPosition += 10;
  
  // Dados para pagamento
  doc.setFont('helvetica', 'bold');
  doc.text('Dados para pagamento:', 20, yPosition);
  yPosition += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.text('PIX: 36.347.491/0001-99 - CNPJ em nome da Rocha Comércio e Instalação de Grama Sintética', 20, yPosition);
  
  yPosition += 15;
  
  // Assinatura (estilo da segunda imagem)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`${data.responsibleName || 'José Newton'}`, 20, yPosition);
  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${data.responsiblePosition || 'Administrador'}`, 20, yPosition);
  
  // Observações no final se existirem
  if (data.notes) {
    yPosition += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('OBSERVAÇÕES:', 20, yPosition);
    yPosition += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
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