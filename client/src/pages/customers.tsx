import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Edit, User } from "lucide-react";
import { formatPhone, formatDocument, formatCEP } from "@/lib/calculations";
import { useToast } from "@/hooks/use-toast";
import CustomerForm from "@/components/customer-form";
import type { Customer } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/customers", { method: "POST", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Sucesso",
        description: "Cliente cadastrado com sucesso!",
      });
      setIsModalOpen(false);
      setEditingCustomer(null);
    },
    onError: (error) => {
      console.error("Error creating customer:", error);
      toast({
        title: "Erro",
        description: "Erro ao cadastrar cliente. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/customers/${id}`, { method: "PUT", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Sucesso",
        description: "Cliente atualizado com sucesso!",
      });
      setIsModalOpen(false);
      setEditingCustomer(null);
    },
    onError: (error) => {
      console.error("Error updating customer:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar cliente. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Filter customers
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  const handleSubmit = (data: any) => {
    if (editingCustomer) {
      updateCustomerMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createCustomerMutation.mutate(data);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleNewCustomer = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-master-green', 'bg-blue-500', 'bg-purple-500', 'bg-yellow-500', 'bg-red-500'];
    const index = name.length % colors.length;
    return colors[index];
  };

  return (
    <div>
      {/* Header - Mobile responsive */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-600 text-sm md:text-base">Gerencie sua base de clientes</p>
          </div>
          <Button 
            className="btn-primary w-full md:w-auto" 
            onClick={handleNewCustomer}
            data-testid="button-novo-cliente"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle>Lista de Clientes</CardTitle>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                  data-testid="input-search-clients"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-32 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                </p>
                <Button className="btn-primary" onClick={handleNewCustomer}>
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Primeiro Cliente
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredCustomers.map((customer) => (
                  <Card key={customer.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 ${getAvatarColor(customer.name)} text-white rounded-full flex items-center justify-center mr-3`}>
                            <span className="font-semibold text-sm">
                              {getInitials(customer.name)}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{customer.name}</h4>
                            <p className="text-sm text-gray-500">
                              Cliente desde {new Date(customer.createdAt!).toLocaleDateString('pt-BR', { 
                                month: 'short', 
                                year: 'numeric' 
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center text-gray-600">
                          <span className="w-4 mr-2">✉️</span>
                          {customer.email}
                        </div>
                        <div className="flex items-center text-gray-600">
                          <span className="w-4 mr-2">📞</span>
                          {customer.phone ? formatPhone(customer.phone) : 'Não informado'}
                        </div>
                        <div className="flex items-center text-gray-600">
                          <span className="w-4 mr-2">🆔</span>
                          {customer.cpfCnpj ? formatDocument(customer.cpfCnpj) : 'Não informado'}
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          Cliente ativo
                        </Badge>
                        <div className="flex items-center space-x-2">
                          
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEdit(customer)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <CustomerForm
            initialData={editingCustomer}
            onSubmit={handleSubmit}
            onCancel={() => setIsModalOpen(false)}
            isLoading={createCustomerMutation.isPending || updateCustomerMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
