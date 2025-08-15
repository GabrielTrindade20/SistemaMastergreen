import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, FileText } from "lucide-react";
import type { Customer, Product, Cost } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { calculateQuotationTotals, calculateQuotationTotalsWithCosts } from "@/lib/calculations";
import { generateQuotationPDF } from "@/lib/pdf-generator";
import { useAuth } from "@/hooks/useAuth";

const quotationSchema = z.object({
  customerId: z.string().min(1, "Selecione um cliente"),
  validUntil: z.string().min(1, "Data de validade é obrigatória"),
  notes: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  shippingIncluded: z.boolean().default(true),
  warrantyText: z.string().default("1 ano de garantia de fábrica"),
  pdfTitle: z.string().optional(),
  responsibleName: z.string().optional(),
  responsiblePosition: z.string().default("Administrador"),
  items: z.array(z.object({
    productId: z.string().min(1, "Selecione um produto"),
    quantity: z.number().min(0.01, "Quantidade deve ser maior que 0"),
  })).min(1, "Adicione pelo menos um produto"),
  costs: z.array(z.object({
    costId: z.string().min(1, "Selecione um custo"),
    calculationType: z.enum(['fixed', 'percentage']),
    unitValue: z.number().min(0, "Valor deve ser maior ou igual a 0"),
    quantity: z.number().min(0.01, "Quantidade deve ser maior que 0"),
  })).optional(),
});

type QuotationFormData = z.infer<typeof quotationSchema>;

