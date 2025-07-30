import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Bot, 
  Megaphone, 
  ArrowRight, 
  Save,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function WhatsApp() {
  const [welcomeMessage, setWelcomeMessage] = useState(`Olá! 👋 Bem-vindo à MasterGreen!

Somos especialistas em:
🌿 Grama Sintética
🏠 Capachos de Vinil  
♿ Piso Tátil

Como posso ajudar você hoje?`);

  const [contactNumber, setContactNumber] = useState("(61) 9 9999-9999");
  const [autoResponses, setAutoResponses] = useState([
    {
      keyword: "orçamento",
      response: "Vou te ajudar com o orçamento! Que tipo de produto você precisa?"
    },
    {
      keyword: "preço",
      response: "Os preços variam conforme o produto. Posso fazer um orçamento personalizado para você!"
    }
  ]);

  const { toast } = useToast();

  const handleSaveSettings = () => {
    // TODO: Implement settings save
    toast({
      title: "Configurações salvas",
      description: "As configurações do WhatsApp foram atualizadas com sucesso!",
    });
  };

  const handleAutoResponseChange = (index: number, field: 'keyword' | 'response', value: string) => {
    const updatedResponses = [...autoResponses];
    updatedResponses[index][field] = value;
    setAutoResponses(updatedResponses);
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Integration</h1>
            <p className="text-gray-600">Automação e atendimento via WhatsApp</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className="status-badge status-approved">
              <CheckCircle className="w-3 h-3 mr-1" />
              Conectado
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full justify-between bg-green-50 hover:bg-green-100 text-green-700 border border-green-200">
                  <div className="flex items-center">
                    <MessageCircle className="w-5 h-5 mr-3" />
                    <span>Enviar Orçamento por WhatsApp</span>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button className="w-full justify-between bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200">
                  <div className="flex items-center">
                    <Bot className="w-5 h-5 mr-3" />
                    <span>Configurar Chatbot</span>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button className="w-full justify-between bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200">
                  <div className="flex items-center">
                    <Megaphone className="w-5 h-5 mr-3" />
                    <span>Campanhas de Marketing</span>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas WhatsApp</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Mensagens Enviadas (hoje)</span>
                  <span className="text-lg font-semibold text-gray-900">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Taxa de Resposta</span>
                  <span className="text-lg font-semibold text-green-600">--</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Orçamentos via WhatsApp</span>
                  <span className="text-lg font-semibold text-blue-600">0</span>
                </div>
                <div className="flex justify-between items-center border-t pt-4">
                  <span className="text-gray-900 font-semibold">Conversões</span>
                  <span className="text-xl font-bold text-master-green">0</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações de Automação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Welcome Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem de Boas-vindas
                </label>
                <Textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={6}
                  className="form-input"
                  placeholder="Digite a mensagem de boas-vindas..."
                />
              </div>

              {/* Auto-responses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Palavras-chave para Respostas Automáticas
                </label>
                <div className="space-y-3">
                  {autoResponses.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                      <Input
                        value={item.keyword}
                        onChange={(e) => handleAutoResponseChange(index, 'keyword', e.target.value)}
                        placeholder="Palavra-chave"
                        className="form-input"
                      />
                      <span className="text-sm text-gray-500 text-center">→</span>
                      <Input
                        value={item.response}
                        onChange={(e) => handleAutoResponseChange(index, 'response', e.target.value)}
                        placeholder="Resposta automática"
                        className="form-input"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contato de Atendimento Humano
                </label>
                <Input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="form-input"
                  placeholder="(00) 0 0000-0000"
                />
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button className="btn-primary" onClick={handleSaveSettings}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Configurações
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
