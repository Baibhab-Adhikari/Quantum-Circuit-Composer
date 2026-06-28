'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { nightOwl } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeViewerProps {
  code: string;
  language?: string;
  title?: string;
}

export function CodeViewer({ code, language = 'python', title }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="rounded-md border border-border/50 overflow-hidden bg-[#1e1e1e] group relative">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c]">
        <span className="text-xs font-mono text-[#cccccc]">{title || language}</span>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 px-2 text-xs text-[#cccccc] hover:text-white hover:bg-[#3c3c3c] transition-colors"
          onClick={handleCopy}
        >
          {copied ? (
            <span className="flex items-center gap-1 text-green-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Copied
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy
            </span>
          )}
        </Button>
      </div>
      <div className="overflow-x-auto text-xs font-mono leading-relaxed m-0">
        <SyntaxHighlighter 
          language={language} 
          style={nightOwl} 
          customStyle={{ margin: 0, padding: '0.75rem', background: 'transparent' }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
