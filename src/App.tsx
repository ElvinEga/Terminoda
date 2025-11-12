import { useState } from 'react';
import { Terminal } from './components/Terminal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectionDialog } from './components/ConnectionDialog';

interface Session {
  id: string;
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>();

  const handleNewConnection = (sessionId: string) => {
    console.log('Successfully connected. New session ID:', sessionId);
    const newSession = { id: sessionId };
    setSessions(prevSessions => [...prevSessions, newSession]);
    setActiveTab(sessionId);
  };

  return (
    <main className="flex flex-col h-screen bg-[#21222C] text-white">
      <div className="flex-grow flex flex-col">
        {sessions.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="flex items-center p-2 border-b border-gray-700 bg-[#282a36]">
              <TabsList>
                {sessions.map((session) => (
                  <TabsTrigger key={session.id} value={session.id}>
                    Session {session.id.substring(0, 8)}...
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="ml-4">
                <ConnectionDialog onConnect={handleNewConnection} />
              </div>
            </div>

            {sessions.map((session) => (
              <TabsContent key={session.id} value={session.id} className="flex-grow p-1">
                <Terminal sessionId={session.id} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-full bg-[#282a36]">
            <div className="text-center">
              <h1 className="text-2xl mb-4">Taurius SSH Client</h1>
              <ConnectionDialog onConnect={handleNewConnection} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
