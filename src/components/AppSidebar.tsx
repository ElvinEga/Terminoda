import { Icons } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface SidebarProps {
  activeView: string
  onViewChange: (view: string) => void
  onOpenSettings: () => void
}

export function AppSidebar({ activeView, onViewChange, onOpenSettings }: SidebarProps) {
  const navItems = [
    { id: "dashboard", icon: Icons.Zap, label: "Dashboard" },
    { id: "hosts", icon: Icons.Server, label: "Hosts" },
    { id: "known-hosts", icon: Icons.Shield, label: "Known Hosts" },
    { id: "snippets", icon: Icons.Command, label: "Snippets" },
    { id: "keys", icon: Icons.Key, label: "Keychain" },
    { id: "history", icon: Icons.Activity, label: "History" },
  ]

  return (
    <div className="w-[260px] h-full bg-black border-r border-white/10 flex flex-col justify-between p-4 z-20 shrink-0">
      <div className="flex flex-col gap-6">
        {/* Logo Area */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <Icons.Terminal className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">Terminoda</span>
        </div>

        {/* Main Navigation */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                activeView === item.id ? "text-white bg-white/10" : "text-zinc-400 hover:text-white hover:bg-white/5",
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5",
                  activeView === item.id ? "text-white" : "text-zinc-500 group-hover:text-white",
                )}
              />
              {item.label}
              {activeView === item.id && (
                <motion.div
                  layoutId="active-nav"
                  className="absolute left-0 w-1 h-5 bg-white rounded-r-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-1">
        <button
            onClick={onOpenSettings}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Icons.Settings className="w-5 h-5 text-zinc-500 group-hover:text-white" />
            Settings
        </button>
      </div>
    </div>
  )
}
