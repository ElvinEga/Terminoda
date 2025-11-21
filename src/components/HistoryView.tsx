import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icons } from "@/components/ui/icons";
import { toast } from "sonner";

interface ConnectionLog {
  id: string;
  host: string;
  username: string;
  timestamp: number;
  status: string;
}

export function HistoryView() {
  const [logs, setLogs] = useState<ConnectionLog[]>([]);

  const loadHistory = async () => {
    try {
      const data = await invoke<ConnectionLog[]>("load_history");
      setLogs(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { loadHistory(); }, []);

  const handleClear = async () => {
    try {
        await invoke("clear_history");
        setLogs([]);
        toast.success("History cleared");
    } catch (err) { toast.error("Failed"); }
  };

  const formatTime = (ts: number) => new Date(ts * 1000).toLocaleString();

  return (
    <div className="flex flex-col h-full bg-[#050505] p-8 text-zinc-200">
        <div className="flex justify-between items-center mb-8 max-w-6xl mx-auto w-full">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
                    <Icons.Activity className="h-6 w-6 text-purple-500" />
                    Connection History
                </h2>
                <p className="text-sm text-zinc-500">Recent access logs.</p>
            </div>
            <button 
                onClick={handleClear} 
                disabled={logs.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
                <Icons.Trash className="h-4 w-4" /> Clear
            </button>
        </div>

        <div className="flex-1 overflow-auto max-w-6xl mx-auto w-full">
            <div className="border border-white/10 rounded-xl overflow-hidden bg-[#0A0A0A]">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-zinc-400 font-medium border-b border-white/10">
                        <tr>
                            <th className="p-4">Status</th>
                            <th className="p-4">Host</th>
                            <th className="p-4">User</th>
                            <th className="p-4 text-right">Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-zinc-500">No history recorded.</td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="p-4">
                                        {log.status === "Success" ? (
                                            <span className="inline-flex items-center gap-2 text-green-400 text-xs bg-green-400/10 px-2 py-1 rounded-full border border-green-400/20">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-400" /> Success
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-2 text-red-400 text-xs bg-red-400/10 px-2 py-1 rounded-full border border-red-400/20">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-400" /> {log.status}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-white font-medium">{log.host}</td>
                                    <td className="p-4 text-zinc-400 font-mono text-xs">{log.username}</td>
                                    <td className="p-4 text-right text-zinc-500 text-xs">{formatTime(log.timestamp)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
}
