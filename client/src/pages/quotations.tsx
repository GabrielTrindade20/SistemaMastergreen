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
import { Plus, MoreHorizontal, FileText, Check, X, Eye, Trash2 } from "lucide-react";
import type { QuotationWithDetails, Customer, Product } from "@shared/schema";
import QuotationForm from "@/components/quotation-form";
import { generateQuotationPDF } from "@/lib/pdf-generator";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Quotations() {
  const [showForm, setShowForm] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationWithDetails | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotations = [], isLoading: quotationsLoading } = useQuery<QuotationWithDetails[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/quotations", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      setShowForm(false);
      toast({
        title: "Sucesso",
        description: "Orçamento criado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar orçamento",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/api/quotations/${id}/status`, "PUT", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({
        title: "Sucesso",
        description: "Status do orçamento atualizado!",
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
      return await apiRequest(`/api/quotations/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({
        title: "Sucesso",
        description: "Orçamento excluído com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir orçamento",
        variant: "destructive",
      });
    },
  });

  const handleCreateQuotation = (data: any) => {
    createMutation.mutate(data);
  };

  const handleStatusUpdate = (id: string, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleDeleteQuotation = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este orçamento?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleGeneratePDF = async (quotation: QuotationWithDetails) => {
    try {
      await generateQuotationPDF(quotation);
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
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => setShowForm(false)}
            className="mb-4"
          >
            ← Voltar
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Novo Orçamento</h1>
        </div>

        <QuotationForm
          customers={customers}
          products={products}
          onSubmit={handleCreateQuotation}
          onCancel={() => setShowForm(false)}
          isLoading={createMutation.isPending}
        />
      </div>
    );
  }

  if (selectedQuotation) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => setSelectedQuotation(null)}
            className="mb-4"
          >
            ← Voltar
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Orçamento {selectedQuotation.quotationNumber}
              </h1>
              <p className="text-gray-600">
                Cliente: {selectedQuotation.customer.name}
              </p>
            </div>
            <div className="flex gap-2">
              {getStatusBadge(selectedQuotation.status)}
              <Button
                onClick={() => handleGeneratePDF(selectedQuotation)}
                className="btn-primary"
              >
                <FileText className="w-4 h-4 mr-2" />
                Gerar PDF
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Nome:</strong> {selectedQuotation.customer.name}</p>
                <p><strong>Email:</strong> {selectedQuotation.customer.email}</p>
                <p><strong>Telefone:</strong> {selectedQuotation.customer.phone}</p>
                <p><strong>CPF/CNPJ:</strong> {selectedQuotation.customer.cpfCnpj}</p>
                {selectedQuotation.customer.address && (
                  <p><strong>Endereço:</strong> {selectedQuotation.customer.address}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhes do Orçamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Data:</strong> {formatDate(selectedQuotation.createdAt!)}</p>
                <p><strong>Válido até:</strong> {formatDate(selectedQuotation.validUntil)}</p>
                <p><strong>Status:</strong> {getStatusBadge(selectedQuotation.status)}</p>
                <p><strong>Frete:</strong> {selectedQuotation.shippingIncluded ? 'Incluso' : 'Não incluso'}</p>
                <p><strong>Garantia:</strong> {selectedQuotation.warrantyText}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Itens do Orçamento</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Valor Unitário</TableHead>
                  <TableHead>Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedQuotation.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell>{parseFloat(item.quantity).toFixed(2)} m²</TableCell>
                    <TableCell>{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(item.subtotal))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total:</span>
                <span className="text-master-green">
                  {formatCurrency(parseFloat(selectedQuotation.total))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedQuotation.status === "pending" && (
          <div className="mt-6 flex gap-4">
            <Button
              onClick={() => handleStatusUpdate(selectedQuotation.id, "approved")}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={updateStatusMutation.isPending}
            >
              <Check className="w-4 h-4 mr-2" />
              Aprovar
            </Button>
            <Button
              onClick={() => handleStatusUpdate(selectedQuotation.id, "rejected")}
              variant="destructive"
              disabled={updateStatusMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" />
              Rejeitar
            </Button>
          </div>
        )}

        {selectedQuotation.notes && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{selectedQuotation.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orçamentos</h1>
          <p className="text-gray-600">Gerencie orçamentos e propostas</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Novo Orçamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Orçamentos</CardTitle>
          <CardDescription>
            {quotations.length} orçamento(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quotationsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-master-green"></div>
            </div>
          ) : quotations.length > 0 ? (
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
                          <DropdownMenuItem
                            onClick={() => handleDeleteQuotation(quotation.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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