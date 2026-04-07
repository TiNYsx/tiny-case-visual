'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const statusIcons = {
  pending: () => <span className="w-2 h-2 rounded-full bg-yellow-500" />,
  pass: () => <span className="w-2 h-2 rounded-full bg-green-500" />,
  fail: () => <span className="w-2 h-2 rounded-full bg-red-500" />,
};

const statusColors = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  pass: { bg: 'bg-green-500/20', text: 'text-green-400' },
  fail: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

interface CustomNodeData {
  title: string;
  status: string;
  _count?: { comments: number };
}

export function CustomNode({ data, selected }: NodeProps<CustomNodeData>) {
  const { t } = useTranslation();
  const status = data.status || 'pending';
  const colors = statusColors[status as keyof typeof statusColors] || statusColors.pending;
  const StatusIcon = statusIcons[status as keyof typeof statusIcons] || statusIcons.pending;

  return (
    <div
      className={`w-[200px] glass rounded-xl p-3 ${selected ? 'border-accent' : 'border-border'} border`}
    >
      <Handle type="target" position={Position.Left} className="!bg-accent" />
      
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${colors.bg.replace('/20', '')}`} />
        <span className="font-medium text-sm truncate text-text-primary">{data.title}</span>
      </div>
      
      <div className={`flex items-center gap-1 text-xs ${colors.text}`}>
        <StatusIcon />
        <span>{t(`testCase.${status}`)}</span>
      </div>
      
      {data._count && data._count.comments > 0 && (
        <div className="flex items-center gap-1 text-xs text-text-muted mt-1">
          <MessageSquare className="w-3 h-3" />
          <span>{data._count.comments}</span>
        </div>
      )}
      
      <Handle type="source" position={Position.Right} className="!bg-accent" />
    </div>
  );
}