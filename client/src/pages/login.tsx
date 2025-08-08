import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, User } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-32 h-16 bg-[#ffffff] rounded-full flex items-center justify-center mx-auto mb-4">
            <img
              src="/src/imagem/logoSemFundo.png"
              alt="Logo MasterGreen"
              className="w-32 h-32 object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-[#002b17]">MasterGreen</CardTitle>
          <CardDescription>
            Sistema de Gestão - Faça login para continuar
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={login.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={login.isPending}
              />
            </div>
            
            {login.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {login.error.message}
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full bg-[#002b17] hover:bg-[#004a2a]"
              disabled={login.isPending}
            >
              {login.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>
          {/* 
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Usuários para teste:</h4>
            <div className="text-xs space-y-1">
              <div><strong>Admin:</strong> admin@mastergreen.com / admin123</div>
              <div><strong>Funcionário:</strong> joao@filial1.com / func123</div>
              <div><strong>Funcionário:</strong> ana@filial2.com / func456</div>
            </div>
          </div> */}
        </CardContent>
      </Card>
    </div>
  );
}