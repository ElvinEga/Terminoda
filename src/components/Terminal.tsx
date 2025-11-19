import { useEffect, useRef } from 'react';
import { useSettings } from "@/context/SettingsContext";
import { Terminal as Xterm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

const draculaTheme = {
  background: '#282a36',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  selectionBackground: '#44475a',
  black: '#000000',
  brightBlack: '#4d4d4d',
  red: '#ff5555',
  brightRed: '#ff6e6e',
  green: '#50fa7b',
  brightGreen: '#69ff94',
  yellow: '#f1fa8c',
  brightYellow: '#ffffa5',
  blue: '#bd93f9',
  brightBlue: '#d6acff',
  magenta: '#ff79c6',
  brightMagenta: '#ff92df',
  cyan: '#8be9fd',
  brightCyan: '#a4ffff',
  white: '#f8f8f2',
  brightWhite: '#ffffff',
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
  const { settings } = useSettings();

  useEffect(() => {
    if (!termRef.current || xtermRef.current) {
      return;
    }

    const xterm = new Xterm({
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      cursorBlink: true,
      theme: draculaTheme,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());

    xterm.open(termRef.current);
    fitAddon.fit();
    xtermRef.current = xterm;
    xterm.focus();

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

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.fontSize = settings.terminalFontSize;
      xtermRef.current.options.fontFamily = settings.terminalFontFamily;
      // Refresh the fit
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent); 
    }
  }, [settings.terminalFontSize, settings.terminalFontFamily]);

  return <div ref={termRef} className="w-full h-full" />;
}
