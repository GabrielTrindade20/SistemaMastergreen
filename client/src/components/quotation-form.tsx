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
import type { Customer, Product } from "@shared/schema";
import { calculateQuotationTotals } from "@/lib/calculations";
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
});

type QuotationFormData = z.infer<typeof quotationSchema>;

interface QuotationFormProps {
  customers: Customer[];
  products: Product[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export default function QuotationForm({ 
  customers, 
  products, 
  onSubmit, 
  onCancel, 
  isLoading 
}: QuotationFormProps) {
  const { user } = useAuth();
  const [quotationItems, setQuotationItems] = useState([
    { productId: "", quantity: 0 }
  ]);

  const form = useForm<QuotationFormData>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      customerId: "",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "",
      discountPercent: 0,
      shippingIncluded: true,
      warrantyText: "1 ano de garantia de fábrica",
      pdfTitle: "",
      responsibleName: user?.name || "",
      responsiblePosition: user?.type === "admin" ? "Administrador" : "Funcionário",
      items: quotationItems,
    },
  });

  // Calculate totals with discount
  const discountPercent = form.watch("discountPercent") || 0;
  const totals = calculateQuotationTotals(quotationItems, products, discountPercent);

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
      quotation: {
        customerId: data.customerId,
        subtotal: totals.subtotal.toString(),
        discountPercent: (data.discountPercent || 0).toString(),
        discountAmount: totals.discountAmount.toString(),
        taxAmount: totals.tax.toString(),
        totalCost: totals.totalCost.toString(),
        total: totals.total.toString(),
        netProfit: totals.netProfit.toString(),
        validUntil: data.validUntil,
        notes: data.notes || null,
        shippingIncluded: data.shippingIncluded ? 1 : 0,
        warrantyText: data.warrantyText || "1 ano de garantia de fábrica",
        pdfTitle: data.pdfTitle || null,
        responsibleName: user?.name || null,
        responsiblePosition: user?.type === "admin" ? "Administrador" : "Funcionário",
      },
      items: data.items.map(item => {
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
                    <Input type="date" {...field} />
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
            <Button type="button" className="btn-primary" onClick={addProduct}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar Produto
            </Button>
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
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Metragem (m²) *
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={item.quantity || ""}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
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
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Summary Section */}
        <Card className="bg-gray-50">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo do Orçamento</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-900 font-medium">
                  R$ {totals.subtotal.toFixed(2)}
                </span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Desconto ({discountPercent}%):</span>
                  <span>- R$ {totals.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Impostos (4,5%):</span>
                <span className="text-gray-900 font-medium">
                  R$ {totals.tax.toFixed(2)}
                </span>
              </div>
              {user?.type === "admin" && (
                <div className="flex justify-between text-blue-600">
                  <span className="font-medium">Lucro da Empresa:</span>
                  <span className="font-bold">R$ {totals.netProfit.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-gray-300 pt-2">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-lg font-bold text-master-green">
                    R$ {totals.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Configuration */}
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
