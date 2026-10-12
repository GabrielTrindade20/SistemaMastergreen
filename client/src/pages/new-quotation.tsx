import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import NewQuotationForm from "@/components/new-quotation-form";
import type { Customer, Product, QuotationWithDetails } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { EditableQuickProposal } from '@shared/quick-proposal-edit';

export default function NewQuotation() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const searchParams = new URLSearchParams(search);
  const editingQuotationId = searchParams.get('edit');
  const isQuickEditing = !!editingQuotationId && searchParams.get('source') === 'app';
  const isAdminEditing = !isQuickEditing && searchParams.get('admin') === 'true' && user?.type === 'admin';
  const editingEndpoint = isQuickEditing ? '/api/quick-proposals' : '/api/quotations';

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Fetch quotation data if editing
  const { data: editingQuotation, isLoading: loadingQuotation, error: loadingError } = useQuery<QuotationWithDetails | EditableQuickProposal | null>({
    queryKey: [editingEndpoint, editingQuotationId],
    queryFn: async () => {
      if (!editingQuotationId) return null;
      return await apiRequest(`${editingEndpoint}/${editingQuotationId}`, { method: "GET" });
    },
    enabled: !!editingQuotationId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const createQuotationMutation = useMutation({
    mutationFn: async (data: any) => {
      
      if (editingQuotationId) {
        return await apiRequest(`${editingEndpoint}/${editingQuotationId}`, { method: "PUT", data });
      } else {
        return await apiRequest("/api/quotations", { method: "POST", data });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-calculated-quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Sucesso",
        description: editingQuotationId ? "Proposta atualizada com sucesso!" : "Proposta criada com sucesso!",
      });
      if (isAdminEditing) {
        setLocation("/funcionarios");
      } else {
        setLocation("/orcamentos");
      }
    },
    onError: (error) => {
      console.error("Error saving quotation:", error);
      toast({
        title: "Erro",
        description: error.message.startsWith('409:') ? 'Esta proposta foi alterada em outra aba. Seus dados continuam no formulário; reabra a proposta para conferir a versão atual antes de salvar.' : "Erro ao salvar proposta. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Redirect away if the quotation being edited is already approved or rejected
  useEffect(() => {
    if (editingQuotation && 'status' in editingQuotation) {
      const status = editingQuotation.status;
      if (status === 'approved' || status === 'rejected') {
        toast({
          title: "Edição não permitida",
          description: "Não é possível editar uma proposta que já foi aprovada ou rejeitada.",
          variant: "destructive",
        });
        setLocation("/orcamentos");
      }
    }
  }, [editingQuotation]);

  const handleSubmit = (data: any) => {
    createQuotationMutation.mutate(data);
  };

  const handleCancel = () => {
    if (isAdminEditing) {
      setLocation("/funcionarios");
    } else {
      setLocation("/orcamentos");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isAdminEditing ? 'Editar Proposta (Admin)' : editingQuotationId ? 'Editar Proposta' : 'Nova Proposta'}
            </h1>
            <p className="text-gray-600">
              {isAdminEditing ? 'Adicione custos e configure comissões' : editingQuotationId ? 'Edite os dados da proposta' : 'Crie uma nova proposta comercial'}
            </p>
          </div>
          <Button variant="outline" onClick={handleCancel}>
            Voltar
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>
              {isAdminEditing ? 'Cálculo de Custos e Comissões' : 'Informações da Proposta'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {createQuotationMutation.error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              {createQuotationMutation.error.message.startsWith('409:')
                ? 'Esta proposta foi alterada em outra aba. Seus dados continuam no formulário. Copie o que precisar e volte à lista para reabrir a versão atual antes de salvar.'
                : 'Não foi possível salvar. Seus dados continuam no formulário; verifique a conexão e tente novamente.'}
            </p>}
            {editingQuotationId && (loadingQuotation || !editingQuotation || loadingError) ? (
              <p role={loadingError ? 'alert' : 'status'}>{loadingError ? 'Não foi possível abrir esta proposta. Verifique seu acesso e volte à lista para tentar novamente.' : 'Carregando proposta…'}</p>
            ) : (
            <NewQuotationForm
              key={`${editingEndpoint}-${editingQuotationId || 'new'}`}
              customers={customers}
              products={products}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={createQuotationMutation.isPending}
              initialData={editingQuotation}
              isEditMode={!!editingQuotationId && !isAdminEditing}
              quickProposal={isQuickEditing ? editingQuotation as EditableQuickProposal : undefined}
            />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