interface QuotationFormProps {
  customers: Customer[];
  products: Product[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: any;
  isAdminMode?: boolean;
  editingId?: string | null;
}

export default function QuotationForm({ 
  customers, 
  products, 
  onSubmit, 
  onCancel, 
  isLoading,
  initialData,
  isAdminMode = false,
  editingId
}: QuotationFormProps) {
  const { user } = useAuth();
  const [quotationItems, setQuotationItems] = useState([
    { productId: "", quantity: 0 }
  ]);
  const [quotationCosts, setQuotationCosts] = useState<Array<{ 
    costId: string; 
    calculationType: 'fixed' | 'percentage';
    unitValue: number;
    quantity: number;
  }>>([]);

  // Fetch available costs
  const { data: costs = [] } = useQuery<Cost[]>({
    queryKey: ["/api/costs"],
  });

  const form = useForm<QuotationFormData>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      customerId: initialData?.customerId || "",
      validUntil: initialData?.validUntil ? new Date(initialData.validUntil).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: initialData?.notes || "",
      discountPercent: parseFloat(initialData?.discountPercent || "0"),
      shippingIncluded: initialData?.shippingIncluded ?? true,
      warrantyText: initialData?.warrantyText || "1 ano de garantia de fábrica",
      pdfTitle: initialData?.pdfTitle || "",
      responsibleName: initialData?.responsibleName || user?.name || "",
      responsiblePosition: initialData?.responsiblePosition || (user?.type === "admin" ? "Administrador" : "Funcionário"),
      items: quotationItems,
      costs: quotationCosts,
    },
  });

  // Load initial data when editing
  useEffect(() => {
    if (initialData) {
      console.log("Loading initial data:", initialData);
      
      // Set form values
      form.reset({
        customerId: initialData.customerId || "",
        validUntil: initialData.validUntil ? new Date(initialData.validUntil).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: initialData.notes || "",
        discountPercent: parseFloat(initialData.discountPercent || "0"),
        shippingIncluded: initialData.shippingIncluded ?? true,
        warrantyText: initialData.warrantyText || "1 ano de garantia de fábrica",
        pdfTitle: initialData.pdfTitle || "",
        responsibleName: initialData.responsibleName || user?.name || "",
        responsiblePosition: initialData.responsiblePosition || (user?.type === "admin" ? "Administrador" : "Funcionário"),
        items: [],
        costs: [],
      });

      // Set quotation items from initial data
      if (initialData.items && initialData.items.length > 0) {
        const loadedItems = initialData.items.map((item: any) => ({
          productId: item.productId || item.product?.id,
          quantity: parseFloat(item.quantity || "0")
        }));
        console.log("Loading items:", loadedItems);
        setQuotationItems(loadedItems);
        form.setValue("items", loadedItems);
      } else {
        // Keep default empty item if no items
        setQuotationItems([{ productId: "", quantity: 0 }]);
      }

      // Set quotation costs from initial data
      if (initialData.costs && initialData.costs.length > 0) {
        const loadedCosts = initialData.costs.map((cost: any) => ({
          costId: cost.costId || cost.cost?.id,
          calculationType: (cost.calculationType || 'fixed') as 'fixed' | 'percentage',
          unitValue: parseFloat(cost.unitValue || "0"),
          quantity: parseFloat(cost.quantity || "1")
        }));
        console.log("Loading costs:", loadedCosts);
        setQuotationCosts(loadedCosts);
        form.setValue("costs", loadedCosts);
      }
    }
  }, [initialData, form, user]);

  const addProduct = () => {
    const newItems = [...quotationItems, { productId: "", quantity: 0 }];
    setQuotationItems(newItems);
    form.setValue("items", newItems);
  };

  const removeProduct = (index: number) => {
    if (quotationItems.length > 1) {
      const newItems = quotationItems.filter((_, i) => i !== index);
      setQuotationItems(newItems);
      form.setValue("items", newItems);
    }
  };

  const updateItem = (index: number, field: 'productId' | 'quantity', value: string | number) => {
    const newItems = [...quotationItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setQuotationItems(newItems);
    form.setValue("items", newItems);
  };

  const addCost = () => {
    const newCosts = [...quotationCosts, { 
      costId: "", 
      calculationType: 'fixed' as const,
      unitValue: 0,
      quantity: 1
    }];
    setQuotationCosts(newCosts);
    form.setValue("costs", newCosts);
  };

  const removeCost = (index: number) => {
    const newCosts = quotationCosts.filter((_, i) => i !== index);
    setQuotationCosts(newCosts);
    form.setValue("costs", newCosts);
  };

  const updateCost = (index: number, field: keyof typeof quotationCosts[0], value: string | number) => {
    const newCosts = [...quotationCosts];
    newCosts[index] = { ...newCosts[index], [field]: value };
    setQuotationCosts(newCosts);
    form.setValue("costs", newCosts);
  };

  // Calculate totals first (need this for percentage calculation)
  const discountPercent = form.watch("discountPercent") || 0;
  const sellerCommissionPercent = initialData?.user?.commissionPercent ? parseFloat(initialData.user.commissionPercent) : 0;
  
  const totals = calculateQuotationTotalsWithCosts(
    quotationItems, 
    products, 
    quotationCosts, 
    discountPercent,
    sellerCommissionPercent
  );
  
  const getCostTotal = (cost: typeof quotationCosts[0]) => {
    if (cost.calculationType === 'percentage') {
      // Calculate subtotal for percentage base
      const subtotal = quotationItems.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        if (!product || !item.quantity) return sum;
        const productPrice = parseFloat(product.pricePerM2);
        return sum + (productPrice * item.quantity);
      }, 0);
      return (subtotal * (cost.unitValue / 100)) * (cost.quantity || 1);
    } else {
      return (cost.unitValue || 0) * (cost.quantity || 1);
    }
  };

  const getCost = (costId: string) => {
    return costs.find(c => c.id === costId);
  };

  const getProduct = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  const getItemSubtotal = (item: { productId: string; quantity: number }) => {
    const product = getProduct(item.productId);
    if (!product || !item.quantity) return 0;
    return parseFloat(product.pricePerM2) * item.quantity;
  };

  const handleSubmit = (data: QuotationFormData) => {
    const quotationData = {
      customerId: data.customerId,
      userId: user?.id || initialData?.user?.id,
      subtotal: totals.finalTotal.toString(),
      discountPercent: (data.discountPercent || 0).toString(),
      discountAmount: totals.discountAmount.toString(),
      taxAmount: totals.invoiceValue.toString(),
      totalCost: totals.totalCosts.toString(),
      total: totals.finalTotal.toString(),
      netProfit: totals.netProfit.toString(),
      validUntil: new Date(data.validUntil).toISOString(),
      notes: data.notes || null,
      shippingIncluded: data.shippingIncluded ? 1 : 0,
      warrantyText: data.warrantyText || "1 ano de garantia de fábrica",
      pdfTitle: data.pdfTitle || null,
      responsibleName: data.responsibleName || user?.name || null,
      responsiblePosition: data.responsiblePosition || (user?.type === "admin" ? "Administrador" : "Funcionário"),
      branch: user?.branch || initialData?.user?.branch || "Ceilândia",
      items: quotationItems.map(item => {
        const product = getProduct(item.productId)!;
        const unitPrice = parseFloat(product.pricePerM2);
        const unitCost = parseFloat(product.costPerM2 || "0");
        const subtotal = unitPrice * item.quantity;
        const totalCost = unitCost * item.quantity;
        
        return {
          productId: item.productId,
          quantity: item.quantity.toString(),
          unitPrice: unitPrice.toString(),
          unitCost: unitCost.toString(),
          subtotal: subtotal.toString(),
          totalCost: totalCost.toString(),
        };
      }),
      costs: quotationCosts.map(cost => {
        const costData = getCost(cost.costId)!;
        return {
          costId: cost.costId,
          calculationType: cost.calculationType,
          unitValue: cost.unitValue.toString(),
          quantity: cost.quantity.toString(),
          totalValue: getCostTotal(cost).toString(),
        };
      }),
    };

    onSubmit(quotationData);
  };

  const handleGeneratePDF = async () => {
    const formData = form.getValues();
    const customer = customers.find(c => c.id === formData.customerId);
    
    if (!customer) {
      form.setError("customerId", { message: "Selecione um cliente" });
      return;
    }

    if (quotationItems.some(item => !item.productId || item.quantity <= 0)) {
      form.setError("items", { message: "Preencha todos os produtos corretamente" });
      return;
    }

    const quotationData = {
      id: 'preview',
      quotationNumber: '#PREVIEW',
      subtotal: totals.subtotal.toString(),
      discountPercent: (formData.discountPercent || 0).toString(),
      discountAmount: totals.discountAmount.toString(),
      taxAmount: totals.tax.toString(),
      totalCost: totals.totalCost.toString(),
      total: totals.total.toString(),
      netProfit: totals.netProfit.toString(),
      status: 'pending',
      validUntil: formData.validUntil,
      notes: formData.notes || null,
      shippingIncluded: formData.shippingIncluded,
      warrantyText: formData.warrantyText || "1 ano de garantia de fábrica",
      pdfTitle: formData.pdfTitle || null,
      responsibleName: formData.responsibleName || null,
      responsiblePosition: formData.responsiblePosition || "Administrador",
      createdAt: new Date().toISOString(),
      customer,
      items: formData.items.map(item => {
        const product = getProduct(item.productId)!;
        const unitPrice = parseFloat(product.pricePerM2);
        const subtotal = unitPrice * item.quantity;
        
        return {
          id: Math.random().toString(),
          quotationId: 'preview',
          productId: item.productId,
          quantity: item.quantity.toString(),
          unitPrice: unitPrice.toString(),
          subtotal: subtotal.toString(),
          product,
        };
      }),
    };

    try {
      await generateQuotationPDF(quotationData as any);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Customer Selection */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados do Cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  {isAdminMode ? (
                    <div className="p-3 bg-gray-100 border rounded-md">
                      <span className="text-gray-900">
                        {customers.find(c => c.id === field.value)?.name || 'Cliente não encontrado'}
                      </span>
                    </div>
                  ) : (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map(customer => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="validUntil"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Validade *</FormLabel>
                  <FormControl>
                    {isAdminMode ? (
                      <div className="p-3 bg-gray-100 border rounded-md">
                        <span className="text-gray-900">
                          {field.value ? new Date(field.value).toLocaleDateString('pt-BR') : 'Não definido'}
                        </span>
                      </div>
                    ) : (
                      <Input type="date" {...field} />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Products Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Produtos</h3>
            {!isAdminMode && (
              <Button type="button" className="btn-primary" onClick={addProduct}>
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Produto
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {quotationItems.map((item, index) => {
              const product = getProduct(item.productId);
              const itemSubtotal = getItemSubtotal(item);

              return (
                <Card key={index} className="bg-gray-50">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Produto *
                        </label>
                        {isAdminMode ? (
                          <div className="p-3 bg-gray-100 border rounded-md">
                            <span className="text-gray-900">
                              {product?.name || 'Produto não encontrado'}
                            </span>
                          </div>
                        ) : (
                          <Select
                            value={item.productId}
                            onValueChange={(value) => updateItem(index, 'productId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(product => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} (R$ {parseFloat(product.pricePerM2).toFixed(2)}/m²)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Metragem (m²) *
                        </label>
                        {isAdminMode ? (
                          <div className="p-3 bg-gray-100 border rounded-md">
                            <span className="text-gray-900">
                              {item.quantity ? item.quantity.toFixed(2) : '0.00'}
                            </span>
                          </div>
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={item.quantity || ""}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Valor Unitário
                        </label>
                        <Input
                          value={product ? `R$ ${parseFloat(product.pricePerM2).toFixed(2)}` : 'R$ 0,00'}
                          readOnly
                          className="bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Subtotal
                        </label>
                        <Input
                          value={`R$ ${itemSubtotal.toFixed(2)}`}
                          readOnly
                          className="bg-gray-100"
                        />
                      </div>
                      {!isAdminMode && (
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeProduct(index)}
                            disabled={quotationItems.length === 1}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Costs Section */}
        {user?.type === "admin" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Custos Adicionais</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCost}
                data-testid="button-add-cost"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Custo
              </Button>
            </div>
            
            <div className="space-y-4">
              {quotationCosts.map((cost, index) => {
                const costData = getCost(cost.costId);
                return (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Custo *
                          </label>
                          <Select
                            value={cost.costId}
                            onValueChange={(value) => updateCost(index, 'costId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um custo" />
                            </SelectTrigger>
                            <SelectContent>
                              {costs.map(costOption => (
                                <SelectItem key={costOption.id} value={costOption.id}>
                                  {costOption.name} - {costOption.supplier}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tipo de Cálculo
                          </label>
                          <div className="flex space-x-2">
                            <Button
                              type="button"
                              variant={cost.calculationType === 'fixed' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateCost(index, 'calculationType', 'fixed')}
                              className="flex-1"
                            >
                              R$
                            </Button>
                            <Button
                              type="button"
                              variant={cost.calculationType === 'percentage' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateCost(index, 'calculationType', 'percentage')}
                              className="flex-1"
                            >
                              %
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Valor Unitário
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={cost.unitValue || ""}
                            onChange={(e) => updateCost(index, 'unitValue', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quantidade
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="1.00"
                            value={cost.quantity || ""}
                            onChange={(e) => updateCost(index, 'quantity', parseFloat(e.target.value) || 1)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Total
                          </label>
                          <Input
                            value={`R$ ${getCostTotal(cost).toFixed(2)}`}
                            readOnly
                            className="bg-gray-100 text-red-600 font-semibold"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCost(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary Section */}
        <Card className="bg-gray-50 border-2">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Resumo Financeiro</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700 font-medium">Total Final ao Cliente:</span>
                <span className="text-gray-900 font-bold text-lg">
                  R$ {totals.finalTotal.toFixed(2)}
                </span>
              </div>
              
              {(user?.type === "admin" || isAdminMode) && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Total de Custos:</span>
                    <span className="text-gray-900 font-medium">
                      R$ {totals.totalCosts.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-700">Valor da Nota Fiscal (5%):</span>
                    <span className="text-gray-900 font-medium">
                      R$ {totals.invoiceValue.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-700">Total com Nota Fiscal:</span>
                    <span className="text-gray-900 font-medium">
                      R$ {totals.totalWithInvoice.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="border-t border-gray-300 pt-3">
                    <div className="flex justify-between">
                      <span className="text-blue-700 font-semibold">Lucro da Empresa:</span>
                      <span className="text-blue-700 font-bold">
                        R$ {totals.companyProfit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-700">Porcentagem de Lucro:</span>
                    <span className="text-gray-900 font-medium">
                      {totals.profitPercent.toFixed(2)}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-700">Dízimo (10%):</span>
                    <span className="text-gray-900 font-medium">
                      R$ {totals.tithe.toFixed(2)}
                    </span>
                  </div>
                  
                  {sellerCommissionPercent > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">Comissão Vendedor ({sellerCommissionPercent}%):</span>
                      <span className="text-gray-900 font-medium">
                        R$ {totals.sellerCommission.toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  <div className="border-t border-gray-300 pt-3">
                    <div className="flex justify-between">
                      <span className="text-green-700 font-semibold text-lg">Lucro Líquido:</span>
                      <span className="text-green-700 font-bold text-lg">
                        R$ {totals.netProfit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Additional Configuration */}
        {!isAdminMode && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurações Adicionais</h3>
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
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shippingIncluded"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Frete incluso?
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <FormField
              control={form.control}
              name="warrantyText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo de Garantia</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="1 ano de garantia de fábrica"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pdfTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título do PDF</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="PROPOSTA PARA VENDA E INSTALAÇÃO DE GRAMA SINTÉTICA"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Responsável pelo orçamento</label>
              <div className="p-3 bg-gray-50 border rounded-md">
                <p className="text-sm font-medium">{user?.name || "Não informado"}</p>
                <p className="text-xs text-gray-500">{user?.type === "admin" ? "Administrador" : "Funcionário"}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Filial</label>
              <div className="p-3 bg-gray-50 border rounded-md">
                <p className="text-sm font-medium">{user?.branch || "Não informado"}</p>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Additional Information */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  placeholder="Observações adicionais sobre o orçamento..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" variant="secondary" onClick={handleGeneratePDF}>
            <FileText className="w-4 h-4 mr-2" />
            Visualizar PDF
          </Button>
          <Button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? "Salvando..." : "Salvar Orçamento"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
