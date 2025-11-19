import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Search, Plus, Trash2, Edit, Code } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';

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
      id: currentSnippet.id || uuidv4()
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

  const filteredSnippets = snippets.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#282a36] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-[#21222C]">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input 
            placeholder="Search snippets..." 
            className="pl-10 bg-[#191a21] border-gray-700 text-white h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => {
          setCurrentSnippet({ id: '', name: '', command: '' });
          setIsDialogOpen(true);
        }} className="bg-purple-600 hover:bg-purple-700 text-white">
          <Plus className="h-4 w-4 mr-2" /> NEW SNIPPET
        </Button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSnippets.map(snippet => (
            <Card key={snippet.id} className="bg-[#2b2d3b] border-gray-700 text-gray-200 p-4 flex flex-col gap-3 hover:bg-[#343746] transition-colors group">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-purple-400" />
                  <span className="font-semibold">{snippet.name}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                    setCurrentSnippet(snippet);
                    setIsDialogOpen(true);
                  }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => handleDelete(snippet.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="bg-[#191a21] p-2 rounded text-xs font-mono text-gray-400 h-16 overflow-hidden line-clamp-3">
                {snippet.command}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#2b2d3b] border-gray-700 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentSnippet.id ? 'Edit Snippet' : 'New Snippet'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input 
                value={currentSnippet.name} 
                onChange={(e) => setCurrentSnippet({...currentSnippet, name: e.target.value})}
                placeholder="e.g. Update System" 
                className="bg-[#191a21] border-gray-600"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Command</label>
              <Textarea 
                value={currentSnippet.command} 
                onChange={(e) => setCurrentSnippet({...currentSnippet, command: e.target.value})}
                placeholder="sudo apt update && sudo apt upgrade -y" 
                className="bg-[#191a21] border-gray-600 font-mono min-h-[100px]"
              />
              <p className="text-xs text-gray-500">Commands will be pasted into the active terminal.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">Save Snippet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
