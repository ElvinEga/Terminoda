import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Snippet } from "./views/SnippetsView";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
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
    <div className="flex flex-col h-full bg-background/20 border-l border-border w-64 shrink-0">
      <div className="p-3 border-b border-border">
        <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Snippets</h3>
        <div className="relative">
          <Icons.Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input 
            className="h-7 pl-8 bg-accent border-border text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring" 
            placeholder="Search snippets..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No snippets found</p>
          ) : (
            filtered.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 hover:bg-accent rounded-md group border border-transparent hover:border-border transition-all">
                <div className="flex flex-col overflow-hidden mr-2 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate font-mono mt-0.5" title={s.command}>{s.command}</span>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => runSnippet(s.command)}
                        title="Run"
                    >
                        <Icons.ChevronRight className="h-3 w-3" />
                    </Button>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            >
                                <Icons.More className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32 bg-popover border-border text-popover-foreground">
                            <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10 text-xs"
                                onClick={() => deleteSnippet(s.id)}
                            >
                                <Icons.Trash className="mr-2 h-3 w-3" /> Delete
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
