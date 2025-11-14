import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Toaster, toast } from 'sonner';
import { Terminal as TerminalComponent } from './components/Terminal';
import { SftpBrowser } from './components/SftpBrowser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VaultSidebar, ConnectionDetails } from './components/VaultSidebar';
import { X, Terminal, Files } from 'lucide-react';

interface Session {
  id: string;
  host: string;
  name: string;
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>();

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
    <main className="flex h-screen bg-[#282a36] text-white">
      <VaultSidebar onHostSelect={handleConnect} />

      <div className="flex-grow flex flex-col">
        {sessions.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="flex items-center border-b border-gray-700 bg-[#21222C]">
              <TabsList className="h-auto rounded-none bg-transparent p-0 gap-0">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center group relative">
                    <TabsTrigger 
                      value={session.id}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pr-8"
                    >
                      {session.name}
                    </TabsTrigger>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(session.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:text-red-400 opacity-60 hover:opacity-100 cursor-pointer"
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
            {sessions.map((session) => (
              <TabsContent key={session.id} value={session.id} className="flex-grow p-0">
                <Tabs defaultValue="terminal" className="h-full flex flex-col">
                  <TabsList className="w-fit bg-[#21222C] border-b border-gray-700 rounded-none">
                    <TabsTrigger value="terminal" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
                      <Terminal className="h-4 w-4 mr-2" />
                      Terminal
                    </TabsTrigger>
                    <TabsTrigger value="sftp" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
                      <Files className="h-4 w-4 mr-2" />
                      SFTP
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="terminal" className="flex-grow p-0 m-0">
                    <TerminalComponent sessionId={session.id} />
                  </TabsContent>
                  <TabsContent value="sftp" className="flex-grow p-0 m-0">
                    <SftpBrowser sessionId={session.id} />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <h1 className="text-2xl mb-4">Select a host from the Vault to begin</h1>
            </div>
          </div>
        )}
      </div>
      
      <Toaster theme="dark" />
    </main>
  );
}

export default App;
