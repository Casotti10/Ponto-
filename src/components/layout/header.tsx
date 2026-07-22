"use client";

import { useState } from "react";
import { Menu, LogOut, User as UserIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell, type NotificationItem } from "@/components/layout/notification-bell";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

interface HeaderProps {
  user: { name: string; email: string; role: string; avatarColor: string };
  notifications: NotificationItem[];
  title?: string;
}

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  EMPLOYEE: "Colaborador",
};

export function Header({ user, notifications, title }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "lg:hidden")}>
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <h1 className="hidden text-lg font-semibold sm:block">{title}</h1>

      <div className="ml-auto flex items-center gap-1.5">
        <NotificationBell notifications={notifications} />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: "ghost" }), "ml-1 flex items-center gap-2 px-2")}
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback style={{ backgroundColor: user.avatarColor, color: "white" }} className="text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium md:block">{user.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="truncate">{user.name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-xs font-normal text-muted-foreground">{roleLabels[user.role] ?? user.role}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<a href="/configuracoes" />}>
                <UserIcon className="mr-2 h-4 w-4" /> Meu perfil
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  void logoutAction();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
