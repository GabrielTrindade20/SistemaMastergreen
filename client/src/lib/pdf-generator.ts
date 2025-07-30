import { jsPDF } from 'jspdf';
import type { QuotationWithDetails } from "@shared/schema";
import { formatCurrency, formatDate } from './calculations';

export async function generateQuotationPDF(quotation: QuotationWithDetails): Promise<void> {
  const doc = new jsPDF();
  
  // Company colors
  const masterGreen: [number, number, number] = [0, 43, 23];
  const black: [number, number, number] = [0, 0, 0];
  const gray: [number, number, number] = [128, 128, 128];

  // Header with company logo/name
  doc.setFillColor(masterGreen[0], masterGreen[1], masterGreen[2]);
  doc.rect(0, 0, 210, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('MasterGreen', 20, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestão - Orçamentos', 20, 26);

  // Reset text color
  doc.setTextColor(black[0], black[1], black[2]);

  // Quotation title and number
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPOSTA COMERCIAL', 20, 45);
  
  doc.setFontSize(12);
  doc.text(`Número: ${quotation.quotationNumber}`, 20, 52);
  doc.text(`Data: ${formatDate(quotation.createdAt!)}`, 20, 58);
  doc.text(`Validade: ${formatDate(quotation.validUntil)}`, 20, 64);

  // Customer information
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', 20, 80);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let yPos = 88;
  
  doc.text(`Nome: ${quotation.customer.name}`, 20, yPos);
  yPos += 6;
  doc.text(`Email: ${quotation.customer.email}`, 20, yPos);
  yPos += 6;
  doc.text(`Telefone: ${quotation.customer.phone}`, 20, yPos);
  yPos += 6;
  doc.text(`CPF/CNPJ: ${quotation.customer.cpfCnpj}`, 20, yPos);
  yPos += 6;
  
  if (quotation.customer.address) {
    doc.text(`Endereço: ${quotation.customer.address}${quotation.customer.number ? ', ' + quotation.customer.number : ''}`, 20, yPos);
    yPos += 6;
    if (quotation.customer.neighborhood && quotation.customer.city) {
      doc.text(`${quotation.customer.neighborhood} - ${quotation.customer.city}`, 20, yPos);
      yPos += 6;
    }
  }

  // Products table
  yPos += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUTOS E SERVIÇOS', 20, yPos);
  
  yPos += 10;
  
  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(20, yPos - 2, 170, 8, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Produto', 22, yPos + 3);
  doc.text('Qtd (m²)', 80, yPos + 3);
  doc.text('Valor Unit.', 110, yPos + 3);
  doc.text('Subtotal', 150, yPos + 3);
  
  yPos += 10;
  
  // Table rows
  doc.setFont('helvetica', 'normal');
  quotation.items.forEach((item) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.text(item.product.name, 22, yPos);
    doc.text(parseFloat(item.quantity).toFixed(2), 80, yPos);
    doc.text(formatCurrency(parseFloat(item.unitPrice)), 110, yPos);
    doc.text(formatCurrency(parseFloat(item.subtotal)), 150, yPos);
    
    yPos += 6;
  });

  // Totals
  yPos += 10;
  
  // Draw line
  doc.setDrawColor(gray[0], gray[1], gray[2]);
  doc.line(20, yPos, 190, yPos);
  yPos += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 130, yPos);
  doc.text(formatCurrency(parseFloat(quotation.subtotal)), 160, yPos);
  yPos += 6;
  
  doc.text('Impostos (10%):', 130, yPos);
  doc.text(formatCurrency(parseFloat(quotation.taxAmount)), 160, yPos);
  yPos += 8;
  
  // Draw line for total
  doc.line(130, yPos - 2, 190, yPos - 2);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', 130, yPos + 2);
  doc.text(formatCurrency(parseFloat(quotation.total)), 160, yPos + 2);

  // Notes
  if (quotation.notes) {
    yPos += 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES:', 20, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(quotation.notes, 170);
    doc.text(splitNotes, 20, yPos);
    yPos += splitNotes.length * 4;
  }

  // Terms and validity
  yPos += 15;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(gray[0], gray[1], gray[2]);
  
  doc.text('• Esta proposta tem validade de 7 dias a partir da data de emissão.', 20, yPos);
  yPos += 4;
  doc.text('• Valores sujeitos a alteração sem aviso prévio.', 20, yPos);
  yPos += 4;
  doc.text('• Condições de pagamento e prazo de entrega a serem definidos na aprovação.', 20, yPos);

  // Footer
  yPos = 280;
  doc.setFillColor(masterGreen[0], masterGreen[1], masterGreen[2]);
  doc.rect(0, yPos, 210, 17, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('MasterGreen - Soluções em Pisos e Revestimentos', 20, yPos + 6);
  doc.text('Contato: (61) 9 9999-9999 | mastergreen@contato.com', 20, yPos + 12);

  // Save the PDF
  const fileName = `Orcamento_${quotation.quotationNumber.replace('#', '')}_${quotation.customer.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
