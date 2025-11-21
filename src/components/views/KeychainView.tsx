import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SshKeyEntry {
  id: string;
  name: string;
  type: string;
  fingerprint: string;
  path?: string;
  created_at: number;
}

export function KeychainView() {
  const [activeTab, setActiveTab] = useState("keys");
  const [keys, setKeys] = useState<SshKeyEntry[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyType, setNewKeyType] = useState("RSA 4096");

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const data = await invoke<SshKeyEntry[]>("load_ssh_keys");
      setKeys(data);
    } catch (err) {
      console.error("Failed to load keys", err);
    }
  };

  const handleGenerateKey = async () => {
    if (!newKeyName) {
        toast.error("Key name is required");
        return;
    }

    // Simulate key generation for UI demo (Real keygen requires deeper rust integration)
    const mockFingerprint = "SHA256:" + Array.from({length: 40}, () => Math.floor(Math.random() * 36).toString(36)).join('');
    
    const newKey: SshKeyEntry = {
        id: crypto.randomUUID(),
        name: newKeyName,
        type: newKeyType,
        fingerprint: mockFingerprint,
        created_at: Math.floor(Date.now() / 1000)
    };

    try {
        await invoke("save_ssh_key", { key: newKey });
        toast.success("New key generated");
        setKeys(prev => [...prev, newKey]);
        setIsDialogOpen(false);
        setNewKeyName("");
    } catch (err) {
        toast.error("Failed to save key");
    }
  };

  const handleImportKey = async () => {
      try {
          const selected = await open({
              multiple: false,
              filters: [{
                  name: 'SSH Key',
                  extensions: ['pem', 'pub', 'key', 'id_rsa', 'id_ed25519']
              }]
          });

          if (selected && typeof selected === 'string') {
              // For now, we just save the path and a mock fingerprint
              // In a real app, we'd parse the key file
              const fileName = selected.split(/[\\/]/).pop() || "Imported Key";
              const mockFingerprint = "SHA256:" + Array.from({length: 40}, () => Math.floor(Math.random() * 36).toString(36)).join('');

              const newKey: SshKeyEntry = {
                  id: crypto.randomUUID(),
                  name: fileName,
                  type: "Imported",
                  fingerprint: mockFingerprint,
                  path: selected,
                  created_at: Math.floor(Date.now() / 1000)
              };

              await invoke("save_ssh_key", { key: newKey });
              setKeys(prev => [...prev, newKey]);
              toast.success("Key imported successfully");
          }
      } catch (err) {
          console.error(err);
          toast.error("Failed to import key");
      }
  };

  const handleDelete = async (id: string) => {
      try {
          await invoke("delete_ssh_key", { id });
          setKeys(prev => prev.filter(k => k.id !== id));
          toast.success("Key deleted");
      } catch (err) {
          toast.error("Failed to delete key");
      }
  }

  const formatTime = (ts: number) => {
      const date = new Date(ts * 1000);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const tabs = [
    { id: "keys", label: "SSH Keys", icon: Icons.Key },
    { id: "identities", label: "Identities", icon: Icons.User },
    { id: "audit", label: "Security Audit", icon: Icons.Shield },
  ];

  // Mock Data for other tabs to populate UI
  const identities = [
    { id: 1, username: "root", label: "Root User", usedIn: "5 hosts" },
    { id: 2, username: "deploy", label: "Deploy Bot", usedIn: "2 hosts" },
  ];

  return (
    <div className="h-full flex flex-col p-8 max-w-6xl mx-auto w-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Keychain & Security</h1>
          <p className="text-muted-foreground text-sm">Manage your digital identities and audit security.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleImportKey}
            className="px-4 py-2 bg-accent hover:bg-accent/80 text-foreground rounded-lg text-sm font-medium transition-colors border border-border flex items-center gap-2"
          >
            <Icons.Upload className="w-4 h-4" />
            Import Key
          </button>
          <button 
            onClick={() => setIsDialogOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Icons.Plus className="w-4 h-4" />
            Generate New Key
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-3 text-sm font-medium flex items-center gap-2 relative transition-colors",
              activeTab === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="active-keychain-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pr-2">
        {activeTab === "keys" && (
          <div className="space-y-4">
            {keys.length === 0 && (
                <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
                    No SSH keys found. Generate or import one.
                </div>
            )}
            {keys.map((key) => (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                key={key.id}
                className="group p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all hover:bg-accent"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary border border-primary/20">
                      <Icons.Key className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-foreground font-medium flex items-center gap-2">
                        {key.name}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground font-mono">
                        <span>{key.type}</span>
                        <span>•</span>
                        <span>{key.fingerprint.substring(0, 24)}...</span>
                        <span>•</span>
                        <span>{formatTime(key.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Copy Fingerprint">
                      <Icons.Copy className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => handleDelete(key.id)}
                        className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete Key"
                    >
                      <Icons.Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Identities Tab (Placeholder UI) */}
        {activeTab === "identities" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {identities.map((identity) => (
              <div
                key={identity.id}
                className="p-4 rounded-xl bg-muted/50 border border-border hover:border-primary/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Icons.User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-foreground font-medium">{identity.label}</h3>
                    <p className="text-sm text-muted-foreground">{identity.username}</p>
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded border border-border">
                    {identity.usedIn}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Security Audit Tab (Placeholder UI) */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20">
                <div className="text-green-500 mb-2">
                  <Icons.Shield className="w-6 h-6" />
                </div>
                <div className="text-2xl font-bold text-foreground mb-1">92%</div>
                <div className="text-sm text-muted-foreground">Security Score</div>
              </div>
              <div className="p-6 rounded-xl bg-muted/50 border border-border">
                <div className="text-muted-foreground mb-2">
                  <Icons.Key className="w-6 h-6" />
                </div>
                <div className="text-2xl font-bold text-foreground mb-1">{keys.length}</div>
                <div className="text-sm text-muted-foreground">Active Keys</div>
              </div>
            </div>
            <div className="p-6 rounded-xl bg-card border border-border">
                <h3 className="text-foreground font-medium mb-2">No issues detected</h3>
                <p className="text-muted-foreground text-sm">Your keys look secure.</p>
            </div>
          </div>
        )}
      </div>

      {/* Generate Key Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground sm:max-w-[400px]">
             <DialogHeader><DialogTitle>Generate SSH Key</DialogTitle></DialogHeader>
             <div className="space-y-4 py-4">
                 <div className="space-y-2">
                     <label className="text-xs text-muted-foreground">Key Name</label>
                     <Input 
                        value={newKeyName} 
                        onChange={(e) => setNewKeyName(e.target.value)} 
                        className="bg-input border-border"
                        placeholder="e.g. Production Server"
                     />
                 </div>
                 <div className="space-y-2">
                     <label className="text-xs text-muted-foreground">Algorithm</label>
                     <Select value={newKeyType} onValueChange={setNewKeyType}>
                        <SelectTrigger className="bg-input border-border">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border text-popover-foreground">
                            <SelectItem value="RSA 4096">RSA 4096</SelectItem>
                            <SelectItem value="ED25519">ED25519</SelectItem>
                        </SelectContent>
                     </Select>
                 </div>
             </div>
             <DialogFooter>
                 <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                 <Button onClick={handleGenerateKey} className="bg-primary text-primary-foreground hover:bg-primary/90">Generate</Button>
             </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
