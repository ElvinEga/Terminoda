import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, ShieldAlert, RefreshCw, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface KnownHostEntry {
  line_number: number;
  marker: string;
  hostnames: string;
  key_type: string;
  key_preview: string;
}

export function KnownHostsView() {
  const [entries, setEntries] = useState<KnownHostEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<KnownHostEntry[]>("load_known_hosts");
      setEntries(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load known_hosts file");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleDelete = async (lineNum: number, host: string) => {
    try {
        await invoke("delete_known_host_entry", { lineNumber: lineNum });
        toast.success(`Removed ${host} from known_hosts`);
        loadEntries(); // Reload list
    } catch (err) {
        toast.error(`Failed to delete entry: ${err}`);
    }
  };

  const filteredEntries = entries.filter(entry => 
    entry.hostnames.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.key_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background text-muted-foreground overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/95 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                </div>
                <div>
                    <h2 className="text-sm font-medium text-foreground">Known Hosts</h2>
                    <p className="text-xs text-muted-foreground">Manage trusted SSH server fingerprints</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search fingerprints..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-all placeholder:text-muted-foreground"
                    />
                </div>
                <button 
                    onClick={loadEntries} 
                    disabled={isLoading}
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-2">
                <AnimatePresence mode="popLayout">
                    {filteredEntries.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-64 text-muted-foreground"
                        >
                            <ShieldAlert className="w-12 h-12 mb-4 text-muted" />
                            <p>No known hosts found.</p>
                        </motion.div>
                    ) : (
                        filteredEntries.map((entry, i) => (
                            <motion.div
                                key={entry.line_number}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: i * 0.02 }}
                                className="group flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-border transition-all"
                            >
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center border border-border text-muted-foreground font-mono text-xs">
                                        {i + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-sm font-medium text-foreground truncate">{entry.hostnames}</h3>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border border-border font-mono">
                                                {entry.key_type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                                            {entry.key_preview}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDelete(entry.line_number, entry.hostnames)}
                                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    title="Remove from known_hosts"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    </div>
  );
}
