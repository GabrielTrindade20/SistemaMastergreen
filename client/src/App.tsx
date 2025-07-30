import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import Quotations from "@/pages/quotations";
import NewQuotation from "@/pages/new-quotation";
import Customers from "@/pages/customers";
import Reports from "@/pages/reports";
import WhatsApp from "@/pages/whatsapp";
import NotFound from "@/pages/not-found";

function Router() {
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
          <Route path="/relatorios" component={Reports} />
          <Route path="/whatsapp" component={WhatsApp} />
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
