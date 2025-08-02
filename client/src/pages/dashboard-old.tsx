import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, FileText, Users, TrendingUp, ArrowUp, Clock, UserPlus } from "lucide-react";
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
  
  const userCustomers = user?.type === "admin" 
    ? customers 
    : customers.filter(c => c.userId === user?.id);

  // Calculate metrics using filtered data
  const totalRevenue = userQuotations
    .filter(q => q.status === 'approved')
    .reduce((sum, q) => sum + parseFloat(q.total), 0);

  const pendingQuotations = userQuotations.filter(q => q.status === 'pending');
  const activeCustomers = userCustomers.length;
  const conversionRate = userQuotations.length > 0 
    ? (userQuotations.filter(q => q.status === 'approved').length / userQuotations.length) * 100 
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">
              {user?.type === "admin" ? "Visão geral do negócio" : "Seus dados pessoais"}
            </p>
          </div>
          <div className="text-sm text-gray-500">
            <Clock className="w-4 h-4 inline mr-2" />
            Atualizado agora
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {user?.type === "admin" ? (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Faturamento Mensal</p>
                      <p className="text-2xl font-bold text-gray-900">
                        R$ {totalRevenue.toFixed(2)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Orçamentos Pendentes</p>
                      <p className="text-2xl font-bold text-gray-900">{pendingQuotations.length}</p>
                    </div>
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Clientes Ativos</p>
                      <p className="text-2xl font-bold text-gray-900">{activeCustomers}</p>
                    </div>
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Taxa de Conversão</p>
                      <p className="text-2xl font-bold text-gray-900">{conversionRate.toFixed(1)}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Meus Orçamentos Fechados</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {userQuotations.filter(q => q.status === 'approved').length}
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Orçamentos Pendentes/Rejeitados</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {userQuotations.filter(q => q.status === 'pending' || q.status === 'rejected').length}
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Meus Clientes</p>
                      <p className="text-2xl font-bold text-gray-900">{userCustomers.length}</p>
                    </div>
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Minha Taxa de Conversão</p>
                      <p className="text-2xl font-bold text-gray-900">{conversionRate.toFixed(1)}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                  </div>
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
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Faturamento Mensal</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-green-600 text-sm mt-1 flex items-center">
                    <ArrowUp className="w-4 h-4 mr-1" />
                    +12% vs mês anterior
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-master-green" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Orçamentos Pendentes</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{pendingQuotations.length}</p>
                  <p className="text-yellow-600 text-sm mt-1 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    Aguardando resposta
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Clientes Ativos</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{activeCustomers}</p>
                  <p className="text-blue-600 text-sm mt-1 flex items-center">
                    <UserPlus className="w-4 h-4 mr-1" />
                    Base de clientes
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Taxa de Conversão</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {conversionRate.toFixed(0)}%
                  </p>
                  <p className="text-green-600 text-sm mt-1 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Performance excelente
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Atividades Recentes</CardTitle>
            <CardDescription>Últimas movimentações do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-start animate-pulse">
                    <div className="w-8 h-8 bg-gray-200 rounded-full mr-3"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivities.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhuma atividade recente</p>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                      activity.type === 'approved' ? 'bg-green-100' :
                      activity.type === 'pending' ? 'bg-yellow-100' : 'bg-gray-100'
                    }`}>
                      <FileText className={`w-4 h-4 ${
                        activity.type === 'approved' ? 'text-green-600' :
                        activity.type === 'pending' ? 'text-yellow-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900">
                        {activity.type === 'approved' ? 'Orçamento aprovado' : 
                         activity.type === 'pending' ? 'Novo orçamento criado' : 'Orçamento atualizado'} - {activity.customer}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {activity.description} - R$ {activity.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        {activity.createdAt.toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
