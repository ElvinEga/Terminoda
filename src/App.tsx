import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Terminal } from './components/Terminal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VaultSidebar, ConnectionDetails } from './components/VaultSidebar';
import { X } from 'lucide-react';

interface Session {
  id: string;
  host: string;
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>();

  const handleConnect = async (details: ConnectionDetails) => {
    try {
      const newSessionId = await invoke<string>('connect_ssh', { details });
      const newSession: Session = {
        id: newSessionId,
        host: details.host,
      };
      setSessions(prev => [...prev, newSession]);
      setActiveTab(newSessionId);
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  const handleCloseTab = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeTab === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      setActiveTab(remaining.length > 0 ? remaining[0].id : undefined);
    }
  };

  return (
    <main className="flex h-screen bg-[#282a36] text-white">
      <VaultSidebar onHostSelect={handleConnect} />

      <div className="flex-grow flex flex-col">
        {sessions.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="flex items-center border-b border-gray-700 bg-[#21222C]">
              <TabsList className="rounded-none bg-transparent">
                {sessions.map((session) => (
                  <TabsTrigger 
                    key={session.id} 
                    value={session.id}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                  >
                    <span className="mr-2">{session.host}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(session.id);
                      }}
                      className="ml-1 hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {sessions.map((session) => (
              <TabsContent key={session.id} value={session.id} className="flex-grow p-0">
                <Terminal sessionId={session.id} />
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
    </main>
  );
}

export default App;
