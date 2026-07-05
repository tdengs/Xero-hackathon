import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, List, LogOut, Plug, Sparkles } from "lucide-react";
import { clearAccessToken } from "@/lib/auth";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const primary = [
  { title: "Workspace", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Reconciliations", url: "/reconciliations", icon: List },
  { title: "Connections", url: "/sources", icon: Plug },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" className="border-r border-rule">
      <SidebarHeader className="border-b border-rule bg-card px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center bg-accent text-accent-foreground">
              <span className="font-tabular text-[0.7rem]">R/</span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate font-display text-sm leading-tight">
                  RECO
                </div>
                <div className="section-marker">agent</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <Link
              to="/press-demo"
              className="grid h-6 w-6 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
              aria-label="Demo"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-card">
        <SidebarGroup>
          <SidebarGroupLabel className="section-marker">
            workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url, item.exact)}
                  >
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {!collapsed ? (
          <div className="mt-auto border-t border-rule p-3">
            <button
              onClick={() => {
                clearAccessToken();
                navigate({ to: "/login" });
              }}
              className="inline-flex w-full items-center gap-2 px-2 py-2 font-tabular text-[0.68rem] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> sign out
            </button>
          </div>
        ) : null}
      </SidebarContent>
    </Sidebar>
  );
}
