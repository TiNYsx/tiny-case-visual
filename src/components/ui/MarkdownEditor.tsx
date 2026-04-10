'use client';

import React from 'react';
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, Link, Image, Heading2 } from 'lucide-react';

interface MarkdownToolbarProps {
  onInsert: (prefix: string, suffix?: string) => void;
}

export function MarkdownToolbar({ onInsert }: MarkdownToolbarProps) {
  const tools = [
    { icon: Bold, action: () => onInsert('**', '**'), title: 'Bold' },
    { icon: Italic, action: () => onInsert('*', '*'), title: 'Italic' },
    { icon: Strikethrough, action: () => onInsert('~~', '~~'), title: 'Strikethrough' },
    { icon: Code, action: () => onInsert('`', '`'), title: 'Code' },
    { icon: Heading2, action: () => onInsert('## ', ''), title: 'Heading' },
    { icon: List, action: () => onInsert('- ', ''), title: 'Bullet List' },
    { icon: ListOrdered, action: () => onInsert('1. ', ''), title: 'Numbered List' },
    { icon: Link, action: () => onInsert('[', '](url)'), title: 'Link' },
    { icon: Image, action: () => onInsert('![alt](', ')'), title: 'Image' },
  ];

  return (
    <div className="flex items-center gap-1 p-2 border-b border-border bg-bg-secondary rounded-t-xl">
      {tools.map((tool, i) => (
        <button
          key={i}
          type="button"
          onClick={tool.action}
          title={tool.title}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
        >
          <tool.icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function MarkdownEditor({ value, onChange, placeholder, rows = 3 }: MarkdownEditorProps) {
  const handleInsert = (prefix: string, suffix: string = '') => {
    const textarea = document.querySelector(`[data-markdown-editor="${placeholder}"]`) as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  return (
    <div className="glass-input rounded-xl overflow-hidden">
      <MarkdownToolbar onInsert={handleInsert} />
      <textarea
        data-markdown-editor={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none resize-none"
      />
    </div>
  );
}