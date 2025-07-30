import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Download, Edit } from "lucide-react";
import type { QuotationWithDetails } from "@shared/schema";
import { generateQuotationPDF } from "@/lib/pdf-generator";

export default function Quotations() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: quotations = [], isLoading } = useQuery<QuotationWithDetails[]>({
    queryKey: ["/api/quotations"],
  });

  // Filter quotations
  const filteredQuotations = quotations.filter(quotation => {
    const matchesStatus = statusFilter === "all" || quotation.status === statusFilter;
    const matchesSearch = quotation.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quotation.customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleDownloadPDF = async (quotation: QuotationWithDetails) => {
    try {
      await generateQuotationPDF(quotation);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="status-badge status-approved">Aprovado</Badge>;
      case "rejected":
        return <Badge className="status-badge status-rejected">Rejeitado</Badge>;
      default:
        return <Badge className="status-badge status-pending">Pendente</Badge>;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orçamentos</h1>
            <p className="text-gray-600">Gerencie suas propostas comerciais</p>
          </div>
          <Link href="/orcamentos/novo">
            <Button className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Nova Proposta
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lista de Orçamentos</CardTitle>
              <div className="flex items-center space-x-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : filteredQuotations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">Nenhum orçamento encontrado</p>
                <Link href="/orcamentos/novo">
                  <Button className="btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Orçamento
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">#</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Cliente</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Produtos</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Valor Total</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Data</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredQuotations.map((quotation) => (
                      <tr key={quotation.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {quotation.quotationNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {quotation.customer.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {quotation.customer.email}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {quotation.items.map(item => 
                            `${item.product.name} (${item.quantity}m²)`
                          ).join(", ")}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          R$ {parseFloat(quotation.total).toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2 
                          })}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(quotation.status)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {new Date(quotation.createdAt!).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDownloadPDF(quotation)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
