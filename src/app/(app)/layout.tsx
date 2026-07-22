import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Header } from "@/components/layout/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-background lg:block">
        <SidebarNav />
      </aside>
      <div className="flex min-h-screen w-full flex-1 flex-col lg:pl-64">
        <Header
          user={{ name: user.name, email: user.email, role: user.role, avatarColor: user.avatarColor }}
          notifications={notifications.map((n) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            read: n.read,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
        <main className="flex-1 p-4 sm:p-6 animate-in fade-in duration-300">{children}</main>
      </div>
    </div>
  );
}
