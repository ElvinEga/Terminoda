import { Server, Key, Network, Code, History, Globe, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConnectionDetails {
  host: string;
  port?: number;
  username: string;
  password?: string;
  private_key_path?: string;
  passphrase?: string;
  keepalive_interval?: number;
  timeout?: number;
}

export interface SavedHost {
  id: string;
  name: string;
  group?: string;
  tags?: string[];
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
    <div className="flex flex-col h-full bg-background text-muted-foreground w-64 border-r border-border">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="bg-primary p-1 rounded">
            <Server className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl text-foreground">Terminoda</span>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className={`w-full justify-start ${
                activeItem === item.id 
                  ? 'bg-accent text-primary font-medium' 
                  : 'hover:bg-accent'
              }`}
              onClick={() => onItemSelect(item.id)}
            >
              <item.icon className={`mr-3 h-4 w-4 ${activeItem === item.id ? 'text-primary' : ''}`} />
              {item.label}
            </Button>
          ))}
        </nav>

      </div>
      
      <div className="p-6 mt-auto border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start hover:bg-accent"
          onClick={onOpenSettings}
        >
          <Settings className="mr-3 h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );
}
