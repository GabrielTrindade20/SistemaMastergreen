import jsPDF from 'jspdf';
import type { QuotationWithDetails } from '@shared/schema';
import { formatCurrency, formatPhone, formatDocument, formatCEP } from './calculations';
import Quotations from '@/pages/quotations';
import logoMasterGreen from '@assets/mastergreen-logo.png';

export interface CompanyInfo {
  name: string;
  socialName: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  pixKey: string;
}

// Function to convert image to base64
export async function getImageAsBase64(imagePath: string): Promise<string> {
  try {
    const response = await fetch(imagePath);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading image:', error);
    return '';
  }
}

export async function generateProposalPDF(quotation: QuotationWithDetails, fileName?: string): Promise<Blob> {
  try {
    const doc = new jsPDF();

    // Company information
    const company: CompanyInfo = {
      name: "MG MASTERGREEN",
      socialName: "Master Green Grama Sintética",
      cnpj: "36.347.491/0001-99",
      address: "QNN 24 Conjunto E Lote 14, Ceilândia Sul - DF",
      phone: "(61) 98412-4179",
      email: "mastergreendf@gmail.com",
      pixKey: "36.347.491/0001-99"
    };

    const pageWidth = doc.internal.pageSize.width;
    const leftMargin = 20;
    const rightMargin = 20;
    const contentWidth = pageWidth - leftMargin - rightMargin;

    let yPosition = 20;

    // Try to load logo, if fails continue without it
    try {
      const logoBase64 = await getImageAsBase64(logoMasterGreen);
      if (logoBase64) {
        const logoWidth = 50;
        const logoHeight = 50;
        doc.addImage(logoBase64, 'PNG', (pageWidth - logoWidth) / 2, yPosition, logoWidth, logoHeight);
        yPosition += 40;
      }
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
      // Continue without logo
      yPosition = 20;
    }
  
  // Company details - centered format matching the exact reference
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  // Center-align all company info exactly as in the model
  const companyDetails = [
    `Razão Social: ${company.socialName}`,
    `CNPJ: ${company.cnpj}`,
    `Endereço: ${company.address}`,
    `Telefone: ${company.phone}`,
    `E-mail: ${company.email}`
  ];
  
  companyDetails.forEach((detail, index) => {
    const textWidth = doc.getTextWidth(detail);
    const xPosition = (pageWidth - textWidth) / 2;
    doc.text(detail, xPosition, yPosition + (index * 5));
  });

  yPosition += 40;

  // Title - exactly as in model: just "PROPOSTA"
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const title = "PROPOSTA";
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPosition);

  yPosition += 20;

  // Customer information - exactly as in model format
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  doc.text(`Ao(à): ${quotation.customer.name}`, leftMargin, yPosition);
  yPosition += 5;
  doc.text(`Telefone: ${formatPhone(quotation.customer.phone || '')}`, leftMargin, yPosition);
  yPosition += 5;
  doc.text(`Endereço: ${quotation.customer.address || 'Não informado'}`, leftMargin, yPosition);
  yPosition += 5;
  
  if (quotation.customer.cpfCnpj) {
    const docLabel = quotation.customer.cpfCnpj.replace(/\D/g, '').length === 14 ? 'CNPJ:' : 'CPF:';
    doc.text(`${docLabel} ${formatDocument(quotation.customer.cpfCnpj)}`, leftMargin, yPosition);
  } else {
    doc.text("CPF/CNPJ:", leftMargin, yPosition);
  }
  yPosition += 5;

  const currentDate = new Date().toLocaleDateString('pt-BR');
  doc.text(`Data da Proposta: ${currentDate}`, leftMargin, yPosition);

  // Items table - exactly as in model
  yPosition += 15;

  // Table header with exact styling from model
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");

  const tableHeaders = ["ITEM", "QTD. (m²)", "DESCRIÇÃO DO PRODUTO", "VALOR UNIT.", "VALOR TOTAL"];
  const columnWidths = [15, 25, 70, 25, 25]; // Reduced widths for better fit
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const tableStartX = (pageWidth - tableWidth) / 2; // Center the table
  let xPosition = tableStartX;

  // Draw table header with black borders and centered text
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  
  tableHeaders.forEach((header, index) => {
    doc.rect(xPosition, yPosition, columnWidths[index], 12);
    
    // Center text in each column
    const textWidth = doc.getTextWidth(header);
    const centerX = xPosition + (columnWidths[index] - textWidth) / 2;
    doc.text(header, centerX, yPosition + 8);
    
    xPosition += columnWidths[index];
  });

  yPosition += 12;

  // Table rows with borders and centered content
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  quotation.items.forEach((item, index) => {
    xPosition = tableStartX;
    const rowHeight = 10; // Reduced row height

    // Draw row cells with borders and centered content
    // Item number
    doc.rect(xPosition, yPosition, columnWidths[0], rowHeight);
    const itemNum = (index + 1).toString();
    const itemNumWidth = doc.getTextWidth(itemNum);
    doc.text(itemNum, xPosition + (columnWidths[0] - itemNumWidth) / 2, yPosition + 8);
    xPosition += columnWidths[0];

    // Quantity
    doc.rect(xPosition, yPosition, columnWidths[1], rowHeight);
    const qty = parseFloat(item.quantity).toFixed(0);
    const qtyWidth = doc.getTextWidth(qty);
    doc.text(qty, xPosition + (columnWidths[1] - qtyWidth) / 2, yPosition + 8);
    xPosition += columnWidths[1];

    // Product description - centered
    doc.rect(xPosition, yPosition, columnWidths[2], rowHeight);
    const productName = item.product.name;
    const prodWidth = doc.getTextWidth(productName);
    const prodCenterX = xPosition + (columnWidths[2] - prodWidth) / 2;
    doc.text(productName, prodCenterX, yPosition + 8);
    xPosition += columnWidths[2];

    // Unit price - centered
    doc.rect(xPosition, yPosition, columnWidths[3], rowHeight);
    const unitPrice = formatCurrency(parseFloat(item.unitPrice));
    const unitPriceWidth = doc.getTextWidth(unitPrice);
    const unitCenterX = xPosition + (columnWidths[3] - unitPriceWidth) / 2;
    doc.text(unitPrice, unitCenterX, yPosition + 8);
    xPosition += columnWidths[3];

    // Total price - centered
    doc.rect(xPosition, yPosition, columnWidths[4], rowHeight);
    const totalPrice = formatCurrency(parseFloat(item.subtotal));
    const totalPriceWidth = doc.getTextWidth(totalPrice);
    const totalCenterX = xPosition + (columnWidths[4] - totalPriceWidth) / 2;
    doc.text(totalPrice, totalCenterX, yPosition + 8);

    yPosition += rowHeight;
  });

  // Total row exactly as in model - green background for both cells
  xPosition = tableStartX + columnWidths[0] + columnWidths[1] + columnWidths[2];
  
  // Green background for "TOTAL:" cell
  doc.setFillColor(76, 175, 80); // Green color matching model
  doc.rect(xPosition, yPosition, columnWidths[3], 12, 'FD'); // Reduced height to match rows
  
  // Green background for total value cell
  doc.rect(xPosition + columnWidths[3], yPosition, columnWidths[4], 12, 'FD');
  
  // White text for "TOTAL:"
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  
  const totalLabel = "TOTAL:";
  const totalLabelWidth = doc.getTextWidth(totalLabel);
  const labelCenterX = xPosition + (columnWidths[3] - totalLabelWidth) / 2;
  doc.text(totalLabel, labelCenterX, yPosition + 8);
  
  // White text for total value
  const totalText = formatCurrency(parseFloat(quotation.total));
  const totalTextWidth = doc.getTextWidth(totalText);
  const valueCenterX = xPosition + columnWidths[3] + (columnWidths[4] - totalTextWidth) / 2;
  doc.text(totalText, valueCenterX, yPosition + 8);
  
  // Reset colors for subsequent content
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
    
  // Dados da Proposta - exactly as in model
  yPosition += 20; // Reduced spacing
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Dados da Proposta:", leftMargin, yPosition);

  yPosition += 8; // Reduced spacing
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // Fixed information exactly as in model
  doc.text(`Prazo de garantia: ${quotation.warrantyText || '1 ano (garantia da fábrica)'}.`, leftMargin, yPosition);
  yPosition += 5;

  doc.text("Forma de pagamento: 50% de entrada + 50% na entrega.", leftMargin, yPosition);
  yPosition += 5;

  const shippingText = quotation.shippingIncluded ? "Incluso no valor" : "Não incluso";
  doc.text(`Frete: ${shippingText}`, leftMargin, yPosition);
  yPosition += 5;

  doc.text("Tributos: Incluso no Preço.", leftMargin, yPosition);
  yPosition += 5;

    
    const validade = new Date(quotation.validUntil);

    // Formata para dd/MM/yyyy
    const validadeFormatada = validade.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    // Usa no PDF
    doc.text(`Validade desta proposta: ${validadeFormatada}`, leftMargin, yPosition);
    yPosition += 12;

  // Dados para pagamento - exactly as in model
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Dados para pagamento:", leftMargin, yPosition);
  yPosition += 6;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`PIX: ${company.cnpj} - CNPJ`, leftMargin, yPosition);
  yPosition += 6;
  doc.text("Em nome de: ROCHA COMERCIO E INSTALACAO DE GRAMA SINTETICA LTDA", leftMargin, yPosition);

  // Responsible person - centered exactly as in model
  yPosition += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  
  const responsibleName = quotation.responsibleName || "NEWTON ROCHA";
  const responsiblePosition = quotation.responsiblePosition || "Administrador";

  // Center the name
  const nameWidth = doc.getTextWidth(responsibleName);
  const nameCenterX = (pageWidth - nameWidth) / 2;
  doc.text(responsibleName, nameCenterX, yPosition);
  
  // Center the position below name
  yPosition += 8;
  doc.setFont("helvetica", "normal");
  const positionWidth = doc.getTextWidth(responsiblePosition);
  const positionCenterX = (pageWidth - positionWidth) / 2;
  doc.text(responsiblePosition, positionCenterX, yPosition);

    // Generate and return PDF as Blob
    const pdfBlob = doc.output('blob');
    
    // If fileName is provided, also trigger download
    if (fileName) {
      const dateForFile = new Date().toISOString().split('T')[0];
      const pdfFileName = fileName || `Proposta-${dateForFile}.pdf`;
      doc.save(pdfFileName);
    }
    
    return pdfBlob;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Erro ao gerar PDF. Tente novamente.');
  }
}

