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
  const tableStartY = yPosition;
  const tableWidth = pageWidth - PAGE_MARGIN * 2;
  const tableX = PAGE_MARGIN;
  const rowHeight = 8;
  
  // Larguras das colunas
  const colWidths = [20, 25, 80, 35, 35]; // ITEM, QTD, DESCRIÇÃO, VALOR UNIT, VALOR TOTAL
  let colX = tableX;
  
  // Cabeçalho da tabela
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.setFillColor(230, 230, 230);
  
  // Desenhar fundo do cabeçalho
  doc.rect(tableX, yPosition, tableWidth, rowHeight, 'FD');
  
  // Desenhar bordas verticais do cabeçalho
  colX = tableX;
  for (let i = 0; i <= colWidths.length; i++) {
    doc.line(colX, yPosition, colX, yPosition + rowHeight);
    if (i < colWidths.length) colX += colWidths[i];
  }
  
  // Texto do cabeçalho
  doc.text('ITEM', tableX + 10, yPosition + 6);
  doc.text('QTD.', tableX + colWidths[0] + 8, yPosition + 6);
  doc.text('DESCRIÇÃO DO PRODUTO', tableX + colWidths[0] + colWidths[1] + 5, yPosition + 6);
  doc.text('VALOR', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, yPosition + 6);
  doc.text('VALOR', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 8, yPosition + 6);
  
  // Segunda linha do cabeçalho
  yPosition += rowHeight;
  doc.rect(tableX, yPosition, tableWidth, rowHeight, 'FD');
  
  // Bordas verticais da segunda linha
  colX = tableX;
  for (let i = 0; i <= colWidths.length; i++) {
    doc.line(colX, yPosition, colX, yPosition + rowHeight);
    if (i < colWidths.length) colX += colWidths[i];
  }
  
  doc.text('', tableX + 10, yPosition + 6);
  doc.text('(m²)', tableX + colWidths[0] + 8, yPosition + 6);
  doc.text('', tableX + colWidths[0] + colWidths[1] + 5, yPosition + 6);
  doc.text('UNIT.', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, yPosition + 6);
  doc.text('TOTAL', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 8, yPosition + 6);

  yPosition += rowHeight;

  // Linhas dos itens
  doc.setFont('helvetica', 'normal');
  data.items.forEach((item, index) => {
    // Preenchimento alternado das linhas
    if (index % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(tableX, yPosition, tableWidth, rowHeight, 'F');
    }
    
    // Borda da linha
    doc.rect(tableX, yPosition, tableWidth, rowHeight, 'D');
    
    // Bordas verticais da linha
    colX = tableX;
    for (let i = 0; i <= colWidths.length; i++) {
      doc.line(colX, yPosition, colX, yPosition + rowHeight);
      if (i < colWidths.length) colX += colWidths[i];
    }
    
    // Texto da linha
    doc.text((index + 1).toString(), tableX + 10, yPosition + 6);
    doc.text(item.quantity.toString(), tableX + colWidths[0] + 8, yPosition + 6);
    doc.text(item.productName, tableX + colWidths[0] + colWidths[1] + 5, yPosition + 6);
    doc.text(`R$ ${item.unitPrice.toFixed(2).replace('.', ',')}`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 25, yPosition + 6, { align: 'right' });
    doc.text(`R$ ${item.total.toFixed(2).replace('.', ',')}`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 30, yPosition + 6, { align: 'right' });
    
    yPosition += rowHeight;
  });

  // Total - fundo verde e letra branca
  const totalBoxWidth = 75;
  const totalBoxX = pageWidth - totalBoxWidth - PAGE_MARGIN;
  doc.setFillColor(greenColor[0], greenColor[1], greenColor[2]);
  doc.rect(totalBoxX, yPosition, totalBoxWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: R$ ${data.finalTotal.toFixed(2).replace('.', ',')}`, totalBoxX + 5, yPosition + 7);

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
