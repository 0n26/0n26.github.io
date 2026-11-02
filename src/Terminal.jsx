import React, { useState, useEffect, useRef } from 'react';
import { projects, stack, profile } from './data.js';
import './terminal.css';

const BANNER = `0n26 // SYSTEM TERMINAL v1.0 [READY]
Type "help" to see available commands or "projects" to view work.`;

export default function Terminal({ isOpen, onClose, onDriveRobot }) {
  const [history, setHistory] = useState([
    { type: 'output', text: BANNER, tone: 'accent' }
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    const onKeyDown = e => {
      if ((e.key === '`' || e.key === 'ё') && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        onClose(v => !v);
      } else if (e.key === 'Escape' && isOpen) {
        onClose(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const runCommand = raw => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setCmdHistory(prev => [trimmed, ...prev]);
    setHistoryIdx(-1);

    const newEntries = [{ type: 'command', text: trimmed }];
    const cmd = trimmed.toLowerCase();

    switch (cmd) {
      case 'help':
        newEntries.push({
          type: 'output',
          text: `AVAILABLE COMMANDS:
  projects, ls     -- List all portfolio projects
  brik             -- Run Discord bot diagnostic
  bansos           -- Inspect VS Code Language Model API provider
  k2-port          -- Check Factorio Space Age tank port status
  stack            -- Show core developer tech stack
  contact          -- View direct contacts & GitHub
  drive, play      -- Transfer control to robot 0n26 (WASD / arrows)
  clear            -- Clear terminal window
  exit             -- Close terminal`
        });
        break;

      case 'projects':
      case 'ls':
        newEntries.push({
          type: 'output',
          text: projects.map(p => `/${p.number}  ${p.name.padEnd(12)} [${p.type}] -> ${p.url}`).join('\n'),
          tone: 'accent'
        });
        break;

      case 'brik':
        newEntries.push({
          type: 'output',
          text: `[INIT] Connecting to brik core...
[OK] TypeScript & Bun runtime active
[OK] discord.js client initialized
[FEATURE] Modular command handler: 14 modules mounted
[URL] https://github.com/0n26/brik`,
          tone: 'success'
        });
        break;

      case 'bansos':
        newEntries.push({
          type: 'output',
          text: `[INIT] vs-bansos Language Model Chat Provider
[INFO] Intercepting VS Code LanguageModel API
[OK] Custom OpenAI / Copilot chat endpoints registered
[STATUS] Active extension: https://github.com/0n26/vs-bansos`,
          tone: 'success'
        });
        break;

      case 'k2-port':
        newEntries.push({
          type: 'output',
          text: `[FACTORIO 2.0] Space Age & Krastorio 2 port
[PROTOTYPE] Advanced Tank balance + tech bonuses updated
[ASSETS] Original art: Krastorio 2 / Krastorio2Assets
[STATUS] Compatibility mod: https://github.com/0n26/k2-port`,
          tone: 'success'
        });
        break;

      case 'stack':
        newEntries.push({
          type: 'output',
          text: stack.map(s => `${s.number}  ${s.title.padEnd(12)} ${s.text} (${s.tags})`).join('\n')
        });
        break;

      case 'contact':
        newEntries.push({
          type: 'output',
          text: `GitHub:   ${profile.github}
Handle:   ${profile.handle}
Site:     https://0n26.github.io/`,
          tone: 'accent'
        });
        break;

      case 'drive':
      case 'play':
        newEntries.push({
          type: 'output',
          text: `[OVERRIDE] Manual control engaged! Robot 0n26 is now in drive mode.
Use WASD or Arrow keys to walk, Space to jump, Esc to dock.`,
          tone: 'accent'
        });
        onDriveRobot?.();
        break;

      case 'clear':
        setHistory([]);
        return;

      case 'exit':
      case 'quit':
        onClose(false);
        return;

      default:
        newEntries.push({
          type: 'output',
          text: `Command not found: "${trimmed}". Type "help" for a list of available commands.`
        });
        break;
    }

    setHistory(prev => [...prev, ...newEntries]);
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      runCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length && historyIdx + 1 < cmdHistory.length) {
        const next = historyIdx + 1;
        setHistoryIdx(next);
        setInput(cmdHistory[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const next = historyIdx - 1;
        setHistoryIdx(next);
        setInput(cmdHistory[next]);
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setInput('');
      }
    }
  };

  return (
    <div className="terminal-backdrop" onClick={() => onClose(false)} role="dialog" aria-modal="true" aria-label="Терминал 0n26">
      <div className="terminal-window" onClick={e => e.stopPropagation()}>
        <div className="terminal-header">
          <div className="terminal-title">
            <span className="terminal-status-dot" aria-hidden="true" />
            <span>0n26 // SHELL v1.0</span>
          </div>
          <button className="terminal-close" onClick={() => onClose(false)} aria-label="Закрыть терминал">×</button>
        </div>
        <div className="terminal-body" ref={bodyRef}>
          {history.map((row, i) => (
            <div key={i} className={`terminal-row ${row.tone ? `terminal-row-output ${row.tone}` : row.type === 'command' ? 'terminal-row-command' : 'terminal-row-output'}`}>
              {row.type === 'command' ? (
                <>
                  <span className="terminal-row-prompt">0n26@gh-pages:~$ </span>
                  <span>{row.text}</span>
                </>
              ) : (
                row.text
              )}
            </div>
          ))}
        </div>
        <div className="terminal-input-row">
          <span className="terminal-prompt" aria-hidden="true">0n26@gh-pages:~$</span>
          <input
            ref={inputRef}
            className="terminal-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck="false"
            autoComplete="off"
            aria-label="Ввод команды в терминал"
          />
        </div>
      </div>
    </div>
  );
}
