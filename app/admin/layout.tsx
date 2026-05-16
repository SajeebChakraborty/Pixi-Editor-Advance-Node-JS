import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileStack,
  Settings,
  Users,
  Image as ImageIcon,
  BarChart3,
  HelpCircle,
  LogOut,
  Bell,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pixizen Admin",
  description: "Pixizen Admin Panel",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: "/admin",
      active: false,
    },
    {
      icon: FileStack,
      label: "Templates",
      href: "/admin/templates",
      active: false,
    },
    {
      icon: ImageIcon,
      label: "Assets",
      href: "/admin/assets",
      active: true,
    },
    { icon: Users, label: "Users", href: "/admin/users", active: false },
    {
      icon: BarChart3,
      label: "Analytics",
      href: "/admin/analytics",
      active: false,
    },
    {
      icon: Settings,
      label: "Settings",
      href: "/admin/settings",
      active: false,
    },
  ];

  return (
    <div
      className={cn(
        "h-screen flex bg-[#f8fafc] text-[#1e293b]",
        inter.className,
      )}
    >
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-bottom border-slate-100">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/logo.png" alt="Pixizen Admin Logo" className="h-8 w-auto object-contain" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              Pixizen<span className="text-indigo-600">Admin</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {sidebarItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                item.active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5",
                  item.active
                    ? "text-indigo-600"
                    : "text-slate-400 group-hover:text-slate-600",
                )}
              />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button className="flex items-center gap-3 px-3 py-2 w-full text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-all">
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates, users..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold">Admin User</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Super Admin
                </p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 overflow-hidden">
                <User className="w-6 h-6 text-slate-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
