import { useEffect, useRef, useState } from 'react';
import { useSettings } from "@/context/SettingsContext";
import { Terminal as Xterm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Search, ArrowUp, ArrowDown, X, Box } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Theme definitions
const draculaTheme = {
  background: '#282a36',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  selectionBackground: '#44475a',
  cursorAccent: '#282a36', 
  black: '#21222c',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
};

const lightTheme = {
  background: '#ffffff',
  foreground: '#333333',
  cursor: '#333333',
  selectionBackground: '#e5e5e5',
  cursorAccent: '#ffffff',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#14ce14',
  brightYellow: '#b5ba00',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

interface TerminalProps {
  sessionId: string;
  host: string;
  name: string;
}

interface TerminalOutputPayload {
  session_id: string;
  data: number[];
}

export function Terminal({ sessionId, host, name }: TerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Xterm | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { settings } = useSettings();
  
  // UI State
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  
  // Status Bar State
  const [dimensions, setDimensions] = useState({ rows: 0, cols: 0 });
  const [isConnected] = useState(true);

  useEffect(() => {
    if (!termRef.current || xtermRef.current) {
      return;
    }

    const xterm = new Xterm({
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      cursorBlink: true,
      theme: settings.theme === 'light' ? lightTheme : draculaTheme,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());
    xterm.loadAddon(searchAddon);

    xterm.open(termRef.current);
    fitAddon.fit();
    
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;
    
    // Initial Dimensions
    setDimensions({ rows: xterm.rows, cols: xterm.cols });
    
    xterm.focus();

    // --- Resize Logic ---
    const handleResize = () => {
        if(fitAddonRef.current) {
            fitAddonRef.current.fit();
            const { rows, cols } = xterm;
            invoke('resize_terminal', { sessionId, rows, cols })
                .then(() => setDimensions({ rows, cols }))
                .catch(console.error);
        }
    };

    const resizeListener = xterm.onResize((size) => {
        setDimensions({ rows: size.rows, cols: size.cols });
        invoke('resize_terminal', { sessionId, rows: size.rows, cols: size.cols }).catch(console.error);
    });

    window.addEventListener('resize', handleResize);
    // --------------------

    // --- Key Handlers (Search) ---
    xterm.attachCustomKeyEventHandler((event) => {
        if (event.ctrlKey && event.key === 'f' && event.type === 'keydown') {
            setShowSearch(prev => !prev);
            return false; 
        }
        return true;
    });

    // --- Data Listener ---
    let unlistener: (() => void) | null = null;
    let isActive = true;

    const setupListener = async () => {
      try {
        unlistener = await listen<TerminalOutputPayload>('terminal-output', (event) => {
          if (isActive && event.payload.session_id === sessionId && xtermRef.current) {
            xtermRef.current.write(new Uint8Array(event.payload.data));
          }
        });
      } catch (error) {
        console.error('Error setting up terminal listener:', error);
      }
    };
    setupListener();

    const onDataListener = xterm.onData((data) => {
      invoke('send_terminal_input', { sessionId, data }).catch(console.error);
    });

    return () => {
      isActive = false;
      if (unlistener) unlistener();
      resizeListener.dispose();
      onDataListener.dispose();
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [sessionId]);

  // Update settings when they change
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.fontFamily = settings.terminalFontFamily;
      xtermRef.current.options.fontSize = settings.terminalFontSize;
      xtermRef.current.options.theme = settings.theme === 'light' ? lightTheme : draculaTheme;
    }
  }, [settings]);

  // Search effect
  useEffect(() => {
    if (showSearch && searchText) {
      searchAddonRef.current?.findNext(searchText);
    } else {
      searchAddonRef.current?.clearDecorations();
    }
  }, [searchText, showSearch]);

  const findNext = () => searchAddonRef.current?.findNext(searchText);
  const findPrev = () => searchAddonRef.current?.findPrevious(searchText);

  return (
    <div className="flex flex-col h-full w-full">
        {/* Terminal Area */}
        <div className="flex-grow relative w-full overflow-hidden bg-[#282a36] dark:bg-[#282a36]">
            <div ref={termRef} className="w-full h-full px-1" />
            
            {/* Search Bar Overlay */}
            {showSearch && (
                <div className="absolute top-2 right-4 z-20 flex items-center gap-1 bg-[#1e1f29] p-1 rounded-md border border-gray-600 shadow-lg">
                    <Search className="h-4 w-4 text-gray-400 ml-2" />
                    <Input 
                        autoFocus
                        placeholder="Find..." 
                        className="h-7 w-32 border-none bg-transparent focus-visible:ring-0 text-sm text-gray-200 placeholder:text-gray-600"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (e.shiftKey) findPrev();
                                else findNext();
                            }
                            if (e.key === 'Escape') {
                                setShowSearch(false);
                                xtermRef.current?.focus();
                            }
                        }}
                    />
                    <div className="h-4 w-px bg-gray-600 mx-1" />
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-300" onClick={findPrev}>
                        <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-300" onClick={findNext}>
                        <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-500/20 hover:text-red-400 text-gray-300" onClick={() => {
                        setShowSearch(false);
                        setSearchText("");
                        searchAddonRef.current?.clearDecorations();
                        xtermRef.current?.focus();
                    }}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </div>

        {/* Status Bar */}
        <div className="h-8 bg-black border-t border-white/10 flex items-center justify-between px-4 text-[10px] text-zinc-500 font-mono select-none shrink-0">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isConnected ? "bg-green-500" : "bg-red-500")} />
                    <span className={isConnected ? "text-zinc-300" : "text-red-400"}>
                        {isConnected ? "SSH-2.0" : "Disconnected"}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                    <Box className="h-3 w-3" />
                    <span>{name}</span>
                    <span className="text-zinc-600">({host})</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <span>UTF-8</span>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 border border-zinc-700 rounded-[1px] flex items-center justify-center">
                         <div className="w-1 h-1 bg-zinc-500 rounded-full" />
                    </div>
                    {dimensions.cols}x{dimensions.rows}
                </div>
            </div>
        </div>
    </div>
  );
}
