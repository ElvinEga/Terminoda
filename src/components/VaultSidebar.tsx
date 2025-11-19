import { Server, Key, Network, Code, History, Globe, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConnectionDetails {
  host: string;
  port?: number;
  username: string;
  password?: string;
  private_key_path?: string;
  passphrase?: string;
}

export interface SavedHost {
  id: string;
  name: string;
  details: ConnectionDetails;
}

interface SidebarProps {
  activeItem: string;
  onItemSelect: (item: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({ activeItem, onItemSelect, onOpenSettings }: SidebarProps) {
  const navItems = [
    { id: 'hosts', label: 'Hosts', icon: Server },
    { id: 'keychain', label: 'Keychain', icon: Key },
    { id: 'port-forwarding', label: 'Port Forwarding', icon: Network },
    { id: 'snippets', label: 'Snippets', icon: Code },
    { id: 'known-hosts', label: 'Known Hosts', icon: Globe },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1e1e2e] text-gray-600 dark:text-gray-400 w-64 border-r border-gray-200 dark:border-gray-800">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="bg-blue-600 p-1 rounded">
            <Server className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900 dark:text-white">Terminoda</span>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className={`w-full justify-start ${
                activeItem === item.id 
                  ? 'bg-blue-50 dark:bg-[#2a2b3d] text-blue-600 dark:text-blue-400 font-medium' 
                  : 'hover:bg-gray-50 dark:hover:bg-[#2a2b3d]'
              }`}
              onClick={() => onItemSelect(item.id)}
            >
              <item.icon className={`mr-3 h-4 w-4 ${activeItem === item.id ? 'text-blue-600 dark:text-blue-400' : ''}`} />
              {item.label}
            </Button>
          ))}
        </nav>

      </div>
      
      <div className="p-6 mt-auto border-t border-gray-200 dark:border-gray-800">
        <Button
          variant="ghost"
          className="w-full justify-start hover:bg-gray-50 dark:hover:bg-[#2a2b3d]"
          onClick={onOpenSettings}
        >
          <Settings className="mr-3 h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );
}
