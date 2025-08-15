import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, FileText, Users, TrendingUp, Clock } from "lucide-react";
import type { QuotationWithDetails, Customer } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();
  
  const { data: quotations = [], isLoading: quotationsLoading } = useQuery<QuotationWithDetails[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const isLoading = quotationsLoading || customersLoading;

  // Filter data based on user type
  const userQuotations = user?.type === "admin" 
    ? quotations 
    : quotations.filter(q => q.userId === user?.id);
  
  const userCustomers = customers; // Already filtered by backend

  // Calculate metrics using filtered data
  const totalRevenue = userQuotations
    .filter(q => q.status === 'approved')
    .reduce((sum, q) => sum + parseFloat(q.total), 0);

  const pendingQuotations = userQuotations.filter(q => q.status === 'pending');
  const activeCustomers = userCustomers.length;
  const conversionRate = userQuotations.length > 0 
    ? (userQuotations.filter(q => q.status === 'approved').length / userQuotations.length) * 100 
    : 0;

  // Calculate commission for employees based on gross value
  const totalCommission = user?.type === "funcionario" 
    ? userQuotations
        .filter(q => q.status === 'approved')
        .reduce((sum, q) => {
          const commissionPercent = parseFloat(user.commissionPercent || '0');
          const grossValue = parseFloat(q.total);
          return sum + (grossValue * commissionPercent / 100);
        }, 0)
    : 0;

  // Recent activities using filtered data
  const recentActivities = userQuotations
    .slice(0, 3)
    .map(q => ({
      id: q.id,
      type: q.status,
      customer: q.customer.name,
      amount: parseFloat(q.total),
      createdAt: new Date(q.createdAt!),
      description: `${q.items[0]?.product.name} ${q.items[0]?.quantity}m²` || 'Orçamento'
    }));

  return (
    <div>
      {/* Header - Mobile responsive */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
          <div className="mb-2 md:mb-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 text-sm md:text-base">
              {user?.type === "admin" ? "Visão geral do negócio" : "Seus dados pessoais"}
            </p>
          </div>
          <div className="text-xs md:text-sm text-gray-500">
            <Clock className="w-4 h-4 inline mr-2" />
            Atualizado agora
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-4 md:p-6">
        {/* Key Metrics Cards - Mobile responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          {user?.type === "admin" ? (
            <>
              {/* Admin Cards */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {userQuotations.filter(q => q.status === 'approved').length} vendas aprovadas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Propostas Pendentes</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingQuotations.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Aguardando aprovação
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeCustomers}</div>
                  <p className="text-xs text-muted-foreground">
                    Total de clientes
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    Propostas aprovadas
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {/* Employee Cards */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Minhas Comissões</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {user?.commissionPercent}% do valor bruto das vendas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Vendas Aprovadas</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {userQuotations.filter(q => q.status === 'approved').length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total de propostas fechadas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Propostas Pendentes</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingQuotations.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Aguardando aprovação
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Meus Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeCustomers}</div>
                  <p className="text-xs text-muted-foreground">
                    Total de clientes
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Recent Activities Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Atividades Recentes</CardTitle>
              <CardDescription>Últimas movimentações no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="flex space-x-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivities.length > 0 ? (
                recentActivities.map(activity => (
                  <div key={activity.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Orçamento para {activity.customer}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.description} • R$ {activity.amount.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {activity.createdAt.toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma atividade recente</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Indicadores de Performance</CardTitle>
              <CardDescription>Métricas {user?.type === "admin" ? "globais" : "pessoais"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Ticket Médio</span>
                  <span className="text-lg font-semibold">
                    R$ {userQuotations.filter(q => q.status === 'approved').length > 0 
                      ? (totalRevenue / userQuotations.filter(q => q.status === 'approved').length).toFixed(2)
                      : '0.00'
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Orçamentos Criados</span>
                  <span className="text-lg font-semibold">{userQuotations.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Orçamentos Aprovados</span>
                  <span className="text-lg font-semibold text-green-600">
                    {userQuotations.filter(q => q.status === 'approved').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Orçamentos Rejeitados</span>
                  <span className="text-lg font-semibold text-red-600">
                    {userQuotations.filter(q => q.status === 'rejected').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}