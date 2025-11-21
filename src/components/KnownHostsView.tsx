import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, ShieldAlert, RefreshCw } from "lucide-react";
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

  return (
    <div className="flex flex-col h-full bg-[#f4f5f7] dark:bg-[#1e1e2e] text-gray-900 dark:text-gray-100 p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ShieldAlert className="h-6 w-6 text-blue-500" />
                    Known Hosts
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Manage trusted SSH server fingerprints (~/.ssh/known_hosts).
                </p>
            </div>
            <Button variant="outline" size="icon" onClick={loadEntries} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg bg-white dark:bg-[#2a2b3d] shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[300px]">Hostnames</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Key Fingerprint (Partial)</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entries.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center h-24 text-gray-500">
                                No entries found or file is empty.
                            </TableCell>
                        </TableRow>
                    ) : (
                        entries.map((entry) => (
                            <TableRow key={entry.line_number}>
                                <TableCell className="font-mono text-xs">{entry.hostnames}</TableCell>
                                <TableCell className="text-xs text-gray-500">{entry.key_type}</TableCell>
                                <TableCell className="font-mono text-xs text-gray-400">{entry.key_preview}</TableCell>
                                <TableCell className="text-right">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                                        onClick={() => handleDelete(entry.line_number, entry.hostnames)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
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
