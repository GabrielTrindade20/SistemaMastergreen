import { useState, useEffect, useRef } from "react";
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
import { Plus, Trash2, Calculator, Search, Check, ChevronsUpDown, Share2, Clock, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { QuickCreateProductDialog } from "@/components/quick-create-product-dialog";
import { QuickCreateCostDialog } from "@/components/quick-create-cost-dialog";
import type { Customer, Product, Cost, SystemSetting } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/calculations";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { EditableQuickProposal } from '@shared/quick-proposal-edit';
import { quickProposalEditSchema } from '@shared/quick-proposal-edit';
import { calculateQuickDetails, quickCostTotal, type QuickProposalDetails } from '@shared/quick-proposal-details';

const DRAFT_KEY = "mastergreen_quotation_draft";

const loadDraft = () => {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const saveDraftToStorage = (data: object) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  } catch {}
};

const clearDraftFromStorage = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
};

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
  name?: string;
  unit?: 'm²'|'un'|'m'|'serviço';
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
  productId?: string; // Produto associado ao custo (para múltiplos produtos)
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
  isEditMode?: boolean;
  quickProposal?: EditableQuickProposal;
}

export function NewQuotationForm(props: NewQuotationFormProps) {
  return <DetailedQuotationForm {...props} />;
}

