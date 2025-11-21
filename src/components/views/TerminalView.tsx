import { useState } from "react";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Terminal } from "../Terminal"; // Real Terminal
import { Session } from "../../App"; // We'll export this interface from App.tsx next
import { SftpBrowser } from "../SftpBrowser";
import { SnippetPalette } from "../SnippetPalette";

interface TerminalViewProps {
  sessions: Session[];
  activeSessionId?: string;
  onSessionChange: (id: string) => void;
  onCloseSession: (id: string) => void;
  onNewConnection: () => void; // To trigger dashboard/modal
}

export function TerminalView({ 
    sessions, 
    activeSessionId, 
    onSessionChange, 
    onCloseSession,
    onNewConnection 
}: TerminalViewProps) {
  
  const [terminalDimensions, setTerminalDimensions] = useState({ cols: 80, rows: 24 });
  const [activeMode, setActiveMode] = useState<'terminal' | 'sftp'>('terminal');
  const [showSnippets, setShowSnippets] = useState(false);

  // If no sessions, show placeholder
  if (sessions.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background">
              <Icons.Terminal className="w-16 h-16 mb-4 text-muted" />
              <p>No active connections.</p>
              <button onClick={onNewConnection} className="mt-4 text-primary hover:underline text-sm">
                  Start a new session
              </button>
          </div>
      );
  }

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tab Bar */}
      <div className="flex items-center bg-background border-b border-border px-2 pt-2 gap-1 shrink-0">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSessionChange(session.id)}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs font-medium cursor-pointer transition-colors min-w-[160px] max-w-[200px]",
              activeSessionId === session.id
                ? "bg-background text-foreground border-t border-x border-border relative z-10"
                : "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <span className="truncate flex-1">{session.name}</span>
            <button 
                onClick={(e) => { e.stopPropagation(); onCloseSession(session.id); }}
                className="opacity-0 group-hover:opacity-100 hover:bg-accent rounded p-0.5 transition-opacity"
            >
              <Icons.Close className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button 
            onClick={onNewConnection}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md ml-1 transition-colors"
        >
          <Icons.Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-Toolbar (Terminal / SFTP Switcher) */}
      <div className="h-10 bg-background border-b border-border flex items-center justify-between px-4 shrink-0">
         <div className="flex gap-4 text-xs font-medium">
             <button 
                onClick={() => setActiveMode('terminal')}
                className={cn("flex items-center gap-2 transition-colors", activeMode === 'terminal' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
             >
                 <Icons.Terminal className="w-3.5 h-3.5" /> Terminal
             </button>
             <button 
                onClick={() => setActiveMode('sftp')}
                className={cn("flex items-center gap-2 transition-colors", activeMode === 'sftp' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
             >
                 <Icons.Folder className="w-3.5 h-3.5" /> SFTP
             </button>
         </div>
         {activeMode === 'terminal' && (
             <button 
                onClick={() => setShowSnippets(!showSnippets)}
                className={cn("p-1.5 rounded hover:bg-accent transition-colors", showSnippets ? "text-foreground bg-accent" : "text-muted-foreground")}
             >
                 <Icons.List className="w-4 h-4" />
             </button>
         )}
      </div>

      {/* Content Area - Using hidden instead of unmounting to preserve terminal state */}
      <div className="flex-1 relative overflow-hidden">
        {sessions.map(session => (
            <div 
                key={session.id} 
                className={cn("absolute inset-0 flex w-full h-full", activeSessionId === session.id ? "z-10 visible" : "z-0 invisible")}
            >
                {activeMode === 'terminal' ? (
                     <>
                        <div className="flex-1 relative bg-background">
                             <Terminal 
                                sessionId={session.id} 
                                onResize={(cols, rows) => setTerminalDimensions({ cols, rows })} 
                             />
                        </div>
                        {showSnippets && (
                             <SnippetPalette sessionId={session.id} />
                        )}
                     </>
                ) : (
                     <SftpBrowser sessionId={session.id} />
                )}
            </div>
        ))}
      </div>

      {/* Status Bar */}
      <div className="h-7 bg-background border-t border-border flex items-center justify-between px-4 text-[10px] text-muted-foreground font-mono shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            SSH-2.0-OpenSSH
          </span>
          <span className="text-muted-foreground">{activeSession?.host}</span>
          <span className="text-muted-foreground">UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <span>CPU: 12%</span> {/* Mock Data from design */}
          <span>RAM: 4.2GB</span> {/* Mock Data from design */}
          <span>Ping: 45ms</span> {/* Mock Data from design */}
          <span className="text-muted-foreground">{terminalDimensions.cols}x{terminalDimensions.rows}</span>
        </div>
      </div>
    </div>
  )
}
