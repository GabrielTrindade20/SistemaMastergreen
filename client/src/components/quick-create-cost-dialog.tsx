import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QuickCreateCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (costId: string) => void;
}

export function QuickCreateCostDialog({ open, onOpenChange, onCreated }: QuickCreateCostDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [supplier, setSupplier] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/costs", {
        method: "POST",
        data: { name, value, supplier: supplier || null, description: null },
      });
    },
    onSuccess: (newCost: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/costs"] });
      toast({ title: "Custo criado com sucesso!" });
      onCreated(newCost.id);
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao criar custo", variant: "destructive" });
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nome é obrigatório";
    if (!value || isNaN(parseFloat(value)) || parseFloat(value) < 0)
      e.value = "Informe um valor válido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) createMutation.mutate();
  };

  const handleClose = () => {
    setName("");
    setValue("");
    setSupplier("");
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo Custo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Frete"
              autoFocus
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-1">
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
            />
            {errors.value && <p className="text-xs text-red-500">{errors.value}</p>}
          </div>

          <div className="space-y-1">
            <Label>Fornecedor</Label>
            <Input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Ex: Transportadora XYZ (opcional)"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-green-900 hover:bg-green-800 text-white">
              {createMutation.isPending ? "Salvando..." : "Criar Custo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
