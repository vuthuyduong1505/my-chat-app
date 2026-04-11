import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  MessageSquare,
  Search,
  UserCircle,
  Users
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", end: true, label: "Chat", icon: MessageSquare },
  { to: "/friends", end: false, label: "Friends", icon: Users },
  { to: "/discover", end: false, label: "Discover", icon: Search },
  { to: "/profile", end: false, label: "Profile", icon: UserCircle }
];

function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const displayName =
    user && `${user.firstName || ""} ${user.lastName || ""}`.trim()
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
      : "User";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen min-h-0 bg-accent">
      <aside
        className={`relative flex shrink-0 flex-col bg-primary text-white shadow-soft transition-[width] duration-300 ease-out ${
          collapsed ? "w-[4.5rem]" : "w-60"
        }`}
      >
        <div
          className={`flex items-center border-b border-white/10 py-4 transition-all duration-300 ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wider text-secondary">D-Chat</p>
              <p className="truncate text-sm font-semibold text-white/95">{displayName}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 pt-4">
          {navItems.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                [
                  "group flex items-center gap-3 rounded-2xl py-2.5 text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center px-0" : "px-3",
                  isActive
                    ? "bg-white/12 text-secondary shadow-sm ring-1 ring-secondary/40"
                    : "text-white/80 hover:bg-white/8 hover:text-white"
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
                      isActive ? "bg-secondary/20 text-secondary" : "bg-white/5 text-white/90 group-hover:bg-white/10"
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.25 : 2} />
                  </span>
                  {!collapsed && <span>{label}</span>}
                  {!collapsed && isActive && (
                    <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-secondary shadow-[0_0_12px_rgba(0,191,165,0.7)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className={`flex w-full items-center gap-3 rounded-2xl py-2.5 text-sm font-medium text-white/90 transition hover:bg-red-500/20 hover:text-red-100 ${
              collapsed ? "justify-center px-0" : "px-3"
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
              <LogOut size={20} />
            </span>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-hidden p-3 md:p-5">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-light shadow-soft ring-1 ring-primary/5">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
