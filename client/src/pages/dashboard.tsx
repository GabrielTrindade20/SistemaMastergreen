import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileText, Users, TrendingUp, Clock, ChevronLeft, ChevronRight, Download, Calendar } from "lucide-react";
import type { User } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/dashboard", selectedDate],
    enabled: !!user,
  });

  const { data: recentActivities = [] } = useQuery({
    queryKey: ["/api/recent-activities", selectedDate],
    enabled: !!user,
  });

  // Navigation functions for month selection
  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1);
    
    if (direction === 'prev') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    const newYear = currentDate.getFullYear();
    const newMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    setSelectedDate(`${newYear}-${newMonth}`);
  };

  const getMonthName = (dateStr: string) => {
    const [year, month] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });
  };

  const generateExtract = async () => {
    try {
      const extractData = await apiRequest(`/api/extract/pdf?date=${selectedDate}`, {
        method: 'GET'
      });

      // Generate PDF using jsPDF
      const pdf = new jsPDF();
      
      // Header
      pdf.setFontSize(20);
      pdf.text('MG MASTERGREEN', 20, 20);
      pdf.setFontSize(16);
      pdf.text(`Extrato Mensal - ${extractData.monthName}`, 20, 35);
      
      let yPos = 55;

      if (extractData.type === 'admin') {
        // Admin extract
        pdf.setFontSize(14);
        pdf.text('RESUMO GERAL', 20, yPos);
        yPos += 15;

        pdf.setFontSize(12);
        pdf.text(`Receita Total: R$ ${extractData.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, yPos);
        yPos += 10;
        pdf.text(`Comissões Pagas: R$ ${extractData.totalCommissionsPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, yPos);
        yPos += 10;
        pdf.text(`Lucro Líquido: R$ ${extractData.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, yPos);
        yPos += 10;
        pdf.text(`Propostas Aprovadas: ${extractData.approvedQuotationsCount}`, 20, yPos);
        yPos += 20;

        // NOVA FUNCIONALIDADE: Incluir performance do admin no PDF
        if (extractData.adminPerformance && extractData.adminPerformance.quotationsCount > 0) {
          pdf.setFontSize(14);
          pdf.text('MINHA PERFORMANCE (ADMIN)', 20, yPos);
          yPos += 15;
          
          pdf.setFontSize(12);
          pdf.text(`Vendas: R$ ${extractData.adminPerformance.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${extractData.adminPerformance.quotationsCount} propostas)`, 20, yPos);
          yPos += 10;
          pdf.text(`Comissão: R$ ${extractData.adminPerformance.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${extractData.adminPerformance.commissionPercent}%)`, 20, yPos);
          yPos += 10;
          pdf.text(`Taxa de Conversão: ${extractData.adminPerformance.conversionRate.toFixed(1)}%`, 20, yPos);
          yPos += 20;
        }

        pdf.setFontSize(14);
        pdf.text('COMISSÕES POR VENDEDOR', 20, yPos);
        yPos += 15;

        extractData.commissionsByEmployee.forEach((emp: any) => {
          pdf.setFontSize(12);
          pdf.text(`${emp.employeeName} (${emp.employeeBranch})`, 20, yPos);
          yPos += 10;
          pdf.text(`  Vendas: R$ ${emp.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${emp.quotationsCount} propostas)`, 25, yPos);
          yPos += 10;
          pdf.text(`  Comissão: R$ ${emp.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${emp.commissionPercent}%)`, 25, yPos);
          yPos += 15;
        });
      } else {
        // Employee extract
        pdf.setFontSize(14);
        pdf.text(`VENDEDOR: ${extractData.employeeName}`, 20, yPos);
        yPos += 10;
        pdf.text(`FILIAL: ${extractData.employeeBranch}`, 20, yPos);
        yPos += 20;

        pdf.setFontSize(12);
        pdf.text(`Total de Comissões: R$ ${extractData.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, yPos);
        yPos += 10;
        pdf.text(`Percentual de Comissão: ${extractData.commissionPercent}%`, 20, yPos);
        yPos += 10;
        pdf.text(`Propostas Aprovadas: ${extractData.approvedQuotationsCount}`, 20, yPos);
        yPos += 20;

        pdf.setFontSize(14);
        pdf.text('DETALHAMENTO DAS COMISSÕES', 20, yPos);
        yPos += 15;

        extractData.commissionBreakdown.forEach((item: any) => {
          pdf.setFontSize(10);
          pdf.text(`${item.quotationNumber} - ${item.customerName}`, 20, yPos);
          yPos += 8;
          pdf.text(`  Valor: R$ ${item.quotationTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Comissão: R$ ${item.commissionAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, yPos);
          yPos += 8;
          pdf.text(`  Data: ${item.approvedDate}`, 25, yPos);
          yPos += 12;
        });
      }

      pdf.save(`extrato-${extractData.monthName.toLowerCase().replace(/\s+/g, '-')}.pdf`);

      toast({
        title: "Extrato gerado",
        description: "O arquivo PDF foi baixado com sucesso.",
      });
    } catch (error) {
      console.error("Error generating extract:", error);
      toast({
        title: "Erro",
        description: "Falha ao gerar extrato.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const data = dashboardData || {} as any;

  return (
    <div>
      {/* Header with Month Filter */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div className="flex flex-col space-y-4 mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 text-sm md:text-base">
              {user?.type === "admin" ? "Visão geral do sistema" : "Seus dados pessoais"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button onClick={generateExtract} variant="outline" size="sm" className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Gerar Extrato PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
            <div className="text-xs md:text-sm text-gray-500 text-center sm:text-left">
              <Clock className="w-4 h-4 inline mr-2" />
              Atualizado agora
            </div>
          </div>
        </div>
        
        {/* Month Navigation */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 bg-white border rounded-md px-3 py-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="p-1 h-auto"
              data-testid="button-prev-month-dashboard"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex-1 text-center font-medium min-w-[200px]">
              {getMonthName(selectedDate).charAt(0).toUpperCase() + getMonthName(selectedDate).slice(1)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="p-1 h-auto"
              data-testid="button-next-month-dashboard"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-4 md:p-6">
        {user?.type === "admin" ? (
          // Admin Dashboard
          <>
            {/* Admin Performance Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Minha Performance (Admin)</CardTitle>
                <CardDescription>
                  Performance geral do sistema administrado por mim
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      R$ {data.totalRevenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </div>
                    <p className="text-sm text-muted-foreground">Receita Total</p>
                    <p className="text-xs text-muted-foreground">
                      {data.approvedQuotations || 0} vendas aprovadas
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      R$ {data.totalNetProfit?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </div>
                    <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                    <p className="text-xs text-muted-foreground">Lucro das propostas processadas</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {data.conversionRate?.toFixed(1) || '0'}%
                    </div>
                    <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                    <p className="text-xs text-muted-foreground">
                      {data.approvedQuotations || 0} de {data.totalQuotations || 0} propostas
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employee Performance Summary Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Performance dos Vendedores</CardTitle>
                <CardDescription>
                  Resumo das vendas e comissões dos vendedores neste mês
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      R$ {(data.commissionsByEmployee?.reduce((sum: number, emp: any) => sum + emp.totalSales, 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-sm text-muted-foreground">Receita Total dos Vendedores</p>
                    <p className="text-xs text-muted-foreground">
                      {data.commissionsByEmployee?.reduce((sum: number, emp: any) => sum + emp.quotationsCount, 0) || 0} vendas dos funcionários
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      R$ {data.totalCommissionsPaid?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </div>
                    <p className="text-sm text-muted-foreground">Comissões Pagas</p>
                    <p className="text-xs text-muted-foreground">Total de comissões dos vendedores</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Admin Personal Performance (if admin made sales) */}
            {data.adminPerformance && data.adminPerformance.quotationsCount > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Minhas Vendas Pessoais</CardTitle>
                  <CardDescription>
                    Propostas que eu criei pessoalmente neste mês
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        R$ {data.adminPerformance.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <p className="text-sm text-muted-foreground">Minhas Vendas</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {data.adminPerformance.quotationsCount}
                      </div>
                      <p className="text-sm text-muted-foreground">Propostas Aprovadas</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {data.adminPerformance.conversionRate.toFixed(1)}%
                      </div>
                      <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        R$ {data.adminPerformance.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <p className="text-sm text-muted-foreground">Minha Comissão ({data.adminPerformance.commissionPercent}%)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Employee Performance Table */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Performance dos Vendedores</CardTitle>
                <CardDescription>
                  Comissões e vendas por vendedor neste mês
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Filial</TableHead>
                      <TableHead>Vendas</TableHead>
                      <TableHead>Propostas</TableHead>
                      <TableHead>Conversão</TableHead>
                      <TableHead>Comissão %</TableHead>
                      <TableHead>Total Comissão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.commissionsByEmployee?.map((emp: any) => (
                      <TableRow key={emp.employeeId}>
                        <TableCell className="font-medium">{emp.employeeName}</TableCell>
                        <TableCell>{emp.employeeBranch}</TableCell>
                        <TableCell>R$ {emp.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{emp.quotationsCount}</TableCell>
                        <TableCell>
                          <Badge variant={emp.conversionRate >= 50 ? "default" : "secondary"}>
                            {emp.conversionRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>{emp.commissionPercent}%</TableCell>
                        <TableCell className="font-semibold">
                          R$ {emp.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    )) || (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500">
                          Nenhum vendedor cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          // Employee Dashboard
          <>
            {/* Employee KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Minhas Comissões</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    R$ {data.totalCommission?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.commissionPercent || 0}% das vendas aprovadas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Minhas Vendas</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {data.totalSales?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.approvedQuotations || 0} vendas aprovadas (valor bruto)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Propostas Pendentes</CardTitle>
                  <Clock className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{data.pendingQuotations || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Aguardando aprovação
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.conversionRate?.toFixed(1) || '0'}%</div>
                  <p className="text-xs text-muted-foreground">
                    {data.approvedQuotations || 0} de {data.totalQuotations || 0} propostas
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Commission Breakdown Table */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Detalhamento das Comissões</CardTitle>
                <CardDescription>
                  Comissões por proposta aprovada neste mês
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proposta</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Comissão %</TableHead>
                      <TableHead>Valor Comissão</TableHead>
                      <TableHead>Data Aprovação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.commissionBreakdown?.map((item: any) => (
                      <TableRow key={item.quotationId}>
                        <TableCell className="font-medium">{item.quotationNumber}</TableCell>
                        <TableCell>{item.customerName}</TableCell>
                        <TableCell>R$ {item.quotationTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{item.commissionPercent}%</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          R$ {item.commissionAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {new Date(item.approvedDate).toLocaleDateString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    )) || (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500">
                          Nenhuma comissão no período selecionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>
              {user?.type === "admin" ? "Atividades Recentes do Sistema" : "Minhas Atividades Recentes"}
            </CardTitle>
            <CardDescription>
              {user?.type === "admin" 
                ? "Propostas geradas no sistema neste mês" 
                : "Suas propostas mais recentes"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.isArray(recentActivities) && recentActivities.length > 0 ? (
                recentActivities.slice(0, 5).map((activity: any, index: number) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.customerName}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {activity.description}
                        {user?.type === "admin" && activity.sellerName && ` - ${activity.sellerName}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <p className="text-sm font-medium text-gray-900">
                        R$ {parseFloat(activity.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">Nenhuma atividade recente encontrada.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}