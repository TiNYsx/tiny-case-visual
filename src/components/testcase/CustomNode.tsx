'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import { MessageSquare, Plus, Link2 } from 'lucide-react';
import { useState } from 'react';

interface TestCaseStep {
  id: string;
  text: string;
}

interface TestCaseConnection {
  id: string;
  sourceId: string;
  targetId: string;
}

interface CustomNodeData {
  id: string;
  title: string;
  status: string;
  testCaseType: string | null;
  steps: TestCaseStep[];
  connectionsAsSource: TestCaseConnection[];
  connectionsAsTarget: TestCaseConnection[];
  _count?: { comments: number };
  onStartConnect?: (nodeId: string, x: number, y: number) => void;
  onAddNode?: (nodeId: string, position: 'left' | 'right') => void;
}

const statusColors = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  pass: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  fail: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

export function CustomNode({ data, selected }: NodeProps<CustomNodeData>) {
  const [isConnecting, setIsConnecting] = useState(false);
  const status = data.status || 'pending';
  const colors = statusColors[status as keyof typeof statusColors] || statusColors.pending;
  const stepCount = data.steps?.length || 0;
  const connectionCount = (data.connectionsAsSource?.length || 0) + (data.connectionsAsTarget?.length || 0);

  const handleConnectStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onStartConnect) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setIsConnecting(true);
      data.onStartConnect(data.id, rect.left, rect.top);
    }
  };

  const handleAddClick = (e: React.MouseEvent, position: 'left' | 'right') => {
    e.stopPropagation();
    if (data.onAddNode) {
      data.onAddNode(data.id, position);
    }
  };

  return (
    <div
      className={`w-[220px] glass rounded-xl p-3 ${selected ? 'border-accent' : 'border-border'} border`}
    >
      <Handle type="target" position={Position.Left} className="!bg-accent !w-3 !h-3" />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${colors.bg.replace('/20', '')} shrink-0`} />
          <span className="font-medium text-sm truncate text-text-primary">{data.title}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span className={`flex items-center gap-1 ${colors.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.bg.replace('/20', '')}`} />
          {status === 'pass' ? 'Passed' : status === 'fail' ? 'Failed' : 'Pending'}
        </span>
        {data.testCaseType && (
          <span className="text-text-muted truncate">{data.testCaseType}</span>
        )}
      </div>
      
      <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span>{stepCount}</span> steps
        </span>
        {connectionCount > 0 && (
          <span className="flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            {connectionCount}
          </span>
        )}
        {data._count && data._count.comments > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {data._count.comments}
          </span>
        )}
      </div>

      <div className="absolute top-1/2 -translate-y-1/2 -left-3">
        <button
          onClick={(e) => handleAddClick(e, 'left')}
          className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-colors shadow-lg"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 -right-3">
        <button
          onClick={(e) => handleAddClick(e, 'right')}
          className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-colors shadow-lg"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-accent !w-3 !h-3" onClick={handleConnectStart} />
    </div>
  );
}