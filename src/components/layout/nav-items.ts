import {
  LayoutDashboard,
  Fingerprint,
  CalendarX2,
  Wallet,
  CalendarDays,
  FileBarChart2,
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
  { href: "/calendario", label: "Calendário", icon: CalendarDays, shortcut: "5" },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart2, shortcut: "6" },
  { href: "/pesquisa", label: "Pesquisa", icon: Search, shortcut: "7" },
  { href: "/historico", label: "Histórico", icon: History, shortcut: "8" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, shortcut: "9" },
];
