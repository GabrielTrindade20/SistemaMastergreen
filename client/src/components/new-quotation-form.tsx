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

export async function generateQuotationPDF(data: PDFQuotationData): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const greenColor = [45, 138, 29]; // #2d8a1d

  let yPosition = 20;

  // Logo no topo
  const logo = await loadImage('./imagem/logoSemFundo.png');
  const logoWidth = 40;
  const logoHeight = 40;
  doc.addImage(logo, 'PNG', (pageWidth - logoWidth) / 2, yPosition, logoWidth, logoHeight);
  yPosition += logoHeight + 10;

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

  yPosition += 10;

  // Título da proposta
  doc.setFillColor(greenColor[0], greenColor[1], greenColor[2]);
  doc.rect(0, yPosition, pageWidth, 12, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(data.pdfTitle || 'PROPOSTA COMERCIAL', pageWidth / 2, yPosition + 8, { align: 'center' });
  yPosition += 20;

  // Dados do cliente
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Ao ${data.customerName}`, 20, yPosition);
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

  // Tabela - Cabeçalho com borda
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setDrawColor(0);
  doc.setFillColor(230, 230, 230);
  doc.rect(15, yPosition, pageWidth - 30, 8, 'FD');
  doc.text('ITEM', 20, yPosition + 6);
  doc.text('QTD.', 40, yPosition + 6);
  doc.text('DESCRIÇÃO', 70, yPosition + 6);
  doc.text('VALOR UNIT.', 140, yPosition + 6);
  doc.text('VALOR TOTAL', 170, yPosition + 6, { align: 'right' });

  yPosition += 10;

  // Itens
  doc.setFont('helvetica', 'normal');
  data.items.forEach((item, index) => {
    doc.rect(15, yPosition - 6, pageWidth - 30, 8); // Borda da linha
    doc.text((index + 1).toString(), 20, yPosition);
    doc.text(item.quantity.toString(), 42, yPosition);
    doc.text(item.productName, 70, yPosition);
    doc.text(`R$ ${item.unitPrice.toFixed(2).replace('.', ',')}`, 140, yPosition);
    doc.text(`R$ ${item.total.toFixed(2).replace('.', ',')}`, 170, yPosition, { align: 'right' });
    yPosition += 10;
  });

  yPosition += 5;

  // Total - fundo verde e letra branca
  doc.setFillColor(greenColor[0], greenColor[1], greenColor[2]);
  doc.rect(120, yPosition, 75, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: R$ ${data.finalTotal.toFixed(2).replace('.', ',')}`, 122, yPosition + 7);

  yPosition += 20;

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
