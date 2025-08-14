import type { Product } from "@shared/schema";

export interface QuotationItem {
  productId: string;
  quantity: number;
}

export interface QuotationTotals {
  subtotal: number;
  tax: number;
  total: number;
}

export function calculateQuotationTotals(
  items: QuotationItem[], 
  products: Product[],
  discountPercent: number = 0
): QuotationTotals & {
  discountAmount: number;
  discountedSubtotal: number;
  totalCost: number;
  netProfit: number;
} {
  // 1. Calcular valor bruto (valor por metro x metragem)
  const subtotal = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    if (!product || !item.quantity) return sum;
    
    const productPrice = parseFloat(product.pricePerM2);
    return sum + (productPrice * item.quantity);
  }, 0);

  // 2. Calcular desconto se aplicável
  const discountAmount = subtotal * (discountPercent / 100);
  const discountedSubtotal = subtotal - discountAmount;

  // 3. Calcular valor da nota fiscal (4,5% de imposto sobre valor bruto)
  const tax = subtotal * 0.045; // Imposto sempre sobre valor bruto, não o com desconto

  // 4. Calcular valor final cobrado do cliente (valor com desconto)
  const total = discountedSubtotal; // Valor final é o valor com desconto, sem somar imposto

  // 5. Calcular custo total da empresa (custo por metro x metragem)
  const totalCost = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    if (!product || !item.quantity) return sum;
    
    const productCost = parseFloat(product.costPerM2 || "0");
    return sum + (productCost * item.quantity);
  }, 0);

  // 6. Calcular lucro líquido (valor final - nota fiscal - custo total)
  const netProfit = total - tax - totalCost;

  return {
    subtotal,
    discountAmount,
    discountedSubtotal,
    tax,
    total,
    totalCost,
    netProfit,
  };
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('pt-BR');
}

export function formatPhone(phone: string): string {
  if (!phone) return '';
  
  // Remove todos os caracteres não numéricos
  const numbers = phone.replace(/\D/g, '');
  
  // Formato: (xx) xxxxx-xxxx
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  
  // Formato: (xx) xxxx-xxxx para telefones fixos
  if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  
  return phone; // Retorna original se não conseguir formatar
}

export function formatCPF(cpf: string): string {
  if (!cpf) return '';
  
  // Remove todos os caracteres não numéricos
  const numbers = cpf.replace(/\D/g, '');
  
  // Formato: xxx.xxx.xxx-xx
  if (numbers.length === 11) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  }
  
  return cpf; // Retorna original se não conseguir formatar
}

export function formatCNPJ(cnpj: string): string {
  if (!cnpj) return '';
  
  // Remove todos os caracteres não numéricos
  const numbers = cnpj.replace(/\D/g, '');
  
  // Formato: xx.xxx.xxx/xxxx-xx
  if (numbers.length === 14) {
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12)}`;
  }
  
  return cnpj; // Retorna original se não conseguir formatar
}

export function formatCEP(cep: string): string {
  if (!cep) return '';
  
  // Remove todos os caracteres não numéricos
  const numbers = cep.replace(/\D/g, '');
  
  // Formato: xxxxx-xxx
  if (numbers.length === 8) {
    return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
  }
  
  return cep; // Retorna original se não conseguir formatar
}

export function formatDocument(document: string): string {
  if (!document) return '';
  
  // Remove todos os caracteres não numéricos
  const numbers = document.replace(/\D/g, '');
  
  // Se tem 11 dígitos, é CPF
  if (numbers.length === 11) {
    return formatCPF(document);
  }
  
  // Se tem 14 dígitos, é CNPJ
  if (numbers.length === 14) {
    return formatCNPJ(document);
  }
  
  return document; // Retorna original se não conseguir identificar
}
