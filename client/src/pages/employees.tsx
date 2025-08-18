import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Users, Search, Filter, Calculator, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Types
interface User {
  id: string;
  name: string;
  email: string;
  type: string;
  branch: string;
  commissionPercent: string;
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface QuotationItem {
  id: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  product: {
    id: string;
    name: string;
    price: string;
    cost: string;
  };
}

interface Quotation {
  id: string;
  customerId: string;
  userId: string;
  responsibleId?: string;
  status: string;
  total: string;
  discountPercent: string;
  notes?: string;
  freightIncluded: boolean;
  warrantyText: string;
  responsibleName: string;
  responsibleRole: string;
  createdAt?: string;
  customer: Customer;
  items: QuotationItem[];
  costs?: Array<{
    name: string;
    supplier: string;
    quantity: string;
    unitValue: string;
    totalValue: string;
  }>;
}

// Utility functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR');
};

export default function Employees() {
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [calculatingCosts, setCalculatingCosts] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Redirect non-admin users
  if (currentUser && currentUser.type !== "admin") {
    navigate("/dashboard");
    return null;
  }

  // Fetch users (employees)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users']
  });

  // Fetch original employee quotations for admin management
  const { data: originalQuotations = [] } = useQuery<Quotation[]>({
    queryKey: ['/api/employee-quotations'],
    enabled: !!currentUser && currentUser.type === "admin"
  });

  // Fetch admin-calculated quotations (validated proposals)
  const { data: validatedQuotations = [] } = useQuery<Quotation[]>({
    queryKey: ['/api/admin-calculated-quotations'],
    enabled: !!currentUser && currentUser.type === "admin"
  });

  // Filter employees only
  const employees = users.filter(user => user.type === 'vendedor');

  const handleCalculateCosts = async (quotationId: string) => {
    setCalculatingCosts(prev => new Set(Array.from(prev).concat(quotationId)));
    try {
      toast({
        title: "Sucesso",
        description: "Redirecionando para edição da proposta...",
      });
      // Redirect to edit the original quotation directly
      navigate(`/orcamentos/novo?edit=${quotationId}&admin=true`);
    } finally {
      setCalculatingCosts(prev => new Set(Array.from(prev).filter(id => id !== quotationId)));
    }
  };

  // Filter functions for both types of quotations
  const getFilteredQuotations = (quotationsList: Quotation[]) => {
    return quotationsList.filter(quotation => {
      const employeeId = quotation.responsibleId || quotation.userId;
      
      // Basic filters
      const matchesSearch = 
        quotation.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getEmployeeName(quotation).toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesEmployee = selectedEmployee === "all" || employeeId === selectedEmployee;
      const matchesStatus = selectedStatus === "all" || quotation.status === selectedStatus;
      
      return matchesSearch && matchesEmployee && matchesStatus && employeeId !== currentUser?.id;
    });
  };

  const filteredOriginalQuotations = getFilteredQuotations(originalQuotations);
  const filteredValidatedQuotations = getFilteredQuotations(validatedQuotations);

  // Create a combined list for employee summary cards
  const allQuotations = [...originalQuotations, ...validatedQuotations];
  const filteredQuotationsForSummary = allQuotations.filter(quotation => {
    const employeeId = quotation.responsibleId || quotation.userId;
    return employeeId !== currentUser?.id;
  });

  // Helper functions
  const getEmployeeName = (quotation: Quotation) => {
    const employeeId = quotation.responsibleId || quotation.userId;
    const employee = users.find(u => u.id === employeeId);
    return employee ? employee.name : 'N/A';
  };

  const getEmployeeCommissionPercent = (employeeId: string) => {
    const employee = users.find(u => u.id === employeeId);
    return employee ? parseFloat(employee.commissionPercent) : 0;
  };

  const calculateCommission = (total: string, employeeId: string) => {
    const commissionPercent = getEmployeeCommissionPercent(employeeId);
    return parseFloat(total) * (commissionPercent / 100);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'pending': { label: 'Pendente', variant: 'secondary' as const },
      'approved': { label: 'Aprovado', variant: 'default' as const },
      'rejected': { label: 'Rejeitado', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Component para renderizar lista de propostas
  const QuotationsList = ({ quotations, title, canEdit = false }: { quotations: Quotation[], title: string, canEdit?: boolean }) => (
    <Card>
      <CardHeader className="flex flex-col space-y-1.5 p-6 mt-[25px] mb-[25px]">
        <CardTitle className="text-2xl font-semibold leading-none tracking-tight ml-[0px] mr-[0px] mt-[0px] mb-[0px]">{title}</CardTitle>
        <CardDescription>
          {quotations.length} proposta(s) encontrada(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {quotations.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Nenhuma proposta encontrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((quotation) => (
                <TableRow key={quotation.id}>
                  <TableCell>{quotation.customer.name}</TableCell>
                  <TableCell>{getEmployeeName(quotation)}</TableCell>
                  <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                  <TableCell>{formatCurrency(parseFloat(quotation.total))}</TableCell>
                  <TableCell>{formatDate(quotation.createdAt!)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedQuotation(quotation)}
                        data-testid={`button-view-${quotation.id}`}
                      >
                        <Eye className="h-4 w-4" />
                        Ver
                      </Button>
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCalculateCosts(quotation.id)}
                          disabled={calculatingCosts.has(quotation.id)}
                          data-testid={`button-calculate-${quotation.id}`}
                        >
                          {calculatingCosts.has(quotation.id) ? (
                            "Carregando..."
                          ) : (
                            <>
                              <Calculator className="h-4 w-4 mr-1" />
                              Calcular Custos
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-master-green" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Funcionários</h1>
          <p className="text-gray-600">Visualize e gerencie as propostas de todos os funcionários</p>
        </div>
      </div>
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por funcionário ou cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>
            
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-full md:w-[200px]" data-testid="select-employee">
                <SelectValue placeholder="Todos os funcionários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os funcionários</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full md:w-[200px]" data-testid="select-status">
                <SelectValue placeholder="Todas as situações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {/* Employee Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((employee) => {
          const employeeQuotations = filteredQuotationsForSummary.filter(q => 
            (q.responsibleId === employee.id || q.userId === employee.id)
          );
          
          // NOVA REGRA: Apenas propostas APROVADAS contam para valor total e comissão
          const approvedQuotations = employeeQuotations.filter(q => q.status === 'approved');
          const totalValue = approvedQuotations.reduce((sum, q) => sum + parseFloat(q.total), 0);
          const totalCommission = approvedQuotations.reduce((sum, q) => 
            sum + calculateCommission(q.total, employee.id), 0
          );
          
          return (
            <Card key={employee.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{employee.name}</h3>
                  <Badge variant="outline">{employee.commissionPercent}%</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-1">{employee.branch}</p>
                <p className="text-sm text-gray-600 mb-3">{employee.email}</p>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Propostas:</span>
                    <span className="font-medium">{employeeQuotations.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Valor Total:</span>
                    <span className="font-medium">{formatCurrency(totalValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Comissão Total:</span>
                    <span className="font-medium text-green-600">{formatCurrency(totalCommission)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {/* Propostas com abas */}
      <Tabs defaultValue="original" className="w-full mt-[10px] mb-[10px]">
        
        <TabsList className="h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground grid w-full grid-cols-2 mt-[60px] mb-[60px] pt-[0px] pb-[0px]">
          <TabsTrigger value="original" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Propostas dos Funcionários
          </TabsTrigger>
          
          <TabsTrigger value="validated" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Propostas Validadas
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="original">
          <QuotationsList 
            quotations={filteredOriginalQuotations} 
            title="Propostas Originais dos Funcionários"
            canEdit={true}
          />
        </TabsContent>
        
        <TabsContent value="validated">
          <QuotationsList 
            quotations={filteredValidatedQuotations} 
            title="Propostas Validadas pelo Admin"
            canEdit={false}
          />
        </TabsContent>
      </Tabs>
      {/* Quotation Details Modal */}
      {selectedQuotation && (
        <Dialog open={!!selectedQuotation} onOpenChange={() => setSelectedQuotation(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Proposta</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p><strong>Cliente:</strong> {selectedQuotation.customer.name}</p>
                  <p><strong>Funcionário:</strong> {getEmployeeName(selectedQuotation)}</p>
                  <p><strong>Status:</strong> {getStatusBadge(selectedQuotation.status)}</p>
                  <p><strong>Data:</strong> {formatDate(selectedQuotation.createdAt!)}</p>
                </div>
                <div>
                  <p><strong>Total:</strong> {formatCurrency(parseFloat(selectedQuotation.total))}</p>
                  <p><strong>Desconto:</strong> {selectedQuotation.discountPercent}%</p>
                  <p><strong>Comissão:</strong> {getEmployeeCommissionPercent(selectedQuotation.responsibleId || selectedQuotation.userId || "")}%</p>
                  <p><strong>Valor Comissão:</strong> {formatCurrency(calculateCommission(selectedQuotation.total, selectedQuotation.responsibleId || selectedQuotation.userId || ""))}</p>
                </div>
              </div>

              {/* Products */}
              <Card>
                <CardHeader>
                  <CardTitle>Produtos</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Preço Unit.</TableHead>
                        <TableHead>Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQuotation.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.product.name}</TableCell>
                          <TableCell>{parseFloat(item.quantity).toFixed(2)}</TableCell>
                          <TableCell>{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                          <TableCell>{formatCurrency(parseFloat(item.subtotal))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Costs if available */}
              {selectedQuotation.costs && selectedQuotation.costs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Custos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Valor Unit.</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedQuotation.costs.map((cost, index) => (
                          <TableRow key={index}>
                            <TableCell>{cost.name}</TableCell>
                            <TableCell>{cost.supplier || '-'}</TableCell>
                            <TableCell>{parseFloat(cost.quantity || '0').toFixed(2)}</TableCell>
                            <TableCell>{formatCurrency(parseFloat(cost.unitValue))}</TableCell>
                            <TableCell>{formatCurrency(parseFloat(cost.totalValue))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Financial Analysis - Only for admin-calculated quotations */}
              {(selectedQuotation as any).adminCalculated === 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Resumo Financeiro</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700">Receitas</h4>
                        {/* Show gross value if there's a discount */}
                        {parseFloat((selectedQuotation as any).subtotal || "0") > parseFloat(selectedQuotation.total) && (
                          <div className="flex justify-between">
                            <span>Valor Bruto:</span>
                            <span className="font-semibold">{formatCurrency(parseFloat((selectedQuotation as any).subtotal || "0"))}</span>
                          </div>
                        )}
                        {/* Show discount if applicable */}
                        {parseFloat((selectedQuotation as any).subtotal || "0") > parseFloat(selectedQuotation.total) && (
                          <div className="flex justify-between">
                            <span>Desconto ({(((parseFloat((selectedQuotation as any).subtotal) - parseFloat(selectedQuotation.total)) / parseFloat((selectedQuotation as any).subtotal)) * 100).toFixed(1)}%):</span>
                            <span className="font-semibold text-red-600">
                              -{formatCurrency(parseFloat((selectedQuotation as any).subtotal) - parseFloat(selectedQuotation.total))}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Total Final ao Cliente:</span>
                          <span className="font-semibold text-green-600">{formatCurrency(parseFloat(selectedQuotation.total))}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700">Custos e Impostos</h4>
                        <div className="flex justify-between">
                          <span>Total dos Custos:</span>
                          <span className="font-semibold text-red-600">
                            {formatCurrency(parseFloat((selectedQuotation as any).totalCosts || "0") || (selectedQuotation.costs?.reduce((sum: number, cost: any) => sum + parseFloat(cost.totalValue), 0) || 0))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Valor da Nota Fiscal (5%):</span>
                          <span className="font-semibold text-red-600">
                            {formatCurrency(parseFloat((selectedQuotation as any).invoiceAmount || "0") || (parseFloat(selectedQuotation.total) * 0.05))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total com Nota Fiscal:</span>
                          <span className="font-semibold text-red-600">
                            {formatCurrency(parseFloat((selectedQuotation as any).totalWithInvoice || "0") || 
                              ((parseFloat((selectedQuotation as any).totalCosts || "0") || (selectedQuotation.costs?.reduce((sum: number, cost: any) => sum + parseFloat(cost.totalValue), 0) || 0)) + 
                              (parseFloat((selectedQuotation as any).invoiceAmount || "0") || (parseFloat(selectedQuotation.total) * 0.05))))}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-700">Lucro da Empresa</h4>
                          {(() => {
                            // Calculate values when needed
                            const totalCosts = parseFloat((selectedQuotation as any).totalCosts || "0") || (selectedQuotation.costs?.reduce((sum: number, cost: any) => sum + parseFloat(cost.totalValue), 0) || 0);
                            const invoiceAmount = parseFloat((selectedQuotation as any).invoiceAmount || "0") || (parseFloat(selectedQuotation.total) * 0.05);
                            const totalWithInvoice = parseFloat((selectedQuotation as any).totalWithInvoice || "0") || (totalCosts + invoiceAmount);
                            const companyProfit = parseFloat((selectedQuotation as any).companyProfit || "0") || (parseFloat(selectedQuotation.total) - totalWithInvoice);
                            const profitPercent = parseFloat((selectedQuotation as any).profitPercent || "0") || (parseFloat(selectedQuotation.total) > 0 ? (companyProfit / parseFloat(selectedQuotation.total)) * 100 : 0);
                            const tithe = parseFloat((selectedQuotation as any).tithe || "0") || (companyProfit * 0.10);
                            const employeeCommission = parseFloat(selectedQuotation.total) * (parseFloat(getEmployeeCommissionPercent(selectedQuotation.responsibleId || selectedQuotation.userId || "") || "0") / 100);

                            return (
                              <>
                                <div className="flex justify-between">
                                  <span>Lucro da Empresa:</span>
                                  <span className="font-semibold text-blue-600">
                                    {formatCurrency(companyProfit)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Porcentagem de Lucro:</span>
                                  <span className="font-semibold">
                                    {profitPercent.toFixed(2)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Dízimo (10%):</span>
                                  <span className="font-semibold text-red-600">
                                    {formatCurrency(tithe)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Comissão Vendedor:</span>
                                  <span className="font-semibold text-orange-600">
                                    {formatCurrency(employeeCommission)}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-700">Resultado Final</h4>
                          {(() => {
                            // Calculate values when needed
                            const totalCosts = parseFloat((selectedQuotation as any).totalCosts || "0") || (selectedQuotation.costs?.reduce((sum: number, cost: any) => sum + parseFloat(cost.totalValue), 0) || 0);
                            const invoiceAmount = parseFloat((selectedQuotation as any).invoiceAmount || "0") || (parseFloat(selectedQuotation.total) * 0.05);
                            const totalWithInvoice = parseFloat((selectedQuotation as any).totalWithInvoice || "0") || (totalCosts + invoiceAmount);
                            const companyProfit = parseFloat((selectedQuotation as any).companyProfit || "0") || (parseFloat(selectedQuotation.total) - totalWithInvoice);
                            const tithe = parseFloat((selectedQuotation as any).tithe || "0") || (companyProfit * 0.10);
                            const employeeCommission = parseFloat(selectedQuotation.total) * (parseFloat(getEmployeeCommissionPercent(selectedQuotation.responsibleId || selectedQuotation.userId || "") || "0") / 100);
                            const netProfit = parseFloat((selectedQuotation as any).netProfit || "0") || (companyProfit - tithe - employeeCommission);

                            return (
                              <>
                                <div className="flex justify-between text-lg">
                                  <span>Lucro Líquido:</span>
                                  <span className="font-bold text-green-600">
                                    {formatCurrency(netProfit)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Margem Líquida:</span>
                                  <span className="font-semibold">
                                    {parseFloat(selectedQuotation.total) > 0 ? ((netProfit / parseFloat(selectedQuotation.total)) * 100).toFixed(2) : "0.00"}%
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Additional Info */}
              {selectedQuotation.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{selectedQuotation.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}