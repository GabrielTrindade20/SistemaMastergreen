import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import Quotations from "@/pages/quotations";
import NewQuotation from "@/pages/new-quotation";
import Customers from "@/pages/customers";
import Products from "@/pages/products";
import Reports from "@/pages/reports";
import WhatsApp from "@/pages/whatsapp";
import Admin from "@/pages/admin";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading, error } = useAuth();
  
  console.log("Auth state:", { user, isLoading, error });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#002b17]"></div>
      </div>
    );
  }

  // Se há erro de autenticação ou não há usuário, mostrar login
  if (error || !user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/orcamentos" component={Quotations} />
          <Route path="/orcamentos/novo" component={NewQuotation} />
          <Route path="/clientes" component={Customers} />
          <Route path="/produtos" component={Products} />
          <Route path="/relatorios" component={Reports} />
          <Route path="/whatsapp" component={WhatsApp} />
          {user.type === "admin" && <Route path="/admin" component={Admin} />}
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
