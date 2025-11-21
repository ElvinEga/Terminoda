import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Icons } from "@/components/ui/icons"
import { motion } from "framer-motion"
import { SavedHost, ConnectionDetails } from '../VaultSidebar';
import { Session } from '../../App';
import { ConnectionDialog } from '../ConnectionDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface DashboardViewProps {
  onConnect: (details: ConnectionDetails, name: string) => void
  onViewChange?: (view: string) => void
  activeSessions: Session[]
}

interface ConnectionLog {
  id: string;
  host: string;
  username: string;
  timestamp: number;
  status: string;
}

export function DashboardView({ onConnect, onViewChange, activeSessions }: DashboardViewProps) {
  const [hosts, setHosts] = useState<SavedHost[]>([]);
  const [recentConnections, setRecentConnections] = useState<ConnectionLog[]>([]);
  const [snippetCount, setSnippetCount] = useState(0);
  const [keyCount, setKeyCount] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<SavedHost | null>(null);
  const [deletingHost, setDeletingHost] = useState<SavedHost | null>(null);
  
  // Load Data from Backend
  useEffect(() => {
      invoke<SavedHost[]>("load_saved_hosts").then(setHosts).catch(console.error);
      invoke<ConnectionLog[]>("load_history").then(data => {
          // Sort by timestamp desc
          const sorted = data.sort((a, b) => b.timestamp - a.timestamp);
          
          // Deduplicate by host + username
          const uniqueMap = new Map<string, ConnectionLog>();
          sorted.forEach(log => {
              const key = `${log.host}:${log.username}`;
              if (!uniqueMap.has(key)) {
                  uniqueMap.set(key, log);
              }
          });
          
          // Take top 4 unique connections
          setRecentConnections(Array.from(uniqueMap.values()).slice(0, 4));
      }).catch(console.error);
      invoke<any[]>("load_snippets").then(data => setSnippetCount(data.length)).catch(console.error);
      invoke<any[]>("load_ssh_keys").then(data => setKeyCount(data.length)).catch(console.error);
  }, []);

  const handleSave = (savedHost: SavedHost, isEditing: boolean) => {
    if (isEditing) {
      setHosts(prev => prev.map(h => h.id === savedHost.id ? savedHost : h));
    } else {
      setHosts(prev => [...prev, savedHost]);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const isHostActive = (hostName: string) => {
    return activeSessions.some(session => session.name === hostName);
  };

  const handleRecentClick = (conn: ConnectionLog) => {
      // Find if we have a saved host for this connection to get full details
      const savedHost = hosts.find(h => h.details.host === conn.host && h.details.username === conn.username);
      
      if (savedHost) {
          onConnect(savedHost.details, savedHost.name);
      } else {
          // Fallback if not saved
          onConnect({
              host: conn.host,
              username: conn.username,
              port: 22
          }, conn.host);
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
    { label: "Active Sessions", value: activeSessions.length.toString(), icon: Icons.Activity },
    { label: "Total Hosts", value: hosts.length.toString(), icon: Icons.Server },
    { label: "Snippets", value: snippetCount.toString(), icon: Icons.Command },
    { label: "Keys", value: keyCount.toString(), icon: Icons.Key },
  ];

  return (
    <div className="p-8 h-full overflow-y-auto bg-background text-foreground">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back, Developer</h1>
            <p className="text-muted-foreground">Here's what's happening with your infrastructure.</p>
          </div>
          <button
            onClick={() => { setEditingHost(null); setIsDialogOpen(true); }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Icons.Plus className="w-4 h-4" />
            New Connection
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          {quickStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border p-4 rounded-xl flex flex-col gap-2 hover:bg-accent transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm font-medium">{stat.label}</span>
                <stat.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <span className="text-2xl font-bold text-foreground">{stat.value}</span>
            </motion.div>
          ))}
        </div>

        {/* Recent Connections */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Connections</h2>
            <button 
                onClick={() => onViewChange?.('hosts')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                View all
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentConnections.map((conn, i) => {
              // Try to find a matching saved host to get a better name if possible
              const savedHost = hosts.find(h => h.details.host === conn.host && h.details.username === conn.username);
              const displayName = savedHost ? savedHost.name : conn.host;
              const displayIp = conn.host;
              const isActive = isHostActive(displayName);

              return (
                <motion.div
                  key={i}
                  onClick={() => handleRecentClick(conn)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="bg-card p-4 rounded-xl flex items-center justify-between group hover:border-primary transition-all cursor-pointer border border-border"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className={`w-10 h-10 rounded-lg flex shrink-0 items-center justify-center transition-all ${
                      isActive ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icons.Terminal className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="text-foreground font-medium truncate">{displayName}</h3>
                      <p className="text-muted-foreground text-xs font-mono truncate">{conn.username}@{displayIp}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatTimeAgo(conn.timestamp)}</span>
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

            {/* Saved Hosts List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Hosts</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hosts.map((host, i) => (
              <motion.div
                key={host.id}
                onClick={() => onConnect(host.details, host.name)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="bg-card p-4 rounded-xl flex items-center justify-between group hover:border-primary transition-all cursor-pointer border border-border"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg flex shrink-0 items-center justify-center bg-muted text-muted-foreground group-hover:text-primary-foreground group-hover:bg-primary transition-colors">
                    <Icons.Terminal className="w-5 h-5" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="text-foreground font-medium group-hover:text-primary transition-colors truncate">{host.name}</h3>
                    <p className="text-muted-foreground text-xs font-mono truncate">{host.details.username}@{host.details.host}</p>
                    {host.group && (
                        <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground mt-1">
                            {host.group}
                        </span>
                    )}
                  </div>
                </div>
                
                <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                                <Icons.More className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground">
                             <DropdownMenuItem className="hover:bg-accent focus:bg-accent cursor-pointer" onClick={() => { setEditingHost(host); setIsDialogOpen(true); }}>Edit</DropdownMenuItem>
                             <DropdownMenuItem className="hover:bg-accent focus:bg-accent cursor-pointer text-destructive focus:text-destructive" onClick={() => setDeletingHost(host)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </motion.div>
            ))}
            
            {hosts.length === 0 && (
                <div className="col-span-full py-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <Icons.Server className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-foreground font-medium mb-1">No hosts found</h3>
                    <p className="text-muted-foreground text-sm">Get started by creating a new connection.</p>
                </div>
            )}
          </div>
        </div>

        {/* Security Audit & Port Forwarding */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Security Audit */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card p-6 rounded-xl border border-border"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Icons.Shield className="w-5 h-5" />
              </div>
              <h3 className="text-foreground font-semibold">Security Audit</h3>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              3 keys are older than 90 days. Consider rotating your SSH keys for better security.
            </p>
            <button 
                onClick={() => onViewChange?.('keys')}
                className="px-4 py-2 bg-muted hover:bg-accent text-foreground rounded-lg text-sm font-medium transition-colors border border-border"
            >
              Review Keys
            </button>
          </motion.div>

          {/* Port Forwarding */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-card p-6 rounded-xl border border-border"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Icons.Activity className="w-5 h-5" />
              </div>
              <h3 className="text-foreground font-semibold">Port Forwarding</h3>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm">Active Tunnels</span>
              <span className="text-foreground font-bold">2</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: '65%' }} />
            </div>
          </motion.div>
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
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete the host "{deletingHost?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
