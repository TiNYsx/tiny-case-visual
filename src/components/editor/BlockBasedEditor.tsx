import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { createLowlight } from 'lowlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import css from 'highlight.js/lib/languages/css';
import js from 'highlight.js/lib/languages/javascript';
import ts from 'highlight.js/lib/languages/typescript';
import html from 'highlight.js/lib/languages/xml';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table as TableIcon,
  Minus,
  Type,
  ChevronDown,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  FileDown,
  Copy,
  AtSign,
} from 'lucide-react';
import { slashCommands } from '@/lib/editor/slash-commands';
import { CustomMention } from '@/lib/editor/mention-extension';
import { generateMarkdown } from '@/lib/editor/markdown-parser';
import { toast } from 'sonner';

const lowlight = createLowlight();
lowlight.register('html', html);
lowlight.register('css', css);
lowlight.register('js', js);
lowlight.register('ts', ts);

interface Document {
  id: string;
  title: string;
  content: any;
  markdown?: string;
  updatedAt: string;
}

interface BlockBasedEditorProps {
  document?: Document;
  onSave?: (doc: { title: string; content: any; markdown: string }) => Promise<void>;
  mentionItems?: Array<{ id: string; label: string } >;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export default function BlockBasedEditor({
  document,
  onSave,
  mentionItems = [],
}: BlockBasedEditorProps) {
  const [title, setTitle] = useState(document?.title || 'Untitled Document');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionMenuPosition, setMentionMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const mentionMenuRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const filteredSlashCommands = slashQuery
    ? slashCommands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(slashQuery.toLowerCase()) ||
          cmd.description.toLowerCase().includes(slashQuery.toLowerCase())
      )
    : slashCommands;

