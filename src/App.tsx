import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Toaster, toast } from 'sonner';
import { ConnectionDetails } from './components/VaultSidebar';
import { DashboardView } from './components/views/DashboardView';
import { HostsView } from "@/components/views/HostsView";
import { KeychainView } from "@/components/views/KeychainView";
import { TerminalView } from "@/components/views/TerminalView";
import { KnownHostsView } from "@/components/views/KnownHostsView";
import { SnippetsView } from "@/components/views/SnippetsView";
import { SettingsModal } from "@/components/SettingsModal";
import { AppSidebar } from './components/AppSidebar';
import { PlaceholderView } from './components/PlaceholderView';
import { Icons } from "@/components/ui/icons";
import { useSettings } from '@/context/SettingsContext';
import { motion, AnimatePresence } from "framer-motion";

// Export this interface so TerminalView can use it
export interface Session {
  id: string;
  host: string;
  name: string;
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [activeNavItem, setActiveNavItem] = useState('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings } = useSettings();

  // Loading Overlay State
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingHost, setConnectingHost] = useState<string>("");

  const handleConnect = async (details: ConnectionDetails, name: string) => {
    setConnectingHost(name);
    setIsConnecting(true);
    
    try {
        const newSessionId = await invoke<string>('connect_ssh', { 
            details, 
            terminalType: settings.terminalEmulation 
        });

        setTimeout(() => {
            const newSession: Session = {
                id: newSessionId,
                host: details.host,
                name,
            };
            setSessions(prev => [...prev, newSession]);
            setActiveSessionId(newSessionId); // Set active session
            setActiveNavItem('terminal'); // Switch view to Terminal
            setIsConnecting(false);
            toast.success(`Connected to ${name}`);
        }, 800);

    } catch (err) {
        setIsConnecting(false);
        toast.error(`Connection failed: ${err}`);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    try {
      await invoke('close_session', { sessionId });
    } catch (error) {
      console.error("Failed to close session:", error);
    } finally {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        // If we have other sessions, switch to the last one, otherwise go to dashboard
        if (remaining.length > 0) {
            setActiveSessionId(remaining[remaining.length - 1].id);
        } else {
            setActiveSessionId(undefined);
            setActiveNavItem('dashboard');
        }
      }
    }
  };

  const renderMainContent = () => {
    switch (activeNavItem) {
      case 'dashboard':
        return <DashboardView onConnect={handleConnect} activeSessions={sessions} onViewChange={setActiveNavItem} />;
      case 'hosts':
        return <HostsView onConnect={handleConnect} />;
      case 'terminal':
        // The Terminal View manages the tabs for all active sessions
        return (
            <TerminalView 
                sessions={sessions} 
                activeSessionId={activeSessionId}
                onSessionChange={setActiveSessionId}
                onCloseSession={handleCloseSession}
                onNewConnection={() => setActiveNavItem('hosts')}
            />
        );
      case 'snippets':
        return <SnippetsView />;
      case 'known-hosts':
        return <KnownHostsView />;
      case 'keys':
        return <KeychainView />;
      case 'history':
        return <PlaceholderView title="History" icon={Icons.Activity} description="View connection logs." />;
      default:
        return <DashboardView onConnect={handleConnect} activeSessions={sessions} onViewChange={setActiveNavItem} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden relative font-sans">
      <AppSidebar 
        activeView={activeNavItem} 
        onViewChange={setActiveNavItem} 
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 relative overflow-hidden bg-[#050505] flex flex-col">
        {/* Decorative gradient - only visible on dashboard/hosts pages mostly */}
        {activeNavItem !== 'terminal' && (
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none z-0" />
        )}

        <AnimatePresence mode="wait">
            <motion.div
                key={activeNavItem}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full w-full z-10"
            >
                {renderMainContent()}
            </motion.div>
        </AnimatePresence>

        {/* Connecting Overlay */}
        <AnimatePresence>
          {isConnecting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-6">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-t-2 border-r-2 border-blue-500/50"
                  />
                  <motion.div
                    animate={{ rotate: -180 }}
                    transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                    className="absolute inset-2 rounded-full border-t-2 border-l-2 border-purple-500/50"
                  />
                  <Icons.Server className="w-8 h-8 text-white" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-medium text-white">Connecting to {connectingHost}...</h3>
                  <p className="text-sm text-zinc-500 font-mono">Establishing secure tunnel</p>
                </div>
                <div className="w-64 h-1 bg-zinc-800 rounded-full overflow-hidden mt-4">
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                    className="h-full w-1/2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <Toaster theme="dark" />
    </div>
  );
}

export default App;
