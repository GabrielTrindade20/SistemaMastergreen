import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Cost, InsertCost } from "@shared/schema";

export default function CostsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);
  const [formData, setFormData] = useState<Partial<InsertCost>>({
    name: "",
    value: "",
    supplier: "",
    description: ""
  });
  const { toast } = useToast();

  // Fetch costs
  const { data: costs = [], isLoading } = useQuery<Cost[]>({
    queryKey: ["/api/costs"],
  });

  // Create cost mutation
  const createCostMutation = useMutation({
    mutationFn: (data: InsertCost) => apiRequest("/api/costs", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/costs"] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: "Custo criado",
        description: "Custo criado com sucesso!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar custo",
        variant: "destructive"
      });
    }
  });

  // Update cost mutation
  const updateCostMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertCost> }) =>
      apiRequest(`/api/costs/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/costs"] });
      setEditingCost(null);
      resetForm();
      toast({
        title: "Custo atualizado",
        description: "Custo atualizado com sucesso!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar custo",
        variant: "destructive"
      });
    }
  });

  // Delete cost mutation
  const deleteCostMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/costs/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/costs"] });
      toast({
        title: "Custo excluído",
        description: "Custo excluído com sucesso!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir custo",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      value: "",
      supplier: "",
      description: ""
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.value || !formData.supplier) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (editingCost) {
      updateCostMutation.mutate({ id: editingCost.id, data: formData as InsertCost });
    } else {
      createCostMutation.mutate(formData as InsertCost);
    }
  };

  const handleEdit = (cost: Cost) => {
    setEditingCost(cost);
    setFormData({
      name: cost.name,
      value: cost.value,
      supplier: cost.supplier,
      description: cost.description || ""
    });
    setShowCreateDialog(true);
  };

  const handleDelete = (cost: Cost) => {
    if (confirm(`Tem certeza que deseja excluir o custo "${cost.name}"?`)) {
      deleteCostMutation.mutate(cost.id);
    }
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(parseFloat(value));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Custos</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Custos</h1>
          <p className="text-muted-foreground">
            Gerencie os custos que podem ser incluídos nas propostas
          </p>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setEditingCost(null);
            setShowCreateDialog(true);
          }}
          data-testid="button-create-cost"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Custo
        </Button>
      </div>

      {costs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Nenhum custo cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece criando seu primeiro custo para incluir nas propostas
              </p>
              <Button 
                onClick={() => {
                  resetForm();
                  setEditingCost(null);
                  setShowCreateDialog(true);
                }}
                data-testid="button-create-first-cost"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Custo
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {costs.map((cost) => (
            <Card key={cost.id} data-testid={`card-cost-${cost.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg" data-testid={`text-cost-name-${cost.id}`}>
                      {cost.name}
                    </CardTitle>
                    <CardDescription data-testid={`text-cost-supplier-${cost.id}`}>
                      {cost.supplier}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" data-testid={`text-cost-value-${cost.id}`}>
                    {formatCurrency(cost.value)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {cost.description && (
                  <p className="text-sm text-muted-foreground mb-4" data-testid={`text-cost-description-${cost.id}`}>
                    {cost.description}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(cost)}
                    data-testid={`button-edit-cost-${cost.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(cost)}
                    data-testid={`button-delete-cost-${cost.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-cost-form">
          <DialogHeader>
            <DialogTitle>
              {editingCost ? "Editar Custo" : "Novo Custo"}
            </DialogTitle>
            <DialogDescription>
              {editingCost 
                ? "Edite as informações do custo" 
                : "Preencha as informações do novo custo"
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do Custo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Transporte, Instalação..."
                  data-testid="input-cost-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="value">Valor (R$) *</Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="0,00"
                  data-testid="input-cost-value"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplier">Fornecedor *</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  placeholder="Nome do fornecedor"
                  data-testid="input-cost-supplier"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição opcional do custo..."
                  data-testid="input-cost-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCreateDialog(false)}
                data-testid="button-cancel-cost"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createCostMutation.isPending || updateCostMutation.isPending}
                data-testid="button-save-cost"
              >
                {createCostMutation.isPending || updateCostMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}