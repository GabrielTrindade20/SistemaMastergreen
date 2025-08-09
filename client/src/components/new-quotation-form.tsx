import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Calculator } from "lucide-react";
import type { Customer, Product, Cost } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/calculations";
import { useAuth } from "@/hooks/useAuth";

const quotationSchema = z.object({
  customerId: z.string().min(1, "Selecione um cliente"),
  validUntil: z.string().min(1, "Data de validade é obrigatória"),
  notes: z.string().optional(),
  shippingIncluded: z.boolean().default(true),
  warrantyText: z.string().default("1 ano de garantia de fábrica"),
  pdfTitle: z.string().optional(),
  responsibleName: z.string().optional(),
  responsiblePosition: z.string().default("Administrador"),
  discountPercent: z.string().optional(),
  discountAmount: z.string().optional(),
});

type QuotationFormData = z.infer<typeof quotationSchema>;

interface QuotationItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice: number;
}

interface QuotationCost {
  costId: string;
  name: string;
  unitValue: number;
  quantity: number;
  totalValue: number;
  supplier?: string;
  description?: string;
}

interface QuotationCalculations {
  subtotal: number; // Total dos produtos (valor total da venda)
  totalCosts: number; // Soma de todos os custos
  totalWithoutInvoice: number; // Total dos custos
  invoicePercent: number; // 5%
  invoiceAmount: number; // 5% sobre o valor da venda
  totalWithInvoice: number; // Total custos + 5% da venda
  companyProfit: number; // Valor da venda - Total com NF
  profitPercent: number; // Porcentagem de lucro
  tithe: number; // 10% do lucro da empresa
  netProfit: number; // Lucro após dízimo
  total: number; // Total final ao cliente (= subtotal)
}

