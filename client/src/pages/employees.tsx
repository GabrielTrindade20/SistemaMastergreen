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
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Eye, 
  Save, 
  Users, 
  TrendingUp,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { apiRequest } from "@/lib/queryClient";
import type { QuotationWithDetails, User } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

export default function Employees() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationWithDetails | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: quotations = [], isLoading: quotationsLoading } = useQuery<QuotationWithDetails[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Filter quotations
  const filteredQuotations = quotations.filter(quotation => {
    const matchesSearch = searchTerm === "" || 
      quotation.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quotation.quotationNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEmployee = selectedEmployee === "all" || 
      quotation.responsibleId === selectedEmployee ||
      quotation.userId === selectedEmployee; // também busca pelo userId caso responsibleId seja null
    
    const matchesStatus = selectedStatus === "all" || 
      quotation.status === selectedStatus;

    return matchesSearch && matchesEmployee && matchesStatus;
  });

  const calculateCommission = (total: string, employeeId: string) => {
    const totalValue = parseFloat(total);
    const employee = users.find(u => u.id === employeeId);
    const commissionPercent = parseFloat(employee?.commissionPercent || "0");
    return (totalValue * commissionPercent) / 100;
  };

  const getEmployeeCommissionPercent = (employeeId: string) => {
    const employee = users.find(u => u.id === employeeId);
    return employee?.commissionPercent || "0";
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: "Em andamento", variant: "secondary" as const },
      approved: { label: "Aprovada", variant: "default" as const },
      rejected: { label: "Rejeitada", variant: "destructive" as const },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || 
      { label: status, variant: "secondary" as const };
    
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    );
  };

  const getEmployeeName = (quotation: QuotationWithDetails) => {
    // Primeiro tenta buscar pelo responsibleId, depois pelo userId
    const employeeId = quotation.responsibleId || quotation.userId;
    if (!employeeId) return "Não informado";
    
    const employee = users.find(u => u.id === employeeId);
    return employee?.name || quotation.responsibleName || "Não informado";
  };

  // Calculate totals
  const totalProposals = filteredQuotations.length;
  const approvedProposals = filteredQuotations.filter(q => q.status === "approved").length;
  const totalValue = filteredQuotations.reduce((sum, q) => sum + parseFloat(q.total), 0);
  const totalCommissions = filteredQuotations.reduce((sum, q) => {
    const employeeId = q.responsibleId || q.userId;
    if (employeeId) {
      return sum + calculateCommission(q.total, employeeId);
    }
    return sum;
  }, 0);

  // Redirect if not admin
  if (user?.type !== "admin") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h1>
          <p className="text-gray-600">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  if (quotationsLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#002b17]"></div>
      </div>
    );
  }

  // Se uma proposta foi selecionada, mostrar visualização detalhada
  if (selectedQuotation) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Visualizar Proposta - {selectedQuotation.quotationNumber}
            </h1>
            <p className="text-gray-600">Detalhes completos da proposta</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setSelectedQuotation(null)}
            data-testid="button-voltar-funcionarios"
          >
            Voltar para Funcionários
          </Button>
        </div>

        {/* Informações do Cliente */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Informações do Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>Nome:</strong> {selectedQuotation.customer.name}</p>
                <p><strong>Email:</strong> {selectedQuotation.customer.email}</p>
                <p><strong>Telefone:</strong> {selectedQuotation.customer.phone}</p>
                <p><strong>CPF/CNPJ:</strong> {selectedQuotation.customer.cpfCnpj}</p>
              </div>
              <div>
                <p><strong>Endereço:</strong> {selectedQuotation.customer.address}, {selectedQuotation.customer.number}</p>
                <p><strong>Bairro:</strong> {selectedQuotation.customer.neighborhood}</p>
                <p><strong>Cidade:</strong> {selectedQuotation.customer.city}</p>
                <p><strong>CEP:</strong> {selectedQuotation.customer.zipCode}</p>
              </div>
            </div>
            {selectedQuotation.customer.notes && (
              <div className="mt-4">
                <p><strong>Observações do Cliente:</strong> {selectedQuotation.customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informações da Proposta */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Informações da Proposta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p><strong>Número:</strong> {selectedQuotation.quotationNumber}</p>
                <p><strong>Data:</strong> {formatDate(selectedQuotation.createdAt!)}</p>
                <p><strong>Status:</strong> {getStatusBadge(selectedQuotation.status)}</p>
              </div>
              <div>
                <p><strong>Responsável:</strong> {getEmployeeName(selectedQuotation)}</p>
                <p><strong>Filial:</strong> {selectedQuotation.branch}</p>
                <p><strong>Válida até:</strong> {formatDate(selectedQuotation.validUntil!)}</p>
              </div>
              <div>
                <p><strong>Comissão:</strong> {getEmployeeCommissionPercent(selectedQuotation.responsibleId || selectedQuotation.userId || "")}%</p>
                <p><strong>Valor Comissão:</strong> {formatCurrency(calculateCommission(selectedQuotation.total, selectedQuotation.responsibleId || selectedQuotation.userId || ""))}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Produtos */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Produtos/Serviços</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Valor Unit.</TableHead>
                  <TableHead>Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedQuotation.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-gray-600">{item.product.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>{parseFloat(item.quantity).toLocaleString('pt-BR')} m²</TableCell>
                    <TableCell>{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(item.subtotal))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total da Proposta:</span>
                <span className="text-green-600">
                  {formatCurrency(parseFloat(selectedQuotation.total))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custos */}
        {selectedQuotation.costs && selectedQuotation.costs.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Custos do Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Valor Unit.</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedQuotation.costs.map((cost: any) => (
                    <TableRow key={cost.id}>
                      <TableCell>{cost.name}</TableCell>
                      <TableCell>{formatCurrency(parseFloat(cost.unitValue))}</TableCell>
                      <TableCell>{cost.quantity}</TableCell>
                      <TableCell>{formatCurrency(parseFloat(cost.totalValue))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total dos Custos:</span>
                  <span className="text-red-600">
                    {formatCurrency(selectedQuotation.costs.reduce((sum: number, cost: any) => sum + parseFloat(cost.totalValue), 0))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Análise Financeira */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Análise Financeira</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700">Receitas</h4>
                <div className="flex justify-between">
                  <span>Valor da Venda:</span>
                  <span className="font-semibold">{formatCurrency(parseFloat(selectedQuotation.total))}</span>
                </div>
              </div>
            
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700">Custos e Impostos</h4>
                <div className="flex justify-between">
                  <span>Total dos Custos:</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(selectedQuotation.costs?.reduce((sum: number, cost: any) => sum + parseFloat(cost.totalValue), 0) || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>NF (5%):</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(parseFloat(selectedQuotation.total) * 0.05)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700">Lucro da Empresa</h4>
                  <div className="flex justify-between">
                    <span>Lucro Bruto:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(
                        parseFloat(selectedQuotation.total) - 
                        (selectedQuotation.costs?.reduce((sum: number, cost: any) => sum + parseFloat(cost.totalValue), 0) || 0) - 
                        (parseFloat(selectedQuotation.total) * 0.05)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dízimo (10%):</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(
                        (parseFloat(selectedQuotation.total) - 
                        (selectedQuotation.costs?.reduce((sum: number, cost: any) => sum + parseFloat(cost.totalValue), 0) || 0) - 
                        (parseFloat(selectedQuotation.total) * 0.05)) * 0.1
                      )}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700">Resultado Final</h4>
                  <div className="flex justify-between text-lg">
                    <span>Lucro Líquido:</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(
                        (parseFloat(selectedQuotation.total) - 
                        (selectedQuotation.costs?.reduce((sum: number, cost: any) => sum + parseFloat(cost.totalValue), 0) || 0) - 
                        (parseFloat(selectedQuotation.total) * 0.05)) * 0.9
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Margem de Lucro:</span>
                    <span className="font-semibold">
                      {(((parseFloat(selectedQuotation.total) - 
                        (selectedQuotation.costs?.reduce((sum: number, cost: any) => sum + parseFloat(cost.totalValue), 0) || 0) - 
                        (parseFloat(selectedQuotation.total) * 0.05)) * 0.9) / parseFloat(selectedQuotation.total) * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedQuotation.notes && (
          <Card className="mb-6">
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
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Gerência de Funcionários</h1>
          <p className="text-gray-600 text-sm md:text-base">Gerencie propostas e comissões de funcionários</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-[#002b17]" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total de Propostas</p>
                  <p className="text-2xl font-bold">{totalProposals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Aprovadas</p>
                  <p className="text-2xl font-bold text-green-600">{approvedProposals}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Valor Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Comissões</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCommissions)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar cliente ou nº proposta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-proposals"
                />
              </div>

              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Todos os funcionários" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os funcionários</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Todas as situações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  <SelectItem value="pending">Em andamento</SelectItem>
                  <SelectItem value="approved">Aprovada</SelectItem>
                  <SelectItem value="rejected">Rejeitada</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setSelectedEmployee("all");
                  setSelectedStatus("all");
                }}
                data-testid="button-clear-filters"
              >
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Proposals Table */}
        <Card>
          <CardHeader>
            <CardTitle>Propostas e Comissões</CardTitle>
            <CardDescription>
              {filteredQuotations.length} proposta(s) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredQuotations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  {searchTerm || selectedEmployee !== "all" || selectedStatus !== "all" 
                    ? "Nenhuma proposta encontrada com os filtros aplicados" 
                    : "Nenhuma proposta cadastrada"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor Bruto</TableHead>
                      <TableHead>% Comissão</TableHead>
                      <TableHead>Valor Comissão</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotations.map((quotation) => {
                      const employeeId = quotation.responsibleId || quotation.userId || "";
                      const commissionPercent = getEmployeeCommissionPercent(employeeId);
                      const commissionValue = calculateCommission(quotation.total, employeeId);
                      
                      return (
                        <TableRow key={quotation.id}>
                          <TableCell className="font-medium">
                            {getEmployeeName(quotation)}
                          </TableCell>
                          <TableCell>{quotation.customer.name}</TableCell>
                          <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                          <TableCell>{formatDate(quotation.createdAt!)}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(parseFloat(quotation.total))}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {commissionPercent}%
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(commissionValue)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedQuotation(quotation)}
                              data-testid={`button-view-proposal-${quotation.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}