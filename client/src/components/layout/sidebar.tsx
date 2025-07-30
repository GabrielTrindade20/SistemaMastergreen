import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  BarChart3, 
  MessageCircle, 
  User 
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Orçamentos", href: "/orcamentos", icon: FileText },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { name: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
];

export default function Sidebar() {
  const [location] = useLocation();

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
        <div className="flex items-center">
          <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-[#002b17]" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">Admin User</p>
            <p className="text-xs text-green-200">admin@mastergreen.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
