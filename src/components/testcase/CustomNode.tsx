'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import { MessageSquare, Plus, Link2 } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

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
  pending: { 
    bg: 'bg-gradient-to-br from-yellow-400/20 to-yellow-600/20', 
    text: 'text-yellow-300', 
    border: 'border-yellow-400/40', 
    glow: 'shadow-yellow-400/20',
    dotColor: 'bg-yellow-400'
  },
  pass: { 
    bg: 'bg-gradient-to-br from-green-400/20 to-green-600/20', 
    text: 'text-green-300', 
    border: 'border-green-400/40', 
    glow: 'shadow-green-400/20',
    dotColor: 'bg-green-400'
  },
  fail: { 
    bg: 'bg-gradient-to-br from-red-400/20 to-red-600/20', 
    text: 'text-red-300', 
    border: 'border-red-400/40', 
    glow: 'shadow-red-400/20',
    dotColor: 'bg-red-400'
  },
};

export function CustomNode({ data, selected }: NodeProps<CustomNodeData>) {
  const [hovered, setHovered] = useState(false);
  const status = data.status || 'pending';
  const colors = statusColors[status as keyof typeof statusColors] || statusColors.pending;
  const stepCount = data.steps?.length || 0;
  const connectionCount = (data.connectionsAsSource?.length || 0) + (data.connectionsAsTarget?.length || 0);

  const handleConnectStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onStartConnect) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
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
    <motion.div
      className={`w-[240px] glass rounded-2xl p-4 ${selected ? 'ring-2 ring-accent ring-opacity-50' : ''} ${colors.border} border transition-all duration-300 cursor-pointer`}
      style={{
        boxShadow: selected ? `0 0 20px rgba(99, 102, 241, 0.4)` : '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!bg-accent !w-4 !h-4 !rounded-full !border-2 !border-white/20 hover:!scale-125 transition-transform" 
      />
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <motion.div 
            className={`w-3 h-3 rounded-full ${colors.dotColor} shrink-0`}
            animate={{ scale: selected ? [1, 1.2, 1] : 1 }}
            transition={{ duration: 0.6, repeat: selected ? Infinity : 0 }}
          />
          <span className="font-semibold text-sm truncate text-text-primary">{data.title}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3 text-xs text-text-muted mb-3">
        <motion.span 
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${colors.bg} ${colors.text} font-medium`}
          whileHover={{ scale: 1.05 }}
        >
          <motion.div 
            className={`w-1.5 h-1.5 rounded-full ${colors.dotColor}`}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          {status === 'pass' ? 'Passed' : status === 'fail' ? 'Failed' : 'Pending'}
        </motion.span>
        {data.testCaseType && (
          <span className="text-text-muted truncate bg-white/5 px-2 py-1 rounded-full">{data.testCaseType}</span>
        )}
      </div>
      
      <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
        <motion.span 
          className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-full"
          whileHover={{ scale: 1.05 }}
        >
          <span>{stepCount}</span> steps
        </motion.span>
        {connectionCount > 0 && (
          <motion.span 
            className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-full"
            whileHover={{ scale: 1.05 }}
          >
            <Link2 className="w-3 h-3" />
            {connectionCount}
          </motion.span>
        )}
        {data._count && data._count.comments > 0 && (
          <motion.span 
            className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-full"
            whileHover={{ scale: 1.05 }}
          >
            <MessageSquare className="w-3 h-3" />
            {data._count.comments}
          </motion.span>
        )}
      </div>

      {/* Animated plus buttons */}
      <motion.div 
        className="absolute top-1/2 -translate-y-1/2 -left-4"
        initial={{ scale: 0 }}
        animate={{ scale: hovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.button
          onClick={(e) => handleAddClick(e, 'left')}
          className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-all duration-200 shadow-lg hover:shadow-xl"
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
        >
          <Plus className="w-4 h-4" />
        </motion.button>
      </motion.div>
      <motion.div 
        className="absolute top-1/2 -translate-y-1/2 -right-4"
        initial={{ scale: 0 }}
        animate={{ scale: hovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.button
          onClick={(e) => handleAddClick(e, 'right')}
          className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-all duration-200 shadow-lg hover:shadow-xl"
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
        >
          <Plus className="w-4 h-4" />
        </motion.button>
      </motion.div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="!bg-accent !w-4 !h-4 !rounded-full !border-2 !border-white/20 hover:!scale-125 transition-transform" 
        onClick={handleConnectStart} 
      />
    </motion.div>
  );
}