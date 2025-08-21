import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, FileText, Check, X, Eye, Trash2, Share2, Copy } from "lucide-react";
import type { QuotationWithDetails, Customer, Product, User } from "@shared/schema";
import NewQuotationForm from "@/components/new-quotation-form";
import { generateProposalPDF } from "@/lib/pdf-generator";
import { formatCurrency, formatDate, formatPhone, formatDocument } from "@/lib/calculations";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Quotations() {
  const [showForm, setShowForm] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationWithDetails | null>(null);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: quotations = [], isLoading: quotationsLoading } = useQuery<QuotationWithDetails[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Função para calcular comissão baseada no funcionário
  const calculateCommission = (total: string, employeeId: string | null) => {
    if (!employeeId) return 0;
    const totalValue = parseFloat(total);
    const employee = users.find(u => u.id === employeeId);
    const commissionPercent = parseFloat(employee?.commissionPercent || "0");
    return (totalValue * commissionPercent) / 100;
  };

  const getEmployeeCommissionPercent = (employeeId: string | null) => {
    if (!employeeId) return "0";
    const employee = users.find(u => u.id === employeeId);
    return employee?.commissionPercent || "0";
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('🚀 Enviando dados para o servidor:', data);
      const result = await apiRequest("/api/quotations", { method: "POST", data });
      console.log('✅ Resposta do servidor:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('🎉 Sucesso na criação da proposta:', result);
      console.log('🔄 Invalidando queries e fechando formulário...');
      
      // Invalidar queries para recarregar a lista
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      
      // Fechar formulário e limpar dados
      setShowForm(false);
      setDuplicateData(null);
      
      console.log('📝 Estado após fechamento - showForm:', false);
      
      toast({
        title: "Sucesso",
        description: "Proposta criada com sucesso!",
      });
    },
    onError: (error: any) => {
      console.error('❌ Erro na criação da proposta:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar proposta",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/api/quotations/${id}/status`, { method: "PUT", data: { status } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({
        title: "Sucesso",
        description: "Status da proposta atualizado!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar status",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/quotations/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({
        title: "Sucesso",
        description: "Proposta excluída com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir proposta",
        variant: "destructive",
      });
    },
  });

  const handleCreateQuotation = (data: any) => {
    console.log('📝 Iniciando criação de nova proposta com dados:', data);
    console.log('🔄 Status da mutação antes:', {
      isLoading: createMutation.isPending,
      isError: createMutation.isError,
      isSuccess: createMutation.isSuccess
    });
    createMutation.mutate(data);
  };

  const handleStatusUpdate = (id: string, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleDeleteQuotation = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta proposta?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDuplicateQuotation = async (quotation: QuotationWithDetails) => {
    try {
      // Buscar detalhes completos da proposta
      const fullQuotation = await apiRequest(`/api/quotations/${quotation.id}`, { method: "GET" });
      
      // Calcular nova data de validade (7 dias a partir de hoje)
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 7);
      
      // Preparar dados para duplicação com TODOS os campos preenchidos
      const duplicateFormData = {
        customerId: fullQuotation.customerId,
        validUntil: validUntil.toISOString().split('T')[0], // Formato YYYY-MM-DD
        notes: fullQuotation.notes || '',
        shippingIncluded: Boolean(fullQuotation.shippingIncluded),
        warrantyText: fullQuotation.warrantyText || '1 ano de garantia de fábrica',
        pdfTitle: fullQuotation.pdfTitle ? `${fullQuotation.pdfTitle} - Cópia` : 'Proposta Duplicada',
        responsibleName: fullQuotation.responsibleName || user?.name || '',
        responsiblePosition: fullQuotation.responsiblePosition || 'Administrador',
        discountPercent: fullQuotation.discountPercent || '',
        items: fullQuotation.items.map((item: any) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          salePrice: parseFloat(item.subtotal) / parseFloat(item.quantity) || parseFloat(item.unitPrice),
          originalUnitPrice: parseFloat(item.unitPrice)
        })),
        costs: fullQuotation.costs?.map((cost: any) => ({
          costId: cost.costId,
          name: cost.name,
          unitValue: parseFloat(cost.unitValue),
          quantity: parseFloat(cost.quantity) || 0,
          totalValue: parseFloat(cost.totalValue),
          supplier: cost.supplier || '',
          description: cost.description || '',
          calculationType: cost.calculationType || 'fixed',
          percentageValue: parseFloat(cost.percentageValue) || 0
        })) || []
      };
      
      setDuplicateData(duplicateFormData);
      setShowForm(true);
      
      toast({
        title: "Sucesso",
        description: "Proposta duplicada com todos os dados originais. Você pode editar conforme necessário.",
      });
    } catch (error) {
      console.error('Erro ao duplicar proposta:', error);
      toast({
        title: "Erro",
        description: "Erro ao duplicar proposta",
        variant: "destructive",
      });
    }
  };

  const handleGeneratePDF = async (quotation: QuotationWithDetails) => {
    try {
      const fileName = `Proposta_${quotation.quotationNumber}.pdf`;
      await generateProposalPDF(quotation, fileName);
      
      toast({
        title: "Sucesso",
        description: "PDF gerado com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao gerar PDF",
        variant: "destructive",
      });
    }
  };

  const handleSharePDF = async (quotation: QuotationWithDetails) => {
    try {
      const fileName = `proposta-${quotation.quotationNumber}.pdf`;
      const pdfBlob = await generateProposalPDF(quotation, fileName);
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        // Usar Web Share API se disponível
        await navigator.share({
          title: `Proposta ${quotation.quotationNumber}`,
          text: `Proposta para ${quotation.customer.name}`,
          files: [pdfFile]
        });
        
        toast({
          title: "Sucesso",
          description: "PDF compartilhado com sucesso!",
        });
      } else {
        // Fallback: download do arquivo
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `proposta-${quotation.quotationNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pdfUrl);
        
        toast({
          title: "Download iniciado",
          description: "PDF baixado. Use o compartilhamento do seu dispositivo para enviar.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao compartilhar PDF",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Aprovado</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejeitado</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
    }
  };

  if (showForm) {
    console.log('🖥️ Renderizando formulário - showForm:', showForm);
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => {
              console.log('🔙 Botão voltar clicado');
              setShowForm(false);
              setDuplicateData(null);
            }}
            className="mb-4"
          >
            ← Voltar
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Nova Proposta</h1>
        </div>

        <NewQuotationForm
          customers={customers}
          products={products}
          onSubmit={handleCreateQuotation}
          onCancel={() => {
            setShowForm(false);
            setDuplicateData(null);
          }}
          isLoading={createMutation.isPending}
          initialData={duplicateData}
        />
      </div>
    );
  }

  if (selectedQuotation) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => setSelectedQuotation(null)}
            className="mb-4"
          >
            ← Voltar
          </Button>
          
          {/* Mobile-first responsive header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">
                Proposta {selectedQuotation.quotationNumber}
              </h1>
              <p className="text-gray-600 mt-1 break-words">
                Cliente: {selectedQuotation.customer.name}
              </p>
            </div>
            
            {/* Status and buttons container for mobile */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
              {getStatusBadge(selectedQuotation.status)}
              
              {/* Button group with mobile-friendly layout */}
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                <Button
                  onClick={() => handleGeneratePDF(selectedQuotation)}
                  className="btn-primary w-full sm:w-auto text-sm"
                  size="sm"
                  data-testid="button-generate-pdf"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Gerar PDF
                </Button>
                <Button
                  onClick={() => handleSharePDF(selectedQuotation)}
                  variant="outline"
                  className="w-full sm:w-auto text-sm"
                  size="sm"
                  data-testid="button-share-quotation"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Compartilhar PDF
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações do Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p className="break-words"><strong>Nome:</strong> {selectedQuotation.customer.name}</p>
                <p className="break-words"><strong>Email:</strong> {selectedQuotation.customer.email}</p>
                <p className="break-words"><strong>Telefone:</strong> {selectedQuotation.customer.phone}</p>
                <p className="break-words"><strong>CPF/CNPJ:</strong> {selectedQuotation.customer.cpfCnpj}</p>
                {selectedQuotation.customer.address && (
                  <p className="break-words"><strong>Endereço:</strong> {selectedQuotation.customer.address}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalhes do Orçamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p className="break-words"><strong>Data:</strong> {formatDate(selectedQuotation.createdAt!)}</p>
                <p className="break-words"><strong>Válido até:</strong> {formatDate(selectedQuotation.validUntil)}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <strong>Status:</strong> {getStatusBadge(selectedQuotation.status)}
                </div>
                <p className="break-words"><strong>Responsável:</strong> {selectedQuotation.responsibleName || selectedQuotation.user?.name}</p>
                <p className="break-words"><strong>Comissão:</strong> {getEmployeeCommissionPercent(selectedQuotation.responsibleId || selectedQuotation.userId)}%</p>
                <p className="break-words"><strong>Valor Comissão:</strong> {formatCurrency(calculateCommission(selectedQuotation.total, selectedQuotation.responsibleId || selectedQuotation.userId))}</p>
                <p className="break-words"><strong>Frete:</strong> {selectedQuotation.shippingIncluded ? 'Incluso' : 'Não incluso'}</p>
                <p className="break-words"><strong>Garantia:</strong> {selectedQuotation.warrantyText}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 md:mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Itens da Proposta</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto p-4">
              <Table className="min-w-full">
                <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  {user?.type === "admin" && (
                    <>
                      <TableHead>Custo Unit.</TableHead>
                      <TableHead>Valor Venda</TableHead>
                    </>
                  )}
                  {user?.type === "funcionario" && (
                    <TableHead>Valor Unit.</TableHead>
                  )}
                  <TableHead>Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedQuotation.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell>{parseFloat(item.quantity).toFixed(2)} m²</TableCell>
                    {user?.type === "admin" && (
                      <>
                        <TableCell>{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                        <TableCell>{formatCurrency(parseFloat(item.unitCost || item.unitPrice))}</TableCell>
                      </>
                    )}
                    {user?.type === "funcionario" && (
                      <TableCell>{formatCurrency(parseFloat(item.unitCost || item.unitPrice))}</TableCell>
                    )}
                    <TableCell>{formatCurrency(parseFloat(item.subtotal))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total da Venda:</span>
                <span className="text-master-green">
                  {formatCurrency(parseFloat(selectedQuotation.total))}
                </span>
              </div>
              
              {/* Mostrar comissão para funcionários na sua própria proposta */}
              {user?.type === "funcionario" && (selectedQuotation.responsibleId === user.id || selectedQuotation.userId === user.id) && (
                <div className="flex justify-between items-center text-sm text-green-600 mt-2 pt-2 border-t">
                  <span>Sua Comissão ({getEmployeeCommissionPercent(user.id)}%):</span>
                  <span className="font-semibold">{formatCurrency(calculateCommission(selectedQuotation.total, user.id))}</span>
                </div>
              )}
            </div>
            </div>
          </CardContent>
        </Card>

        {/* Seção de Custos - Visível para todos os status */}
        {selectedQuotation.costs && selectedQuotation.costs.length > 0 && 
         ['pending', 'approved', 'rejected'].includes(selectedQuotation.status) && (
          <Card className="mt-4 md:mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Custos da Proposta</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto p-4">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Valor Unit.</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedQuotation.costs.map((cost: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{cost.name}</TableCell>
                        <TableCell>{cost.supplier || '-'}</TableCell>
                        <TableCell>
                          {(() => {
                            const quantity = parseFloat(cost.quantity || 0);
                            const unitValue = parseFloat(cost.unitValue || 0);
                            const totalValue = parseFloat(cost.totalValue || 0);
                            
                            if (unitValue > 0 && totalValue > 0 && quantity > 0) {
                              const expectedTotalFromPercentage = unitValue * (quantity / 100);
                              const expectedTotalFromQuantity = unitValue * quantity;
                              
                              const diffPercentage = Math.abs(totalValue - expectedTotalFromPercentage);
                              const diffQuantity = Math.abs(totalValue - expectedTotalFromQuantity);
                              
                              if (diffPercentage <= 0.01 || diffPercentage < diffQuantity) {
                                return `${quantity.toFixed(2)}%`;
                              }
                            }
                            
                            return quantity.toFixed(2);
                          })()}
                        </TableCell>
                        <TableCell>{formatCurrency(parseFloat(cost.unitValue))}</TableCell>
                        <TableCell>{formatCurrency(parseFloat(cost.totalValue))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total dos Custos:</span>
                  <span className="text-red-600">
                    {formatCurrency(parseFloat(selectedQuotation.totalCosts || "0"))}
                  </span>
                </div>
              </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seção de Cálculos - Apenas para Administradores */}
        {user?.type === "admin" && (
          <Card className="mt-4 md:mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Análise Financeira</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700">Receitas</h4>
                  {/* Mostrar subtotal (valor bruto) se houver desconto */}
                  {parseFloat(selectedQuotation.subtotal || "0") > parseFloat(selectedQuotation.total) && (
                    <div className="flex justify-between">
                      <span>Valor Bruto:</span>
                      <span className="font-semibold">{formatCurrency(parseFloat(selectedQuotation.subtotal || "0"))}</span>
                    </div>
                  )}
                  {/* Mostrar desconto se houver */}
                  {parseFloat(selectedQuotation.subtotal || "0") > parseFloat(selectedQuotation.total) && (
                    <div className="flex justify-between">
                      <span>Desconto ({(((parseFloat(selectedQuotation.subtotal) - parseFloat(selectedQuotation.total)) / parseFloat(selectedQuotation.subtotal)) * 100).toFixed(1)}%):</span>
                      <span className="font-semibold text-red-600">
                        -{formatCurrency(parseFloat(selectedQuotation.subtotal) - parseFloat(selectedQuotation.total))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Total Final ao Cliente:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(parseFloat(selectedQuotation.total))}</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700">Custos e Impostos</h4>
                  <div className="flex justify-between">
                    <span>Total dos Custos:</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(parseFloat(selectedQuotation.totalCosts || "0"))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>NF (5% do valor {parseFloat((selectedQuotation as any).discountPercent || "0") > 0 ? 'com desconto' : 'total'}):</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(parseFloat(selectedQuotation.invoiceAmount || "0"))}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-700">Lucro da Empresa</h4>
                      <>
                        <div className="flex justify-between">
                          <span>Total de Custos:</span>
                          <span className="font-semibold text-red-600">
                            {formatCurrency(parseFloat(selectedQuotation.totalCosts || "0"))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Valor da Nota Fiscal (5%):</span>
                          <span className="font-semibold text-red-600">
                            {formatCurrency(parseFloat(selectedQuotation.invoiceAmount || "0"))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total com Nota Fiscal:</span>
                          <span className="font-semibold text-red-600">
                            {formatCurrency(parseFloat(selectedQuotation.totalWithInvoice || "0"))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lucro da Empresa:</span>
                          <span className="font-semibold text-blue-600">
                            {formatCurrency(parseFloat(selectedQuotation.companyProfit || "0"))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Porcentagem de Lucro:</span>
                          <span className="font-semibold">
                            {parseFloat(selectedQuotation.profitPercent || "0").toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Dízimo (10%):</span>
                          <span className="font-semibold text-red-600">
                            {formatCurrency(parseFloat(selectedQuotation.tithe || "0"))}
                          </span>
                        </div>
                      </>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-700">Resultado Final</h4>
                      <>
                        <div className="flex justify-between text-lg">
                          <span>Lucro Líquido:</span>
                          <span className="font-bold text-green-600">
                            {formatCurrency(parseFloat(selectedQuotation.netProfit || "0"))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Margem Líquida:</span>
                          <span className="font-semibold">
                            {(() => {
                              const finalTotal = parseFloat(selectedQuotation.total);
                              const netProfit = parseFloat(selectedQuotation.netProfit || "0");
                              return finalTotal > 0 ? ((netProfit / finalTotal) * 100).toFixed(2) : "0.00";
                            })()}%
                          </span>
                        </div>
                      </>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedQuotation.status === "pending" && (
          <div className="mt-4 md:mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button
              onClick={() => handleStatusUpdate(selectedQuotation.id, "approved")}
              className="bg-green-600 hover:bg-green-700 text-white flex-1 min-h-[44px]"
              disabled={updateStatusMutation.isPending}
            >
              <Check className="w-4 h-4 mr-2" />
              Aprovar
            </Button>
            <Button
              onClick={() => handleStatusUpdate(selectedQuotation.id, "rejected")}
              variant="destructive"
              className="flex-1 min-h-[44px]"
              disabled={updateStatusMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" />
              Rejeitar
            </Button>
          </div>
        )}

        {selectedQuotation.notes && (
          <Card className="mt-4 md:mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Observações</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-sm md:text-base">{selectedQuotation.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Propostas</h1>
          <p className="text-gray-600 text-sm md:text-base">Gerencie propostas comerciais</p>
        </div>
        <Button 
          onClick={() => setShowForm(true)} 
          className="btn-primary w-full md:w-auto"
          data-testid="button-nova-proposta"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Proposta
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Propostas</CardTitle>
          <CardDescription>
            {quotations.length} proposta(s) cadastrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quotationsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-master-green"></div>
            </div>
          ) : quotations.length > 0 ? (
            <>
              {/* Mobile view */}
              <div className="block md:hidden space-y-4">
                {quotations.map((quotation) => (
                  <Card key={quotation.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{quotation.quotationNumber}</p>
                        <p className="text-sm text-gray-600">{quotation.customer.name}</p>
                      </div>
                      {getStatusBadge(quotation.status)}
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-500">{formatDate(quotation.createdAt!)}</p>
                        <p className="font-semibold text-lg">{formatCurrency(parseFloat(quotation.total))}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedQuotation(quotation)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGeneratePDF(quotation)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Gerar PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSharePDF(quotation)}>
                            <Share2 className="mr-2 h-4 w-4" />
                            Compartilhar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateQuotation(quotation)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicar e Editar
                          </DropdownMenuItem>
                          {quotation.status === "pending" && (
                            <>
                              <DropdownMenuItem onClick={() => handleStatusUpdate(quotation.id, "approved")}>
                                <Check className="mr-2 h-4 w-4" />
                                Aprovar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusUpdate(quotation.id, "rejected")}>
                                <X className="mr-2 h-4 w-4" />
                                Rejeitar
                              </DropdownMenuItem>
                            </>
                          )}
                          {user?.type === "admin" && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteQuotation(quotation.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                ))}
              </div>
              
              {/* Desktop view */}
              <div className="hidden md:block">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quotation) => (
                    <TableRow key={quotation.id}>
                    <TableCell className="font-medium">
                      {quotation.quotationNumber}
                    </TableCell>
                    <TableCell>{quotation.customer.name}</TableCell>
                    <TableCell>{formatDate(quotation.createdAt!)}</TableCell>
                    <TableCell>
                      {formatCurrency(parseFloat(quotation.total))}
                    </TableCell>
                    <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setSelectedQuotation(quotation)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleGeneratePDF(quotation)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Gerar PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleSharePDF(quotation)}
                          >
                            <Share2 className="mr-2 h-4 w-4" />
                            Compartilhar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicateQuotation(quotation)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicar e Editar
                          </DropdownMenuItem>
                          {/* Aprovar/Rejeitar - Funcionários não podem alterar após aprovar/rejeitar */}
                          {quotation.status === "pending" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleStatusUpdate(quotation.id, "approved")}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Aprovar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusUpdate(quotation.id, "rejected")}
                              >
                                <X className="mr-2 h-4 w-4" />
                                Rejeitar
                              </DropdownMenuItem>
                            </>
                          )}
                          {/* Excluir - Apenas admins podem excluir */}
                          {user?.type === "admin" && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteQuotation(quotation.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhum orçamento encontrado.</p>
              <Button
                onClick={() => setShowForm(true)}
                className="btn-primary mt-4"
              >
                Criar Primeiro Orçamento
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}