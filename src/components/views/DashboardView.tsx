import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Icons } from "@/components/ui/icons"
import { motion } from "framer-motion"
import { SavedHost, ConnectionDetails } from '../VaultSidebar';
import { ConnectionDialog } from '../ConnectionDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface DashboardViewProps {
  onConnect: (details: ConnectionDetails, name: string) => void
  onViewChange?: (view: string) => void
}

export function DashboardView({ onConnect, onViewChange }: DashboardViewProps) {
  const [hosts, setHosts] = useState<SavedHost[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<SavedHost | null>(null);
  const [deletingHost, setDeletingHost] = useState<SavedHost | null>(null);
  
  // Load Hosts from Backend
  useEffect(() => {
      invoke<SavedHost[]>("load_saved_hosts").then(setHosts).catch(console.error);
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
    try {
      await invoke("delete_host", { hostId: deletingHost.id });
      setHosts(prev => prev.filter(h => h.id !== deletingHost.id));
      setDeletingHost(null);
      toast.success("Host deleted");
    } catch(e) { 
      toast.error(String(e)); 
    }
  };

  const quickStats = [
    { label: "Total Hosts", value: hosts.length.toString(), icon: Icons.Server },
    { label: "Snippets", value: "-", icon: Icons.Command }, // Placeholder for now
    { label: "Keys", value: "-", icon: Icons.Key },       // Placeholder for now
  ];

  return (
    <div className="p-8 h-full overflow-y-auto bg-transparent text-zinc-100">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Welcome to Terminoda</h1>
            <p className="text-zinc-400">Your secure gateway to infrastructure.</p>
          </div>
          <button
            onClick={() => { setEditingHost(null); setIsDialogOpen(true); }}
            className="bg-white text-black px-4 py-2 rounded-lg font-medium text-sm hover:bg-zinc-200 transition-colors flex items-center gap-2"
          >
            <Icons.Plus className="w-4 h-4" />
            New Connection
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          {quickStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-4 rounded-xl flex flex-col gap-2 hover:bg-white/5 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-sm font-medium">{stat.label}</span>
                <stat.icon className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-2xl font-bold text-white">{stat.value}</span>
            </motion.div>
          ))}
        </div>

        {/* Saved Hosts List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Saved Hosts</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hosts.map((host, i) => (
              <motion.div
                key={host.id}
                onClick={() => onConnect(host.details, host.name)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="glass-card p-4 rounded-xl flex items-center justify-between group hover:border-white/20 transition-all cursor-pointer border border-white/10 bg-black/20"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg flex shrink-0 items-center justify-center bg-zinc-800 text-zinc-500 group-hover:text-white group-hover:bg-zinc-700 transition-colors">
                    <Icons.Terminal className="w-5 h-5" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors truncate">{host.name}</h3>
                    <p className="text-zinc-500 text-xs font-mono truncate">{host.details.username}@{host.details.host}</p>
                    {host.group && (
                        <span className="inline-flex items-center rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 mt-1">
                            {host.group}
                        </span>
                    )}
                  </div>
                </div>
                
                <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                                <Icons.More className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#0A0A0A] border-white/10 text-zinc-300">
                             <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 cursor-pointer" onClick={() => { setEditingHost(host); setIsDialogOpen(true); }}>Edit</DropdownMenuItem>
                             <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 cursor-pointer text-red-500 focus:text-red-500" onClick={() => setDeletingHost(host)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </motion.div>
            ))}
            
            {hosts.length === 0 && (
                <div className="col-span-full py-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4">
                        <Icons.Server className="w-8 h-8 text-zinc-600" />
                    </div>
                    <h3 className="text-zinc-300 font-medium mb-1">No hosts found</h3>
                    <p className="text-zinc-500 text-sm">Get started by creating a new connection.</p>
                </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Connection Dialog (Logic Reused) */}
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
              This will permanently delete the host "{deletingHost?.name}".
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
