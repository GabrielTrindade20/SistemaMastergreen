import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download, FileText, TrendingUp, Users, DollarSign, Target,
  Filter, BarChart2, Save, Trash2, ChevronDown, ChevronUp, LayoutDashboard
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useMemo } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, User, SavedReportTemplate } from "@shared/schema";
import jsPDF from "jspdf";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReportRow {
  quotationId: string;
  quotationNumber: string;
  quotationStatus: string;
  quotationTotal: number;
  quotationNetProfit: number;
  quotationCreatedAt: string;
  quotationBranch: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCity: string;
  customerState: string;
  customerStatus: string;
  customerLeadOrigin: string;
  customerCreatedAt: string;
  responsibleId: string;
  responsibleName: string;
  responsibleBranch: string;
}

interface Filters {
  period: string;
  dateFrom: string;
  dateTo: string;
  city: string;
  state: string;
  responsibleId: string;
  customerStatus: string;
  customerId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  fechado: "Fechado",
  pendente: "Pendente",
  em_negociacao: "Em Negociação",
  cancelado: "Cancelado",
  sem_retorno: "Sem Retorno",
  perdido: "Perdido",
};

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  approved: "Aprovado",
  pending: "Pendente",
  rejected: "Rejeitado",
};

const STATUS_COLORS: Record<string, string> = {
  fechado: "#16a34a",
  pendente: "#d97706",
  em_negociacao: "#2563eb",
  cancelado: "#6b7280",
  sem_retorno: "#9333ea",
  perdido: "#dc2626",
};

const PIE_COLORS = ["#16a34a", "#d97706", "#2563eb", "#dc2626", "#9333ea", "#6b7280"];

const ALL_COLUMNS = [
  { group: "Dados do Cliente", key: "customerName", label: "Nome do Cliente" },
  { group: "Dados do Cliente", key: "customerEmail", label: "Email" },
  { group: "Dados do Cliente", key: "customerPhone", label: "Telefone" },
  { group: "Dados do Cliente", key: "customerCity", label: "Cidade" },
  { group: "Dados do Cliente", key: "customerState", label: "Estado" },
  { group: "Dados do Cliente", key: "customerLeadOrigin", label: "Origem do Lead" },
  { group: "Dados Comerciais", key: "quotationNumber", label: "Nº Proposta" },
  { group: "Dados Comerciais", key: "quotationCreatedAt", label: "Data" },
  { group: "Dados Comerciais", key: "responsibleName", label: "Responsável" },
  { group: "Dados Comerciais", key: "quotationBranch", label: "Filial" },
  { group: "Status Comercial", key: "quotationStatus", label: "Status da Proposta" },
  { group: "Status Comercial", key: "customerStatus", label: "Status do Cliente" },
  { group: "Dados Financeiros", key: "quotationTotal", label: "Valor Total" },
  { group: "Dados Financeiros", key: "quotationNetProfit", label: "Lucro Líquido" },
];

const COLUMN_GROUPS = ["Dados do Cliente", "Dados Comerciais", "Status Comercial", "Dados Financeiros"];

const DEFAULT_COLUMNS = ["customerName", "customerCity", "quotationNumber", "quotationCreatedAt", "responsibleName", "quotationStatus", "customerStatus", "quotationTotal"];

