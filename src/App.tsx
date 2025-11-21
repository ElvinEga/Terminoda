import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Toaster } from "@/components/ui/sonner";
import { Terminal } from "./components/Terminal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./components/AppSidebar";
import { ConnectionDetails } from "./components/VaultSidebar";
import { DashboardView } from "./components/views/DashboardView";
import { SettingsModal } from "./components/SettingsModal";
import { SnippetsView } from "./components/SnippetsView";
import { SnippetPalette } from "./components/SnippetPalette";
import { KnownHostsView } from "./components/KnownHostsView";
import { HistoryView } from "./components/HistoryView";
import { X, PanelRight } from "lucide-react";

interface Session {
  id: string;
  name: string;
  host: string;
  type: 'ssh';
}

function App() {
  const [activeNavItem, setActiveNavItem] = useState("dashboard");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);

  const handleConnect = async (details: ConnectionDetails, name?: string) => {
    try {
        const sessionId = await invoke<string>('connect_ssh', {
            host: details.host,
            port: typeof details.port === 'string' ? parseInt(details.port) : details.port,
            username: details.username,
            password: details.password || null,
            privateKeyPath: details.private_key_path || null,
        });
        
        const newSession: Session = {
            id: sessionId,
            name: name || details.host,
            host: details.host,
            type: 'ssh'
        };
        
        setSessions(prev => [...prev, newSession]);
        setActiveTab(sessionId);
        setActiveNavItem('terminal'); // Switch to terminal view
    } catch (error) {
        console.error('Connection failed:', error);
        // In a real app, show a toast notification here
    }
  };

  const closeSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
        await invoke('close_session', { sessionId });
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (activeTab === sessionId) {
            setActiveTab(sessions.find(s => s.id !== sessionId)?.id);
        }
    } catch (error) {
        console.error('Failed to close session:', error);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-black text-foreground overflow-hidden relative font-sans">
      {/* Use the NEW Sidebar */}
      <AppSidebar 
        activeView={activeNavItem} 
        onViewChange={(view) => {
            setActiveNavItem(view);
            setActiveTab(undefined);
        }} 
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 relative overflow-hidden bg-[#050505] flex flex-col">
        {/* Decorative gradient from new design */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none z-0" />
        
        {/* Existing Tab/Content logic wrapped in a z-indexed div */}
        <div className="flex-1 z-10 relative flex flex-col h-full">
          {activeNavItem === 'dashboard' && !activeTab && (
             <DashboardView onConnect={handleConnect} />
          )}

          {activeNavItem === 'hosts' && !activeTab && (
             <DashboardView onConnect={handleConnect} />
          )}

          {activeNavItem === 'snippets' && !activeTab && (
             <SnippetsView />
          )}

          {activeNavItem === 'known-hosts' && !activeTab && (
             <KnownHostsView />
          )}

          {activeNavItem === 'history' && !activeTab && (
             <HistoryView />
          )}

          {/* Terminal Tabs */}
          {sessions.length > 0 && (activeNavItem === 'terminal' || activeTab) && (
             <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
                <div className="bg-[#0A0A0A] border-b border-white/10 px-2 flex items-center gap-2 h-10 shrink-0">
                  <TabsList className="bg-transparent p-0 h-full gap-1">
                    {sessions.map(session => (
                        <TabsTrigger 
                          key={session.id} 
                          value={session.id}
                          className="group relative data-[state=active]:bg-[#1A1A1A] data-[state=active]:text-white text-zinc-500 hover:text-zinc-300 h-8 px-3 text-xs font-medium rounded-t-md border-t border-x border-transparent data-[state=active]:border-white/10 flex items-center gap-2 transition-all select-none data-[state=active]:shadow-sm"
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-zinc-700 group-data-[state=active]:bg-green-500/50 transition-colors" />
                                {session.name}
                            </div>
                            <div 
                                role="button"
                                className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5 text-zinc-500 hover:text-zinc-300 transition-all"
                                onClick={(e) => closeSession(e, session.id)}
                            >
                                <X className="h-3 w-3" />
                            </div>
                        </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                
                {sessions.map(session => (
                    <TabsContent key={session.id} value={session.id} className="flex-grow p-0 m-0 mt-0 relative flex flex-col data-[state=inactive]:hidden h-full">
                        <div className="flex-grow relative flex overflow-hidden h-full">
                            <Terminal 
                                sessionId={session.id} 
                                host={session.host}
                                name={session.name}
                            />
                            
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-2 right-4 z-10 bg-black/20 hover:bg-black/40 text-white/50 hover:text-white"
                                onClick={() => setShowSnippets(!showSnippets)}
                            >
                                <PanelRight className="h-4 w-4" />
                            </Button>

                            {showSnippets && (
                                <SnippetPalette sessionId={session.id} />
                            )}
                        </div>
                    </TabsContent>
                ))}
             </Tabs>
          )}
        </div>
      </main>
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <Toaster theme="dark" />
    </div>
  );
}

export default App;