// Share function for WhatsApp and email
export async function shareProposalPDF(quotation: QuotationWithDetails, method: 'whatsapp' | 'email' | 'download') {
  const fileName = `proposta-${quotation.quotationNumber}.pdf`;

  if (method === 'download') {
    await generateProposalPDF(quotation, fileName);
    return;
  }

  // For WhatsApp and email sharing, we'll generate the PDF and provide sharing options
  // This is a simplified version - in a real app you'd need proper file handling
  await generateProposalPDF(quotation, fileName);

  if (method === 'whatsapp') {
    const message = `Olá! Segue em anexo a proposta ${quotation.quotationNumber} no valor de R$ ${parseFloat(quotation.total).toFixed(2)}. Qualquer dúvida, estou à disposição!`;
    const whatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  } else if (method === 'email') {
    const subject = `Proposta ${quotation.quotationNumber} - MasterGreen`;
    const body = `Prezado(a) ${quotation.customer.name},\n\nSegue em anexo a proposta solicitada no valor de R$ ${parseFloat(quotation.total).toFixed(2)}.\n\nQualquer dúvida, estou à disposição!\n\nAtenciosamente,\nEquipe MasterGreen`;
    const mailtoUrl = `mailto:${quotation.customer.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  }
}

// Keep the old function name for backward compatibility
export async function generateQuotationPDF(quotation: QuotationWithDetails, fileName?: string): Promise<Blob> {
  return generateProposalPDF(quotation, fileName);
}

export async function shareQuotationPDF(quotation: QuotationWithDetails, method: 'whatsapp' | 'email' | 'download') {
  return shareProposalPDF(quotation, method);
}