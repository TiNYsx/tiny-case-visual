interface MarkdownNode {
  type: string;
  attrs?: Record<string, any>;
  content?: MarkdownNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
}

function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>');
}

function processMarks(text: string, marks?: Array<{ type: string; attrs?: Record<string, any> }>): string {
  if (!marks || marks.length === 0) return text;

  let result = text;

  // Process marks in reverse order to handle nesting correctly
  const sortedMarks = [...marks].sort((a, b) => {
    const priority: Record<string, number> = {
      link: 0,
      code: 1,
      bold: 2,
      italic: 3,
      strike: 4,
      highlight: 5,
    };
    return (priority[a.type] || 99) - (priority[b.type] || 99);
  });

  for (const mark of sortedMarks) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`;
        break;
      case 'italic':
        result = `*${result}*`;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
      case 'link':
        result = `[${result}](${mark.attrs?.href || ''})`;
        break;
      case 'highlight':
        result = `==${result}==`;
        break;
    }
  }

  return result;
}

function processInlineContent(content?: MarkdownNode[]): string {
  if (!content) return '';

  return content
    .map((node) => {
      if (node.type === 'text') {
        return processMarks(node.text || '', node.marks);
      }
      if (node.type === 'hardBreak') {
        return '\n';
      }
      if (node.type === 'mention') {
        return `[@${node.attrs?.label || node.attrs?.id}](mention://${node.attrs?.id})`;
      }
      return '';
    })
    .join('');
}

function processBlock(node: MarkdownNode, depth: number = 0): string {
  const indent = '  '.repeat(depth);

  switch (node.type) {
    case 'doc':
      return (node.content || []).map((child) => processBlock(child, depth)).join('\n\n');

    case 'paragraph':
      return indent + processInlineContent(node.content);

    case 'heading': {
      const level = node.attrs?.level || 1;
      const hashes = '#'.repeat(level);
      return `${hashes} ${processInlineContent(node.content)}`;
    }

    case 'blockquote':
      return (node.content || [])
        .map((child) => {
          const lines = processBlock(child, depth).split('\n');
          return lines.map((line) => `> ${line}`).join('\n');
        })
        .join('\n\n');

    case 'bulletList':
      return (node.content || [])
        .map((child) => processBlock(child, depth))
        .join('\n');

    case 'orderedList':
      return (node.content || [])
        .map((child, index) => {
          const itemContent = processListItem(child, depth);
          return `${indent}${index + 1}. ${itemContent}`;
        })
        .join('\n');

    case 'listItem':
      return `${indent}- ${processListItem(node, depth)}`;

    case 'taskList':
      return (node.content || [])
        .map((child) => processBlock(child, depth))
        .join('\n');

    case 'taskItem': {
      const checked = node.attrs?.checked ? '[x]' : '[ ]';
      return `${indent}- ${checked} ${processListItem(node, depth)}`;
    }

    case 'codeBlock': {
      const language = node.attrs?.language || '';
      const code = processInlineContent(node.content);
      return `\`\`\`${language}\n${code}\n\`\`\``;
    }

    case 'horizontalRule':
      return '---';

    case 'table':
      return processTable(node);

    case 'hardBreak':
      return '\n';

    default:
      return processInlineContent(node.content);
  }
}

function processListItem(node: MarkdownNode, depth: number): string {
  if (!node.content) return '';

  const paragraphs = node.content.filter((child) => child.type === 'paragraph');
  const nestedLists = node.content.filter(
    (child) => child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList'
  );

  let result = paragraphs.map((p) => processInlineContent(p.content)).join('\n');

  if (nestedLists.length > 0) {
    const nestedContent = nestedLists
      .map((list) => processBlock(list, depth + 1))
      .join('\n');
    result += '\n' + nestedContent;
  }

  return result;
}

function processTable(node: MarkdownNode): string {
  if (!node.content) return '';

  const rows = node.content;
  let result = '';

  rows.forEach((row, rowIndex) => {
    if (!row.content) return;

    const cells = row.content
      .map((cell) => {
        const cellContent = processInlineContent(cell.content);
        return ` ${cellContent} `;
      })
      .join('|');

    result += `|${cells}|\n`;

    // Add separator after header row
    if (rowIndex === 0) {
      const separator = row.content.map(() => ' --- ').join('|');
      result += `|${separator}|\n`;
    }
  });

  return result.trim();
}

export function generateMarkdown(json: MarkdownNode): string {
  if (!json) return '';
  return processBlock(json).trim();
}

export function generatePlainText(json: MarkdownNode): string {
  if (!json || !json.content) return '';

  function extractText(node: MarkdownNode): string {
    if (node.text) return node.text;
    if (node.content) return node.content.map(extractText).join(' ');
    return '';
  }

  return json.content.map(extractText).join('\n').trim();
}
