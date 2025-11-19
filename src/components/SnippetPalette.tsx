import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Snippet } from "./SnippetsView";
import { Button } from "@/components/ui/button";
import { Play, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SnippetPaletteProps {
  sessionId: string;
}

export function SnippetPalette({ sessionId }: SnippetPaletteProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    invoke<Snippet[]>("load_snippets").then(setSnippets).catch(console.error);
  }, []);

  const runSnippet = async (command: string) => {
    // Append \r to execute immediately
    await invoke("send_terminal_input", { sessionId, data: command + "\r" });
  };

  const filtered = snippets.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-[#21222C] border-l border-gray-700 w-64">
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Snippets</h3>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
          <Input 
            className="h-8 pl-8 bg-[#191a21] border-gray-600 text-xs" 
            placeholder="Filter..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filtered.map(s => (
             <div key={s.id} className="flex items-center justify-between p-2 hover:bg-[#343746] rounded group">
               <div className="flex flex-col overflow-hidden">
                 <span className="text-sm text-gray-200 truncate">{s.name}</span>
                 <span className="text-xs text-gray-500 truncate font-mono">{s.command}</span>
               </div>
               <Button 
                 size="icon" 
                 variant="ghost" 
                 className="h-6 w-6 text-green-500 hover:text-green-400 hover:bg-green-500/20"
                 onClick={() => runSnippet(s.command)}
               >
                 <Play className="h-3 w-3" />
               </Button>
             </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
