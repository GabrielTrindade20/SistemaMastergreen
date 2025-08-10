import jsPDF from 'jspdf';
import logoSemFundo from '../imagem/logoSemFundo.png';

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

export async function generateQuotationPDF(data: PDFQuotationData): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const greenColor = [45, 138, 29]; // #2d8a1d
  const PAGE_MARGIN = 10;

  let yPosition = 10;

  // Logo no topo
  const logo = await loadImage(logoSemFundo);
  const logoWidth = 40;
  const logoHeight = 40;
  doc.addImage(logo, 'PNG', (pageWidth - logoWidth) / 2, yPosition, logoWidth, logoHeight);
  yPosition += logoHeight;

  // Informações da empresa
  doc.setTextColor(0, 0, 0);
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
    yPosition += 6;
  });

  yPosition += 5;

  // Título da proposta
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.text(data.pdfTitle || 'PROPOSTA COMERCIAL', pageWidth / 2, yPosition + 8, { align: 'center' });
  yPosition += 20;

  // Dados do cliente
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Ao: ${data.customerName}`, 20, yPosition);
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

  yPosition += 10;

  // Configuração da tabela
  const tableWidth = pageWidth - PAGE_MARGIN * 2;
  const tableX = PAGE_MARGIN;
  const rowHeight = 12;
  
  // Larguras das colunas baseadas na imagem
  const colWidths = [25, 30, 85, 35, 40]; // ITEM, QTD, DESCRIÇÃO, VALOR UNIT, VALOR TOTAL
  
  // Cabeçalho da tabela
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  
  // Primeira linha do cabeçalho
  doc.setFillColor(245, 245, 245);
  doc.rect(tableX, yPosition, tableWidth, rowHeight, 'FD');
  
  // Texto do cabeçalho - primeira linha
  doc.text('ITEM', tableX + 12, yPosition + 4);
  doc.text('QTD.', tableX + colWidths[0] + 12, yPosition + 4);
  doc.text('DESCRIÇÃO DO PRODUTO', tableX + colWidths[0] + colWidths[1] + 20, yPosition + 4);
  doc.text('VALOR', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, yPosition + 4);
  doc.text('VALOR', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 12, yPosition + 4);
  
  // Segunda linha do cabeçalho  
  yPosition += rowHeight;
  doc.rect(tableX, yPosition, tableWidth, rowHeight, 'FD');
  
  doc.text('', tableX + 12, yPosition + 4);
  doc.text('(m²)', tableX + colWidths[0] + 10, yPosition + 4);
  doc.text('', tableX + colWidths[0] + colWidths[1] + 20, yPosition + 4);
  doc.text('UNIT.', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, yPosition + 4);
  doc.text('TOTAL', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 8, yPosition + 4);

  // Desenhar bordas verticais do cabeçalho
  let currentX = tableX;
  for (let i = 0; i <= colWidths.length; i++) {
    doc.line(currentX, yPosition - rowHeight, currentX, yPosition + rowHeight);
    if (i < colWidths.length) currentX += colWidths[i];
  }

  yPosition += rowHeight;

  // Linhas dos itens
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  data.items.forEach((item, index) => {
    // Preenchimento alternado das linhas
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(tableX, yPosition, tableWidth, rowHeight, 'F');
    }
    
    // Borda horizontal superior
    doc.line(tableX, yPosition, tableX + tableWidth, yPosition);
    
    // Bordas verticais
    currentX = tableX;
    for (let i = 0; i <= colWidths.length; i++) {
      doc.line(currentX, yPosition, currentX, yPosition + rowHeight);
      if (i < colWidths.length) currentX += colWidths[i];
    }
    
    // Texto da linha
    doc.setTextColor(0, 0, 0);
    doc.text((index + 1).toString(), tableX + 12, yPosition + 8);
    doc.text(item.quantity.toString(), tableX + colWidths[0] + 12, yPosition + 8);
    doc.text(item.productName, tableX + colWidths[0] + colWidths[1] + 5, yPosition + 8);
    doc.text(`R$ ${item.unitPrice.toFixed(2).replace('.', ',')}`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 30, yPosition + 8, { align: 'right' });
    doc.text(`R$ ${item.total.toFixed(2).replace('.', ',')}`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 35, yPosition + 8, { align: 'right' });
    
    yPosition += rowHeight;
  });

  // Linha do total integrada na tabela (última linha)
  doc.setFillColor(greenColor[0], greenColor[1], greenColor[2]);
  
  // Células vazias até a coluna do total
  const totalCellX = tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
  doc.rect(tableX, yPosition, totalCellX - tableX, rowHeight, 'FD');
  
  // Célula do total com fundo verde
  doc.rect(totalCellX, yPosition, colWidths[4], rowHeight, 'FD');
  
  // Bordas da linha do total
  currentX = tableX;
  for (let i = 0; i <= colWidths.length; i++) {
    doc.line(currentX, yPosition, currentX, yPosition + rowHeight);
    if (i < colWidths.length) currentX += colWidths[i];
  }
  
  // Borda horizontal final
  doc.line(tableX, yPosition + rowHeight, tableX + tableWidth, yPosition + rowHeight);
  
  // Texto do total
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`R$ ${data.finalTotal.toFixed(2).replace('.', ',')}`, totalCellX + colWidths[4] - 5, yPosition + 8, { align: 'right' });

  yPosition += 20;

  doc.setTextColor(0, 0, 0);
  
  // Dados da proposta
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Dados da Proposta:', 20, yPosition);
  yPosition += 8;
  doc.setFont('helvetica', 'normal');
  doc.text('Descrição do produto: Grama sintética de 20mm Com Instalação', 20, yPosition);
  yPosition += 6;
  doc.text('Prazo de garantia: GARANTIA DE 10 ANOS', 20, yPosition);
  yPosition += 6;
  doc.text('Forma de pagamento: 50% de entrada + 50% na entrega.', 20, yPosition);

  // Assinatura
  yPosition += 20;
  doc.setFont('helvetica', 'bold');
  doc.text(data.responsibleName || 'José Newton', 20, yPosition);
  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(data.responsiblePosition || 'Administrador', 20, yPosition);

  const pdfBlob = doc.output('blob');
  const filename = data.pdfTitle 
    ? `${data.pdfTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.pdf`
    : `Proposta_${data.quotationNumber.replace('#', '')}.pdf`;

  return { blob: pdfBlob, filename };
}

function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Erro ao processar imagem'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}
