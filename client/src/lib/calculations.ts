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
  products: Product[]
): QuotationTotals {
  const subtotal = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    if (!product || !item.quantity) return sum;
    
    const productPrice = parseFloat(product.pricePerM2);
    return sum + (productPrice * item.quantity);
  }, 0);

  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;

  return {
    subtotal,
    tax,
    total,
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
