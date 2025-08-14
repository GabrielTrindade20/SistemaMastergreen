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

// Function to convert image to base64
async function getImageAsBase64(imagePath: string): Promise<string> {
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
      socialName: "Rocha Comércio e Instalação de Grama Sintética",
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

    let yPosition = 15;

    // Try to load logo, if fails continue without it
    try {
      const logoBase64 = await getImageAsBase64('/src/imagem/logoSemFundo.png');
      if (logoBase64) {
        const logoWidth = 60;
        const logoHeight = 60;
        doc.addImage(logoBase64, 'PNG', 75, 5, logoWidth, logoHeight);
        yPosition = 45;
      }
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
      // Continue without logo
      yPosition = 15;
    }
  
  // Company details - centered format matching the reference
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  // Center-align all company info
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
    doc.text(detail, xPosition, yPosition + (index * 4));
  });


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
  doc.text(`Ao ${quotation.customer.name}`, leftMargin, yPosition);
  
  // // A/C line (if there's a contact person)
  // if (quotation.customer.name) {
  //   yPosition += 5;
  //   doc.text(`A/C: ${quotation.customer.name}`, leftMargin, yPosition);
  // }
  
  yPosition += 5;
  doc.text(`Telefone: ${quotation.customer.phone || 'Não informado'}`, leftMargin, yPosition);
  yPosition += 5;
  doc.text(`Endereço: ${quotation.customer.address || 'Não informado'}`, leftMargin, yPosition);
  
  if (quotation.customer.cpfCnpj) {
    yPosition += 5;
    doc.text(`CNPJ: ${quotation.customer.cpfCnpj}`, leftMargin, yPosition);
  }

  const currentDate = new Date().toLocaleDateString('pt-BR');
  yPosition += 5;
  doc.text(`Data da Proposta: ${currentDate}`, leftMargin, yPosition);

  // Items table
  yPosition += 10;

  // Table header - centered format like reference
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");

  const tableHeaders = ["ITEM", "QTD.\n(m²)", "DESCRIÇÃO DO PRODUTO", "VALOR\nUNIT.", "VALOR\nTOTAL"];
  const columnWidths = [20, 25, 80, 25, 25];
  let xPosition = leftMargin;

  // Draw table header with centered text
  tableHeaders.forEach((header, index) => {
    doc.rect(xPosition, yPosition, columnWidths[index], 12);
    
    // Center text in each column
    const lines = header.split('\n');
    lines.forEach((line, lineIndex) => {
      const textWidth = doc.getTextWidth(line);
      const centerX = xPosition + (columnWidths[index] - textWidth) / 2;
      doc.text(line, centerX, yPosition + 6 + (lineIndex * 3));
    });
    
    xPosition += columnWidths[index];
  });

  yPosition += 12;

  // Table rows with centered content
  doc.setFont("helvetica", "normal");
  quotation.items.forEach((item, index) => {
    xPosition = leftMargin;
    const rowHeight = 10;

    // Draw row cells with centered content
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

    // Product description - left aligned with padding
    doc.rect(xPosition, yPosition, columnWidths[2], rowHeight);
    const productName = item.product.name;
    // Split long product names into multiple lines if needed
    const maxWidth = columnWidths[2] - 4;
    const words = productName.split(' ');
    let line = '';
    let lineY = yPosition + 8;
    
    words.forEach(word => {
      const testLine = line + (line ? ' ' : '') + word;
      if (doc.getTextWidth(testLine) > maxWidth && line) {
        doc.text(line, xPosition + 2, lineY);
        line = word;
        lineY += 4;
      } else {
        line = testLine;
      }
    });
    if (line) {
      doc.text(line, xPosition + 2, lineY);
    }
    xPosition += columnWidths[2];

    // Unit price - right aligned
    doc.rect(xPosition, yPosition, columnWidths[3], rowHeight);
    const unitPrice = `R$ ${parseFloat(item.unitPrice).toFixed(0)}`;
    const unitPriceWidth = doc.getTextWidth(unitPrice);
    doc.text(unitPrice, xPosition + columnWidths[3] - unitPriceWidth - 2, yPosition + 8);
    xPosition += columnWidths[3];

    // Total price - right aligned
    doc.rect(xPosition, yPosition, columnWidths[4], rowHeight);
    const totalPrice = `R$ ${parseFloat(item.subtotal).toFixed(2).replace('.', ',')}`;
    const totalPriceWidth = doc.getTextWidth(totalPrice);
    doc.text(totalPrice, xPosition + columnWidths[4] - totalPriceWidth - 2, yPosition + 8);

    yPosition += rowHeight;
  });

  // Total row with green background spanning the last column
  xPosition = leftMargin + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3];
  
  // Set green background color #298a1e
  doc.setFillColor(41, 138, 30); // RGB values for #298a1e
  doc.rect(xPosition, yPosition, columnWidths[4], 15, 'F'); // 'F' fills the rectangle
  
  // Add border around the green cell
  doc.setDrawColor(0, 0, 0); // Black border
  doc.rect(xPosition, yPosition, columnWidths[4], 15, 'S'); // 'S' for stroke only
  
  // Set white text color for contrast
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  
  const totalText = `R$ ${parseFloat(quotation.total).toFixed(2).replace('.', ',')}`;
  const totalTextWidth = doc.getTextWidth(totalText);
  doc.text(totalText, xPosition + (columnWidths[4] - totalTextWidth) / 2, yPosition + 10);
  
  // CRITICAL: Reset all colors and settings to default for subsequent content
  doc.setTextColor(0, 0, 0); // Reset text to black
  doc.setFillColor(255, 255, 255); // Reset fill to white
  doc.setDrawColor(0, 0, 0); // Reset draw color to black
    
  // Additional information
  yPosition += 12;
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