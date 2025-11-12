import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!termRef.current || xtermRef.current) {
      return;
    }

    const xterm = new Xterm({
      fontFamily: '"JetBrains Mono", Menlo, "DejaVu Sans Mono", Consolas, "Lucida Console", monospace',
      fontSize: 14,
      cursorBlink: true,
      theme: draculaTheme,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());

    xterm.open(termRef.current);
    fitAddon.fit();
    xtermRef.current = xterm;
    xterm.focus();

    let unlistener: (() => void) | null = null;

    listen<TerminalOutputPayload>('terminal-output', (event) => {
      if (event.payload.session_id === sessionId) {
        xterm.write(new Uint8Array(event.payload.data));
      }
    }).then(unlisten => {
      unlistener = unlisten;
    });

    const onDataListener = xterm.onData((data) => {
      invoke('send_terminal_input', { sessionId, data }).catch(console.error);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    if (termRef.current.parentElement) {
      resizeObserver.observe(termRef.current.parentElement);
    }

    return () => {
      if (unlistener) {
        unlistener();
      }
      onDataListener.dispose();
      resizeObserver.disconnect();
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [sessionId]);

  return <div ref={termRef} className="w-full h-full" />;
}