interface NewQuotationFormProps {
  customers: Customer[];
  products: Product[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export default function NewQuotationForm({ 
  customers, 
  products, 
  onSubmit, 
  onCancel, 
  isLoading 
}: NewQuotationFormProps) {
  const { user } = useAuth();
  
  const [items, setItems] = useState<QuotationItem[]>([{
    productId: '',
    quantity: 0,
    unitPrice: 0,
    originalUnitPrice: 0,
  }]);
  
  const [costs, setCosts] = useState<QuotationCost[]>([]);
  
  const [calculations, setCalculations] = useState<QuotationCalculations>({
    subtotal: 0,
    totalCosts: 0,
    totalWithoutInvoice: 0,
    invoicePercent: 5.00,
    invoiceAmount: 0,
    totalWithInvoice: 0,
    companyProfit: 0,
    profitPercent: 0,
    tithe: 0,
    netProfit: 0,
    total: 0,
  });

  // Fetch available costs
  const { data: availableCosts = [] } = useQuery<Cost[]>({
    queryKey: ["/api/costs"],
  });

  const form = useForm<QuotationFormData>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      customerId: "",
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "",
      shippingIncluded: true,
      warrantyText: "1 ano de garantia de fábrica",
      pdfTitle: "",
      responsibleName: user?.name || "",
      responsiblePosition: "Administrador",
      discountPercent: "",
      discountAmount: "",
    },
  });

  // Recalcular automaticamente quando items ou costs mudarem
  useEffect(() => {
    calculateTotals();
  }, [items, costs]);

  const calculateTotals = () => {
    // 1. Total Final ao Cliente: quantidade do produto * valor do metro do produto
    const totalFinalCliente = items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);

    // 2. Total de Custos: soma de todos os custos
    const totalCosts = costs.reduce((sum, cost) => {
      return sum + cost.totalValue;
    }, 0);

    // 3. Valor Total dos Produtos: soma de todos os custos, incluindo a grama (produto escolhido)
    const valorTotalProdutos = totalCosts + totalFinalCliente;

    // 4. Valor da Nota Fiscal (5%): Total Final ao Cliente * 5%
    const invoicePercent = 5.00;
    const invoiceAmount = totalFinalCliente * (invoicePercent / 100);

    // 5. Total com Nota Fiscal: Total de Custos + Valor da Nota Fiscal
    const totalWithInvoice = totalCosts + invoiceAmount;

    // 6. Lucro da Empresa: Total Final ao Cliente - Total com Nota Fiscal
    const companyProfit = totalFinalCliente - totalWithInvoice;

    // 7. Porcentagem de Lucro: Lucro da Empresa * 100 / Total Final ao Cliente
    const profitPercent = totalFinalCliente > 0 ? (companyProfit * 100) / totalFinalCliente : 0;

    // 8. Dízimo (10%): Lucro da Empresa * 10%
    const tithe = companyProfit * 0.10;

    // 9. Lucro Líquido: Lucro da Empresa - Dízimo
    const netProfit = companyProfit - tithe;

    setCalculations({
      subtotal: valorTotalProdutos, // Valor Total dos Produtos
      totalCosts, // Total de Custos
      totalWithoutInvoice: totalCosts, // Total sem nota fiscal = total de custos
      invoicePercent,
      invoiceAmount, // Valor da Nota Fiscal (5%)
      totalWithInvoice, // Total com Nota Fiscal
      companyProfit, // Lucro da Empresa
      profitPercent, // Porcentagem de Lucro
      tithe, // Dízimo (10%)
      netProfit, // Lucro Líquido
      total: totalFinalCliente, // Total Final ao Cliente
    });
  };

  const addItem = () => {
    setItems([...items, {
      productId: '',
      quantity: 0,
      unitPrice: 0,
      originalUnitPrice: 0,
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Se mudou o produto, atualizar o preço padrão
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].unitPrice = parseFloat(product.pricePerM2);
        newItems[index].originalUnitPrice = parseFloat(product.pricePerM2);
      }
    }
    
    setItems(newItems);
  };

  const addCost = () => {
    if (availableCosts.length === 0) return;
    
    const firstCost = availableCosts[0];
    const newCost: QuotationCost = {
      costId: firstCost.id,
      name: firstCost.name,
      unitValue: parseFloat(firstCost.value),
      quantity: 1,
      totalValue: parseFloat(firstCost.value),
      supplier: firstCost.supplier || '',
      description: firstCost.description || '',
    };
    
    setCosts([...costs, newCost]);
  };

  const removeCost = (index: number) => {
    setCosts(costs.filter((_, i) => i !== index));
  };

  const updateCost = (index: number, field: keyof QuotationCost, value: any) => {
    const newCosts = [...costs];
    newCosts[index] = { ...newCosts[index], [field]: value };
    
    // Se mudou o custo, atualizar os dados
    if (field === 'costId') {
      const cost = availableCosts.find(c => c.id === value);
      if (cost) {
        newCosts[index].name = cost.name;
        newCosts[index].unitValue = parseFloat(cost.value);
        newCosts[index].supplier = cost.supplier || '';
        newCosts[index].description = cost.description || '';
      }
    }
    
    // Recalcular total do custo
    if (field === 'unitValue' || field === 'quantity') {
      newCosts[index].totalValue = newCosts[index].unitValue * newCosts[index].quantity;
    }
    
    setCosts(newCosts);
  };

  const handleSubmit = (formData: QuotationFormData) => {
    const quotationData = {
      ...formData,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      costs: costs.map(cost => ({
        costId: cost.costId === 'manual' ? null : cost.costId,
        name: cost.name,
        unitValue: cost.unitValue,
        quantity: cost.quantity,
        totalValue: cost.totalValue,
        supplier: cost.supplier,
        description: cost.description,
      })),
      calculations,
    };
    
    onSubmit(quotationData);
  };

  const isAdmin = user?.type === "admin";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cliente */}
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-customer">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Data de Validade */}
          <FormField
            control={form.control}
            name="validUntil"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Válido até</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-valid-until" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Produtos */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div>
                    <label className="text-sm font-medium">Produto</label>
                    <Select 
                      value={item.productId} 
                      onValueChange={(value) => updateItem(index, 'productId', value)}
                    >
                      <SelectTrigger data-testid={`select-product-${index}`}>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Quantidade (m²)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      data-testid={`input-quantity-${index}`}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Valor Unitário (R$/m²)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unitPrice || ''}
                      onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      data-testid={`input-unit-price-${index}`}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Subtotal</label>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </div>
                  </div>
                  
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      data-testid={`button-remove-item-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                data-testid="button-add-item"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Produto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Custos - Apenas para Admin */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Custos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {costs.map((cost, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div>
                      <label className="text-sm font-medium">Custo</label>
                      <Select 
                        value={cost.costId} 
                        onValueChange={(value) => updateCost(index, 'costId', value)}
                      >
                        <SelectTrigger data-testid={`select-cost-${index}`}>
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCosts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="manual">Custo Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Nome</label>
                      <Input
                        value={cost.name}
                        onChange={(e) => updateCost(index, 'name', e.target.value)}
                        data-testid={`input-cost-name-${index}`}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Valor Unitário</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cost.unitValue || ''}
                        onChange={(e) => updateCost(index, 'unitValue', parseFloat(e.target.value) || 0)}
                        data-testid={`input-cost-unit-value-${index}`}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Quantidade</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cost.quantity || ''}
                        onChange={(e) => updateCost(index, 'quantity', parseFloat(e.target.value) || 0)}
                        data-testid={`input-cost-quantity-${index}`}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Total</label>
                      <div className="text-lg font-semibold text-red-600">
                        {formatCurrency(cost.totalValue)}
                      </div>
                    </div>
                    
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeCost(index)}
                        data-testid={`button-remove-cost-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCost}
                  disabled={availableCosts.length === 0}
                  data-testid="button-add-cost"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Custo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resumo dos Cálculos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Resumo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Valores para todos */}
              <div className="flex justify-between">
                <span>Valor Total dos Produtos:</span>
                <span className="font-semibold">{formatCurrency(calculations.subtotal)}</span>
              </div>
              
              <div className="flex justify-between">
                <span>Total Final ao Cliente:</span>
                <span className="font-bold text-lg text-green-600">{formatCurrency(calculations.total)}</span>
              </div>

              {/* Valores apenas para Admin */}
              {isAdmin && (
                <>
                  <hr className="my-4" />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total de Custos:</span>
                      <span className="text-red-600">{formatCurrency(calculations.totalCosts)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span>Valor da Nota Fiscal (5%):</span>
                      <span>{formatCurrency(calculations.invoiceAmount)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span>Total com Nota Fiscal:</span>
                      <span>{formatCurrency(calculations.totalWithInvoice)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span>Lucro da Empresa:</span>
                      <span className="text-blue-600">{formatCurrency(calculations.companyProfit)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span>Porcentagem de Lucro:</span>
                      <span>{calculations.profitPercent.toFixed(2)}%</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span>Dízimo (10%):</span>
                      <span>{formatCurrency(calculations.tithe)}</span>
                    </div>
                    
                    <div className="flex justify-between font-semibold">
                      <span>Lucro Líquido:</span>
                      <span className="text-green-600">{formatCurrency(calculations.netProfit)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configurações Adicionais */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações da Proposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Desconto */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discountPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Desconto (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-discount-percent"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="discountAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor do Desconto (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-discount-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Frete e Garantia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="shippingIncluded"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Frete Incluso</FormLabel>
                      <FormDescription>
                        Marque se o frete está incluído no valor
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-shipping-included"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="warrantyText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Texto da Garantia</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="1 ano de garantia de fábrica"
                        {...field}
                        data-testid="input-warranty-text"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Informações do Responsável */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="responsibleName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Responsável</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nome completo"
                        {...field}
                        data-testid="input-responsible-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsiblePosition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo do Responsável</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Administrador, Vendedor"
                        {...field}
                        data-testid="input-responsible-position"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Título personalizado do PDF */}
            <FormField
              control={form.control}
              name="pdfTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título Personalizado da Proposta</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Proposta Comercial - Instalação de Grama Sintética"
                      {...field}
                      data-testid="input-pdf-title"
                    />
                  </FormControl>
                  <FormDescription>
                    Deixe em branco para usar o título padrão
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Observações */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea placeholder="Observações adicionais..." {...field} data-testid="textarea-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Botões */}
        <div className="flex justify-end gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            data-testid="button-submit"
          >
            {isLoading ? "Salvando..." : "Salvar Proposta"}
          </Button>
        </div>
      </form>
    </Form>
  );
}