import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icons } from "@/components/ui/icons";
import { motion, AnimatePresence } from "framer-motion";
import { SavedHost, ConnectionDetails } from "../VaultSidebar";
import { ConnectionDialog } from "../ConnectionDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface HostsViewProps {
  onConnect: (details: ConnectionDetails, name: string) => void;
}

export function HostsView({ onConnect }: HostsViewProps) {
  const [hosts, setHosts] = useState<SavedHost[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("All Hosts");
  
  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<SavedHost | null>(null);
  const [deletingHost, setDeletingHost] = useState<SavedHost | null>(null);

  // Load Data
  const loadHosts = async () => {
      try {
        const data = await invoke<SavedHost[]>("load_saved_hosts");
        setHosts(data);
      } catch (error) {
        console.error("Failed to load hosts:", error);
      }
  };

  useEffect(() => { loadHosts(); }, []);

  // Handlers
  const handleSave = (savedHost: SavedHost, isEditing: boolean) => {
    if (isEditing) {
      setHosts(prev => prev.map(h => h.id === savedHost.id ? savedHost : h));
    } else {
      setHosts(prev => [...prev, savedHost]);
    }
  };

  const handleDelete = async () => {
    if (!deletingHost) return;
    try {
      await invoke("delete_host", { hostId: deletingHost.id });
      setHosts(prev => prev.filter(h => h.id !== deletingHost.id));
      setDeletingHost(null);
      toast.success("Host deleted");
    } catch (e) {
      toast.error(String(e));
    }
  };

  // Compute Groups
  const groups = useMemo(() => {
      const unique = new Set(hosts.map(h => h.group || "Ungrouped"));
      return ["All Hosts", ...Array.from(unique).sort()];
  }, [hosts]);

  // Compute Tags
  const tags = useMemo(() => {
      const allTags = hosts.flatMap(h => h.tags || []);
      return Array.from(new Set(allTags)).sort();
  }, [hosts]);

  // Filter Logic
  const filteredHosts = hosts.filter(host => {
      const matchesSearch = host.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            host.details.host.toLowerCase().includes(searchQuery.toLowerCase());
      const hostGroup = host.group || "Ungrouped";
      const matchesGroup = selectedGroup === "All Hosts" || hostGroup === selectedGroup;
      
      return matchesSearch && matchesGroup;
  });

  return (
    <div className="flex h-full relative bg-[#050505]">
      {/* Sidebar Filter */}
      <div className="w-64 border-r border-white/10 p-4 flex flex-col gap-6 bg-black/40">
        <div className="relative">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search hosts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all placeholder:text-zinc-600"
          />
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">Groups</h3>
          {groups.map((group) => {
            const count = group === "All Hosts" ? hosts.length : hosts.filter(h => (h.group || "Ungrouped") === group).length;
            const isActive = selectedGroup === group;
            
            return (
                <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={cn(
                    "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between group",
                    isActive ? "text-white bg-white/10" : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
                >
                {group}
                <span className={cn("text-xs", isActive ? "text-zinc-400" : "text-zinc-600 group-hover:text-zinc-500")}>
                    {count}
                </span>
                </button>
            );
          })}
        </div>

        <div className="space-y-1 mt-auto">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">Tags</h3>
            {tags.length === 0 && <div className="px-2 text-xs text-zinc-600 italic">No tags found</div>}
            {tags.map(tag => (
                <div key={tag} className="flex items-center gap-2 px-2 py-1 text-sm text-zinc-400 hover:text-white cursor-pointer group">
                    <div className="w-2 h-2 rounded-full bg-blue-500/50 group-hover:bg-blue-500 transition-colors" />
                    {tag}
                </div>
            ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-[#050505]">
        {/* Toolbar */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-black/20">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="text-white font-medium">{selectedGroup}</span>
            <span className="text-zinc-600">/</span>
            <span>{filteredHosts.length} items</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-900/50 rounded-lg p-1 border border-white/10">
              <button
                onClick={() => setViewMode("list")}
                className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300")}
              >
                <Icons.List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300")}
              >
                <Icons.Grid className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => { setEditingHost(null); setIsDialogOpen(true); }}
              className="bg-white text-black px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors flex items-center gap-2"
            >
              <Icons.Plus className="w-4 h-4" />
              Add Host
            </button>
          </div>
        </div>

        {/* List/Grid View */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {filteredHosts.length === 0 ? (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-64 text-zinc-500"
                >
                    <Icons.Server className="w-12 h-12 mb-4 text-zinc-700" />
                    <p>No hosts found in this group.</p>
                </motion.div>
            ) : viewMode === "list" ? (
                <div className="space-y-2">
                {filteredHosts.map((host, i) => (
                    <motion.div
                    key={host.id}
                    onClick={() => onConnect(host.details, host.name)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/5 transition-all cursor-pointer"
                    >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center border border-white/5 group-hover:border-white/20 transition-colors text-zinc-500 group-hover:text-white">
                           <Icons.Terminal className="w-5 h-5" />
                        </div>
                        <div>
                        <h4 className="text-white font-medium text-sm">{host.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span className="font-mono">{host.details.host}</span>
                            <span className="text-zinc-700">•</span>
                            <span className="text-zinc-400">{host.details.username}</span>
                        </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            {host.tags && host.tags.map(tag => (
                                <span key={tag} className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] border border-white/5">
                                    {tag}
                                </span>
                            ))}
                            {host.group && (
                                <span className="px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 text-[10px] border border-white/5">
                                    {host.group}
                                </span>
                            )}
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-md transition-all text-zinc-400 hover:text-white">
                                        <Icons.More className="w-4 h-4" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-[#111] border-white/10 text-zinc-300">
                                    <DropdownMenuItem onClick={() => { setEditingHost(host); setIsDialogOpen(true); }}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => setDeletingHost(host)}>Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    </motion.div>
                ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredHosts.map((host, i) => (
                    <motion.div
                    key={host.id}
                    onClick={() => onConnect(host.details, host.name)}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="group p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer flex flex-col gap-4"
                    >
                    <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center border border-white/5 group-hover:border-white/20 transition-colors text-zinc-500 group-hover:text-white">
                           <Icons.Server className="w-5 h-5" />
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition-opacity p-1">
                                        <Icons.More className="w-4 h-4" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-[#111] border-white/10 text-zinc-300">
                                    <DropdownMenuItem onClick={() => { setEditingHost(host); setIsDialogOpen(true); }}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => setDeletingHost(host)}>Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-white font-medium text-sm mb-1 truncate">{host.name}</h4>
                        <p className="text-xs text-zinc-500 font-mono truncate">{host.details.username}@{host.details.host}</p>
                    </div>

                    <div className="mt-auto pt-2 border-t border-white/5">
                         <div className="flex flex-wrap gap-1 mb-2">
                            {host.tags && host.tags.map(tag => (
                                 <span key={tag} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-600">{host.group || "Ungrouped"}</span>
                            <button className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Connect <Icons.ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                    </motion.div>
                ))}
                </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Connection Dialog */}
      <ConnectionDialog
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        onSave={handleSave}
        editingHost={editingHost}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingHost} onOpenChange={() => setDeletingHost(null)}>
        <AlertDialogContent className="bg-[#0A0A0A] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will permanently delete the host "{deletingHost?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-zinc-400 hover:bg-white/10 hover:text-white border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
