import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Trash2, Edit, Code, Copy, Terminal } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export interface Snippet {
  id: string;
  name: string;
  command: string;
}

export function SnippetsView() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentSnippet, setCurrentSnippet] = useState<Snippet>({ id: '', name: '', command: '' });

  useEffect(() => {
    loadSnippets();
  }, []);

  const loadSnippets = async () => {
    try {
      const data = await invoke<Snippet[]>("load_snippets");
      setSnippets(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!currentSnippet.name || !currentSnippet.command) {
      toast.error("Name and Command are required");
      return;
    }

    const snippetToSave = {
      ...currentSnippet,
      id: currentSnippet.id || crypto.randomUUID()
    };

    try {
      await invoke("save_snippet", { snippet: snippetToSave });
      toast.success("Snippet saved");
      setIsDialogOpen(false);
      loadSnippets();
    } catch (err) {
      toast.error("Failed to save snippet");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_snippet", { snippetId: id });
      toast.success("Snippet deleted");
      setSnippets(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
  };

  const filteredSnippets = snippets.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background text-muted-foreground overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <Terminal className="h-4 w-4 text-primary" />
            </div>
            <div>
                <h2 className="text-sm font-medium text-foreground">Snippets</h2>
                <p className="text-xs text-muted-foreground">Reusable command templates</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search snippets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-all placeholder:text-muted-foreground"
                />
            </div>
            <button
              onClick={() => {
                setCurrentSnippet({ id: '', name: '', command: '' });
                setIsDialogOpen(true);
              }}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Snippet
            </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
                {filteredSnippets.map((snippet, i) => (
                    <motion.div
                        key={snippet.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: i * 0.02 }}
                        className="group flex flex-col p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center border border-border text-primary">
                                    <Code className="w-4 h-4" />
                                </div>
                                <span className="font-medium text-foreground text-sm truncate max-w-[120px]">{snippet.name}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => copyToClipboard(snippet.command)}
                                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                    title="Copy to clipboard"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                    onClick={() => {
                                        setCurrentSnippet(snippet);
                                        setIsDialogOpen(true);
                                    }}
                                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                    onClick={() => handleDelete(snippet.id)}
                                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="relative mt-auto group/code">
                            <div className="bg-muted border border-border rounded-lg p-2.5 h-20 overflow-hidden font-mono text-xs text-muted-foreground break-all">
                                {snippet.command}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-muted to-transparent pointer-events-none" />
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentSnippet.id ? 'Edit Snippet' : 'New Snippet'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <Input 
                value={currentSnippet.name} 
                onChange={(e) => setCurrentSnippet({...currentSnippet, name: e.target.value})}
                placeholder="e.g. Update System" 
                className="bg-input border-border focus:border-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Command</label>
              <Textarea 
                value={currentSnippet.command} 
                onChange={(e) => setCurrentSnippet({...currentSnippet, command: e.target.value})}
                placeholder="sudo apt update && sudo apt upgrade -y" 
                className="bg-input border-border focus:border-ring font-mono min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">Commands will be pasted into the active terminal.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="hover:bg-accent hover:text-foreground">Cancel</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">Save Snippet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
