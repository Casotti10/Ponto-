import {
  LayoutDashboard,
  Fingerprint,
  CalendarX2,
  Wallet,
  Banknote,
  CalendarDays,
  FileBarChart2,
  KanbanSquare,
  Search,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "1" },
  { href: "/ponto", label: "Registro de Ponto", icon: Fingerprint, shortcut: "2" },
  { href: "/ausencias", label: "Ausências", icon: CalendarX2, shortcut: "3" },
  { href: "/banco-horas", label: "Banco de Horas", icon: Wallet, shortcut: "4" },
  { href: "/financeiro", label: "Financeiro", icon: Banknote, shortcut: "5" },
  // Os atalhos numéricos 1–0 já estavam todos ocupados quando este módulo
  // entrou; renumerar os anteriores custaria a memória muscular de quem já usa.
  { href: "/tarefas", label: "Tarefas", icon: KanbanSquare, shortcut: "t" },
  { href: "/calendario", label: "Calendário", icon: CalendarDays, shortcut: "6" },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart2, shortcut: "7" },
  { href: "/pesquisa", label: "Pesquisa", icon: Search, shortcut: "8" },
  { href: "/historico", label: "Histórico", icon: History, shortcut: "9" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, shortcut: "0" },
];
