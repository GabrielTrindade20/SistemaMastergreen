import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import NewQuotationForm from "@/components/new-quotation-form";
import type { Customer, Product } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export default function NewQuotation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [isAdminEditing, setIsAdminEditing] = useState(false);
  
  // Get URL parameters for editing
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    const adminMode = urlParams.get('admin') === 'true';
    
    setEditingQuotationId(editId);
    setIsAdminEditing(adminMode && user?.type === 'admin');
  }, [user]);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Fetch quotation data if editing
  const { data: editingQuotation } = useQuery({
    queryKey: ["/api/quotations", editingQuotationId],
    queryFn: async () => {
      if (!editingQuotationId) return null;
      return await apiRequest(`/api/quotations/${editingQuotationId}`, { method: "GET" });
    },
    enabled: !!editingQuotationId,
  });

  const createQuotationMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('=== MUTATION FUNCTION ===');
      console.log('editingQuotationId:', editingQuotationId);
      console.log('isAdminEditing:', isAdminEditing);
      console.log('data being sent:', data);
      
      if (editingQuotationId) {
        // Update existing quotation
        console.log('Making PUT request to:', `/api/quotations/${editingQuotationId}`);
        const result = await apiRequest(`/api/quotations/${editingQuotationId}`, { method: "PUT", data });
        console.log('PUT request result:', result);
        return result;
      } else {
        // Create new quotation
        console.log('Making POST request to: /api/quotations');
        const result = await apiRequest("/api/quotations", { method: "POST", data });
        console.log('POST request result:', result);
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({
        title: "Sucesso",
        description: editingQuotationId ? "Proposta atualizada com sucesso!" : "Proposta criada com sucesso!",
      });
      if (isAdminEditing) {
        setLocation("/employees");
      } else {
        setLocation("/orcamentos");
      }
    },
    onError: (error) => {
      console.error("Error saving quotation:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar proposta. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: any) => {
    console.log('handleSubmit called with data:', data);
    console.log('Editing quotation ID:', editingQuotationId);
    console.log('Is admin editing:', isAdminEditing);
    createQuotationMutation.mutate(data);
  };

  const handleCancel = () => {
    if (isAdminEditing) {
      setLocation("/employees");
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
            <NewQuotationForm
              customers={customers}
              products={products}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={createQuotationMutation.isPending}
              initialData={editingQuotation}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
