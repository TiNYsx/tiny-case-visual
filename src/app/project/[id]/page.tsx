'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Plus, ArrowLeft, Edit2, Trash2, ChevronRight, MessageSquare, CheckCircle, XCircle, Clock, Play, Image, Paperclip, Link2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const ReactFlow = dynamic(() => import('reactflow').then(m => ({ default: m.ReactFlow })), { ssr: false });
const CustomNode = dynamic(() => import('@/components/testcase/CustomNode').then(m => ({ default: m.CustomNode })), { ssr: false });

const nodeTypes = { custom: CustomNode };

interface TestCaseStep {
  id: string;
  text: string;
  imageUrl: string | null;
  order: number;
}

interface TestCaseConnection {
  id: string;
  sourceId: string;
  targetId: string;
}

interface TestCase {
  id: string;
  title: string;
  description: string | null;
  testCaseType: string | null;
  testData: string | null;
  expectedResult: string | null;
  positionX: number | null;
  positionY: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  checkedAt: string | null;
  steps: TestCaseStep[];
  connectionsAsSource: TestCaseConnection[];
  connectionsAsTarget: TestCaseConnection[];
  _count: { comments: number };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdBy: { id: string; displayName: string; photoURL: string | null };
}

export default function ProjectPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [tempEdge, setTempEdge] = useState<{ source: string; targetX: number; targetY: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    testCaseType: '' as string | null,
    testData: '',
    expectedResult: '',
  });
  const [steps, setSteps] = useState<{ text: string; imageUrl: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'steps' | 'history'>('details');
  const [testHistory, setTestHistory] = useState<any[]>([]);

  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId) fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [projectRes, testCasesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/testcases?projectId=${projectId}`),
      ]);
      if (projectRes.ok) setProject(await projectRes.json());
      if (testCasesRes.ok) setTestCases(await testCasesRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestHistory = async (testCaseId: string) => {
    try {
      const res = await fetch(`/api/test-runs?testCaseId=${testCaseId}`);
      if (res.ok) setTestHistory(await res.json());
    } catch (error) {
      console.error('Error fetching test history:', error);
    }
  };

  const handleStartConnect = (nodeId: string, x: number, y: number) => {
    setConnectingFrom(nodeId);
    setMousePos({ x, y });
  };

  const handleAddNodeForNode = async (nodeId: string, position: 'left' | 'right') => {
    // Find the current node position
    const currentNode = nodes.find(n => n.id === nodeId);
    if (!currentNode) return;

    const offsetX = position === 'left' ? -250 : 250;
    const newPosition = { x: currentNode.position.x + offsetX, y: currentNode.position.y };

    // Create new test case
    try {
      const res = await fetch('/api/testcases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Test Case',
          description: '',
          projectId,
          positionX: newPosition.x,
          positionY: newPosition.y,
          steps: [],
        }),
      });
      if (res.ok) {
        const newTc = await res.json();
        // Connect if needed
        if (position === 'right') {
          await handleConnect(nodeId, newTc.id);
        } else {
          await handleConnect(newTc.id, nodeId);
        }
        fetchData();
      }
    } catch (error) {
      console.error('Error creating node:', error);
    }
  };

  const nodes = useMemo(() => {
    return testCases.map(tc => ({
      id: tc.id,
      position: { 
        x: tc.positionX ?? 100 + Math.random() * 500, 
        y: tc.positionY ?? 100 + Math.random() * 300 
      },
      data: {
        ...tc,
        onStartConnect: handleStartConnect,
        onAddNode: handleAddNodeForNode,
      },
      type: 'custom',
    }));
  }, [testCases]);

  const edges = useMemo(() => {
    const edgeList: any[] = [];
    testCases.forEach(tc => {
      tc.connectionsAsSource.forEach(conn => {
        edgeList.push({
          id: conn.id,
          source: conn.sourceId,
          target: conn.targetId,
          type: 'smoothstep',
          animated: false,
          style: { stroke: 'rgba(255,255,255,0.2)' },
        });
      });
    });
    return edgeList;
  }, [testCases]);

  const handleConnect = useCallback(async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error creating connection:', error);
    }
  }, []);

  const handleDeleteConnection = useCallback(async (sourceId: string, targetId: string) => {
    try {
      const res = await fetch(`/api/connections?sourceId=${sourceId}&targetId=${targetId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
    }
  }, []);

  const handleNodeDragStop = useCallback(async (event: React.MouseEvent, node: any) => {
    try {
      await fetch(`/api/testcases/${node.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX: node.position.x, positionY: node.position.y }),
      });
    } catch (error) {
      console.error('Error saving position:', error);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingTestCase ? `/api/testcases/${editingTestCase.id}` : '/api/testcases';
      const method = editingTestCase ? 'PUT' : 'POST';
      
      const body: any = {
        ...formData,
        projectId,
        steps,
      };
      
      if (editingTestCase) {
        body.connections = editingTestCase.connectionsAsSource.map(c => ({ targetId: c.targetId }));
      }
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingTestCase(null);
        setFormData({ title: '', description: '', testCaseType: null, testData: '', expectedResult: '' });
        setSteps([]);
        fetchData();
      }
    } catch (error) {
      console.error('Error saving test case:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/testcases/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        if (selectedTestCase?.id === id) setSelectedTestCase(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting test case:', error);
    }
  };

  const openEditModal = (tc: TestCase) => {
    setEditingTestCase(tc);
    setFormData({
      title: tc.title,
      description: tc.description || '',
      testCaseType: tc.testCaseType,
      testData: tc.testData || '',
      expectedResult: tc.expectedResult || '',
    });
    setSteps(tc.steps ? tc.steps.map(s => ({ text: s.text, imageUrl: s.imageUrl || '' })) : []);
    setIsModalOpen(true);
  };

  const addStep = () => setSteps([...steps, { text: '', imageUrl: '' }]);
  const removeStep = (index: number) => setSteps(steps.filter((_, i) => i !== index));

  const handleNodeClick = (_: any, node: any) => {
    if (connectingFrom) {
      handleConnect(connectingFrom, node.id);
      setConnectingFrom(null);
    } else {
      setSelectedTestCase(node.data);
      setActiveTab('details');
    }
  };

  const handlePaneClick = () => {
    if (connectingFrom) {
      setConnectingFrom(null);
    }
  };

  const handleStartConnect = (nodeId: string, x: number, y: number) => {
    setConnectingFrom(nodeId);
    setMousePos({ x, y });
  };

  const handleAddNodeForNode = async (nodeId: string, position: 'left' | 'right') => {
    // Find the current node position
    const currentNode = nodes.find(n => n.id === nodeId);
    if (!currentNode) return;

    const offsetX = position === 'left' ? -250 : 250;
    const newPosition = { x: currentNode.position.x + offsetX, y: currentNode.position.y };

    // Create new test case
    try {
      const res = await fetch('/api/testcases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Test Case',
          description: '',
          projectId,
          positionX: newPosition.x,
          positionY: newPosition.y,
          steps: [],
        }),
      });
      if (res.ok) {
        const newTc = await res.json();
        // Connect if needed
        if (position === 'right') {
          await handleConnect(nodeId, newTc.id);
        } else {
          await handleConnect(newTc.id, nodeId);
        }
        fetchData();
      }
    } catch (error) {
      console.error('Error creating node:', error);
    }
  };

  const handleMouseMove = useCallback((e: any) => {
    if (connectingFrom) {
      const bounds = reactFlowWrapperRef.current?.getBoundingClientRect();
      if (bounds) {
        setMousePos({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
      }
    }
  }, [connectingFrom]);

  const handleAddNode = () => {
    setEditingTestCase(null);
    setFormData({ title: '', description: '', testCaseType: null, testData: '', expectedResult: '' });
    setSteps([]);
    setIsModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-400';
      case 'fail': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-green-500/20';
      case 'fail': return 'bg-red-500/20';
      default: return 'bg-yellow-500/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-8 rounded-2xl">
          <div className="text-text-secondary animate-pulse">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-grid bg-gradient-radial overflow-hidden">
      <header className="glass border-b border-border px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button variant="ghost" size="sm" className="!p-1.5 shrink-0" onClick={() => router.push('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold truncate">{project?.name}</h1>
            <p className="text-xs sm:text-sm text-text-secondary hidden sm:block">{project?.description || '-'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {connectingFrom && (
            <Button variant="danger" size="sm" onClick={() => setConnectingFrom(null)}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )}
          <Button variant="secondary" size="sm" className="hidden sm:flex" onClick={() => router.push(`/project/${projectId}/run`)}>
            <Play className="w-4 h-4 mr-2" />
            <span className="hidden md:inline">Run Test</span>
          </Button>
          <Button variant="secondary" size="sm" className="sm:hidden !px-2" onClick={() => router.push(`/project/${projectId}/run`)}>
            <Play className="w-4 h-4" />
          </Button>
          <Button size="sm" className="hidden sm:flex" onClick={handleAddNode}>
            <Plus className="w-4 h-4 mr-2" />
            {t('testCase.create')}
          </Button>
          <Button size="sm" className="sm:hidden !px-2" onClick={handleAddNode}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative" ref={reactFlowWrapperRef}>
        <div className="flex-1 relative min-w-0">
          <ReactFlow
            nodes={nodes.map(n => ({
              ...n,
              type: 'custom',
            }))}
            edges={edges}
            onNodeClick={handleNodeClick}
            onNodeDragStop={handleNodeDragStop}
            onPaneClick={handlePaneClick}
            onMouseMove={handleMouseMove}
            fitView
            attributionPosition="bottom-left"
            nodeTypes={nodeTypes}
          >
          </ReactFlow>
          
          {connectingFrom && (
            <div 
              className="pointer-events-none absolute border-2 border-dashed border-accent rounded-full"
              style={{
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                zIndex: 1000,
              }}
            />
          )}
        </div>

        <AnimatePresence>
          {selectedTestCase && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="w-full sm:w-[350px] md:w-[400px] glass border-l border-border flex flex-col overflow-hidden absolute sm:relative right-0 top-0 bottom-0 z-50 sm:z-auto"
            >
              <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate text-sm sm:text-base">{selectedTestCase.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusBg(selectedTestCase.status)} ${getStatusColor(selectedTestCase.status)}`}>
                      {selectedTestCase.status === 'pass' ? 'Passed' : selectedTestCase.status === 'fail' ? 'Failed' : 'Pending'}
                    </span>
                    {selectedTestCase.testCaseType && (
                      <span className="text-xs text-text-muted">{selectedTestCase.testCaseType}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="!p-1" onClick={() => openEditModal(selectedTestCase)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="!p-1" onClick={() => setDeleteConfirm(selectedTestCase.id)}>
                    <Trash2 className="w-4 h-4 text-error" />
                  </Button>
                  <Button variant="ghost" size="sm" className="!p-1 sm:hidden" onClick={() => setSelectedTestCase(null)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

                <div className="flex border-b border-border overflow-x-auto">
                  {(['details', 'steps', 'history'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => { 
                        setActiveTab(tab); 
                        if (tab === 'history') fetchTestHistory(selectedTestCase.id);
                      }}
                      className={`flex-1 py-2 sm:py-3 px-1 sm:px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'text-accent border-b-2 border-accent' : 'text-text-muted'}`}
                    >
                      {tab === 'history' ? 'History' : t(`testCase.${tab}`)}
                    </button>
                  ))}
                </div>

              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    {selectedTestCase.description && (
                      <div>
                        <label className="text-sm text-text-muted">Description</label>
                        <div className="text-text-secondary mt-1 prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedTestCase.description}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                    
                    {selectedTestCase.testCaseType && (
                      <div>
                        <label className="text-sm text-text-muted">Test Case Type</label>
                        <p className="text-text-secondary mt-1">{selectedTestCase.testCaseType}</p>
                      </div>
                    )}
                    
                    {selectedTestCase.testData && (
                      <div>
                        <label className="text-sm text-text-muted">Test Data</label>
                        <div className="text-text-secondary mt-1 prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedTestCase.testData}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                    
                    {selectedTestCase.expectedResult && (
                      <div>
                        <label className="text-sm text-text-muted">Expected Result</label>
                        <div className="text-text-secondary mt-1 prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedTestCase.expectedResult}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="text-text-muted">Last Run</label>
                        <p className="text-text-secondary">{selectedTestCase.checkedAt ? new Date(selectedTestCase.checkedAt).toLocaleString('th-TH') : '-'}</p>
                      </div>
                      <div>
                        <label className="text-text-muted">Created</label>
                        <p className="text-text-secondary">{new Date(selectedTestCase.createdAt).toLocaleDateString('th-TH')}</p>
                      </div>
                    </div>

                    {(selectedTestCase.connectionsAsSource.length > 0 || selectedTestCase.connectionsAsTarget.length > 0) && (
                      <div>
                        <label className="text-sm text-text-muted mb-2 block">Connections</label>
                        <div className="space-y-1">
                          {selectedTestCase.connectionsAsSource.map(conn => {
                            const targetNode = testCases.find(tc => tc.id === conn.targetId);
                            return targetNode ? (
                              <div key={conn.id} className="flex items-center justify-between glass rounded-lg px-3 py-2 text-sm">
                                <span className="text-text-secondary truncate">→ {targetNode.title}</span>
                                <button onClick={() => handleDeleteConnection(conn.sourceId, conn.targetId)} className="text-error hover:text-error/80">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : null;
                          })}
                          {selectedTestCase.connectionsAsTarget.map(conn => {
                            const sourceNode = testCases.find(tc => tc.id === conn.sourceId);
                            return sourceNode ? (
                              <div key={conn.id} className="flex items-center justify-between glass rounded-lg px-3 py-2 text-sm">
                                <span className="text-text-secondary truncate">{sourceNode.title} →</span>
                                <button onClick={() => handleDeleteConnection(conn.sourceId, conn.targetId)} className="text-error hover:text-error/80">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'steps' && (
                  <div className="space-y-4">
                    {!selectedTestCase.steps || selectedTestCase.steps.length === 0 ? (
                      <p className="text-text-muted text-center py-4">No steps defined</p>
                    ) : (
                      selectedTestCase.steps.map((step, i) => (
                        <div key={step.id} className="glass rounded-xl p-3">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-sm flex items-center justify-center shrink-0">{i + 1}</span>
                            <div className="flex-1">
                              <div className="text-text-secondary prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.text}</ReactMarkdown>
                              </div>
                              {step.imageUrl && <img src={step.imageUrl} alt="" className="mt-2 rounded-lg max-w-full" />}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-4">
                    {testHistory.length === 0 ? (
                      <p className="text-text-muted text-center py-4">No test history yet</p>
                    ) : (
                      testHistory.map((run) => (
                        <div key={run.id} className={`glass rounded-xl p-4 ${run.status === 'pass' ? 'border-l-4 border-green-500' : run.status === 'fail' ? 'border-l-4 border-red-500' : 'border-l-4 border-yellow-500'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {run.status === 'pass' ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : run.status === 'fail' ? (
                                <XCircle className="w-5 h-5 text-red-500" />
                              ) : (
                                <Clock className="w-5 h-5 text-yellow-500" />
                              )}
                              <span className={`font-semibold ${run.status === 'pass' ? 'text-green-400' : run.status === 'fail' ? 'text-red-400' : 'text-yellow-400'}`}>
                                {run.status === 'pass' ? 'Passed' : run.status === 'fail' ? 'Failed' : 'Pending'}
                              </span>
                            </div>
                            <span className="text-xs text-text-muted">
                              {new Date(run.checkedAt).toLocaleString('th-TH')}
                            </span>
                          </div>
                          
                          {run.testData && (
                            <div className="text-sm text-text-muted mb-2">
                              <span className="font-medium">Test Data:</span> {run.testData}
                            </div>
                          )}
                          {run.actualResult && (
                            <div className="text-sm text-text-secondary mt-2 p-2 bg-bg-primary/50 rounded">
                              <span className="font-medium">Actual Result:</span> {run.actualResult}
                            </div>
                          )}
                          {run.notes && (
                            <div className="text-text-secondary text-sm mt-2 p-2 bg-bg-primary/50 rounded">
                              {run.notes}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTestCase(null); }} title={editingTestCase ? t('testCase.edit') : t('testCase.create')} size="lg">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input 
              label="Test Case Name" 
              value={formData.title} 
              onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
              required 
            />
            <Textarea 
              label="Description" 
              value={formData.description} 
              onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
              rows={2} 
            />
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">Test Case Type</label>
              <select 
                value={formData.testCaseType || ''} 
                onChange={(e) => setFormData({ ...formData, testCaseType: e.target.value || null })} 
                className="glass-input w-full px-4 py-3 rounded-xl"
              >
                <option value="">Select Type</option>
                <option value="Positive Case">Positive Case</option>
                <option value="Negative Case">Negative Case</option>
              </select>
            </div>
            <Textarea 
              label="Test Data (Default)" 
              value={formData.testData} 
              onChange={(e) => setFormData({ ...formData, testData: e.target.value })} 
              placeholder="Enter default test data - can be overridden during test run"
              rows={2} 
            />
            <Textarea 
              label="Expected Result" 
              value={formData.expectedResult} 
              onChange={(e) => setFormData({ ...formData, expectedResult: e.target.value })} 
              rows={2} 
            />
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-secondary">Test Steps</label>
                <Button type="button" variant="ghost" size="sm" onClick={addStep}><Plus className="w-4 h-4 mr-1" />Add Step</Button>
              </div>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex gap-2">
                    <Input 
                      value={step.text} 
                      onChange={(e) => { const s = [...steps]; s[i].text = e.target.value; setSteps(s); }} 
                      placeholder={`Step ${i + 1}`} 
                    />
                    <Button type="button" variant="danger" size="sm" onClick={() => removeStep(i)}>×</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button type="button" variant="secondary" onClick={() => { setIsModalOpen(false); setEditingTestCase(null); }}>{t('common.cancel')}</Button>
            <Button type="submit" loading={submitting}>{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title={t('testCase.delete')} size="sm" footer={<><Button variant="secondary" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button><Button variant="danger" onClick={() => handleDelete(deleteConfirm!)}>{t('common.delete')}</Button></>}>
        <p className="text-text-secondary">{t('testCase.confirmDelete')}</p>
      </Modal>
    </div>
  );
}