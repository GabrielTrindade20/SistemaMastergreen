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
  const [commissionData, setCommissionData] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: quotations = [], isLoading: quotationsLoading } = useQuery<QuotationWithDetails[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const updateCommissionMutation = useMutation({
    mutationFn: async ({ quotationId, commission }: { quotationId: string; commission: number }) => {
      const response = await apiRequest("PATCH", `/api/quotations/${quotationId}/commission`, {
        commission
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({
        title: "Sucesso",
        description: "Comissão salva com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error updating commission:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar comissão. Tente novamente.",
        variant: "destructive",
      });
    },
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

  const handleCommissionChange = (quotationId: string, percentage: string) => {
    const numValue = parseFloat(percentage) || 0;
    setCommissionData(prev => ({
      ...prev,
      [quotationId]: numValue
    }));
  };

  const calculateCommission = (total: string, percentage: string | number) => {
    const totalValue = parseFloat(total);
    const commissionPercent = typeof percentage === 'string' ? parseFloat(percentage) : percentage;
    return (totalValue * commissionPercent) / 100;
  };

  const saveCommission = (quotationId: string) => {
    const commission = commissionData[quotationId] || 0;
    updateCommissionMutation.mutate({ quotationId, commission });
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
    const commission = parseFloat(q.commission || "0") || commissionData[q.id] || 0;
    return sum + calculateCommission(q.total, commission);
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
                      const currentCommission = parseFloat(quotation.commission || "0") || commissionData[quotation.id] || 0;
                      const commissionValue = calculateCommission(quotation.total, currentCommission);
                      
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
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              placeholder="0.0"
                              value={currentCommission || ""}
                              onChange={(e) => handleCommissionChange(quotation.id, e.target.value)}
                              className="w-20"
                              data-testid={`input-commission-${quotation.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(commissionValue)}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => saveCommission(quotation.id)}
                                disabled={updateCommissionMutation.isPending}
                                data-testid={`button-save-commission-${quotation.id}`}
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`/orcamentos?view=${quotation.id}`, '_blank')}
                                data-testid={`button-view-proposal-${quotation.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
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