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
  const subtotal = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    if (!product || !item.quantity) return sum;
    
    const productPrice = parseFloat(product.pricePerM2);
    return sum + (productPrice * item.quantity);
  }, 0);

  const discountAmount = subtotal * (discountPercent / 100);
  const discountedSubtotal = subtotal - discountAmount;
  const tax = discountedSubtotal * 0.045; // 4.5% tax
  const total = discountedSubtotal + tax;

  // Calculate total cost and profit
  const totalCost = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    if (!product || !item.quantity) return sum;
    
    const productCost = parseFloat(product.costPerM2 || "0");
    return sum + (productCost * item.quantity);
  }, 0);

  const netProfit = total - totalCost;

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
