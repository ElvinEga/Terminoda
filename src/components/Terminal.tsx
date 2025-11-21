import { useEffect, useRef, useState } from 'react';
import { useSettings } from "@/context/SettingsContext";
import { Terminal as Xterm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Search, ArrowUp, ArrowDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
  onResize?: (cols: number, rows: number) => void; // Callback for status bar
}

interface TerminalOutputPayload {
  session_id: string;
  data: number[];
}

export function Terminal({ sessionId, onResize }: TerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Xterm | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { settings } = useSettings();
  
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Helper to get theme
  const getTheme = () => {
     if (settings.theme === 'dark') return draculaTheme;
     if (settings.theme === 'light') return lightTheme;
     if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return draculaTheme;
     return lightTheme;
  };

  useEffect(() => {
    if (!termRef.current || xtermRef.current) return;

    const xterm = new Xterm({
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      cursorBlink: true,
      theme: getTheme(),
      allowProposedApi: true,
      allowTransparency: true, // Transparent background for glass effect
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
    
    xterm.focus();

    // Report initial size
    onResize?.(xterm.cols, xterm.rows);

    // Resize Logic
    const handleResize = () => {
        if(fitAddonRef.current) {
            fitAddonRef.current.fit();
            const { rows, cols } = xterm;
            onResize?.(cols, rows); // Update parent
            invoke('resize_terminal', { sessionId, rows, cols }).catch(console.error);
        }
    };

    const resizeListener = xterm.onResize((size) => {
        onResize?.(size.cols, size.rows); // Update parent
        invoke('resize_terminal', { sessionId, rows: size.rows, cols: size.cols }).catch(console.error);
    });

    window.addEventListener('resize', handleResize);
    
    // Delay initial resize to ensure container is ready
    setTimeout(() => handleResize(), 100);

    // Key Handlers (Search)
    xterm.attachCustomKeyEventHandler((event) => {
        if (event.ctrlKey && event.key === 'f' && event.type === 'keydown') {
            setShowSearch(prev => !prev);
            return false; 
        }
        return true;
    });

    // Data Listeners
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

  // Update Settings Effect
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.fontSize = settings.terminalFontSize;
      xtermRef.current.options.fontFamily = settings.terminalFontFamily;
      xtermRef.current.options.theme = getTheme();
      
      // Refit
      if(fitAddonRef.current) fitAddonRef.current.fit();
    }
  }, [settings]);

  // Search Logic
  useEffect(() => {
    if (searchAddonRef.current) {
        if (searchText) {
            searchAddonRef.current.findNext(searchText, {
                decorations: { matchOverviewRuler: '#8be9fd', activeMatchColorOverviewRuler: '#ff79c6' }
            });
        } else {
            searchAddonRef.current.clearDecorations();
        }
    }
  }, [searchText]);

  const findNext = () => searchAddonRef.current?.findNext(searchText);
  const findPrev = () => searchAddonRef.current?.findPrevious(searchText);

  return (
    <div className="w-full h-full relative bg-transparent">
        <div ref={termRef} className="w-full h-full px-2 pt-2" />
        
        {/* Search Overlay */}
        {showSearch && (
            <div className="absolute top-2 right-4 z-20 flex items-center gap-1 bg-[#1e1f29] p-1 rounded-md border border-white/10 shadow-lg">
                <Search className="h-4 w-4 text-zinc-400 ml-2" />
                <Input 
                    autoFocus
                    placeholder="Find..." 
                    className="h-7 w-32 border-none bg-transparent focus-visible:ring-0 text-sm text-white"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.shiftKey ? findPrev() : findNext(); }
                        if (e.key === 'Escape') { setShowSearch(false); xtermRef.current?.focus(); }
                    }}
                />
                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/10" onClick={findPrev}><ArrowUp className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/10" onClick={findNext}><ArrowDown className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-500/20 hover:text-red-400" onClick={() => setShowSearch(false)}><X className="h-3 w-3" /></Button>
            </div>
        )}
    </div>
  );
}
