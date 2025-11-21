import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Icons } from "@/components/ui/icons"
import { motion } from "framer-motion"

interface AppSidebarProps {
  activeView: string
  onViewChange: (view: string) => void
  onOpenSettings: () => void
}

export function AppSidebar({ activeView, onViewChange, onOpenSettings }: AppSidebarProps) {
  const navItems = [
    { id: "dashboard", icon: Icons.Zap, label: "Dashboard" },
    { id: "terminal", icon: Icons.Terminal, label: "Terminal" },
    { id: "hosts", icon: Icons.Server, label: "Hosts" },
    { id: "known-hosts", icon: Icons.Shield, label: "Known Hosts" },
    { id: "snippets", icon: Icons.Command, label: "Snippets" },
    { id: "keys", icon: Icons.Key, label: "Keychain" },
    { id: "history", icon: Icons.Activity, label: "History" },
  ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-2 group-data-[collapsible=icon]:justify-center">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Icons.Terminal className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
            Terminoda
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.id)}
                    isActive={activeView === item.id}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                    {activeView === item.id && (
                      <motion.div
                        layoutId="active-nav"
                        className="absolute left-0 w-1 h-5 bg-sidebar-primary rounded-r-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onOpenSettings} tooltip="Settings">
              <Icons.Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
