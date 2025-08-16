import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, DollarSign, FileText, TrendingUp, Calendar, Users } from "lucide-react";
import type { QuotationWithDetails, Customer } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import jsPDF from "jspdf";

export default function Reports() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  
  const { data: quotations = [] } = useQuery<QuotationWithDetails[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Filter data based on user type and selected month
  const userQuotations = user?.type === "admin" 
    ? quotations 
    : quotations.filter(q => q.userId === user?.id);

  const filteredQuotations = userQuotations.filter(q => {
    const quotationDate = new Date(q.createdAt!).toISOString().slice(0, 7);
    return quotationDate === selectedMonth;
  });

  // Calculate financial metrics for selected month
  const approvedQuotations = filteredQuotations.filter(q => q.status === 'approved');
  const totalRevenue = approvedQuotations.reduce((sum, q) => sum + parseFloat(q.total), 0);

  // Calculate total costs and profits
  const totalCosts = approvedQuotations.reduce((sum, q) => sum + parseFloat(q.totalCosts || '0'), 0);
  const netProfit = approvedQuotations.reduce((sum, q) => sum + parseFloat(q.netProfit || '0'), 0);

  // Calculate commission for employees based on gross value
  const totalCommission = user?.type === "vendedor" 
    ? approvedQuotations.reduce((sum, q) => {
        const commissionPercent = parseFloat(user.commissionPercent || '0');
        const grossValue = parseFloat(q.total);
        return sum + (grossValue * commissionPercent / 100);
      }, 0)
    : 0;

  const quotationsCreated = filteredQuotations.length;
  const quotationsApproved = approvedQuotations.length;
  const conversionRate = quotationsCreated > 0 ? (quotationsApproved / quotationsCreated) * 100 : 0;

  // Generate available months from quotations
  const availableMonths = Array.from(
    new Set(
      userQuotations.map(q => new Date(q.createdAt!).toISOString().slice(0, 7))
    )
  ).sort().reverse();

  // Product analysis for selected month
  const productStats = approvedQuotations.reduce((acc, quotation) => {
    quotation.items.forEach(item => {
      const productName = item.product.name;
      if (!acc[productName]) {
        acc[productName] = { name: productName, quantity: 0, revenue: 0 };
      }
      acc[productName].quantity += parseFloat(item.quantity);
      acc[productName].revenue += parseFloat(item.subtotal);
    });
    return acc;
  }, {} as Record<string, { name: string; quantity: number; revenue: number }>);

  // Generate PDF report
  const generateReport = () => {
    const doc = new jsPDF();
    const monthYear = new Date(selectedMonth + '-01').toLocaleDateString('pt-BR', { 
      month: 'long', 
      year: 'numeric' 
    });
    
    doc.setFontSize(20);
    doc.text(`Relatório - ${monthYear}`, 20, 30);
    
    if (user?.type === "funcionario") {
      doc.setFontSize(14);
      doc.text(`Funcionário: ${user.name}`, 20, 50);
      doc.text(`Filial: ${user.branch}`, 20, 60);
      
      doc.setFontSize(12);
      doc.text(`Vendas Aprovadas: ${quotationsApproved}`, 20, 80);
      doc.text(`Receita Total: R$ ${totalRevenue.toFixed(2)}`, 20, 90);
      doc.text(`Comissão Total: R$ ${totalCommission.toFixed(2)} (${user.commissionPercent}% do valor bruto)`, 20, 100);
      doc.text(`Taxa de Conversão: ${conversionRate.toFixed(1)}%`, 20, 110);
    } else {
      doc.setFontSize(12);
      doc.text(`Vendas Aprovadas: ${quotationsApproved}`, 20, 50);
      doc.text(`Receita Total: R$ ${totalRevenue.toFixed(2)}`, 20, 60);
      doc.text(`Custos Totais: R$ ${totalCosts.toFixed(2)}`, 20, 70);
      doc.text(`Lucro Líquido: R$ ${netProfit.toFixed(2)}`, 20, 80);
      doc.text(`Taxa de Conversão: ${conversionRate.toFixed(1)}%`, 20, 90);
    }
    
    doc.save(`relatorio-${selectedMonth}-${user?.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  const productArray = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);

  if (availableMonths.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Nenhum orçamento encontrado para gerar relatórios.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-gray-600">
              {user?.type === "admin" ? "Análises e relatórios do negócio" : "Seus relatórios mensais"}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Selecionar mês" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(month => (
                  <SelectItem key={month} value={month}>
                    {new Date(month + '-01').toLocaleDateString('pt-BR', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={generateReport} className="btn-primary">
              <Download className="w-4 h-4 mr-2" />
              Gerar PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                {quotationsApproved} vendas aprovadas
              </p>
            </CardContent>
          </Card>

          {user?.type === "funcionario" ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suas Comissões</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {user.commissionPercent}% do valor bruto das vendas
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Após custos operacionais
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Propostas Criadas</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{quotationsCreated}</div>
              <p className="text-xs text-muted-foreground">
                Total no mês selecionado
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
        </div>

        {/* Product Performance */}
        {productArray.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Performance por Produto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {productArray.slice(0, 5).map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-500">{product.quantity.toFixed(1)}m²</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R$ {product.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p className="text-sm text-gray-500">
                        {((product.revenue / totalRevenue) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Quotations */}
        <Card>
          <CardHeader>
            <CardTitle>Propostas do Período</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredQuotations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Nenhuma proposta encontrada no período selecionado.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredQuotations.slice(0, 10).map((quotation) => (
                  <div key={quotation.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        quotation.status === 'approved' ? 'bg-green-500' :
                        quotation.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="font-medium">{quotation.customer.name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(quotation.createdAt!).toLocaleDateString('pt-BR')}
                        </p>
                        {user?.type === "admin" && quotation.user && (
                          <p className="text-sm text-blue-600">
                            Criado por: {quotation.user.name} • Código: #{quotation.quotationNumber}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        R$ {parseFloat(quotation.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-gray-500 capitalize">{quotation.status}</p>
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