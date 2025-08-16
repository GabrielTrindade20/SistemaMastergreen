import { useForm } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCustomerSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save } from "lucide-react";
import type { Customer } from "@shared/schema";
import { z } from "zod";
import { usePhoneMask, useCPFCNPJMask, useCEPMask } from "@/hooks/useFormat";

const formSchema = insertCustomerSchema.extend({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  city: z.string().min(2, "Cidade é obrigatória"),
  email: z.string().optional(),
  cpfCnpj: z.string().optional(),
  address: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  zipCode: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof formSchema>;

interface CustomerFormProps {
  initialData?: Customer | null;
  onSubmit: (data: CustomerFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export default function CustomerForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading 
}: CustomerFormProps) {
  const phoneMask = usePhoneMask();
  const cpfCnpjMask = useCPFCNPJMask();
  const cepMask = useCEPMask();

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      cpfCnpj: initialData?.cpfCnpj || "",
      address: initialData?.address || "",
      number: initialData?.number || "",
      neighborhood: initialData?.neighborhood || "",
      city: initialData?.city || "",
      zipCode: initialData?.zipCode || "",
      notes: initialData?.notes || "",
    },
  });

  // Inicializar máscaras com dados existentes
  useState(() => {
    if (initialData?.phone) phoneMask.setValue(initialData.phone);
    if (initialData?.cpfCnpj) cpfCnpjMask.setValue(initialData.cpfCnpj);
    if (initialData?.zipCode) cepMask.setValue(initialData.zipCode);
  });

  const handleSubmitWithFormat = (data: CustomerFormData) => {
    // Remover formatação antes de enviar
    const cleanedData = {
      ...data,
      phone: data.phone?.replace(/\D/g, '') || '',
      cpfCnpj: data.cpfCnpj?.replace(/\D/g, '') || '',
      zipCode: data.zipCode?.replace(/\D/g, '') || '',
    };
    onSubmit(cleanedData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitWithFormat)} className="space-y-6">
        {/* Personal Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações Pessoais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="cpfCnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF/CNPJ *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="000.000.000-00" 
                      {...field}
                      value={cpfCnpjMask.value || field.value}
                      onChange={(e) => {
                        const formatted = cpfCnpjMask.handleChange(e.target.value);
                        field.onChange(formatted);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone *</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel" 
                      placeholder="(00) 0 0000-0000" 
                      {...field}
                      value={phoneMask.value || field.value}
                      onChange={(e) => {
                        const formatted = phoneMask.handleChange(e.target.value);
                        field.onChange(formatted);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="cliente@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="00000-000" 
                      {...field}
                      value={cepMask.value || field.value}
                      onChange={(e) => {
                        const formatted = cepMask.handleChange(e.target.value);
                        field.onChange(formatted);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite a cidade" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logradouro</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua, avenida, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl>
                    <Input placeholder="123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="neighborhood"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bairro</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o bairro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Additional Information */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Informações adicionais sobre o cliente..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading} className="btn-primary">
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? "Salvando..." : "Salvar Cliente"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
