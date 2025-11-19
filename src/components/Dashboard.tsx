import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Terminal, Plus, Settings, Server } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SavedHost, ConnectionDetails } from './VaultSidebar';
import { ConnectionDialog } from './ConnectionDialog';
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

interface DashboardProps {
  onConnect: (details: ConnectionDetails, name: string) => void;
}

export function Dashboard({ onConnect }: DashboardProps) {
  const [hosts, setHosts] = useState<SavedHost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<SavedHost | null>(null);
  const [deletingHost, setDeletingHost] = useState<SavedHost | null>(null);

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

  const filteredHosts = hosts.filter(host => 
    host.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    host.details.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
    host.details.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#f4f5f7] dark:bg-[#1e1e2e] text-gray-900 dark:text-gray-100 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Find a host or ssh user@hostname..." 
            className="pl-10 bg-white dark:bg-[#2a2b3d] border-gray-200 dark:border-gray-700 rounded-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="default" className="ml-4 bg-[#e2e8f0] text-gray-700 hover:bg-[#cbd5e1] dark:bg-[#313244] dark:text-gray-200 dark:hover:bg-[#45475a]">
          CONNECT
        </Button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-8">
        <Button 
          className="bg-[#4c566a] hover:bg-[#434c5e] text-white"
          onClick={() => { setEditingHost(null); setIsDialogOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" /> NEW HOST
        </Button>
        <Button variant="secondary" className="bg-[#4c566a] hover:bg-[#434c5e] text-white">
          <Terminal className="mr-2 h-4 w-4" /> TERMINAL
        </Button>
      </div>

      {/* Groups (Placeholder for now) */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Groups</h3>
        <div className="bg-white dark:bg-[#2a2b3d] p-4 rounded-lg shadow-sm inline-block min-w-[200px]">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-md">
              <Server className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-medium">All Hosts</div>
              <div className="text-xs text-gray-500">{hosts.length} Hosts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Hosts Grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Hosts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredHosts.map(host => (
            <div 
              key={host.id} 
              className="group bg-white dark:bg-[#2a2b3d] p-4 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer relative border border-transparent hover:border-blue-500"
              onClick={() => onConnect(host.details, host.name)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-[#f97316] p-2 rounded-full">
                    <Terminal className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{host.name}</div>
                    <div className="text-xs text-gray-500">
                      ssh, {host.details.username}
                    </div>
                  </div>
                </div>
                
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Settings className="h-4 w-4 text-gray-400" />
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
                </div>
              </div>
            </div>
          ))}
        </div>
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
