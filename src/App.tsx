import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Toaster, toast } from 'sonner';
import { Terminal as TerminalComponent } from './components/Terminal';
import { SftpBrowser } from './components/SftpBrowser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sidebar, ConnectionDetails } from './components/VaultSidebar';
import { Dashboard } from './components/Dashboard';
import { SettingsModal } from './components/SettingsModal';
import { SnippetsView } from './components/SnippetsView';
import { SnippetPalette } from './components/SnippetPalette';
import { X, Terminal, Files, PanelRight } from 'lucide-react';

interface Session {
  id: string;
  host: string;
  name: string;
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>();
  const [activeNavItem, setActiveNavItem] = useState('hosts');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);

  const handleConnect = async (details: ConnectionDetails, name: string) => {
    console.log('[connect] invoking connect_ssh', details);
    toast.promise(
      invoke<string>('connect_ssh', { details }),
      {
        loading: `Connecting to ${details.host}...`,
        success: (newSessionId) => {
          console.log('[connect] connect_ssh success', newSessionId);
          const newSession: Session = {
            id: newSessionId,
            host: details.host,
            name,
          };
          setSessions(prev => [...prev, newSession]);
          setActiveTab(newSessionId);
          return `Connected to ${name}!`;
        },
        error: (err) => {
          console.error('[connect] connect_ssh failed', err);
          return `Connection failed: ${err}`;
        },
      }
    );
  };

  const handleCloseTab = async (sessionId: string) => {
    try {
      await invoke('close_session', { sessionId });
    } catch (error) {
      console.error("Failed to close session on backend:", error);
      toast.error("Failed to properly close session.");
    } finally {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeTab === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        setActiveTab(remaining.length > 0 ? remaining[0].id : undefined);
      }
    }
  };

  return (
    <main className="flex h-screen bg-[#f4f5f7] dark:bg-[#1e1e2e] text-gray-900 dark:text-gray-100">
      <Sidebar 
        activeItem={activeNavItem} 
        onItemSelect={setActiveNavItem} 
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="flex-grow flex flex-col overflow-hidden">
        {sessions.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="flex items-center border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e1e2e]">
              <TabsList className="h-auto rounded-none bg-transparent p-0 gap-0">
                {/* Home/Dashboard Tab */}
                <div 
                  className={`flex items-center px-4 py-2 cursor-pointer border-r border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#2a2b3d] ${!activeTab ? 'bg-gray-100 dark:bg-[#2a2b3d]' : ''}`}
                  onClick={() => setActiveTab(undefined)}
                >
                   <span className="text-sm font-medium">Dashboard</span>
                </div>

                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center group relative border-r border-gray-200 dark:border-gray-800">
                    <TabsTrigger 
                      value={session.id}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-gray-50 dark:data-[state=active]:bg-[#2a2b3d] pr-8 h-full py-2"
                    >
                      {session.name}
                    </TabsTrigger>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(session.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                      role="button"
                      tabIndex={-1}
                      aria-label={`Close ${session.name}`}
                    >
                      <X className="h-3 w-3" />
                    </div>
                  </div>
                ))}
              </TabsList>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-hidden relative">
               {/* If no active tab (undefined), show Dashboard */}
               <div className={`absolute inset-0 ${activeTab ? 'hidden' : 'block'}`}>
                  {activeNavItem === 'snippets' ? (
                    <SnippetsView />
                  ) : (
                    <Dashboard onConnect={handleConnect} />
                  )}
               </div>

               {/* Session Content */}
               {sessions.map((session) => (
                <TabsContent key={session.id} value={session.id} className="h-full flex-grow p-0 m-0 data-[state=inactive]:hidden">
                  <Tabs defaultValue="terminal" className="h-full flex flex-col">
                    <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e1e2e]">
                      <TabsList className="w-fit bg-transparent rounded-none p-0">
                        <TabsTrigger value="terminal" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 px-4 py-2">
                          <Terminal className="h-4 w-4 mr-2" />
                          Terminal
                        </TabsTrigger>
                        <TabsTrigger value="sftp" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 px-4 py-2">
                          <Files className="h-4 w-4 mr-2" />
                          SFTP
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent value="terminal" className="flex-grow p-0 m-0 mt-0 relative flex">
                      <div className="flex-grow relative">
                        <TerminalComponent sessionId={session.id} />
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute top-2 right-4 z-10 bg-black/20 hover:bg-black/40 text-white/50 hover:text-white"
                          onClick={() => setShowSnippets(!showSnippets)}
                        >
                           <PanelRight className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {showSnippets && (
                         <SnippetPalette sessionId={session.id} />
                      )}
                    </TabsContent>
                    <TabsContent value="sftp" className="flex-grow p-0 m-0">
                      <SftpBrowser sessionId={session.id} />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        ) : (
          activeNavItem === 'snippets' ? (
            <SnippetsView />
          ) : (
            <Dashboard onConnect={handleConnect} />
          )
        )}
      </div>
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <Toaster theme="dark" />
    </main>
  );
}

export default App;