function DetailedQuotationForm({
  customers, 
  products, 
  onSubmit, 
  onCancel, 
  isLoading,
  initialData,
  quickProposal,
  isEditMode = false,
}: NewQuotationFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quickCustomer,setQuickCustomer] = useState(quickProposal?.customer);
  const [quickDate,setQuickDate] = useState(quickProposal?.date || '');
  const [quickPayment,setQuickPayment] = useState(quickProposal?.payment || '');
  const [quickFreight,setQuickFreight] = useState(quickProposal?.freight || '');
  const [pricingMode,setPricingMode] = useState<'manual'|'items'>(quickProposal?.webDetails?.pricingMode || 'manual');
  const [manualTotal,setManualTotal] = useState(((quickProposal?.webDetails?.manualTotalCents || quickProposal?.totalCents || 0)/100).toFixed(2));
  const [quickError,setQuickError] = useState('');
  const loadedQuickRef = useRef<string | null>(null);
  
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
  const [hasDraft, setHasDraft] = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftLoadedRef = useRef(false);
  const [quickProductDialogOpen, setQuickProductDialogOpen] = useState(false);
  const [quickProductTargetIndex, setQuickProductTargetIndex] = useState<number | null>(null);
  const [quickCostDialogOpen, setQuickCostDialogOpen] = useState(false);
  const [quickCostTargetIndex, setQuickCostTargetIndex] = useState<number | null>(null);
  
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

  // Fetch system settings for calculation percentages
  const { data: settings = [] } = useQuery<SystemSetting[]>({
    queryKey: ["/api/settings"],
  });
  const rawInvoice = parseFloat(settings.find(s => s.key === "invoice_percent")?.value ?? "5");
  const rawTithe = parseFloat(settings.find(s => s.key === "tithe_percent")?.value ?? "10");
  const invoicePercentSetting = isNaN(rawInvoice) ? 5 : rawInvoice;
  const tithePercentSetting = isNaN(rawTithe) ? 10 : rawTithe;

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

  // Carregar rascunho salvo ao montar (apenas para novas propostas)
  useEffect(() => {
    if (isEditMode || initialData || draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    const draft = loadDraft();
    if (!draft) return;
    setHasDraft(true);
    const fv = draft.formValues || {};
    if (fv.customerId) form.setValue('customerId', fv.customerId);
    if (fv.validUntil) form.setValue('validUntil', fv.validUntil);
    if (fv.notes !== undefined) form.setValue('notes', fv.notes);
    if (fv.shippingIncluded !== undefined) form.setValue('shippingIncluded', fv.shippingIncluded);
    if (fv.warrantyText) form.setValue('warrantyText', fv.warrantyText);
    if (fv.pdfTitle !== undefined) form.setValue('pdfTitle', fv.pdfTitle);
    if (fv.discountPercent !== undefined) form.setValue('discountPercent', fv.discountPercent);
    if (draft.items && draft.items.length > 0) setItems(draft.items);
    if (draft.costs && draft.costs.length > 0) setCosts(draft.costs);
    if (draft.customerSearchValue) setCustomerSearchValue(draft.customerSearchValue);
  }, []); // only on mount

  // Auto-salvar rascunho quando form muda (apenas novas propostas)
  useEffect(() => {
    if (isEditMode) return;
    const { unsubscribe } = form.watch((values) => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(() => {
        saveDraftToStorage({ formValues: values, items, costs, customerSearchValue });
      }, 800);
    });
    return () => {
      unsubscribe();
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [form, isEditMode]);

  // Auto-salvar rascunho quando items/costs/customerSearchValue mudam
  useEffect(() => {
    if (isEditMode) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      saveDraftToStorage({ formValues: form.getValues(), items, costs, customerSearchValue });
    }, 800);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [items, costs, customerSearchValue, isEditMode]);

  const discardDraft = () => {
    clearDraftFromStorage();
    setHasDraft(false);
    form.reset({
      customerId: "",
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "",
      shippingIncluded: true,
      warrantyText: "1 ano de garantia de fábrica",
      pdfTitle: "",
      responsibleName: user?.name || "",
      responsiblePosition: "Administrador",
      discountPercent: "",
    });
    setItems([{ productId: '', quantity: 0, unitPrice: 0, salePrice: 0, originalUnitPrice: 0 }]);
    setCosts([]);
    setCustomerSearchValue("");
  };

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
    if (quickProposal) {
      if (loadedQuickRef.current === quickProposal.id) return;
      loadedQuickRef.current = quickProposal.id;
      const details = quickProposal.webDetails;
      form.reset({customerId:quickProposal.id,validUntil:details?.validUntil || new Date(Date.now()+7*86400000).toISOString().slice(0,10),notes:details?.notes || '',shippingIncluded:details?.shippingIncluded ?? /^inclus/i.test(quickProposal.freight),warrantyText:quickProposal.warranty,pdfTitle:details?.pdfTitle || '',responsibleName:details?.responsibleName || user?.name || '',responsiblePosition:details?.responsiblePosition || 'Administrador',discountPercent:String(quickProposal.discountPercent)});
      setCustomerSearchValue(quickProposal.customer.name);
      setItems(details?.items.map(item=>({productId:item.productId||'',name:item.name,unit:item.unit||'m²',quantity:item.quantity,unitPrice:item.unitCost,salePrice:item.unitPrice,originalUnitPrice:item.unitCost})) || []);
      setCosts(details?.costs.map(cost=>({...cost,costId:cost.costId || 'manual',productId:cost.productId || undefined,totalValue:quickCostTotal(cost)})) || []);
      return;
    }
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
  }, [initialData, form, customers, user, quickProposal]);

  // Recalcular automaticamente quando items, costs, desconto ou configurações mudarem
  useEffect(() => {
    calculateTotals();
  }, [items, costs, form.watch('discountPercent'), invoicePercentSetting, tithePercentSetting, pricingMode, manualTotal]);

  const buildQuickDetails = (): QuickProposalDetails => ({
    version:1,pricingMode,manualTotalCents:Math.round(Number(manualTotal.replace(',','.'))*100),
    validUntil:form.getValues('validUntil'),notes:form.getValues('notes') || '',pdfTitle:form.getValues('pdfTitle') || '',
    responsibleName:form.getValues('responsibleName') || user?.name || '',responsiblePosition:form.getValues('responsiblePosition') || 'Administrador',
    shippingIncluded:form.getValues('shippingIncluded'),invoicePercent:invoicePercentSetting,tithePercent:tithePercentSetting,
    items:items.filter(item=>item.productId || item.name || Number(item.quantity) || Number(item.salePrice) || Number(item.unitPrice)).map(item=>({
      productId:item.productId||null,name:item.name ?? products.find(p=>p.id===item.productId)?.name ?? '',unit:item.unit||'m²',
      quantity:Number(item.quantity),unitCost:Number(item.unitPrice),unitPrice:Number(item.salePrice),
    })),
    costs:costs.map(cost=>({costId:cost.costId==='manual'?null:cost.costId,name:cost.name,unitValue:Number(cost.unitValue),quantity:Number(cost.quantity),calculationType:cost.calculationType,percentageValue:Number(cost.percentageValue || 0),productId:cost.productId || null,supplier:cost.supplier || '',description:cost.description || ''})),
  });

  const buildQuickSubmission = () => {
    const webDetails = buildQuickDetails();
    const discountPercent = Number(form.getValues('discountPercent') || 0);
    const parsed = quickProposalEditSchema.safeParse({revision:quickProposal!.revision,customer:quickCustomer,proposalDate:quickDate,payment:quickPayment,freight:quickFreight,warranty:form.getValues('warrantyText'),discountPercent,totalCents:Math.round(calculateQuickDetails(webDetails,discountPercent).total*100),webDetails});
    if (!parsed.success) {
      setQuickError('Confira os dados, datas, valores e produtos/custos selecionados. '+parsed.error.issues.map(issue=>issue.path.join('.')+': '+issue.message).join(' · '));
      return null;
    }
    setQuickError('');
    return parsed.data;
  };

  const calculateTotals = () => {
    if (quickProposal) {
      setCalculations(calculateQuickDetails(buildQuickDetails(),Number(form.getValues('discountPercent') || 0)));
      return;
    }
    // 1. Valor Total da Venda (bruto): quantidade * valor por metro escolhido pelo cliente
    const valorTotalVenda = items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const salePrice = Number(item.salePrice) || 0;
      return sum + (quantity * salePrice);
    }, 0);

    // 2. Aplicar desconto primeiro
    const discountPercent = parseFloat(form.getValues('discountPercent') || '0');
    const discount = valorTotalVenda * (discountPercent / 100);
    const valorComDesconto = valorTotalVenda - discount;

    // 3. Custos dos Produtos: custo unitário * quantidade
    const custoProdutos = items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);

    // 4. Total de Custos: soma custos dos produtos + outros custos
    const totalCosts = custoProdutos + costs.reduce((sum, cost) => {
      return sum + cost.totalValue;
    }, 0);

    // 5. Valor da Nota Fiscal: invoicePercentSetting% do valor COM DESCONTO
    const invoicePercent = invoicePercentSetting;
    const valorNotaFiscal = valorComDesconto * (invoicePercent / 100);

    // 6. Total com Nota Fiscal: Total de Custos + Valor da Nota Fiscal
    const totalComNotaFiscal = totalCosts + valorNotaFiscal;

    // 7. Lucro da Empresa: Valor COM DESCONTO - Total com Nota Fiscal
    const lucroEmpresa = valorComDesconto - totalComNotaFiscal;

    // 8. Porcentagem de Lucro: (lucro * 100) / Valor COM DESCONTO
    const profitPercent = valorComDesconto > 0 ? (lucroEmpresa * 100) / valorComDesconto : 0;

    // 9. Dízimo: tithePercentSetting% do Lucro da Empresa
    const dizimo = lucroEmpresa * (tithePercentSetting / 100);

    // 10. Lucro Líquido: Lucro da Empresa - Dízimo
    const lucroLiquido = lucroEmpresa - dizimo;

    setCalculations({
      subtotal: valorTotalVenda,
      totalCosts,
      totalWithoutInvoice: totalCosts,
      invoicePercent,
      invoiceAmount: valorNotaFiscal,
      totalWithInvoice: totalComNotaFiscal,
      companyProfit: lucroEmpresa,
      profitPercent,
      tithe: dizimo,
      netProfit: lucroLiquido,
      total: valorComDesconto,
      discount,
      finalTotal: valorComDesconto,
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
    if (quickProposal) setCosts(costs.map(cost=>cost.productId===items[index].productId?{...cost,productId:undefined}:cost));
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
        if(quickProposal){newItems[index].name=product.name;newItems[index].unit='m²';}
        // Para vendedores, definir unitPrice como 0 já que não veem custos
        // Mas admin precisa ver o custo real
        if (user?.type === 'vendedor' || quickProposal) {
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
    if (availableCosts.length === 0) {
      if (quickProposal) setCosts([...costs,{costId:'manual',name:'Custo manual',unitValue:0,quantity:1,totalValue:0,calculationType:'fixed',percentageValue:0}]);
      return;
    }
    
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
      productId: items.length === 1 ? items[0].productId : undefined, // Apenas associar se há um produto único
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
    if (quickProposal) {
      const cost = newCosts[index];
      cost.totalValue = quickCostTotal({...cost,costId:cost.costId==='manual'?null:cost.costId,productId:cost.productId || null,percentageValue:cost.percentageValue || 0,supplier:cost.supplier || '',description:cost.description || ''});
    }
    setCosts(newCosts);
  };

  const handleSubmit = (formData: QuotationFormData) => {
    if (quickProposal) {
      const data = buildQuickSubmission();
      if (data) onSubmit(data);
      return;
    }
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
        quantity: cost.calculationType === 'percentage' ? cost.percentageValue || 0 : cost.quantity,
        totalValue: cost.totalValue,
        supplier: cost.supplier,
        description: cost.description,
      })),
      calculations,
    };
    
    console.log('Prepared quotation data:', quotationData);
    console.log('About to call onSubmit function...');
    
    try {
      clearDraftFromStorage();
      setHasDraft(false);
      onSubmit(quotationData);
      console.log('onSubmit called successfully');
    } catch (error) {
      console.error('Error calling onSubmit:', error);
    }
    
    console.log('=== HANDLESUBMIT COMPLETE ===');
  };

  const handleShareQuotation = async () => {
    if (quickProposal) {
      if (!await form.trigger()) return;
      const data = buildQuickSubmission();
      if (!data) return;
      try {
        const { generateQuickProposalPDF } = await import('@/lib/pdf-generator');
        const blob = await generateQuickProposalPDF({...quickProposal,...data,date:data.proposalDate});
        const file = new File([blob],`proposta-${quickProposal.quotationNumber}.pdf`,{type:'application/pdf'});
        if (navigator.canShare?.({files:[file]})) await navigator.share({files:[file],title:data.webDetails?.pdfTitle || 'Proposta MasterGreen'});
        else downloadPDF(blob,`proposta-${quickProposal.quotationNumber}`);
      } catch (error) { if (!(error instanceof Error && error.name==='AbortError')) setQuickError('Não foi possível gerar o PDF. Confira a conexão e tente novamente.'); }
      return;
    }
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
        {quickProposal && <div className="rounded-lg border bg-green-50 p-4 text-sm space-y-2">
          <strong>App · {quickProposal.quotationNumber}</strong>
          <p>Mesmo editor do sistema: acrescente produtos e custos, configure a proposta e salve. Os itens antigos que não foram enviados pelo celular não são preenchidos automaticamente.</p>
        </div>}
        {quickError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{quickError}</p>}

        {/* Banner de rascunho restaurado */}
        {hasDraft && !isEditMode && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-amber-800">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">Rascunho restaurado automaticamente</span>
              <span className="text-xs text-amber-600 hidden sm:inline">— seus dados preenchidos anteriormente foram recuperados</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={discardDraft}
              className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 shrink-0 ml-2"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Descartar
            </Button>
          </div>
        )}

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
                            if (quickProposal) setQuickCustomer({name:customer.name,contact:'',phone:customer.phone || '',document:customer.cpfCnpj || '',address:[customer.address,customer.number,customer.neighborhood,customer.city,customer.state,customer.zipCode].filter(Boolean).join(' · ')});
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

        {quickProposal && quickCustomer && <Card><CardHeader><CardTitle>Dados recebidos do aplicativo</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-2 gap-4">
          {([['name','Nome do cliente'],['contact','Contato'],['phone','Telefone'],['document','CPF / CNPJ'],['address','Endereço']] as const).map(([key,label])=><div key={key}><label htmlFor={`app-${key}`} className="text-sm font-medium">{label}</label><Input id={`app-${key}`} value={quickCustomer[key]} onChange={event=>{setQuickCustomer({...quickCustomer,[key]:event.target.value});if(key==='name')setCustomerSearchValue(event.target.value);}} /></div>)}
          <div><label htmlFor="app-date" className="text-sm font-medium">Data da proposta</label><Input id="app-date" type="date" value={quickDate} onChange={e=>setQuickDate(e.target.value)} /></div>
          <div><label htmlFor="app-payment" className="text-sm font-medium">Condições de pagamento</label><Input id="app-payment" value={quickPayment} onChange={e=>setQuickPayment(e.target.value)} /></div>
          <div><label htmlFor="app-freight" className="text-sm font-medium">Frete</label><Input id="app-freight" value={quickFreight} onChange={e=>setQuickFreight(e.target.value)} /></div>
          <p className="sm:col-span-2 text-sm text-muted-foreground">Os dados acima pertencem a esta proposta; não alteram o cadastro geral do cliente.</p>
        </CardContent></Card>}

        {/* Produtos */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {quickProposal&&<p className="text-sm text-muted-foreground">Os itens do app mantêm a descrição e o preço negociados. Custos não informados começam em zero; preencha-os para estimar o lucro.</p>}
              {items.map((item, index) => (
                <div key={index} data-testid={`proposal-item-${index}`} className={quickProposal
                  ? 'grid grid-cols-1 gap-4 items-end rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3 [&>div]:min-w-0'
                  : `grid grid-cols-1 gap-4 items-end ${user?.type === 'admin' ? 'md:grid-cols-7' : 'md:grid-cols-4'}`}>
                  <div className={quickProposal?'col-span-full space-y-2':undefined}>
                    <label className="text-sm font-medium">Produto</label>
                    <SearchableSelect
                      options={[...(quickProposal&&item.productId&&!products.some(p=>p.id===item.productId)?[{value:item.productId,label:item.name||'Produto salvo na proposta'}]:[]),...products.map(p => ({ value: p.id, label: p.name }))]}
                      value={item.productId}
                      onValueChange={(value) => updateItem(index, 'productId', value)}
                      placeholder="Selecionar produto"
                      data-testid={`select-product-${index}`}
                      className={quickProposal?'h-auto min-h-10 whitespace-normal text-left [&>span]:whitespace-normal [&>span]:break-words':undefined}
                      onCreateNew={() => {
                        setQuickProductTargetIndex(index);
                        setQuickProductDialogOpen(true);
                      }}
                      createNewLabel="+ Criar novo produto"
                    />
                    {quickProposal&&<div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                      <div className="min-w-0 space-y-1">
                        <label htmlFor={`item-description-${index}`} className="text-sm font-medium">Descrição na proposta</label>
                        <Textarea id={`item-description-${index}`} aria-label={`Descrição do item ${index+1}`} className="min-h-[64px] resize-y" rows={2} placeholder="Descrição / item livre" value={item.name??''} onChange={e=>updateItem(index,'name',e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`item-unit-${index}`} className="text-sm font-medium">Unidade</label>
                        <select id={`item-unit-${index}`} aria-label={`Unidade do item ${index+1}`} className="h-12 w-full rounded-md border bg-background px-3 text-sm md:h-10" value={item.unit||'m²'} onChange={e=>updateItem(index,'unit',e.target.value)}>{['m²','un','m','serviço'].map(unit=><option key={unit}>{unit}</option>)}</select>
                      </div>
                      {!item.productId&&<p className="col-span-full text-xs text-muted-foreground">Item livre recebido do app. Você pode vinculá-lo a um produto acima.</p>}
                    </div>}
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Quantidade ({item.unit||'m²'})</label>
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
                        <label className="text-sm font-medium">Custo Unitário (R$/{item.unit||'m²'})</label>
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
                        <label className="text-sm font-medium">{quickProposal?`Valor por ${item.unit||'m²'} (Venda)`:'Valor por Metro (Venda)'}</label>
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
                      disabled={!quickProposal && items.length === 1}
                      data-testid={`button-remove-item-${index}`}
                      aria-label={`Remover produto ${index+1}`}
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
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 items-end">
                    <div>
                      <label className="text-sm font-medium">Custo</label>
                      <SearchableSelect
                        options={[
                          ...availableCosts.map(c => ({ value: c.id, label: c.name })),
                          { value: "manual", label: "Custo Manual" },
                        ]}
                        value={cost.costId}
                        onValueChange={(value) => updateCost(index, 'costId', value)}
                        placeholder="Selecionar custo"
                        data-testid={`select-cost-${index}`}
                        onCreateNew={() => {
                          setQuickCostTargetIndex(index);
                          setQuickCostDialogOpen(true);
                        }}
                        createNewLabel="+ Criar novo custo"
                      />
                    </div>

                    {/* Seleção de Produto - Apenas quando há múltiplos produtos */}
                    {(quickProposal || items.length > 1) && (
                      <div>
                        <label className="text-sm font-medium">Produto</label>
                        <Select 
                          value={cost.productId || 'none'} 
                          onValueChange={(value) => updateCost(index, 'productId', value === 'none' ? undefined : value)}
                        >
                          <SelectTrigger data-testid={`select-product-${index}`}>
                            <SelectValue placeholder="Selecionar produto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Custo geral (não específico)</SelectItem>
                            {items.filter((item,index,all)=>item.productId&&all.findIndex(other=>other.productId===item.productId)===index).map((item, itemIndex) => {
                              const product = products.find(p => p.id === item.productId);
                              return (
                                <SelectItem key={`product-${itemIndex}-${item.productId}`} value={item.productId || `item-${itemIndex}`}>
                                  {product?.name || `Produto ${itemIndex + 1}`}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
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

                    {quickProposal && cost.costId === 'manual' && <div><label htmlFor={`manual-cost-${index}`} className="text-sm font-medium">Nome do custo</label><Input id={`manual-cost-${index}`} value={cost.name} onChange={e=>updateCost(index,'name',e.target.value)} /></div>}
                    
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
                  disabled={!quickProposal && availableCosts.length === 0}
                  data-testid="button-add-cost"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Custo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {quickProposal && <Card><CardHeader><CardTitle>Valor da proposta</CardTitle></CardHeader><CardContent className="space-y-3">
          <label htmlFor="app-pricing" className="text-sm font-medium">Como definir o total</label>
          <select id="app-pricing" className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={pricingMode} onChange={e=>setPricingMode(e.target.value as 'manual'|'items')}>
            <option value="manual">Manter valor final informado</option><option value="items">Calcular pelos produtos e desconto</option>
          </select>
          {pricingMode==='manual' && <div><label htmlFor="app-total" className="text-sm font-medium">Valor final da proposta (R$)</label><Input id="app-total" inputMode="decimal" value={manualTotal} onChange={e=>setManualTotal(e.target.value)} /><p className="text-sm text-muted-foreground mt-2">Valor já negociado, com desconto aplicado. Adicionar produtos ou mudar o desconto não altera este total enquanto esta opção estiver selecionada.</p></div>}
          {pricingMode==='items' && <p className="text-sm text-muted-foreground">O total será a soma dos produtos cadastrados abaixo, com o desconto da proposta. Confira se todos os itens foram incluídos.</p>}
        </CardContent></Card>}

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
              {quickProposal && <p className="text-sm text-muted-foreground">Estimativa com os custos preenchidos no web; não significa aprovação nem receita realizada.</p>}
              {/* Valores para todos */}
              {/* <div className="flex justify-between">
                <span>Valor Total dos Produtos:</span>
                <span className="font-semibold">{formatCurrency(calculations.subtotal)}</span>
              </div> */}
              
              {calculations.discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Valor Bruto:</span>
                    <span className="font-semibold">{formatCurrency(calculations.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Desconto ({form.getValues('discountPercent')}%):</span>
                    <span className="text-red-600">-{formatCurrency(calculations.discount)}</span>
                  </div>
                </>
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
                      <span>Valor da Nota Fiscal ({calculations.invoicePercent}% do valor {calculations.discount > 0 ? 'com desconto' : 'total'}):</span>
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
                      <span>Dízimo ({tithePercentSetting}%):</span>
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="shippingIncluded"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-2 sm:p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Frete Incluso</FormLabel>
                      <FormDescription>
                        Marque se o frete está incluído no valor
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={value=>{field.onChange(value);if(quickProposal)setQuickFreight(value?'Incluso':'Não incluso');}}
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
                        value={quickProposal ? field.value : user?.name || ''}
                        onChange={quickProposal ? field.onChange : undefined}
                        readOnly={!quickProposal}
                        className={quickProposal ? '' : 'bg-gray-100'}
                        data-testid="input-responsible-name"
                      />
                    </FormControl>
                    <FormDescription>
                      {quickProposal ? 'Responsável informado nesta proposta' : 'Responsável logado no sistema'}
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
                        value={quickProposal ? field.value : user?.type || ''}
                        onChange={quickProposal ? field.onChange : undefined}
                        readOnly={!quickProposal}
                        className={quickProposal ? '' : 'bg-gray-100'}
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
              {isLoading ? "Salvando..." : isEditMode ? "Salvar Alterações" : "Salvar Orçamento"}
            </Button>
          </div>
        </div>
      </form>

      {/* Quick-create dialogs */}
      <QuickCreateProductDialog
        open={quickProductDialogOpen}
        onOpenChange={setQuickProductDialogOpen}
        onCreated={(productId) => {
          if (quickProductTargetIndex !== null) {
            updateItem(quickProductTargetIndex, 'productId', productId);
          }
          setQuickProductTargetIndex(null);
        }}
      />

      <QuickCreateCostDialog
        open={quickCostDialogOpen}
        onOpenChange={setQuickCostDialogOpen}
        onCreated={(costId) => {
          if (quickCostTargetIndex !== null) {
            updateCost(quickCostTargetIndex, 'costId', costId);
          }
          setQuickCostTargetIndex(null);
        }}
      />
    </Form>
  );
}

export default NewQuotationForm;
