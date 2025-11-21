import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Snippet } from "./SnippetsView";
import { Button } from "@/components/ui/button";
import { Play, Search, MoreHorizontal, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface SnippetPaletteProps {
  sessionId: string;
}

export function SnippetPalette({ sessionId }: SnippetPaletteProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [search, setSearch] = useState("");

  const loadSnippets = () => {
    invoke<Snippet[]>("load_snippets").then(setSnippets).catch(console.error);
  };

  useEffect(() => {
    loadSnippets();
  }, []);

  const runSnippet = async (command: string) => {
    await invoke("send_terminal_input", { sessionId, data: command + "\r" });
  };

  const deleteSnippet = async (id: string) => {
    try {
        await invoke("delete_snippet", { snippetId: id });
        toast.success("Snippet deleted");
        setSnippets(prev => prev.filter(s => s.id !== id));
    } catch (e) {
        toast.error("Failed to delete snippet");
    }
  };

  const filtered = snippets.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-[#21222C] border-l border-gray-700 w-64 shrink-0">
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Snippets</h3>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
          <Input 
            className="h-8 pl-8 bg-[#191a21] border-gray-600 text-xs text-gray-300 placeholder:text-gray-600" 
            placeholder="Filter..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filtered.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-4">No snippets found.</p>
          ) : (
            filtered.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 hover:bg-[#343746] rounded group border border-transparent hover:border-gray-700">
                <div className="flex flex-col overflow-hidden mr-2">
                    <span className="text-sm text-gray-200 truncate">{s.name}</span>
                    <span className="text-xs text-gray-500 truncate font-mono" title={s.command}>{s.command}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 text-green-500 hover:text-green-400 hover:bg-green-500/20"
                        onClick={() => runSnippet(s.command)}
                        title="Run"
                    >
                        <Play className="h-3 w-3" />
                    </Button>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-gray-500 hover:text-white hover:bg-gray-600"
                            >
                                <MoreHorizontal className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem 
                                className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                                onClick={() => deleteSnippet(s.id)}
                            >
                                <Trash2 className="mr-2 h-3 w-3" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
