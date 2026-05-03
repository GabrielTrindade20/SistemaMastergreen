import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QuickCreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (productId: string) => void;
}

export function QuickCreateProductDialog({ open, onOpenChange, onCreated }: QuickCreateProductDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Grama");
  const [pricePerM2, setPricePerM2] = useState("");
  const [costPerM2, setCostPerM2] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/products", {
        method: "POST",
        data: { name, category, pricePerM2, costPerM2: costPerM2 || "0", hasInstallation: 0 },
      });
    },
    onSuccess: (newProduct: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto criado com sucesso!" });
      onCreated(newProduct.id);
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao criar produto", variant: "destructive" });
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nome é obrigatório";
    if (!pricePerM2 || isNaN(parseFloat(pricePerM2)) || parseFloat(pricePerM2) < 0)
      e.pricePerM2 = "Informe um valor por m² válido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) createMutation.mutate();
  };

  const handleClose = () => {
    setName("");
    setCategory("Grama");
    setPricePerM2("");
    setCostPerM2("");
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Grama Bermuda"
              autoFocus
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Grama">Grama</SelectItem>
                <SelectItem value="Piso Vinílico">Piso Vinílico</SelectItem>
                <SelectItem value="Piso Tátil">Piso Tátil</SelectItem>
                <SelectItem value="Carpete">Carpete</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Valor por m² (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={pricePerM2}
              onChange={(e) => setPricePerM2(e.target.value)}
              placeholder="0,00"
            />
            {errors.pricePerM2 && <p className="text-xs text-red-500">{errors.pricePerM2}</p>}
          </div>

          <div className="space-y-1">
            <Label>Custo por m² (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={costPerM2}
              onChange={(e) => setCostPerM2(e.target.value)}
              placeholder="0,00 (opcional)"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-green-900 hover:bg-green-800 text-white">
              {createMutation.isPending ? "Salvando..." : "Criar Produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
