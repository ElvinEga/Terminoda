import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Server, TerminalSquare } from "lucide-react";
import { ConnectionDialog } from "./ConnectionDialog";

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

interface VaultSidebarProps {
  onHostSelect: (details: ConnectionDetails) => void;
}

export function VaultSidebar({ onHostSelect }: VaultSidebarProps) {
  const [hosts, setHosts] = useState<SavedHost[]>([]);

  const loadHosts = async () => {
    try {
      const loadedHosts = await invoke<SavedHost[]>("load_saved_hosts");
      setHosts(loadedHosts);
    } catch (error) {
      console.error("Failed to load hosts:", error);
    }
  };

  useEffect(() => {
    loadHosts();
  }, []);

  const handleNewConnection = (savedHost: SavedHost) => {
    setHosts(prev => [...prev, savedHost]);
    onHostSelect(savedHost.details);
  };

  return (
    <div className="flex flex-col h-full bg-[#21222C] text-gray-300 w-64 border-r border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">Vault</h2>
      </div>
      <div className="flex-grow p-2 overflow-y-auto">
        <ul className="space-y-1">
          {hosts.map((host) => (
            <li key={host.id}>
              <button
                onClick={() => onHostSelect(host.details)}
                className="w-full flex items-center p-2 rounded-md hover:bg-gray-700 text-left transition-colors"
              >
                <Server className="mr-3 h-5 w-5 flex-shrink-0" />
                <span className="flex-grow truncate">{host.name}</span>
              </button>
            </li>
          ))}
          {hosts.length === 0 && (
            <div className="text-center text-gray-500 p-4">
              <TerminalSquare className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-2 text-sm">No saved hosts.</p>
              <p className="text-xs">Click "New" to add one.</p>
            </div>
          )}
        </ul>
      </div>
      <div className="p-4 border-t border-gray-700">
        <ConnectionDialog onSave={handleNewConnection} />
      </div>
    </div>
  );
}
