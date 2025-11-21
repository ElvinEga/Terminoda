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
  foreground: '#2e3440',
  cursor: '#2e3440',
  selectionBackground: '#d8dee9',
  cursorAccent: '#ffffff',
  black: '#3b4252',
  red: '#bf616a',
  green: '#a3be8c',
  yellow: '#ebcb8b',
  blue: '#81a1c1',
  magenta: '#b48ead',
  cyan: '#88c0d0',
  white: '#e5e9f0',
  brightBlack: '#4c566a',
  brightRed: '#bf616a',
  brightGreen: '#a3be8c',
  brightYellow: '#ebcb8b',
  brightBlue: '#81a1c1',
  brightMagenta: '#b48ead',
  brightCyan: '#8fbcbb',
  brightWhite: '#eceff4',
};

interface TerminalProps {
  sessionId: string;
}

interface TerminalOutputPayload {
  session_id: string;
  data: number[];
}

export function Terminal({ sessionId }: TerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Xterm | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const { settings } = useSettings();
  
  // Search State
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");

  const getTheme = () => {
     if (settings.theme === 'dark') return draculaTheme;
     if (settings.theme === 'light') return lightTheme;
     
     if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
         return draculaTheme;
     }
     return lightTheme;
  };

  useEffect(() => {
    if (!termRef.current || xtermRef.current) {
      return;
    }

    const xterm = new Xterm({
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      cursorBlink: true,
      theme: getTheme(),
      allowProposedApi: true,
      bellStyle: settings.bellSound ? 'sound' : 'none',
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());
    xterm.loadAddon(searchAddon);

    xterm.open(termRef.current);
    fitAddon.fit();
    
    xtermRef.current = xterm;
    searchAddonRef.current = searchAddon;
    
    xterm.focus();

    // Custom Key Handling for Ctrl+F
    xterm.attachCustomKeyEventHandler((event) => {
        if (event.ctrlKey && event.key === 'f' && event.type === 'keydown') {
            setShowSearch(prev => !prev);
            return false; // Prevent default to handle internally
        }
        return true;
    });

    const sendResize = (rows: number, cols: number) => {
      invoke('resize_terminal', { sessionId, rows, cols }).catch(console.error);
    };

    sendResize(xterm.rows, xterm.cols);

    let unlistener: (() => void) | null = null;
    let isActive = true;

    const setupListener = async () => {
      try {
        unlistener = await listen<TerminalOutputPayload>('terminal-output', (event) => {
          if (isActive && event.payload.session_id === sessionId && xtermRef.current) {
            try {
              xtermRef.current.write(new Uint8Array(event.payload.data));
            } catch (error) {
              console.error('Error writing to terminal:', error);
            }
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

    const resizeListener = xterm.onResize((size) => {
      sendResize(size.rows, size.cols);
    });

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon && termRef.current) {
        fitAddon.fit();
      }
    });
    if (termRef.current.parentElement) {
      resizeObserver.observe(termRef.current.parentElement);
    }

    return () => {
      isActive = false;
      if (unlistener) {
        unlistener();
      }
      resizeListener.dispose();
      onDataListener.dispose();
      resizeObserver.disconnect();
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [sessionId]);

  // Update settings dynamically
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.fontSize = settings.terminalFontSize;
      xtermRef.current.options.fontFamily = settings.terminalFontFamily;
      xtermRef.current.options.bellStyle = settings.bellSound ? 'sound' : 'none';
      xtermRef.current.options.theme = getTheme();
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent); 
    }
  }, [settings.terminalFontSize, settings.terminalFontFamily, settings.bellSound, settings.theme]);

  // Handle Search Logic
  useEffect(() => {
    if (searchAddonRef.current) {
        if (searchText) {
            searchAddonRef.current.findNext(searchText, {
                decorations: {
                    matchOverviewRuler: '#8be9fd',
                    activeMatchColorOverviewRuler: '#ff79c6'
                }
            });
        } else {
            searchAddonRef.current.clearDecorations();
        }
    }
  }, [searchText]);

  const findNext = () => searchAddonRef.current?.findNext(searchText);
  const findPrev = () => searchAddonRef.current?.findPrevious(searchText);

  return (
    <div ref={termRef} className="w-full h-full relative">
        {showSearch && (
            <div className="absolute top-2 right-16 z-20 flex items-center gap-1 bg-[#1e1f29] p-1 rounded-md border border-gray-600 shadow-lg animate-in fade-in slide-in-from-top-2">
                <Search className="h-4 w-4 text-gray-400 ml-2" />
                <Input 
                    autoFocus
                    placeholder="Find..." 
                    className="h-7 w-32 border-none bg-transparent focus-visible:ring-0 text-sm"
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
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={findPrev}>
                    <ArrowUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={findNext}>
                    <ArrowDown className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-500/20 hover:text-red-400" onClick={() => {
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
  );
}
