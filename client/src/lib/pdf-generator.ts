import jsPDF from 'jspdf';
import type { QuotationWithDetails } from '@shared/schema';

interface CompanyInfo {
  name: string;
  socialName: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  pixKey: string;
}

export async function generateQuotationPDF(quotation: QuotationWithDetails, fileName?: string): Promise<void> {
  const doc = new jsPDF();

  // Add company logo (base64 or URL)
  // Example: const logoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANS...';
  // Adjust width, height, and position as needed
  const logoBase64 = 'data:../imagem/logoSemFundo.png';
  doc.addImage(logoBase64, 'PNG', 20, 10, 30, 15); // x=20, y=10, width=30, height=15

  let yPosition = 30; // Move down to avoid overlapping logo

  // Company information
  const company: CompanyInfo = {
    name: "MG MASTERGREEN",
    socialName: "MasterGreen Grama Sintética",
    cnpj: "36.347.401/0001-99",
    address: "QNN 24 Conjunto E Lote 14, Ceilândia Sul - DF",
    phone: "(61) 98412-4179",
    email: "mastergreendf@gmail.com",
    pixKey: "36.347.401/0001-99"
  };

  const pageWidth = doc.internal.pageSize.width;
  const leftMargin = 20;
  const rightMargin = 20;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // Header with company logo and info
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(company.name, leftMargin, yPosition);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("GRAMAS E PISOS", leftMargin, yPosition + 6);

  // Company details
  yPosition += 15;
  doc.setFontSize(8);
  doc.text(`Razão Social: ${company.socialName}`, leftMargin, yPosition);
  doc.text(`CNPJ: ${company.cnpj}`, leftMargin, yPosition + 4);
  doc.text(`Endereço: ${company.address}`, leftMargin, yPosition + 8);
  doc.text(`Telefone: ${company.phone}`, leftMargin, yPosition + 12);
  doc.text(`E-mail: ${company.email}`, leftMargin, yPosition + 16);

  // Title
  yPosition += 30;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const title = quotation.pdfTitle || "PROPOSTA PARA VENDA E INSTALAÇÃO DE GRAMA SINTÉTICA";
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPosition);

  // Customer information
  yPosition += 20;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Ao: ${quotation.customer.name}`, leftMargin, yPosition);
  doc.text(`Telefone: ${quotation.customer.phone || 'Não informado'}`, leftMargin, yPosition + 5);
  doc.text(`Endereço: ${quotation.customer.address || 'Não informado'}`, leftMargin, yPosition + 10);
  if (quotation.customer.cpfCnpj) {
    doc.text(`CPF/CNPJ: ${quotation.customer.cpfCnpj}`, leftMargin, yPosition + 15);
    yPosition += 5;
  }

  const currentDate = new Date().toLocaleDateString('pt-BR');
  doc.text(`Data da Proposta: ${currentDate}`, leftMargin, yPosition + 15);

  // Items table
  yPosition += 30;

  // Table header
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");

  const tableHeaders = ["ITEM", "QTD. (m²)", "DESCRIÇÃO DO PRODUTO", "VALOR UNIT.", "VALOR TOTAL"];
  const columnWidths = [15, 25, 80, 25, 25];
  let xPosition = leftMargin;

  // Draw table header
  tableHeaders.forEach((header, index) => {
    doc.rect(xPosition, yPosition, columnWidths[index], 8);
    doc.text(header, xPosition + 2, yPosition + 5);
    xPosition += columnWidths[index];
  });

  yPosition += 8;

  // Table rows
  doc.setFont("helvetica", "normal");
  quotation.items.forEach((item, index) => {
    xPosition = leftMargin;
    const rowHeight = 12;

    // Draw row cells
    doc.rect(xPosition, yPosition, columnWidths[0], rowHeight);
    doc.text((index + 1).toString(), xPosition + 2, yPosition + 8);
    xPosition += columnWidths[0];

    doc.rect(xPosition, yPosition, columnWidths[1], rowHeight);
    doc.text(parseFloat(item.quantity).toFixed(2), xPosition + 2, yPosition + 8);
    xPosition += columnWidths[1];

    doc.rect(xPosition, yPosition, columnWidths[2], rowHeight);
    const productName = item.product.name;
    doc.text(productName, xPosition + 2, yPosition + 8);
    xPosition += columnWidths[2];

    doc.rect(xPosition, yPosition, columnWidths[3], rowHeight);
    doc.text(`R$ ${parseFloat(item.unitPrice).toFixed(2)}`, xPosition + 2, yPosition + 8);
    xPosition += columnWidths[3];

    doc.rect(xPosition, yPosition, columnWidths[4], rowHeight);
    doc.text(`R$ ${parseFloat(item.subtotal).toFixed(2)}`, xPosition + 2, yPosition + 8);

    yPosition += rowHeight;
  });

  // Total row
  xPosition = leftMargin + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3];
  doc.setFont("helvetica", "bold");
  doc.rect(xPosition, yPosition, columnWidths[4], 10);
  doc.text(`R$ ${parseFloat(quotation.total).toFixed(2)}`, xPosition + 2, yPosition + 7);

  // Additional information
  yPosition += 25;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Dados da Proposta:", leftMargin, yPosition);

  yPosition += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Product description
  if (quotation.items.length > 0 && quotation.items[0].product.description) {
    doc.text(`Descrição do produto: ${quotation.items[0].product.description}`, leftMargin, yPosition);
    yPosition += 6;
  }

  // Warranty
  doc.text(`Prazo de garantia: ${quotation.warrantyText || '1 ano de garantia de fábrica'}`, leftMargin, yPosition);
  yPosition += 6;

  // Payment terms
  doc.text("Forma de pagamento: 50% de entrada + 50% na entrega.", leftMargin, yPosition);
  yPosition += 6;

  // Shipping
  const shippingText = quotation.shippingIncluded ? "Incluso" : "Não incluso";
  doc.text(`Frete: ${shippingText}`, leftMargin, yPosition);
  yPosition += 6;

  // Taxes
  doc.text("Tributos: incluso no preço.", leftMargin, yPosition);
  yPosition += 6;

  // Validity
  const validityDays = Math.ceil((new Date(quotation.validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  doc.text(`Validade desta proposta: ${validityDays} dias.`, leftMargin, yPosition);
  yPosition += 10;

  // Payment info
  doc.setFont("helvetica", "bold");
  doc.text("Dados para pagamento:", leftMargin, yPosition);
  yPosition += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`PIX: ${company.pixKey} - CNPJ em nome da ${company.socialName}`, leftMargin, yPosition);

  // Responsible person
  yPosition += 15;
  doc.setFont("helvetica", "bold");
  const responsibleName = quotation.responsibleName || "JOSÉ NEWTON DE ALMEIDA ROCHA";
  const responsiblePosition = quotation.responsiblePosition || "Administrador";

  doc.text(responsibleName, leftMargin, yPosition);
  doc.setFont("helvetica", "normal");
  doc.text(responsiblePosition, leftMargin, yPosition + 5);

  // Generate and download PDF
  const dateForFile = new Date().toISOString().split('T')[0];
  const pdfFileName = fileName || `orcamento-#PREVIEW-${dateForFile}.pdf`;
  doc.save(pdfFileName);
}

// Share function for WhatsApp and email
export async function shareQuotationPDF(quotation: QuotationWithDetails, method: 'whatsapp' | 'email' | 'download') {
  const fileName = `orcamento-${quotation.quotationNumber}.pdf`;

  if (method === 'download') {
    await generateQuotationPDF(quotation, fileName);
    return;
  }

  // For WhatsApp and email sharing, we'll generate the PDF and provide sharing options
  // This is a simplified version - in a real app you'd need proper file handling
  await generateQuotationPDF(quotation, fileName);

  if (method === 'whatsapp') {
    const message = `Olá! Segue em anexo o orçamento ${quotation.quotationNumber} no valor de R$ ${parseFloat(quotation.total).toFixed(2)}. Qualquer dúvida, estou à disposição!`;
    const whatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  } else if (method === 'email') {
    const subject = `Orçamento ${quotation.quotationNumber} - MasterGreen`;
    const body = `Prezado(a) ${quotation.customer.name},\n\nSegue em anexo o orçamento solicitado no valor de R$ ${parseFloat(quotation.total).toFixed(2)}.\n\nQualquer dúvida, estou à disposição!\n\nAtenciosamente,\nEquipe MasterGreen`;
    const mailtoUrl = `mailto:${quotation.customer.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  }
}