import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, DollarSign, FileText, TrendingUp } from "lucide-react";
import type { QuotationWithDetails, Customer } from "@shared/schema";

export default function Reports() {
  const { data: quotations = [] } = useQuery<QuotationWithDetails[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Calculate financial metrics
  const totalRevenue = quotations
    .filter(q => q.status === 'approved')
    .reduce((sum, q) => sum + parseFloat(q.total), 0);

  const operationalCosts = totalRevenue * 0.41; // 41% estimated costs
  const netProfit = totalRevenue - operationalCosts;

  const quotationsCreated = quotations.length;
  const quotationsApproved = quotations.filter(q => q.status === 'approved').length;
  const conversionRate = quotationsCreated > 0 ? (quotationsApproved / quotationsCreated) * 100 : 0;

  // Product analysis
  const productStats = quotations
    .filter(q => q.status === 'approved')
    .reduce((acc, quotation) => {
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

  const productArray = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);
  const totalProductRevenue = productArray.reduce((sum, p) => sum + p.revenue, 0);

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-gray-600">Análises e relatórios do seu negócio</p>
          </div>
          <Button className="btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Exportar Dados
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Financial Report */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-master-green" />
                Relatório Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Receita Total</span>
                  <span className="text-lg font-semibold text-green-600">
                    R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Custos Operacionais</span>
                  <span className="text-lg font-semibold text-red-600">
                    R$ {operationalCosts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-4">
                  <span className="text-gray-900 font-semibold">Lucro Líquido</span>
                  <span className="text-xl font-bold text-master-green">
                    R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <Button className="w-full mt-4 btn-secondary">
                <FileText className="w-4 h-4 mr-2" />
                Gerar Relatório Completo
              </Button>
            </CardContent>
          </Card>

          {/* Sales Report */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                Relatório de Vendas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Orçamentos Criados</span>
                  <span className="text-lg font-semibold text-blue-600">
                    {quotationsCreated}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Orçamentos Aprovados</span>
                  <span className="text-lg font-semibold text-green-600">
                    {quotationsApproved}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-4">
                  <span className="text-gray-900 font-semibold">Taxa de Conversão</span>
                  <span className="text-xl font-bold text-master-green">
                    {conversionRate.toFixed(0)}%
                  </span>
                </div>
              </div>
              <Button className="w-full mt-4 btn-secondary">
                <Download className="w-4 h-4 mr-2" />
                Exportar para CSV
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analytics */}
        <Card>
          <CardHeader>
            <CardTitle>Análise Detalhada por Produto</CardTitle>
          </CardHeader>
          <CardContent>
            {productArray.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Nenhum dado de produto disponível. Crie alguns orçamentos aprovados primeiro.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Produto</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Vendas (m²)</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Receita</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">% do Total</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Performance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {productArray.map((product, index) => {
                      const percentage = totalProductRevenue > 0 ? (product.revenue / totalProductRevenue) * 100 : 0;
                      const colors = ['bg-master-green', 'bg-blue-500', 'bg-yellow-500'];
                      const color = colors[index] || 'bg-gray-500';
                      
                      return (
                        <tr key={product.name}>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">
                            {product.name}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {product.quantity.toFixed(1)} m²
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            R$ {product.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-sm text-green-600">
                            {percentage.toFixed(1)}%
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className={`${color} h-2 rounded-full`} 
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600">
                                {percentage.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
