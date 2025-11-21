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
    <div className="flex flex-col h-full bg-[#050505] text-zinc-400 overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/20 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <ShieldAlert className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                    <h2 className="text-sm font-medium text-white">Known Hosts</h2>
                    <p className="text-xs text-zinc-500">Manage trusted SSH server fingerprints</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search fingerprints..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all placeholder:text-zinc-600"
                    />
                </div>
                <button 
                    onClick={loadEntries} 
                    disabled={isLoading}
                    className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
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
                            className="flex flex-col items-center justify-center h-64 text-zinc-500"
                        >
                            <ShieldAlert className="w-12 h-12 mb-4 text-zinc-800" />
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
                                className="group flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all"
                            >
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className="w-10 h-10 rounded-lg bg-zinc-900/50 flex items-center justify-center border border-white/5 text-zinc-500 font-mono text-xs">
                                        {i + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-sm font-medium text-white truncate">{entry.hostnames}</h3>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-zinc-500 border border-white/5 font-mono">
                                                {entry.key_type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-600 font-mono truncate max-w-md">
                                            {entry.key_preview}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDelete(entry.line_number, entry.hostnames)}
                                    className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
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
