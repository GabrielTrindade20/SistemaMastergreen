import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import QuotationForm from "@/components/quotation-form";
import type { Customer, Product } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function NewQuotation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createQuotationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/quotations", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({
        title: "Sucesso",
        description: "Proposta criada com sucesso!",
      });
      setLocation("/orcamentos");
    },
    onError: (error) => {
      console.error("Error creating quotation:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar proposta. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: any) => {
    createQuotationMutation.mutate(data);
  };

  const handleCancel = () => {
    setLocation("/orcamentos");
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nova Proposta</h1>
            <p className="text-gray-600">Crie uma nova proposta comercial</p>
          </div>
          <Button variant="outline" onClick={handleCancel}>
            Voltar
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Informações da Proposta</CardTitle>
          </CardHeader>
          <CardContent>
            <QuotationForm
              customers={customers}
              products={products}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={createQuotationMutation.isPending}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
