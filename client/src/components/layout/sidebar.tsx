import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Package,
  BarChart3, 
  MessageCircle, 
  User,
  Shield,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Orçamentos", href: "/orcamentos", icon: FileText },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Produtos", href: "/produtos", icon: Package, adminOnly: true },
  { name: "Relatórios", href: "/relatorios", icon: BarChart3, adminOnly: true },
  { name: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navigation = [
    ...baseNavigation.filter(item => !item.adminOnly || user?.type === "admin"),
    ...(user?.type === "admin" ? [{ name: "Admin", href: "/admin", icon: Shield }] : [])
  ];

  const handleLogout = () => {
    logout.mutate();
  };

  if (!user) return null;

  return (
    <div className="w-64 bg-[#002b17] text-white flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-green-800">
        <h1 className="text-2xl font-bold">MasterGreen</h1>
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
                  <div className={`sidebar-link ${isActive ? 'active' : ''}`}>
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
            <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
              {user.type === "admin" ? (
                <Shield className="w-5 h-5 text-[#002b17]" />
              ) : (
                <User className="w-5 h-5 text-[#002b17]" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-green-200">{user.branch}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-green-200 hover:text-white hover:bg-green-700"
            disabled={logout.isPending}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
