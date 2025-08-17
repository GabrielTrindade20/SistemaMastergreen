import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Edit, Trash2, DollarSign, TrendingUp } from "lucide-react";
import type { Product, InsertProduct } from "@shared/schema";

export default function Products() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !!user,
  });

  const createProductMutation = useMutation({
    mutationFn: async (productData: InsertProduct) => {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar produto");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      toast({ title: "Produto criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, productData }: { id: string; productData: Partial<InsertProduct> }) => {
      const response = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar produto");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      toast({ title: "Produto atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir produto");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto excluído com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenDialog = (product?: Product) => {
    setEditingProduct(product || null);
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      deleteProductMutation.mutate(id);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Grama": return "bg-green-100 text-green-800 border-green-200";
      case "Piso": return "bg-blue-100 text-blue-800 border-blue-200";
      case "Carpete": return "bg-purple-100 text-purple-800 border-purple-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getMarginPercent = (price: string, cost: string) => {
    const priceNum = parseFloat(price || "0");
    const costNum = parseFloat(cost || "0");
    if (priceNum === 0) return 0;
    return ((priceNum - costNum) / priceNum * 100).toFixed(1);
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Você precisa estar logado para acessar esta página.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col space-y-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Catálogo de Produtos</h1>
          <p className="text-gray-600 mt-1 text-sm md:text-base">Gerencie os produtos e preços da empresa</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-[#002b17] hover:bg-[#004a2a] w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preço Médio/m²</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {products.length > 0 
                ? (products.reduce((sum, p) => sum + parseFloat(p.pricePerM2), 0) / products.length).toFixed(2)
                : "0.00"
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem Média</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.length > 0 
                ? (products.reduce((sum, p) => {
                    const margin = parseFloat(getMarginPercent(p.pricePerM2, p.costPerM2 || "0"));
                    return sum + margin;
                  }, 0) / products.length).toFixed(1)
                : "0.0"
              }%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorias</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(products.map(p => p.category).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos Cadastrados</CardTitle>
          <CardDescription>
            Gerencie preços, custos e categorias dos produtos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {products.map((product) => (
              <div key={product.id} className="border rounded-lg hover:bg-gray-50">
                {/* Mobile layout */}
                <div className="block sm:hidden p-4">
                  <div className="flex items-start space-x-3 mb-3">
                    <div className="w-10 h-10 bg-[#002b17] text-white rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base leading-tight">{product.name}</h3>
                      {product.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge className={getCategoryColor(product.category || "")}>
                      {product.category}
                    </Badge>
                    {product.hasInstallation === 1 && (
                      <Badge variant="outline">Com Instalação</Badge>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md mb-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Preço:</span>
                        <div className="font-bold text-[#002b17]">
                          R$ {parseFloat(product.pricePerM2).toFixed(2)}/m²
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Custo:</span>
                        <div className="text-gray-700">
                          R$ {parseFloat(product.costPerM2 || "0").toFixed(2)}/m²
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Margem:</span>
                        <div className="font-medium text-green-600">
                          {getMarginPercent(product.pricePerM2, product.costPerM2 || "0")}%
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(product)}
                      className="flex-1 max-w-[100px]"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteProduct(product.id)}
                      disabled={deleteProductMutation.isPending}
                      className="flex-1 max-w-[100px]"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden sm:flex items-center justify-between p-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-[#002b17] text-white rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{product.name}</h3>
                      {product.description && (
                        <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                      )}
                      <div className="flex items-center space-x-3 mt-2">
                        <Badge className={getCategoryColor(product.category || "")}>
                          {product.category}
                        </Badge>
                        {product.hasInstallation === 1 && (
                          <Badge variant="outline">Com Instalação</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#002b17]">
                        R$ {parseFloat(product.pricePerM2).toFixed(2)}/m²
                      </div>
                      <div className="text-sm text-gray-500">
                        Custo: R$ {parseFloat(product.costPerM2 || "0").toFixed(2)}/m²
                      </div>
                      <div className="text-sm text-green-600 font-medium">
                        Margem: {getMarginPercent(product.pricePerM2, product.costPerM2 || "0")}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(product)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteProduct(product.id)}
                      disabled={deleteProductMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum produto cadastrado</h3>
                <p className="text-gray-500 mb-4">Comece cadastrando seu primeiro produto</p>
                <Button onClick={() => handleOpenDialog()} className="bg-[#002b17] hover:bg-[#004a2a]">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Produto
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para criar/editar produto */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct ? "Edite as informações do produto" : "Preencha os dados do novo produto"}
            </DialogDescription>
          </DialogHeader>
          <ProductForm
            product={editingProduct}
            onSubmit={(productData) => {
              if (editingProduct) {
                updateProductMutation.mutate({ id: editingProduct.id, productData });
              } else {
                createProductMutation.mutate(productData);
              }
            }}
            isLoading={createProductMutation.isPending || updateProductMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (productData: InsertProduct) => void;
  isLoading: boolean;
}

function ProductForm({ product, onSubmit, isLoading }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: product?.name || "",
    category: product?.category || "Grama",
    hasInstallation: product?.hasInstallation || 0,
    pricePerM2: product?.pricePerM2 || "",
    costPerM2: product?.costPerM2 || "",
    description: product?.description || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as InsertProduct);
  };

  const getMarginPercent = () => {
    const price = parseFloat(formData.pricePerM2) || 0;
    const cost = parseFloat(formData.costPerM2) || 0;
    if (price === 0) return 0;
    return ((price - cost) / price * 100).toFixed(1);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Nome do Produto</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Grama Sintética 20mm"
            required
            disabled={isLoading}
          />
        </div>
        
        <div>
          <Label htmlFor="category">Categoria</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Grama">Grama Sintética</SelectItem>
              <SelectItem value="Piso">Piso Tátil</SelectItem>
              <SelectItem value="Carpete">Capacho/Carpete</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="hasInstallation">Opção de Instalação</Label>
          <Select
            value={formData.hasInstallation.toString()}
            onValueChange={(value) => setFormData({ ...formData, hasInstallation: parseInt(value) })}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Apenas Produto</SelectItem>
              <SelectItem value="1">Com Instalação</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="pricePerM2">Preço de Venda (R$/m²)</Label>
          <Input
            id="pricePerM2"
            type="number"
            step="0.01"
            min="0"
            value={formData.pricePerM2}
            onChange={(e) => setFormData({ ...formData, pricePerM2: e.target.value })}
            placeholder="0.00"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="costPerM2">Custo (R$/m²)</Label>
          <Input
            id="costPerM2"
            type="number"
            step="0.01"
            min="0"
            value={formData.costPerM2}
            onChange={(e) => setFormData({ ...formData, costPerM2: e.target.value })}
            placeholder="0.00"
            disabled={isLoading}
          />
          {formData.pricePerM2 && formData.costPerM2 && (
            <p className="text-sm text-green-600 mt-1">
              Margem: {getMarginPercent()}%
            </p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">Descrição (Opcional)</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Informações adicionais sobre o produto..."
            disabled={isLoading}
            rows={3}
          />
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Salvando..." : (product ? "Atualizar Produto" : "Criar Produto")}
      </Button>
    </form>
  );
}