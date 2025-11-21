import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { History, Trash2, Monitor, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleClear = async () => {
    try {
        await invoke("clear_history");
        setLogs([]);
        toast.success("History cleared");
    } catch (err) {
        toast.error("Failed to clear history");
    }
  };

  const formatTime = (ts: number) => {
      return new Date(ts * 1000).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
      if (status === "Success") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      if (status.includes("Failed")) return <AlertCircle className="h-4 w-4 text-red-500" />;
      return <Monitor className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f5f7] dark:bg-[#1e1e2e] text-gray-900 dark:text-gray-100 p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <History className="h-6 w-6 text-purple-500" />
                    Connection History
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Recent connection attempts and status.
                </p>
            </div>
            <Button variant="outline" onClick={handleClear} disabled={logs.length === 0}>
                <Trash2 className="h-4 w-4 mr-2" /> Clear History
            </Button>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg bg-white dark:bg-[#2a2b3d] shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Host</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center h-24 text-gray-500">
                                No history found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        logs.map((log) => (
                            <TableRow key={log.id}>
                                <TableCell className="text-xs text-gray-500">{formatTime(log.timestamp)}</TableCell>
                                <TableCell className="font-medium">{log.host}</TableCell>
                                <TableCell>{log.username}</TableCell>
                                <TableCell className="flex items-center gap-2">
                                    {getStatusIcon(log.status)}
                                    <span className="text-xs">{log.status}</span>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    </div>
  );
}
