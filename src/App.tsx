import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Terminal } from './components/Terminal';
import { Button } from './components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Session {
  id: string;
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>();

  const createNewSession = async () => {
    try {
      const newSessionId = await invoke<string>('create_new_session');
      console.log('Received new session ID from backend:', newSessionId);

      const newSession = { id: newSessionId };
      setSessions(prevSessions => [...prevSessions, newSession]);
      setActiveTab(newSessionId);
    } catch (error) {
      console.error("Failed to create new session:", error);
    }
  };

  return (
    <main className="flex flex-col h-screen bg-[#21222C] text-white">
      <div className="flex-grow flex flex-col">
        {sessions.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="flex items-center p-2 border-b border-gray-700">
              <TabsList>
                {sessions.map((session) => (
                  <TabsTrigger key={session.id} value={session.id}>
                    Session {session.id.substring(0, 8)}...
                  </TabsTrigger>
                ))}
              </TabsList>
              <Button onClick={createNewSession} className="ml-4">+</Button>
            </div>

            {sessions.map((session) => (
              <TabsContent key={session.id} value={session.id} className="flex-grow">
                <Terminal sessionId={session.id} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h1 className="text-2xl mb-4">Taurius SSH Client</h1>
              <Button onClick={createNewSession} size="lg">Start New Session</Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
