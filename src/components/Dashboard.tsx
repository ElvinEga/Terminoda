import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Terminal, Plus, Settings, Server, Folder } from 'lucide-react';
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
import { cn } from '@/lib/utils';

interface DashboardProps {
  onConnect: (details: ConnectionDetails, name: string) => void;
}

export function Dashboard({ onConnect }: DashboardProps) {
  const [hosts, setHosts] = useState<SavedHost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
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

  // Compute Groups
  const groups = useMemo(() => {
    const uniqueGroups = new Set(hosts.map(h => h.group || "General"));
    return ["All", ...Array.from(uniqueGroups).sort()];
  }, [hosts]);

  // Filter Logic
  const filteredHosts = hosts.filter(host => {
    const matchesSearch = 
      host.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      host.details.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      host.details.username.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGroup = selectedGroup === 'All' || (host.group || "General") === selectedGroup;

    return matchesSearch && matchesGroup;
  });

  return (
    <div className="flex flex-col h-full bg-background text-foreground p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Find a host or ssh user@hostname..." 
            className="pl-10 bg-card border-border rounded-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <Button 
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => { setEditingHost(null); setIsDialogOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" /> NEW HOST
        </Button>
      </div>

      {/* Groups */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Groups</h3>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {groups.map(group => {
            const count = group === 'All' 
                ? hosts.length 
                : hosts.filter(h => (h.group || "General") === group).length;
            
            return (
                <div 
                    key={group}
                    onClick={() => setSelectedGroup(group)}
                    className={cn(
                        "min-w-[180px] cursor-pointer p-4 rounded-lg shadow-sm border transition-all",
                        selectedGroup === group 
                            ? "bg-primary/10 border-primary" 
                            : "bg-card border-transparent hover:border-border"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-md",
                            selectedGroup === group ? "bg-primary" : "bg-muted"
                        )}>
                            {group === 'All' ? <Server className="h-5 w-5 text-white" /> : <Folder className="h-5 w-5 text-white" />}
                        </div>
                        <div>
                            <div className="font-medium truncate max-w-[100px]">{group}</div>
                            <div className="text-xs text-muted-foreground">{count} Hosts</div>
                        </div>
                    </div>
                </div>
            );
          })}
        </div>
      </div>

      {/* Hosts Grid */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
            {selectedGroup} Hosts
        </h3>
        {filteredHosts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
                No hosts found in this group.
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredHosts.map(host => (
                <div 
                key={host.id} 
                className="group bg-card p-4 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer relative border border-transparent hover:border-primary"
                onClick={() => onConnect(host.details, host.name)}
                >
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                    <div className="bg-primary p-2 rounded-full">
                        <Terminal className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="overflow-hidden">
                        <div className="font-semibold text-lg truncate">{host.name}</div>
                        <div className="text-xs text-muted-foreground flex flex-col">
                            <span>{host.details.username}@{host.details.host}</span>
                            {host.group && <span className="inline-block mt-1 px-1.5 py-0.5 bg-muted rounded text-[10px] w-fit">{host.group}</span>}
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
        )}
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