  const filteredMentions = mentionQuery
    ? mentionItems.filter((item) =>
        item.label.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : mentionItems;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return `Heading ${node.attrs.level}`;
          }
          return "Type '/' for commands or start writing...";
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight,
      Typography,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      CustomMention.configure({
        HTMLAttributes: {
          class: 'mention-tag',
        },
        suggestion: {
          char: '@',
          items: ({ query }: { query: string }) => {
            return mentionItems
              .filter((item) =>
                item.label.toLowerCase().includes(query.toLowerCase())
              )
              .slice(0, 5);
          },
        },
      }),
    ],
    content: document?.content || {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    },
    onUpdate: ({ editor }) => {
      handleContentChange();
      handleSlashMenu(editor);
      handleMentionMenu(editor);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-stone dark:prose-invert prose-headings:font-semibold prose-headings:text-stone-800 prose-p:text-stone-700 prose-li:text-stone-700 max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
      handleKeyDown: (view, event) => {
        if (showSlashMenu) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedSlashIndex((prev) =>
              Math.min(prev + 1, filteredSlashCommands.length - 1)
            );
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedSlashIndex((prev) => Math.max(prev - 1, 0));
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            const cmd = filteredSlashCommands[selectedSlashIndex];
            if (cmd) {
              const { state } = view;
              const { selection } = state;
              const { from, to } = selection;
              const tr = state.tr.deleteRange(from - slashQuery.length - 1, to);
              view.dispatch(tr);
              cmd.command({ editor: view, range: { from: from - slashQuery.length - 1, to } });
              setShowSlashMenu(false);
              setSlashQuery('');
            }
            return true;
          }
          if (event.key === 'Escape') {
            setShowSlashMenu(false);
            setSlashQuery('');
            return true;
          }
          if (event.key === 'Backspace' && slashQuery.length === 0) {
            setShowSlashMenu(false);
            return false;
          }
        }

        if (showMentionMenu) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedMentionIndex((prev) =>
              Math.min(prev + 1, filteredMentions.length - 1)
            );
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedMentionIndex((prev) => Math.max(prev - 1, 0));
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            const item = filteredMentions[selectedMentionIndex];
            if (item) {
              insertMention(item);
            }
            return true;
          }
          if (event.key === 'Escape') {
            setShowMentionMenu(false);
            setMentionQuery('');
            return true;
          }
        }

        return false;
      },
    },
  });

  const handleContentChange = useCallback(() => {
    setSaveStatus('unsaved');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
    }, 2000);
  }, []);

  const handleAutoSave = useCallback(async () => {
    if (!editor || !onSave) return;
    setSaveStatus('saving');
    try {
      const json = editor.getJSON();
      const markdown = generateMarkdown(json);
      await onSave({ title, content: json, markdown });
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
    }
  }, [editor, onSave, title]);

  const handleSlashMenu = useCallback(
    (editorInstance: any) => {
      const { selection } = editorInstance.state;
      const { $from } = selection;
      const textBefore = $from.parent.textBetween(
        Math.max(0, $from.parentOffset - 20),
        $from.parentOffset,
        null,
        '\ufffc'
      );

      const match = textBefore.match(/\/(\w*)$/);
      if (match) {
        const coords = editorInstance.view.coordsAtPos($from.pos);
        setSlashMenuPosition({
          top: coords.bottom + window.scrollY + 5,
          left: coords.left + window.scrollX,
        });
        setSlashQuery(match[1]);
        setShowSlashMenu(true);
        setSelectedSlashIndex(0);
      } else {
        setShowSlashMenu(false);
        setSlashQuery('');
      }
    },
    []
  );

  const handleMentionMenu = useCallback(
    (editorInstance: any) => {
      const { selection } = editorInstance.state;
      const { $from } = selection;
      const textBefore = $from.parent.textBetween(
        Math.max(0, $from.parentOffset - 20),
        $from.parentOffset,
        null,
        '\ufffc'
      );

      const match = textBefore.match(/@(\w*)$/);
      if (match) {
        const coords = editorInstance.view.coordsAtPos($from.pos);
        setMentionMenuPosition({
          top: coords.bottom + window.scrollY + 5,
          left: coords.left + window.scrollX,
        });
        setMentionQuery(match[1]);
        setShowMentionMenu(true);
        setSelectedMentionIndex(0);
      } else {
        setShowMentionMenu(false);
        setMentionQuery('');
      }
    },
    []
  );

  const insertMention = (item: { id: string; label: string }) => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;
    const from = $from.pos - mentionQuery.length - 1;
    const to = $from.pos;

    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent({
        type: 'mention',
        attrs: { id: item.id, label: item.label },
      })
      .insertContent(' ')
      .run();

    setShowMentionMenu(false);
    setMentionQuery('');
  };

  const executeSlashCommand = (cmd: (typeof slashCommands)[0]) => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;
    const from = $from.pos - slashQuery.length - 1;
    const to = $from.pos;

    editor.chain().focus().deleteRange({ from, to }).run();
    cmd.command({ editor, range: { from, to } });
    setShowSlashMenu(false);
    setSlashQuery('');
  };

  const setLink = () => {
    if (!editor) return;
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setShowLinkInput(false);
    }
  };

  const copyAsMarkdown = () => {
    if (!editor) return;
    const markdown = generateMarkdown(editor.getJSON());
    navigator.clipboard.writeText(markdown);
    toast.success('Markdown copied to clipboard');
  };

  const exportToMarkdown = () => {
    if (!editor) return;
    const markdown = generateMarkdown(editor.getJSON());
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.replace(/\s+/g, '_')}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Document exported as Markdown');
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (slashMenuRef.current && showSlashMenu) {
      const selected = slashMenuRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedSlashIndex, showSlashMenu]);

  useEffect(() => {
    if (mentionMenuRef.current && showMentionMenu) {
      const selected = mentionMenuRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedMentionIndex, showMentionMenu]);

  const getIcon = (iconName: string) => {
    const props = { size: 16, className: 'text-stone-500' };
    switch (iconName) {
      case 'Type':
        return <Type {...props} />;
      case 'Heading1':
        return <Heading1 {...props} />;
      case 'Heading2':
        return <Heading2 {...props} />;
      case 'Heading3':
        return <Heading3 {...props} />;
      case 'List':
        return <List {...props} />;
      case 'ListOrdered':
        return <ListOrdered {...props} />;
      case 'CheckSquare':
        return <CheckSquare {...props} />;
      case 'Code':
        return <Code {...props} />;
      case 'Quote':
        return <Quote {...props} />;
      case 'Table':
        return <TableIcon {...props} />;
      case 'Minus':
        return <Minus {...props} />;
      default:
        return <Type {...props} />;
    }
  };

  const getStatusIcon = () => {
    switch (saveStatus) {
      case 'saved':
        return <Cloud size={14} className="text-emerald-500" />;
      case 'saving':
        return <Loader2 size={14} className="text-amber-500 animate-spin" />;
      case 'unsaved':
        return <CloudOff size={14} className="text-stone-400" />;
      case 'error':
        return <CloudOff size={14} className="text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saved':
        return 'Saved';
      case 'saving':
        return 'Saving...';
      case 'unsaved':
        return 'Unsaved';
      case 'error':
        return 'Error';
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-stone-200 bg-white">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              handleContentChange();
            }}
            className="text-lg font-semibold text-stone-800 bg-transparent border-none outline-none placeholder:text-stone-400 w-96"
            placeholder="Document Title"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={copyAsMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-md transition-colors"
            title="Copy as Markdown"
          >
            <Copy size={14} />
            Copy MD
          </button>
          <button
            onClick={exportToMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-md transition-colors"
            title="Export to Markdown"
          >
            <FileDown size={14} />
            Export
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-500">
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </div>
        </div>
      </div>

      {/* Editor Canvas */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto my-8 bg-white rounded-xl shadow-sm border border-stone-200 min-h-[600px]">
          {editor && (
            <>
              {/* Bubble Menu */}
              <BubbleMenu
                editor={editor}
                className="flex items-center gap-0.5 bg-white border border-stone-200 rounded-lg shadow-lg px-1 py-1"
              >
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-1.5 rounded hover:bg-stone-100 transition-colors ${
                    editor.isActive('bold') ? 'bg-stone-100 text-stone-800' : 'text-stone-600'
                  }`}
                  title="Bold"
                >
                  <Bold size={14} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-1.5 rounded hover:bg-stone-100 transition-colors ${
                    editor.isActive('italic') ? 'bg-stone-100 text-stone-800' : 'text-stone-600'
                  }`}
                  title="Italic"
                >
                  <Italic size={14} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  className={`p-1.5 rounded hover:bg-stone-100 transition-colors ${
                    editor.isActive('strike') ? 'bg-stone-100 text-stone-800' : 'text-stone-600'
                  }`}
                  title="Strikethrough"
                >
                  <Strikethrough size={14} />
                </button>
                <div className="w-px h-4 bg-stone-200 mx-1" />
                <button
                  onClick={() => {
                    if (editor.isActive('link')) {
                      editor.chain().focus().unsetLink().run();
                    } else {
                      setShowLinkInput(!showLinkInput);
                    }
                  }}
                  className={`p-1.5 rounded hover:bg-stone-100 transition-colors ${
                    editor.isActive('link') ? 'bg-stone-100 text-stone-800' : 'text-stone-600'
                  }`}
                  title="Link"
                >
                  <LinkIcon size={14} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  className={`p-1.5 rounded hover:bg-stone-100 transition-colors ${
                    editor.isActive('code') ? 'bg-stone-100 text-stone-800' : 'text-stone-600'
                  }`}
                  title="Inline Code"
                >
                  <Code size={14} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleHighlight().run()}
                  className={`p-1.5 rounded hover:bg-stone-100 transition-colors ${
                    editor.isActive('highlight') ? 'bg-stone-100 text-stone-800' : 'text-stone-600'
                  }`}
                  title="Highlight"
                >
                  <span className="text-xs font-bold">H</span>
                </button>

                {showLinkInput && (
                  <div className="absolute top-full mt-2 left-0 bg-white border border-stone-200 rounded-lg shadow-lg p-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="text-sm px-2 py-1 border border-stone-200 rounded outline-none focus:border-stone-400 w-48"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setLink();
                      }}
                      autoFocus
                    />
                    <button
                      onClick={setLink}
                      className="p-1 bg-stone-800 text-white rounded hover:bg-stone-700"
                    >
                      <Check size={12} />
                    </button>
                  </div>
                )}
              </BubbleMenu>

              {/* Floating Menu (Empty lines) */}
              <FloatingMenu
                editor={editor}
                className="flex items-center gap-0.5 bg-white border border-stone-200 rounded-lg shadow-lg px-1 py-1"
              >
                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-600 transition-colors"
                  title="Heading 1"
                >
                  <Heading1 size={14} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-600 transition-colors"
                  title="Bullet List"
                >
                  <List size={14} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleTaskList().run()}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-600 transition-colors"
                  title="Task List"
                >
                  <CheckSquare size={14} />
                </button>
                <button
                  onClick={() => editor.chain().focus().setCodeBlock().run()}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-600 transition-colors"
                  title="Code Block"
                >
                  <Code size={14} />
                </button>
              </FloatingMenu>
            </>
          )}

          <div ref={editorRef}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Slash Command Menu */}
      {showSlashMenu && filteredSlashCommands.length > 0 && (
        <div
          ref={slashMenuRef}
          className="fixed z-50 w-72 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden"
          style={{
            top: slashMenuPosition.top,
            left: slashMenuPosition.left,
          }}
        >
          <div className="px-3 py-2 text-xs font-medium text-stone-400 uppercase tracking-wider border-b border-stone-100">
            Basic Blocks
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {filteredSlashCommands.map((cmd, index) => (
              <button
                key={cmd.title}
                data-selected={index === selectedSlashIndex}
                onClick={() => executeSlashCommand(cmd)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  index === selectedSlashIndex
                    ? 'bg-stone-100'
                    : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-center w-8 h-8 bg-stone-100 rounded-lg">
                  {getIcon(cmd.icon)}
                </div>
                <div>
                  <div className="text-sm font-medium text-stone-800">{cmd.title}</div>
                  <div className="text-xs text-stone-500">{cmd.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mention Menu */}
      {showMentionMenu && filteredMentions.length > 0 && (
        <div
          ref={mentionMenuRef}
          className="fixed z-50 w-64 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden"
          style={{
            top: mentionMenuPosition.top,
            left: mentionMenuPosition.left,
          }}
        >
          <div className="px-3 py-2 text-xs font-medium text-stone-400 uppercase tracking-wider border-b border-stone-100">
            Link to Document
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredMentions.map((item, index) => (
              <button
                key={item.id}
                data-selected={index === selectedMentionIndex}
                onClick={() => insertMention(item)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  index === selectedMentionIndex
                    ? 'bg-stone-100'
                    : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-center w-8 h-8 bg-stone-100 rounded-lg">
                  <AtSign size={14} className="text-stone-500" />
                </div>
                <div className="text-sm font-medium text-stone-800">{item.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
