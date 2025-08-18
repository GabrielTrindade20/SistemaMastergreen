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
import { Plus, Trash2, Calculator, Search, Check, ChevronsUpDown, Share2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Customer, Product, Cost } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/calculations";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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
});

type QuotationFormData = z.infer<typeof quotationSchema>;

interface QuotationItem {
  productId: string;
  quantity: number | string;
  unitPrice: number | string; // Custo unitário do produto
  salePrice: number | string; // Valor por metro para venda ao cliente
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
  calculationType: 'fixed' | 'percentage'; // R$ ou %
  percentageValue?: number; // Valor da porcentagem quando calculationType é 'percentage'
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
  discount: number; // Valor do desconto
  finalTotal: number; // Total final com desconto
}

interface NewQuotationFormProps {
  customers: Customer[];
  products: Product[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: any;
}

export function NewQuotationForm({ 
  customers, 
  products, 
  onSubmit, 
  onCancel, 
  isLoading,
  initialData 
}: NewQuotationFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [items, setItems] = useState<QuotationItem[]>([{
    productId: '',
    quantity: 0,
    unitPrice: 0, // Custo unitário
    salePrice: 0, // Valor de venda por metro
    originalUnitPrice: 0,
  }]);
  
  const [costs, setCosts] = useState<QuotationCost[]>([]);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchValue, setCustomerSearchValue] = useState("");
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  
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
    discount: 0,
    finalTotal: 0,
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
    },
  });

  // Atualizar o nome do responsável quando o usuário for carregado
  useEffect(() => {
    if (user?.name && !initialData) {
      form.setValue('responsibleName', user.name);
    }
  }, [user, form, initialData]);

  // Inicializar lista de clientes filtrados
  useEffect(() => {
    setFilteredCustomers(customers);
  }, [customers]);

  // Filtrar clientes conforme digitação
  useEffect(() => {
    if (customerSearchValue.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(customerSearchValue.toLowerCase()) ||
        customer.email?.toLowerCase().includes(customerSearchValue.toLowerCase()) ||
        customer.phone?.includes(customerSearchValue)
      );
      setFilteredCustomers(filtered);
    }
  }, [customerSearchValue, customers]);

  // Carregar dados quando initialData for fornecido (edição)
  useEffect(() => {
    if (initialData) {
      console.log('Loading initial data:', initialData);
      console.log('Loading items:', initialData.items?.map((i: any) => ({
        productId: i.productId,
        quantity: i.quantity
      })));
      
      // Configurar o formulário com os dados da proposta
      form.setValue('customerId', initialData.customerId || '');
      form.setValue('validUntil', initialData.validUntil ? new Date(initialData.validUntil).toISOString().split('T')[0] : '');
      form.setValue('notes', initialData.notes || '');
      form.setValue('shippingIncluded', Boolean(initialData.shippingIncluded));
      form.setValue('warrantyText', initialData.warrantyText || '1 ano de garantia de fábrica');
      form.setValue('pdfTitle', initialData.pdfTitle || '');
      form.setValue('responsibleName', initialData.responsibleName || user?.name || '');
      form.setValue('responsiblePosition', initialData.responsiblePosition || 'Administrador');
      form.setValue('discountPercent', initialData.discountPercent || '');
      
      // Carregar itens
      if (initialData.items && initialData.items.length > 0) {
        const loadedItems = initialData.items.map((item: any) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseFloat(item.unitCost) || 0, // custo unitário
          salePrice: parseFloat(item.unitPrice) || 0, // preço de venda
          originalUnitPrice: parseFloat(item.unitCost) || 0,
        }));
        setItems(loadedItems);
      }
      
      // Carregar custos existentes se houver
      if (initialData.costs && initialData.costs.length > 0) {
        const loadedCosts = initialData.costs.map((cost: any) => ({
          costId: cost.costId || 'manual',
          name: cost.name || '',
          unitValue: parseFloat(cost.unitValue) || 0,
          quantity: parseFloat(cost.quantity) || 1,
          totalValue: parseFloat(cost.totalValue) || 0,
          supplier: cost.supplier || '',
          description: cost.description || '',
          calculationType: 'fixed' as const,
          percentageValue: 0,
        }));
        setCosts(loadedCosts);
      }
      
      // Configurar o cliente selecionado
      if (initialData.customerId && customers.length > 0) {
        const selectedCustomer = customers.find(c => c.id === initialData.customerId);
        if (selectedCustomer) {
          setCustomerSearchValue(selectedCustomer.name);
        }
      }
    }
  }, [initialData, form, customers, user]);

  // Recalcular automaticamente quando items, costs ou desconto mudarem
  useEffect(() => {
    calculateTotals();
  }, [items, costs, form.watch('discountPercent')]);

  const calculateTotals = () => {
    // 1. Valor Total da Venda: quantidade * valor por metro escolhido pelo cliente
    const valorTotalVenda = items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const salePrice = Number(item.salePrice) || 0;
      return sum + (quantity * salePrice);
    }, 0);

    // 2. Custos dos Produtos: custo unitário * quantidade
    const custoProdutos = items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);

    // 3. Total de Custos: soma custos dos produtos + outros custos
    const totalCosts = custoProdutos + costs.reduce((sum, cost) => {
      return sum + cost.totalValue;
    }, 0);

    // 4. Valor da Nota Fiscal (5%): 5% do Valor Total da Venda
    const invoicePercent = 5.00;
    const valorNotaFiscal = valorTotalVenda * 0.05;

    // 5. Total com Nota Fiscal: Total de Custos + Valor da Nota Fiscal
    const totalComNotaFiscal = totalCosts + valorNotaFiscal;

    // 6. Lucro da Empresa: Valor Total da Venda - Total com Nota Fiscal
    const lucroEmpresa = valorTotalVenda - totalComNotaFiscal;

    // 7. Porcentagem de Lucro: (lucro * 100) / Valor Total da Venda
    const profitPercent = valorTotalVenda > 0 ? (lucroEmpresa * 100) / valorTotalVenda : 0;

    // 8. Dízimo (10%): 10% do Lucro da Empresa
    const dizimo = lucroEmpresa * 0.10;

    // 9. Lucro Líquido: Lucro da Empresa - Dízimo
    const lucroLiquido = lucroEmpresa - dizimo;

    // 10. Calcular desconto
    const discountPercent = parseFloat(form.getValues('discountPercent') || '0');
    const discount = valorTotalVenda * (discountPercent / 100);
    const finalTotal = valorTotalVenda - discount;

    setCalculations({
      subtotal: valorTotalVenda, // Valor Total da Venda
      totalCosts, // Total de Custos (produtos + outros custos)
      totalWithoutInvoice: totalCosts, // Total sem nota fiscal
      invoicePercent,
      invoiceAmount: valorNotaFiscal, // Valor da Nota Fiscal (5%)
      totalWithInvoice: totalComNotaFiscal, // Total com Nota Fiscal
      companyProfit: lucroEmpresa, // Lucro da Empresa
      profitPercent, // Porcentagem de Lucro
      tithe: dizimo, // Dízimo (10%)
      netProfit: lucroLiquido, // Lucro Líquido
      total: valorTotalVenda, // Total Final ao Cliente
      discount, // Valor do desconto
      finalTotal, // Total final com desconto
    });
  };

  const addItem = () => {
    setItems([...items, {
      productId: '',
      quantity: 0,
      unitPrice: 0,
      salePrice: 0,
      originalUnitPrice: 0,
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    console.log(`🔄 Atualizando item ${index}, campo ${field}:`, value);
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Se mudou o produto, atualizar o preço padrão (custo) e sugerir preço de venda
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        // Para vendedores, definir unitPrice como 0 já que não veem custos
        // Mas admin precisa ver o custo real
        if (user?.type === 'vendedor') {
          newItems[index].unitPrice = 0; // Vendedor não vê custos
          newItems[index].salePrice = parseFloat(product.pricePerM2); // Preço de venda sugerido
        } else {
          newItems[index].unitPrice = parseFloat(product.pricePerM2); // Admin vê custos
          newItems[index].salePrice = parseFloat(product.pricePerM2); // Preço de venda inicial igual ao custo
        }
        newItems[index].originalUnitPrice = parseFloat(product.pricePerM2);
        console.log(`📦 Produto selecionado:`, product.name, `- Preço: R$ ${product.pricePerM2}`);
      }
    }
    
    console.log(`📝 Estado atualizado do item ${index}:`, newItems[index]);
    setItems(newItems);
  };

  const addCost = () => {
    if (availableCosts.length === 0) return;
    
    const firstCost = availableCosts[0];
    const newCost: QuotationCost = {
      costId: firstCost.id,
      name: firstCost.name,
      unitValue: parseFloat(firstCost.value),
      quantity: 0,
      totalValue: 0,
      supplier: firstCost.supplier || '',
      description: firstCost.description || '',
      calculationType: 'fixed',
      percentageValue: 0,
    };
    
    setCosts([...costs, newCost]);
  };

  const removeCost = (index: number) => {
    setCosts(costs.filter((_, i) => i !== index));
  };

  const updateCost = (index: number, field: keyof QuotationCost, value: any) => {
    console.log(`💰 Atualizando custo ${index}, campo ${field}:`, value);
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
        console.log(`📊 Custo selecionado:`, cost.name, `- Valor: R$ ${cost.value}`);
      }
    }
    
    // Recalcular total do custo baseado no tipo de cálculo
    if (field === 'unitValue' || field === 'quantity' || field === 'calculationType' || field === 'percentageValue') {
      if (newCosts[index].calculationType === 'percentage' && newCosts[index].percentageValue) {
        // Para porcentagem, calcula baseado no valor unitário do custo com a porcentagem
        newCosts[index].totalValue = newCosts[index].unitValue * (newCosts[index].percentageValue / 100);
      } else {
        // Para valor fixo, calcula normalmente
        newCosts[index].totalValue = newCosts[index].unitValue * newCosts[index].quantity;
      }
      console.log(`🧮 Total recalculado:`, newCosts[index].totalValue);
    }
    
    console.log(`💸 Estado atualizado do custo ${index}:`, newCosts[index]);
    setCosts(newCosts);
  };

  const handleSubmit = (formData: QuotationFormData) => {
    console.log('=== HANDLESUBMIT CALLED ===');
    console.log('User type:', user?.type);
    console.log('Is admin editing:', user?.type === 'admin');
    console.log('Form data received:', formData);
    console.log('Current items state:', items);
    console.log('Current costs state:', costs);
    console.log('Current calculations:', calculations);
    
    // Verificar se há mudanças nos valores
    console.log('Detailed item analysis:');
    items.forEach((item, index) => {
      console.log(`Item ${index}:`, {
        produto: item.productId,
        quantidade: item.quantity,
        precoOriginal: item.unitPrice,
        precoVenda: item.salePrice,
        precoFinal: item.salePrice || item.unitPrice
      });
    });
    
    console.log('Detailed costs analysis:');
    costs.forEach((cost, index) => {
      console.log(`Cost ${index}:`, {
        costId: cost.costId,
        name: cost.name,
        unitValue: cost.unitValue,
        quantity: cost.quantity,
        totalValue: cost.totalValue,
        calculationType: cost.calculationType
      });
    });
    
    const quotationData = {
      ...formData,
      // Garantir que campos obrigatórios estão presentes para atualização
      customerId: formData.customerId || initialData?.customerId,
      userId: user?.id || initialData?.userId,
      branch: user?.branch || initialData?.branch,
      subtotal: calculations.subtotal?.toString() || calculations.total?.toString() || initialData?.subtotal || '0',
      total: calculations.total?.toString() || initialData?.total || '0',
      validUntil: formData.validUntil,
      
      // Campos dos cálculos
      totalCosts: calculations.totalCosts?.toString() || '0',
      totalWithoutInvoice: calculations.totalWithoutInvoice?.toString() || '0',
      invoicePercent: calculations.invoicePercent?.toString() || '5',
      invoiceAmount: calculations.invoiceAmount?.toString() || '0',
      totalWithInvoice: calculations.totalWithInvoice?.toString() || '0',
      companyProfit: calculations.companyProfit?.toString() || '0',
      profitPercent: calculations.profitPercent?.toString() || '0',
      tithe: calculations.tithe?.toString() || '0',
      netProfit: calculations.netProfit?.toString() || '0',
      
      // Configurações
      shippingIncluded: formData.shippingIncluded ? 1 : 0,
      warrantyText: formData.warrantyText || '1 ano de garantia de fábrica',
      responsibleName: formData.responsibleName || user?.name || initialData?.responsibleName,
      responsiblePosition: formData.responsiblePosition || user?.type || 'Administrador',
      responsibleId: user?.id || initialData?.responsibleId,
      adminCalculated: 1, // Marcar como calculado pelo admin
      
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.salePrice || item.unitPrice, // Usar salePrice como unitPrice
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
    
    console.log('Prepared quotation data:', quotationData);
    console.log('About to call onSubmit function...');
    
    try {
      onSubmit(quotationData);
      console.log('onSubmit called successfully');
    } catch (error) {
      console.error('Error calling onSubmit:', error);
    }
    
    console.log('=== HANDLESUBMIT COMPLETE ===');
  };

  const handleShareQuotation = async () => {
    console.log('📤 Gerando PDF para compartilhamento...');
    
    // Verificar se há itens
    if (items.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um produto para compartilhar",
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = form.getValues();
      
      // Obter dados do cliente selecionado
      const selectedCustomer = customers.find(c => c.id === formData.customerId);
      if (!selectedCustomer) {
        toast({
          title: "Erro",
          description: "Selecione um cliente para compartilhar",
          variant: "destructive",
        });
        return;
      }

      // Preparar dados temporários para o PDF (sem salvar)
      const tempQuotationData = {
        id: 'temp-' + Date.now(),
        quotationNumber: '#PREVIEW',
        customerId: selectedCustomer.id,
        userId: user?.id || '',
        branch: user?.branch || 'Matriz',
        status: 'pending',
        customer: selectedCustomer,
        user: user || {
          id: '',
          name: 'Usuário Desconhecido',
          email: '',
          password: '',
          type: 'employee',
          branch: 'Matriz',
          commissionPercent: '0',
          createdAt: null
        },
        validUntil: new Date(formData.validUntil),
        notes: formData.notes || null,
        warrantyText: formData.warrantyText || null,
        pdfTitle: formData.pdfTitle || null,
        responsibleName: formData.responsibleName || null,
        responsiblePosition: formData.responsiblePosition || null,
        responsibleId: user?.id || null,
        adminCalculated: 0,
        originalQuotationId: null,
        items: items.map((item, index) => {
          const product = products.find(p => p.id === item.productId);
          const unitPriceValue = Number(item.salePrice) || Number(item.unitPrice);
          const subtotalValue = Number(item.quantity) * unitPriceValue;
          return {
            id: `temp-item-${index}`,
            productId: item.productId,
            quotationId: 'temp-quotation',
            product: product || {
              id: item.productId,
              name: 'Produto Desconhecido',
              createdAt: null,
              category: null,
              hasInstallation: 0,
              pricePerM2: '0',
              costPerM2: '0',
              description: null
            },
            quantity: item.quantity.toString(),
            unitPrice: unitPriceValue.toString(),
            unitCost: (Number(product?.costPerM2) || 0).toString(),
            totalCost: (Number(item.quantity) * (Number(product?.costPerM2) || 0)).toString(),
            subtotal: subtotalValue.toString()
          };
        }),
        costs: costs.map((cost, index) => ({
          id: `temp-cost-${index}`,
          quotationId: 'temp-quotation',
          costId: cost.costId,
          name: cost.name,
          description: cost.description || null,
          supplier: cost.supplier || null,
          quantity: cost.quantity.toString(),
          unitValue: cost.unitValue.toString(),
          totalValue: cost.totalValue.toString()
        })),
        totalCosts: calculations.totalCosts.toString(),
        totalWithoutInvoice: calculations.totalWithoutInvoice.toString(),
        invoicePercent: calculations.invoicePercent.toString(),
        invoiceAmount: calculations.invoiceAmount.toString(),
        totalWithInvoice: calculations.totalWithInvoice.toString(),
        companyProfit: calculations.companyProfit.toString(),
        profitPercent: calculations.profitPercent.toString(),
        tithe: calculations.tithe.toString(),
        netProfit: calculations.netProfit.toString(),
        discount: calculations.discount.toString(),
        finalTotal: calculations.finalTotal.toString(),
        discountPercent: formData.discountPercent || "0",
        subtotal: calculations.subtotal.toString(),
        total: calculations.finalTotal.toString(),
        shippingIncluded: formData.shippingIncluded ? 1 : 0,
        createdAt: new Date()
      };

      console.log('📋 Dados temporários para PDF:', tempQuotationData);

      // Gerar PDF
      const { generateQuotationPDF } = await import("@/lib/pdf-generator");
      const pdfBlob = await generateQuotationPDF(tempQuotationData);
      
      // Verificar se o navegador suporta compartilhamento
      if (navigator.share && navigator.canShare) {
        const pdfFile = new File([pdfBlob], `proposta-preview-${Date.now()}.pdf`, {
          type: 'application/pdf'
        });
        
        if (navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            title: formData.pdfTitle || 'Proposta MasterGreen',
            text: 'Confira nossa proposta de grama sintética',
            files: [pdfFile]
          });
          
          toast({
            title: "Sucesso",
            description: "PDF compartilhado com sucesso!",
          });
        } else {
          // Fallback: download direto
          downloadPDF(pdfBlob, formData.pdfTitle || 'proposta-preview');
        }
      } else {
        // Fallback: download direto
        downloadPDF(pdfBlob, formData.pdfTitle || 'proposta-preview');
      }
    } catch (error) {
      console.error('❌ Erro ao gerar PDF:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar PDF para compartilhamento",
        variant: "destructive",
      });
    }
  };

  const downloadPDF = (pdfBlob: Blob, filename: string) => {
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(pdfUrl);
    
    toast({
      title: "Download iniciado",
      description: "PDF baixado. Use o compartilhamento do seu dispositivo para enviar.",
    });
  };

  const isAdmin = user?.type === "admin";

  return (
    <Form {...form}>
      <form onSubmit={(e) => {
        console.log('Form submit event triggered');
        console.log('Form validation state:', form.formState.isValid);
        console.log('Form errors:', form.formState.errors);
        form.handleSubmit(handleSubmit, (errors) => {
          console.log('Form validation errors:', errors);
        })(e);
      }} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cliente com Pesquisa Melhorada */}
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      placeholder="Digite o nome do cliente ou clique para ver todos"
                      value={customerSearchValue}
                      onChange={(e) => {
                        setCustomerSearchValue(e.target.value);
                        setCustomerSearchOpen(true);
                      }}
                      onFocus={() => setCustomerSearchOpen(true)}
                      data-testid="input-customer-search"
                      className="pr-10"
                    />
                  </FormControl>
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                
                {customerSearchOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          className={cn(
                            "px-3 py-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0",
                            field.value === customer.id && "bg-blue-50"
                          )}
                          onClick={() => {
                            field.onChange(customer.id);
                            setCustomerSearchValue(customer.name);
                            setCustomerSearchOpen(false);
                          }}
                          data-testid={`option-customer-${customer.id}`}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{customer.name}</span>
                            {customer.email && (
                              <span className="text-sm text-gray-500">{customer.email}</span>
                            )}
                            {customer.phone && (
                              <span className="text-sm text-gray-500">{customer.phone}</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-500 text-center">
                        Nenhum cliente encontrado
                      </div>
                    )}
                  </div>
                )}
                
                {/* Campo oculto para clique fora fechar dropdown */}
                {customerSearchOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setCustomerSearchOpen(false)}
                  />
                )}
                
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
                <div key={index} className={`grid grid-cols-1 gap-4 items-end ${user?.type === 'admin' ? 'md:grid-cols-7' : 'md:grid-cols-4'}`}>
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
                  
                  {/* Campos de custo apenas para admin */}
                  {user?.type === 'admin' && (
                    <>
                      <div>
                        <label className="text-sm font-medium">Custo Unitário (R$/m²)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice || ''}
                          onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          data-testid={`input-unit-price-${index}`}
                          className="bg-gray-50"
                          title="Custo do produto (incluído nos custos)"
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Valor por Metro (Venda)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.salePrice || ''}
                          onChange={(e) => updateItem(index, 'salePrice', parseFloat(e.target.value) || 0)}
                          data-testid={`input-sale-price-${index}`}
                          className="bg-green-50 border-green-200"
                          title="Valor por metro que será cobrado do cliente"
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Custo Total</label>
                        <div className="text-lg font-semibold text-red-600">
                          {formatCurrency((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Campo de valor de venda - sempre visível */}
                  {user?.type === 'vendedor' && (
                    <div>
                      <label className="text-sm font-medium">Valor por Metro (Venda)</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.salePrice || ''}
                        onChange={(e) => updateItem(index, 'salePrice', parseFloat(e.target.value) || 0)}
                        data-testid={`input-sale-price-${index}`}
                        className="bg-green-50 border-green-200"
                        title="Valor por metro que será cobrado do cliente"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium">Valor Total Venda</label>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency((Number(item.quantity) || 0) * (Number(item.salePrice) || 0))}
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
        {user?.type === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle>Custos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {costs.map((cost, index) => (
                  <Card key={index} className="border-l-4 border-l-red-500">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
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
                      <label className="text-sm font-medium">Tipo de Cálculo</label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={cost.calculationType === 'fixed' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateCost(index, 'calculationType', 'fixed')}
                          data-testid={`button-calc-fixed-${index}`}
                        >
                          R$
                        </Button>
                        <Button
                          type="button"
                          variant={cost.calculationType === 'percentage' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateCost(index, 'calculationType', 'percentage')}
                          data-testid={`button-calc-percentage-${index}`}
                        >
                          %
                        </Button>
                      </div>
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

                    {cost.calculationType === 'percentage' ? (
                      <div>
                        <label className="text-sm font-medium">Porcentagem (%)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={cost.percentageValue || ''}
                          onChange={(e) => updateCost(index, 'percentageValue', parseFloat(e.target.value) || 0)}
                          data-testid={`input-cost-percentage-${index}`}
                        />
                      </div>
                    ) : (
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
                    )}
                    
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
                    </CardContent>
                  </Card>
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
              {/* <div className="flex justify-between">
                <span>Valor Total dos Produtos:</span>
                <span className="font-semibold">{formatCurrency(calculations.subtotal)}</span>
              </div> */}
              
              {calculations.discount > 0 && (
                <div className="flex justify-between">
                  <span>Desconto ({form.getValues('discountPercent')}%):</span>
                  <span className="text-red-600">-{formatCurrency(calculations.discount)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span>Total Final ao Cliente:</span>
                <span className="font-bold text-lg text-green-600">{formatCurrency(calculations.finalTotal)}</span>
              </div>

              {/* Mostrar comissão para funcionários */}
              {!isAdmin && user && user.commissionPercent && parseFloat(user.commissionPercent) > 0 && (
                <>
                  <hr className="my-4" />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Valor Bruto:</span>
                      <span className="font-semibold">{formatCurrency(calculations.finalTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sua Comissão ({user.commissionPercent}%):</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(calculations.finalTotal * parseFloat(user.commissionPercent) / 100)}
                      </span>
                    </div>
                  </div>
                </>
              )}

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
                  <FormDescription>
                    {calculations.discount > 0 && `Desconto: ${formatCurrency(calculations.discount)}`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        value={user?.name || ''}
                        readOnly
                        className="bg-gray-100"
                        data-testid="input-responsible-name"
                      />
                    </FormControl>
                    <FormDescription>
                      Responsável logado no sistema
                    </FormDescription>
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
                        value={user?.type || ''}
                        readOnly
                        className="bg-gray-100"
                        data-testid="input-responsible-name"
                      />
                    </FormControl>
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

        {/* Botões - Layout responsivo */}
        <div className="flex flex-col sm:flex-row gap-4 sm:justify-between">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel"
            className="order-3 sm:order-1"
          >
            Cancelar
          </Button>
          
          <div className="flex flex-col sm:flex-row gap-4 order-1 sm:order-2">
            <Button 
              type="button" 
              variant="secondary"
              onClick={handleShareQuotation}
              data-testid="button-share"
              className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar PDF
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              data-testid="button-submit"
              className="bg-green-900 hover:bg-green-800 text-white w-full sm:w-auto"
              onClick={(e) => {
                console.log('Submit button clicked');
                console.log('Button disabled:', isLoading);
                console.log('Form valid:', form.formState.isValid);
                console.log('Form dirty:', form.formState.isDirty);
              }}
            >
              {isLoading ? "Salvando..." : "Salvar Orçamento"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

export default NewQuotationForm;