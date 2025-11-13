import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Server, TerminalSquare, MoreHorizontal } from "lucide-react";
import { ConnectionDialog } from "./ConnectionDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  onHostSelect: (details: ConnectionDetails, name: string) => void;
}

export function VaultSidebar({ onHostSelect }: VaultSidebarProps) {
  const [hosts, setHosts] = useState<SavedHost[]>([]);
  const [editingHost, setEditingHost] = useState<SavedHost | null>(null);
  const [deletingHost, setDeletingHost] = useState<SavedHost | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  const handleSave = (savedHost: SavedHost, isEditing: boolean) => {
    if (isEditing) {
      setHosts(prev => prev.map(h => h.id === savedHost.id ? savedHost : h));
    } else {
      setHosts(prev => [...prev, savedHost]);
      onHostSelect(savedHost.details, savedHost.name);
    }
  };

  const handleDelete = async () => {
    if (!deletingHost) return;

    toast.promise(invoke("delete_host", { hostId: deletingHost.id }), {
      loading: "Deleting host...",
      success: () => {
        setHosts(prev => prev.filter(h => h.id !== deletingHost.id));
        setDeletingHost(null);
        return "Host deleted successfully.";
      },
      error: (err) => `Failed to delete: ${err}`,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#21222C] text-gray-300 w-64 border-r border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">Vault</h2>
      </div>
      <div className="flex-grow p-2 overflow-y-auto">
        <ul className="space-y-1">
          {hosts.map((host) => (
            <li key={host.id} className="group flex items-center p-2 rounded-md hover:bg-gray-700">
              <button
                onClick={() => onHostSelect(host.details, host.name)}
                className="flex items-center text-left flex-grow"
              >
                <Server className="mr-3 h-5 w-5 flex-shrink-0" />
                <span className="flex-grow truncate">{host.name}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => { setEditingHost(host); setIsDialogOpen(true); }}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeletingHost(host)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
        <Button className="w-full" onClick={() => { setEditingHost(null); setIsDialogOpen(true); }}>New Host</Button>
      </div>
      
      <ConnectionDialog
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        onSave={handleSave}
        editingHost={editingHost}
      />
      
      <AlertDialog open={!!deletingHost} onOpenChange={() => setDeletingHost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the host "{deletingHost?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
