import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import logoMasterGreen from "@assets/mastergreen-logo.png";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Package,
  BarChart3, 
  MessageCircle, 
  User,
  Shield,
  LogOut,
  DollarSign,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Propostas", href: "/orcamentos", icon: FileText },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Produtos", href: "/produtos", icon: Package, adminOnly: true },
  { name: "Custos", href: "/custos", icon: DollarSign, adminOnly: true },
  { name: "Relatórios", href: "/relatorios", icon: BarChart3, adminOnly: true },
  { name: "Vendedores", href: "/funcionarios", icon: Users, adminOnly: true }];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    ...baseNavigation.filter(item => !item.adminOnly || user?.type === "admin"),
    ...(user?.type === "admin" ? [{ name: "Admin", href: "/admin", icon: Shield }] : [])
  ];

  const handleLogout = () => {
    logout.mutate();
  };

  if (!user) return null;

  return (
    <>
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-white border-gray-300"
          data-testid="button-mobile-menu"
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative top-0 left-0 z-50 md:z-auto 
        w-64 bg-[#002b17] text-white flex flex-col 
        h-full md:h-auto
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo/Brand */}
        <div className="p-6 border-b border-green-800">
          <div className="flex items-center mb-2">
            <img 
              src={logoMasterGreen} 
              alt="Logo MasterGreen" 
              className="w-8 h-8 object-contain mr-3"
            />
            <h1 className="text-2xl font-bold md:text-2xl sm:text-xl">MasterGreen</h1>
          </div>
          <p className="text-green-200 text-sm mt-1">Sistema de Gestão</p>
        </div>
        
        {/* Navigation Menu */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href || 
                (item.href === "/dashboard" && location === "/");
              
              return (
                <li key={item.name}>
                  <Link href={item.href}>
                    <div 
                      className={`sidebar-link ${isActive ? 'active' : ''}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      data-testid={`link-${item.name.toLowerCase()}`}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* User Profile */}
        <div className="p-4 border-t border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-[#ffffff] rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-[#002b17]" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium" data-testid="text-username">{user.name}</p>
                <p className="text-xs text-green-200" data-testid="text-user-branch">{user.branch}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-green-200 hover:text-white hover:bg-green-700"
              disabled={logout.isPending}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}