const QUICK_REPORTS: { label: string; columns: string[]; filters: Partial<Filters> }[] = [
  {
    label: "Clientes Fechados",
    columns: ["customerName", "customerCity", "quotationNumber", "quotationCreatedAt", "responsibleName", "quotationTotal"],
    filters: { customerStatus: "fechado" },
  },
  {
    label: "Clientes Pendentes",
    columns: ["customerName", "customerCity", "customerPhone", "quotationNumber", "quotationCreatedAt", "responsibleName"],
    filters: { customerStatus: "pendente" },
  },
  {
    label: "Clientes Perdidos",
    columns: ["customerName", "customerCity", "customerLeadOrigin", "quotationCreatedAt", "responsibleName"],
    filters: { customerStatus: "perdido" },
  },
  {
    label: "Clientes por Cidade",
    columns: ["customerName", "customerCity", "customerState", "quotationStatus", "quotationTotal", "responsibleName"],
    filters: {},
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

function getDateRange(period: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (period) {
    case "today":
      return { dateFrom: fmt(now), dateTo: fmt(now) };
    case "7d": {
      const from = new Date(now); from.setDate(now.getDate() - 6);
      return { dateFrom: fmt(from), dateTo: fmt(now) };
    }
    case "30d": {
      const from = new Date(now); from.setDate(now.getDate() - 29);
      return { dateFrom: fmt(from), dateTo: fmt(now) };
    }
    case "this_month":
      return { dateFrom: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: fmt(from), dateTo: fmt(to) };
    }
    default:
      return { dateFrom: "", dateTo: "" };
  }
}

function renderCellValue(key: string, row: ReportRow) {
  switch (key) {
    case "quotationTotal": return formatCurrency(row.quotationTotal);
    case "quotationNetProfit": return formatCurrency(row.quotationNetProfit);
    case "quotationCreatedAt": return formatDate(row.quotationCreatedAt);
    case "customerCreatedAt": return formatDate(row.customerCreatedAt);
    case "quotationStatus": return QUOTATION_STATUS_LABELS[row.quotationStatus] || row.quotationStatus;
    case "customerStatus": return CUSTOMER_STATUS_LABELS[row.customerStatus] || row.customerStatus || "-";
    default: return (row as any)[key] || "-";
  }
}

// ─── Column Selector ──────────────────────────────────────────────────────────
function ColumnSelector({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {COLUMN_GROUPS.map(group => (
        <div key={group}>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{group}</p>
          <div className="grid grid-cols-2 gap-1">
            {ALL_COLUMNS.filter(c => c.group === group).map(col => (
              <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox checked={selected.has(col.key)} onCheckedChange={() => toggle(col.key)} />
                {col.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Filters Panel ────────────────────────────────────────────────────────────
function FiltersPanel({
  filters, onChange, customers, users, isAdmin,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  customers: Customer[];
  users: User[];
  isAdmin: boolean;
}) {
  const set = (k: keyof Filters, v: string) => {
    const next = { ...filters, [k]: v };
    if (k === "period" && v !== "custom") {
      const { dateFrom, dateTo } = getDateRange(v);
      next.dateFrom = dateFrom;
      next.dateTo = dateTo;
    }
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <Label className="text-xs">Período</Label>
        <Select value={filters.period} onValueChange={v => set("period", v)}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="this_month">Este mês</SelectItem>
            <SelectItem value="last_month">Mês anterior</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(filters.period === "custom" || filters.dateFrom) && (
        <>
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={filters.dateFrom} onChange={e => set("dateFrom", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={filters.dateTo} onChange={e => set("dateTo", e.target.value)} className="mt-1" />
          </div>
        </>
      )}
      <div>
        <Label className="text-xs">Cidade</Label>
        <Input placeholder="Filtrar por cidade" value={filters.city} onChange={e => set("city", e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label className="text-xs">Estado</Label>
        <Input placeholder="UF" value={filters.state} onChange={e => set("state", e.target.value)} className="mt-1" maxLength={2} />
      </div>
      <div>
        <Label className="text-xs">Status do Cliente</Label>
        <Select value={filters.customerStatus || "all"} onValueChange={v => set("customerStatus", v === "all" ? "" : v)}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(CUSTOMER_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isAdmin && (
        <div>
          <Label className="text-xs">Responsável</Label>
          <Select value={filters.responsibleId || "all"} onValueChange={v => set("responsibleId", v === "all" ? "" : v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Label className="text-xs">Cliente específico</Label>
        <Select value={filters.customerId || "all"} onValueChange={v => set("customerId", v === "all" ? "" : v)}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {customers.slice(0, 100).map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function KpiCards({ data }: { data: ReportRow[] }) {
  const totalCustomers = new Set(data.map(r => r.customerId)).size;
  const closed = data.filter(r => r.customerStatus === "fechado");
  const pending = data.filter(r => r.customerStatus === "pendente");
  const lost = data.filter(r => r.customerStatus === "perdido");
  const approved = data.filter(r => r.quotationStatus === "approved");
  const totalRevenue = approved.reduce((s, r) => s + r.quotationTotal, 0);
  const pendingRevenue = data.filter(r => r.quotationStatus === "pending").reduce((s, r) => s + r.quotationTotal, 0);
  const conversionRate = data.length > 0 ? (approved.length / data.length) * 100 : 0;
  const avgTicket = approved.length > 0 ? totalRevenue / approved.length : 0;

  const cards = [
    { label: "Total Clientes", value: totalCustomers, icon: Users, color: "text-blue-600" },
    { label: "Fechados", value: closed.length, icon: Target, color: "text-green-600" },
    { label: "Pendentes", value: pending.length, icon: FileText, color: "text-yellow-600" },
    { label: "Perdidos", value: lost.length, icon: TrendingUp, color: "text-red-600" },
    { label: "Taxa de Conversão", value: `${conversionRate.toFixed(1)}%`, icon: BarChart2, color: "text-purple-600" },
    { label: "Receita Total", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-green-600" },
    { label: "Receita Pendente", value: formatCurrency(pendingRevenue), icon: DollarSign, color: "text-yellow-600" },
    { label: "Ticket Médio", value: formatCurrency(avgTicket), icon: TrendingUp, color: "text-blue-600" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {cards.map(card => (
        <Card key={card.label}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">{card.label}</p>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-lg font-bold text-gray-900">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function Charts({ data }: { data: ReportRow[] }) {
  const funnelData = useMemo(() => {
    const total = new Set(data.map(r => r.customerId)).size;
    const withQuotation = new Set(data.map(r => r.quotationId)).size;
    const closed = data.filter(r => r.quotationStatus === "approved").length;
    return [
      { name: "Leads (clientes)", value: total },
      { name: "Com Proposta", value: withQuotation },
      { name: "Fechamentos", value: closed },
    ];
  }, [data]);

  const cityData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    data.filter(r => r.quotationStatus === "approved").forEach(r => {
      const city = r.customerCity || "Não informado";
      if (!map[city]) map[city] = { count: 0, value: 0 };
      map[city].count++;
      map[city].value += r.quotationTotal;
    });
    return Object.entries(map).map(([city, d]) => ({ city, ...d })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [data]);

  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    data.filter(r => r.quotationStatus === "approved").forEach(r => {
      if (r.quotationCreatedAt) {
        const d = new Date(r.quotationCreatedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        map[key] = (map[key] || 0) + r.quotationTotal;
      }
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }));
  }, [data]);

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    const unique = new Map<string, string>();
    data.forEach(r => { if (!unique.has(r.customerId)) unique.set(r.customerId, r.customerStatus || "pendente"); });
    unique.forEach(status => { map[status] = (map[status] || 0) + 1; });
    return Object.entries(map).map(([status, count]) => ({
      name: CUSTOMER_STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || "#6b7280",
    }));
  }, [data]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Funil Comercial</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={11} />
              <YAxis dataKey="name" type="category" width={110} fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" fill="#002b17" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Status dos Clientes</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} fontSize={11}>
                {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {cityData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Receita por Cidade (Aprovados)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="city" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {monthlyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vendas por Mês</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Line type="monotone" dataKey="total" stroke="#002b17" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Results Table ────────────────────────────────────────────────────────────
function ResultsTable({ data, selectedColumns }: { data: ReportRow[]; selectedColumns: Set<string> }) {
  const cols = ALL_COLUMNS.filter(c => selectedColumns.has(c.key));
  const totalRevenue = data.filter(r => r.quotationStatus === "approved").reduce((s, r) => s + r.quotationTotal, 0);

  if (cols.length === 0) return <p className="text-gray-400 text-sm text-center py-4">Selecione pelo menos uma coluna.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {cols.map(c => <th key={c.key} className="text-left py-2 px-3 font-semibold text-gray-700 whitespace-nowrap">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={`${row.quotationId}-${i}`} className="border-b hover:bg-gray-50">
              {cols.map(c => (
                <td key={c.key} className="py-2 px-3 text-gray-700 whitespace-nowrap">
                  {renderCellValue(c.key, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            {cols.map((c, i) => (
              <td key={c.key} className="py-2 px-3 text-gray-700">
                {i === 0
                  ? `Total: ${data.length} registros`
                  : c.key === "quotationTotal"
                  ? formatCurrency(totalRevenue)
                  : ""}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {data.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-8">Nenhum resultado encontrado para os filtros aplicados.</p>
      )}
    </div>
  );
}

// ─── Visão Executiva ──────────────────────────────────────────────────────────
function ExecutiveView() {
  const { data: exec, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/executive"],
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Carregando visão executiva...</div>;
  }

  if (!exec) return null;

  const summaryCards = [
    { label: "Receita Total (6 meses)", value: formatCurrency(exec.totalRevenue || 0), icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
    { label: "Lucro Estimado", value: formatCurrency(exec.estimatedProfit || 0), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Clientes Ativos", value: exec.activeCustomers || 0, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Taxa de Conversão", value: `${(exec.conversionRate || 0).toFixed(1)}%`, icon: Target, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Ticket Médio", value: formatCurrency(exec.avgTicket || 0), icon: BarChart2, color: "text-teal-600", bg: "bg-teal-50" },
    { label: "Cidade Top", value: exec.topCity || "-", icon: Filter, color: "text-red-600", bg: "bg-red-50" },
    { label: "Melhor Vendedor", value: exec.bestSeller || "-", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
    {
      label: "vs. Mês Anterior",
      value: `${exec.momChange >= 0 ? "+" : ""}${(exec.momChange || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: exec.momChange >= 0 ? "text-green-600" : "text-red-600",
      bg: exec.momChange >= 0 ? "bg-green-50" : "bg-red-50",
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {summaryCards.map(card => (
          <Card key={card.label} className={card.bg}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-600">{card.label}</p>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Receita Mensal (últimos 6 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={exec.monthlyRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={10} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#002b17" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Funil do Período</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 mt-4">
              {[
                { label: "Total de Propostas", value: exec.totalQuotations, color: "bg-blue-500" },
                { label: "Aprovadas", value: exec.closedCount, color: "bg-green-500" },
                { label: "Pendentes", value: exec.pendingCount, color: "bg-yellow-500" },
                { label: "Rejeitadas", value: exec.rejectedCount, color: "bg-red-500" },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`${item.color} h-2 rounded-full`}
                      style={{ width: `${exec.totalQuotations > 0 ? (item.value / exec.totalQuotations) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.type === "admin";

  const [filters, setFilters] = useState<Filters>({
    period: "this_month",
    ...getDateRange("this_month"),
    city: "",
    state: "",
    responsibleId: "",
    customerStatus: "",
    customerId: "",
  });
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMNS));
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: templates = [] } = useQuery<SavedReportTemplate[]>({ queryKey: ["/api/report-templates"] });

  // Build query params
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) p.set("dateTo", filters.dateTo);
    if (filters.city) p.set("city", filters.city);
    if (filters.state) p.set("state", filters.state);
    if (filters.responsibleId) p.set("responsibleId", filters.responsibleId);
    if (filters.customerStatus) p.set("customerStatus", filters.customerStatus);
    if (filters.customerId) p.set("customerId", filters.customerId);
    return p.toString();
  }, [filters]);

  const { data: reportData = [], isLoading } = useQuery<ReportRow[]>({
    queryKey: ["/api/reports/advanced", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/reports/advanced?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("/api/report-templates", {
        method: "POST",
        data: {
          name,
          filtersJson: filters,
          columnsJson: Array.from(selectedColumns),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-templates"] });
      toast({ title: "Modelo salvo com sucesso!" });
      setSaveDialogOpen(false);
      setTemplateName("");
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/report-templates/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-templates"] });
      toast({ title: "Modelo removido" });
    },
  });

  const loadTemplate = (t: SavedReportTemplate) => {
    try {
      const f = JSON.parse(t.filtersJson);
      const c = JSON.parse(t.columnsJson);
      setFilters(f);
      setSelectedColumns(new Set(c));
      toast({ title: `Modelo "${t.name}" carregado` });
    } catch {
      toast({ title: "Erro ao carregar modelo", variant: "destructive" });
    }
  };

  const applyQuickReport = (qr: typeof QUICK_REPORTS[0]) => {
    setSelectedColumns(new Set(qr.columns));
    setFilters(prev => ({ ...prev, ...qr.filters }));
  };

  // Export functions
  const exportCSV = () => {
    const cols = ALL_COLUMNS.filter(c => selectedColumns.has(c.key));
    const header = cols.map(c => c.label).join(",");
    const rows = reportData.map(row =>
      cols.map(c => {
        const v = renderCellValue(c.key, row);
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "relatorio.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const cols = ALL_COLUMNS.filter(c => selectedColumns.has(c.key));
    const wsData = [
      cols.map(c => c.label),
      ...reportData.map(row => cols.map(c => renderCellValue(c.key, row))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, "relatorio.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const cols = ALL_COLUMNS.filter(c => selectedColumns.has(c.key));
    doc.setFontSize(14);
    doc.text("Relatório Inteligente - MasterGreen", 14, 16);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}  •  Total: ${reportData.length} registros`, 14, 22);

    const colW = Math.min(40, (280 - 14) / cols.length);
    let y = 30;
    doc.setFillColor(0, 43, 23);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.rect(14, y - 5, colW * cols.length, 7, "F");
    cols.forEach((c, i) => doc.text(c.label.slice(0, 14), 15 + i * colW, y));

    doc.setTextColor(0, 0, 0);
    y += 5;
    reportData.slice(0, 200).forEach((row, ri) => {
      if (y > 185) { doc.addPage(); y = 20; }
      if (ri % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(14, y - 4, colW * cols.length, 7, "F");
      }
      cols.forEach((c, i) => {
        const v = String(renderCellValue(c.key, row)).slice(0, 16);
        doc.text(v, 15 + i * colW, y);
      });
      y += 7;
    });

    doc.save("relatorio-mastergreen.pdf");
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Relatórios Inteligentes</h1>
            <p className="text-gray-600 text-sm">Análises comerciais, financeiras e operacionais</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-3 h-3 mr-1" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="w-3 h-3 mr-1" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <Download className="w-3 h-3 mr-1" />PDF
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="reports" className="w-full">
        <div className="px-4 md:px-6 pt-4">
          <TabsList>
            <TabsTrigger value="reports">
              <BarChart2 className="w-4 h-4 mr-2" />Relatórios
            </TabsTrigger>
            <TabsTrigger value="executive">
              <LayoutDashboard className="w-4 h-4 mr-2" />Visão Executiva
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── REPORTS TAB ── */}
        <TabsContent value="reports" className="p-4 md:p-6 pt-4">

          {/* Quick Reports */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Relatórios Prontos</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_REPORTS.map(qr => (
                <Button key={qr.label} variant="outline" size="sm" onClick={() => applyQuickReport(qr)}>
                  {qr.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Saved Templates */}
          {templates.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Modelos Salvos</p>
              <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center gap-1 bg-gray-100 rounded-md px-2 py-1">
                    <button className="text-sm text-gray-700 hover:text-green-700" onClick={() => loadTemplate(t)}>{t.name}</button>
                    <button onClick={() => deleteTemplateMutation.mutate(t.id)} className="text-gray-400 hover:text-red-500 ml-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters toggle */}
          <Card className="mb-4">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <CardTitle className="text-sm">Filtros</CardTitle>
                </div>
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </CardHeader>
            {showFilters && (
              <CardContent>
                <FiltersPanel
                  filters={filters}
                  onChange={setFilters}
                  customers={customers}
                  users={users as User[]}
                  isAdmin={isAdmin}
                />
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFilters({ period: "this_month", ...getDateRange("this_month"), city: "", state: "", responsibleId: "", customerStatus: "", customerId: "" })}
                  >
                    Limpar filtros
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSaveDialogOpen(true)}>
                    <Save className="w-3 h-3 mr-1" />Salvar modelo
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Column selector toggle */}
          <Card className="mb-4">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowColumns(!showColumns)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <CardTitle className="text-sm">Colunas ({selectedColumns.size} selecionadas)</CardTitle>
                </div>
                {showColumns ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </CardHeader>
            {showColumns && (
              <CardContent>
                <ColumnSelector selected={selectedColumns} onChange={setSelectedColumns} />
              </CardContent>
            )}
          </Card>

          {/* KPI Cards */}
          {!isLoading && <KpiCards data={reportData} />}

          {/* Charts toggle */}
          <div className="flex items-center gap-2 mb-3">
            <Button variant="ghost" size="sm" onClick={() => setShowCharts(!showCharts)}>
              <BarChart2 className="w-4 h-4 mr-1" />
              {showCharts ? "Ocultar gráficos" : "Mostrar gráficos"}
            </Button>
          </div>
          {showCharts && !isLoading && reportData.length > 0 && <Charts data={reportData} />}

          {/* Results Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Resultados {isLoading ? "(carregando...)" : `(${reportData.length} registros)`}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : (
                <ResultsTable data={reportData} selectedColumns={selectedColumns} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── EXECUTIVE TAB ── */}
        <TabsContent value="executive">
          <ExecutiveView />
        </TabsContent>
      </Tabs>

      {/* Save template dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar modelo de relatório</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do modelo</Label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Ex: Clientes fechados em SP"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
              <Button
                className="btn-primary"
                disabled={!templateName.trim() || saveTemplateMutation.isPending}
                onClick={() => saveTemplateMutation.mutate(templateName.trim())}
              >
                {saveTemplateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
