'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Plus, ArrowLeft, Edit2, Trash2, ChevronRight, CheckCircle, XCircle, Clock, Play, X, Lock, ListChecks } from 'lucide-react';
import type { Node, NodeChange, Edge } from 'reactflow';
import { applyNodeChanges } from 'reactflow';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';

const ReactFlow = dynamic(() => import('reactflow').then(m => ({ default: m.ReactFlow })), { ssr: false });
const Controls = dynamic(() => import('reactflow').then(m => ({ default: m.Controls })), { ssr: false });
const Background = dynamic(() => import('reactflow').then(m => ({ default: m.Background })), { ssr: false });
const MiniMap = dynamic(() => import('reactflow').then(m => ({ default: m.MiniMap })), { ssr: false });
const CustomNode = dynamic(() => import('@/components/testcase/CustomNode').then(m => ({ default: m.CustomNode })), { ssr: false });

const nodeTypes = { custom: CustomNode };

type TemplateStep = {
  id: string;
  title: string;
  instruction: string;
  expected: string | null;
  order: number;
};

type TestCaseStep = {
  id: string;
  text: string;
  imageUrl: string | null;
  order: number;
};

type TestCaseConnection = {
  id: string;
  sourceId: string;
  targetId: string;
};

type TestCase = {
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
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  currentUserRole?: string;
  isManager?: boolean;
  templateSteps?: TemplateStep[];
  testSessions?: Array<{
    id: string;
    tester: { id: string; name: string | null; email: string | null };
    startedAt: string;
  }>;
};

type TestHistoryItem = {
  id: string;
  status: string;
  notes: string | null;
  checkedAt: string;
};

type TestCaseNode = Node<TestCase>;

type TestCaseEdge = Edge;

type SaveTestCaseBody = {
  title: string;
  description: string;
  testCaseType: string | null;
  testData: string;
  expectedResult: string;
  projectId: string;
  steps: { text: string; imageUrl: string }[];
  connections?: { targetId: string }[];
};

export default function ProjectPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [flowNodes, setFlowNodes] = useState<TestCaseNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', testCaseType: '' as string | null, testData: '', expectedResult: '', connections: [] as string[] });
  const [steps, setSteps] = useState<{ text: string; imageUrl: string }[]>([]);
  const [templateStep, setTemplateStep] = useState({ title: '', instruction: '', expected: '' });
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'steps' | 'history' | 'template'>('details');
  const [testHistory, setTestHistory] = useState<TestHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runningSession = project?.testSessions?.[0] || null;
  const isLocked = Boolean(runningSession);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [projectRes, testCasesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/testcases?projectId=${projectId}`),
      ]);

      if (projectRes.ok) setProject(await projectRes.json());
      if (testCasesRes.ok) setTestCases(await testCasesRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Could not load project data.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!projectId) return;
    const events = new EventSource(`/api/projects/${projectId}/events`);
    events.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event.type !== 'heartbeat' && event.type !== 'connected') fetchData();
    };
    return () => events.close();
  }, [projectId, fetchData]);

  const fetchTestHistory = async (testCaseId: string) => {
    try {
      const res = await fetch(`/api/test-runs?testCaseId=${testCaseId}`);
      if (res.ok) setTestHistory(await res.json());
    } catch (err) {
      console.error('Error fetching test history:', err);
    }
  };

  const handleConnect = useCallback(async (sourceId: string, targetId: string) => {
    if (sourceId === targetId || isLocked) return;
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, targetId }),
    });
    if (res.ok) fetchData();
  }, [fetchData, isLocked]);

  const handleAddNodeForNode = useCallback(async (nodeId: string, position: 'left' | 'right') => {
    if (isLocked) return;
    const currentTc = testCases.find(tc => tc.id === nodeId);
    if (!currentTc) return;

    const offsetX = position === 'left' ? -300 : 300;
    const newPosition = { x: (currentTc.positionX ?? 120) + offsetX, y: currentTc.positionY ?? 120 };

    const res = await fetch('/api/testcases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Test Case', description: '', projectId, positionX: newPosition.x, positionY: newPosition.y, steps: [] }),
    });

    if (res.ok) {
      const newTc: TestCase = await res.json();
      if (position === 'right') await handleConnect(nodeId, newTc.id);
      else await handleConnect(newTc.id, nodeId);
      fetchData();
    }
  }, [fetchData, handleConnect, isLocked, projectId, testCases]);

  const nodes = useMemo<TestCaseNode[]>(() => {
    return testCases.map((tc, index) => ({
      id: tc.id,
      position: {
        x: tc.positionX ?? 120 + (index % 4) * 300,
        y: tc.positionY ?? 120 + Math.floor(index / 4) * 220,
      },
      data: {
        ...tc,
        onStartConnect: (nodeId: string) => setConnectingFrom(nodeId),
        onAddNode: handleAddNodeForNode,
        onRun: (nodeId: string) => router.push(`/project/${projectId}/run?startWith=${nodeId}`),
        onView: (nodeId: string) => {
          const tc = testCases.find(t => t.id === nodeId);
          if (tc) {
            setSelectedTestCase(tc);
            setActiveTab('details');
          }
        },
        selectable: true,
      },
      type: 'custom',
    }));
  }, [handleAddNodeForNode, testCases, projectId, router]);

  useEffect(() => {
    setFlowNodes(nodes);
  }, [nodes]);

  const edges = useMemo<TestCaseEdge[]>(() => {
    return testCases.flatMap(tc => tc.connectionsAsSource.map(conn => ({
      id: conn.id,
      source: conn.sourceId,
      target: conn.targetId,
      type: 'default',
      animated: false,
      style: { stroke: '#6366f1', strokeWidth: 4 },
      markerEnd: 'arrowclosed' as any,
      selectable: true,
      zIndex: 1,
      interactionWidth: 20,
    })));
  }, [testCases]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setFlowNodes(current => applyNodeChanges(changes, current));
  }, []);

  const handleDeleteConnection = useCallback(async (sourceId: string, targetId: string) => {
    if (isLocked) return;
    const res = await fetch(`/api/connections?sourceId=${sourceId}&targetId=${targetId}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  }, [fetchData, isLocked]);

  const handleNodeDragStop = useCallback(async (_event: React.MouseEvent, node: TestCaseNode) => {
    setTestCases(current => current.map(tc => tc.id === node.id ? { ...tc, positionX: node.position.x, positionY: node.position.y } : tc));
    await fetch(`/api/testcases/${node.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionX: node.position.x, positionY: node.position.y }),
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const url = editingTestCase ? `/api/testcases/${editingTestCase.id}` : '/api/testcases';
      const method = editingTestCase ? 'PUT' : 'POST';
      const body: SaveTestCaseBody = { ...formData, projectId, steps, connections: formData.connections.map(targetId => ({ targetId })) };

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not save test case.');
        return;
      }

      setIsModalOpen(false);
      setEditingTestCase(null);
      setFormData({ title: '', description: '', testCaseType: null, testData: '', expectedResult: '', connections: [] });
      setSteps([]);
      fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/testcases/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDeleteConfirm(null);
      if (selectedTestCase?.id === id) setSelectedTestCase(null);
      fetchData();
    }
  };

  const handleAddTemplateStep = async () => {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateStep),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not add template step.');
      return;
    }
    setTemplateStep({ title: '', instruction: '', expected: '' });
    fetchData();
  };

  const handleDeleteTemplateStep = async (stepId: string) => {
    const res = await fetch(`/api/projects/${projectId}/template/${stepId}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  const openEditModal = (tc: TestCase) => {
    setEditingTestCase(tc);
    setFormData({ title: tc.title, description: tc.description || '', testCaseType: tc.testCaseType, testData: tc.testData || '', expectedResult: tc.expectedResult || '', connections: tc.connectionsAsSource?.map(c => c.targetId) || [] });
    setSteps(tc.steps ? tc.steps.map(s => ({ text: s.text, imageUrl: s.imageUrl || '' })) : []);
    setIsModalOpen(true);
  };

  const addStep = () => setSteps([...steps, { text: '', imageUrl: '' }]);
  const removeStep = (index: number) => setSteps(steps.filter((_, i) => i !== index));

  const handleNodeClick = (_: React.MouseEvent, node: TestCaseNode) => {
    if (connectingFrom) {
      handleConnect(connectingFrom, node.id);
      setConnectingFrom(null);
    }
  };

  const handleAddNode = () => {
    if (isLocked) return;
    setEditingTestCase(null);
    setFormData({ title: '', description: '', testCaseType: null, testData: '', expectedResult: '', connections: [] });
    setSteps([]);
    setIsModalOpen(true);
  };

  if (loading || status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><div className="glass p-8 rounded-2xl text-text-secondary animate-pulse">Loading...</div></div>;
  }

  return (
    <div className="h-screen flex flex-col bg-grid bg-gradient-radial overflow-hidden">
      <header className="glass border-b border-border px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" className="!p-1.5 shrink-0" onClick={() => router.push('/')}><ArrowLeft className="w-5 h-5" /></Button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold truncate">{project?.name}</h1>
            <p className="text-xs sm:text-sm text-text-secondary hidden sm:block">{project?.description || 'Visual test case project'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isLocked && <div className="hidden md:flex items-center gap-2 text-xs text-yellow-300 glass rounded-xl px-3 py-2"><Lock className="w-4 h-4" /> Testing by {runningSession?.tester?.name || runningSession?.tester?.email}</div>}
          {connectingFrom && <Button variant="danger" size="sm" onClick={() => setConnectingFrom(null)}><X className="w-4 h-4 mr-1" />Cancel</Button>}
          <Button variant="secondary" size="sm" onClick={() => router.push(`/project/${projectId}/run${selectedTestCase ? `?startWith=${selectedTestCase.id}` : ''}`)} disabled={!selectedTestCase}><Play className="w-4 h-4 mr-2" />Run</Button>
          <Button variant="secondary" size="sm" onClick={() => setActiveTab('template')}><ListChecks className="w-4 h-4 mr-2" />Template</Button>
          <Button size="sm" onClick={handleAddNode} disabled={isLocked}><Plus className="w-4 h-4 mr-2" />Test Case</Button>
        </div>
      </header>

      {error && <div className="shrink-0 bg-error/15 border-b border-error/30 px-6 py-2 text-sm text-red-200">{error}</div>}

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative min-w-0">
          <ReactFlow
            nodes={flowNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodeClick={handleNodeClick}
            onNodeDragStop={handleNodeDragStop}
            onPaneClick={() => setConnectingFrom(null)}
            fitView
            nodesDraggable={!isLocked}
            nodesConnectable={false}
            elementsSelectable
            attributionPosition="bottom-left"
            nodeTypes={nodeTypes}
            className="bg-transparent"
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable nodeColor={() => '#6366f1'} />
          </ReactFlow>
          {connectingFrom && <div className="absolute left-4 bottom-4 glass rounded-xl px-4 py-3 text-sm text-text-secondary">Click another node to create a connection.</div>}
        </div>

        {(selectedTestCase || activeTab === 'template') && (
          <aside className="w-full sm:w-[390px] glass border-l border-border flex flex-col overflow-hidden absolute sm:relative right-0 top-0 bottom-0 z-50 sm:z-auto">
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{activeTab === 'template' ? 'Project Test Template' : selectedTestCase?.title}</h3>
                <p className="text-xs text-text-muted">{activeTab === 'template' ? `${project?.templateSteps?.length || 0} steps` : selectedTestCase?.status}</p>
              </div>
              <div className="flex items-center gap-1">
                {selectedTestCase && activeTab !== 'template' && <Button variant="ghost" size="sm" className="!p-1" onClick={() => openEditModal(selectedTestCase)} disabled={isLocked}><Edit2 className="w-4 h-4" /></Button>}
                {selectedTestCase && activeTab !== 'template' && <Button variant="ghost" size="sm" className="!p-1" onClick={() => setDeleteConfirm(selectedTestCase.id)} disabled={isLocked}><Trash2 className="w-4 h-4 text-error" /></Button>}
                <Button variant="ghost" size="sm" className="!p-1" onClick={() => { setSelectedTestCase(null); setActiveTab('details'); }}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>

            {selectedTestCase && activeTab !== 'template' && (
              <div className="flex border-b border-border overflow-x-auto">
                {(['details', 'steps', 'history'] as const).map(tab => (
                  <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'history') fetchTestHistory(selectedTestCase.id); }} className={`flex-1 py-3 px-3 text-sm font-medium transition-colors ${activeTab === tab ? 'text-accent border-b-2 border-accent' : 'text-text-muted'}`}>
                    {tab}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'template' && (
                <div className="space-y-4">
                  {isLocked && <div className="glass rounded-xl p-3 text-sm text-yellow-200">Template is locked while {runningSession?.tester?.name || runningSession?.tester?.email} is testing.</div>}
                  {project?.templateSteps?.map((step, index) => (
                    <div key={step.id} className="glass rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{index + 1}. {step.title}</div>
                          <div className="prose prose-invert prose-sm max-w-none mt-2 text-text-secondary"><ReactMarkdown remarkPlugins={[remarkGfm]}>{step.instruction}</ReactMarkdown></div>
                          {step.expected && <div className="mt-2 text-xs text-text-muted"><span className="font-medium">Expected:</span> {step.expected}</div>}
                        </div>
                        <button className="text-error disabled:opacity-40" disabled={isLocked} onClick={() => handleDeleteTemplateStep(step.id)}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  {!isLocked && (
                    <div className="glass rounded-xl p-3 space-y-3">
                      <Input label="Step title" value={templateStep.title} onChange={(e) => setTemplateStep({ ...templateStep, title: e.target.value })} />
                      <div><label className="text-sm text-text-secondary mb-2 block">Instruction</label><MarkdownEditor value={templateStep.instruction} onChange={(instruction) => setTemplateStep({ ...templateStep, instruction })} rows={4} placeholder="Markdown instruction" /></div>
                      <div><label className="text-sm text-text-secondary mb-2 block">Expected result</label><MarkdownEditor value={templateStep.expected} onChange={(expected) => setTemplateStep({ ...templateStep, expected })} rows={3} placeholder="Expected result" /></div>
                      <Button onClick={handleAddTemplateStep} disabled={!templateStep.title || !templateStep.instruction}><Plus className="w-4 h-4 mr-2" />Add Template Step</Button>
                    </div>
                  )}
                </div>
              )}

              {selectedTestCase && activeTab === 'details' && (
                <div className="space-y-4">
                  {selectedTestCase.description && <MarkdownBlock label="Description" value={selectedTestCase.description} />}
                  {selectedTestCase.testData && <MarkdownBlock label="Test Data" value={selectedTestCase.testData} />}
                  {selectedTestCase.expectedResult && <MarkdownBlock label="Expected Result" value={selectedTestCase.expectedResult} />}
                  <div className="grid grid-cols-2 gap-4 text-sm"><div><label className="text-text-muted">Last Run</label><p>{selectedTestCase.checkedAt ? new Date(selectedTestCase.checkedAt).toLocaleString() : '-'}</p></div><div><label className="text-text-muted">Created</label><p>{new Date(selectedTestCase.createdAt).toLocaleDateString()}</p></div></div>
                  {(selectedTestCase.connectionsAsSource.length > 0 || selectedTestCase.connectionsAsTarget.length > 0) && <div><label className="text-sm text-text-muted mb-2 block">Connections</label><div className="space-y-1">{selectedTestCase.connectionsAsSource.map(conn => <ConnectionRow key={conn.id} label={`→ ${testCases.find(tc => tc.id === conn.targetId)?.title || 'Unknown'}`} onDelete={() => handleDeleteConnection(conn.sourceId, conn.targetId)} disabled={isLocked} />)}{selectedTestCase.connectionsAsTarget.map(conn => <ConnectionRow key={conn.id} label={`${testCases.find(tc => tc.id === conn.sourceId)?.title || 'Unknown'} →`} onDelete={() => handleDeleteConnection(conn.sourceId, conn.targetId)} disabled={isLocked} />)}</div></div>}
                </div>
              )}

              {selectedTestCase && activeTab === 'steps' && (
                <div className="space-y-4">{selectedTestCase.steps.length === 0 ? <p className="text-text-muted text-center py-4">No steps defined</p> : selectedTestCase.steps.map((step, i) => <div key={step.id} className="glass rounded-xl p-3"><div className="flex items-start gap-3"><span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-sm flex items-center justify-center shrink-0">{i + 1}</span><div className="prose prose-invert prose-sm max-w-none text-text-secondary"><ReactMarkdown remarkPlugins={[remarkGfm]}>{step.text}</ReactMarkdown>{step.imageUrl && <img src={step.imageUrl} alt="" className="mt-2 rounded-lg max-w-full" />}</div></div></div>)}</div>
              )}

              {selectedTestCase && activeTab === 'history' && (
                <div className="space-y-4">{testHistory.length === 0 ? <p className="text-text-muted text-center py-4">No test history yet</p> : testHistory.map((run) => <div key={run.id} className={`glass rounded-xl p-4 ${run.status === 'pass' ? 'border-l-4 border-green-500' : run.status === 'fail' ? 'border-l-4 border-red-500' : 'border-l-4 border-yellow-500'}`}><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2">{run.status === 'pass' ? <CheckCircle className="w-5 h-5 text-green-500" /> : run.status === 'fail' ? <XCircle className="w-5 h-5 text-red-500" /> : <Clock className="w-5 h-5 text-yellow-500" />}<span className="font-semibold">{run.status}</span></div><span className="text-xs text-text-muted">{new Date(run.checkedAt).toLocaleString()}</span></div>{run.notes && <div className="prose prose-invert prose-sm max-w-none text-text-secondary"><ReactMarkdown remarkPlugins={[remarkGfm]}>{run.notes}</ReactMarkdown></div>}</div>)}</div>
              )}
            </div>
          </aside>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTestCase(null); }} title={editingTestCase ? 'Edit Test Case' : 'Create Test Case'} size="lg">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input label="Test Case Name" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
            <div><label className="text-sm text-text-secondary mb-2 block">Description</label><MarkdownEditor value={formData.description} onChange={(description) => setFormData({ ...formData, description })} rows={3} placeholder="Description" /></div>
            <div><label className="text-sm text-text-secondary mb-2 block">Test Case Type</label><select value={formData.testCaseType || ''} onChange={(e) => setFormData({ ...formData, testCaseType: e.target.value || null })} className="glass-input w-full px-4 py-3 rounded-xl"><option value="">Select Type</option><option value="Positive Case">Positive Case</option><option value="Negative Case">Negative Case</option></select></div>
            <div><label className="text-sm text-text-secondary mb-2 block">Test Data</label><MarkdownEditor value={formData.testData} onChange={(testData) => setFormData({ ...formData, testData })} rows={3} placeholder="Test data" /></div>
            <div><label className="text-sm text-text-secondary mb-2 block">Expected Result</label><MarkdownEditor value={formData.expectedResult} onChange={(expectedResult) => setFormData({ ...formData, expectedResult })} rows={3} placeholder="Expected result" /></div>
            <div>
              <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium text-text-secondary">Test Steps</label><Button type="button" variant="ghost" size="sm" onClick={addStep}><Plus className="w-4 h-4 mr-1" />Add Step</Button></div>
              <div className="space-y-3">{steps.map((step, i) => <div key={i} className="flex gap-2 items-start"><div className="flex-1"><MarkdownEditor value={step.text} onChange={(value) => { const next = [...steps]; next[i].text = value; setSteps(next); }} placeholder={`Step ${i + 1}`} rows={2} /></div><Button type="button" variant="danger" size="sm" onClick={() => removeStep(i)}>×</Button></div>)}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">Connect To</label>
              <div className="glass-input rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                {testCases.filter(tc => tc.id !== editingTestCase?.id).length === 0 ? (
                  <p className="text-text-muted text-sm">No other test cases available</p>
                ) : (
                  testCases.filter(tc => tc.id !== editingTestCase?.id).map(tc => (
                    <label key={tc.id} className="flex items-center gap-2 cursor-pointer hover:bg-bg-secondary/50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={formData.connections.includes(tc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, connections: [...formData.connections, tc.id] });
                          } else {
                            setFormData({ ...formData, connections: formData.connections.filter(id => id !== tc.id) });
                          }
                        }}
                        className="rounded accent-accent"
                      />
                      <span className="text-text-secondary text-sm truncate">{tc.title}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6"><Button type="button" variant="secondary" onClick={() => { setIsModalOpen(false); setEditingTestCase(null); }}>Cancel</Button><Button type="submit" loading={submitting}>Save</Button></div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete test case" size="sm" footer={<><Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button><Button variant="danger" onClick={() => handleDelete(deleteConfirm!)}>Delete</Button></>}>
        <p className="text-text-secondary">Delete this test case?</p>
      </Modal>
    </div>
  );
}

function MarkdownBlock({ label, value }: { label: string; value: string }) {
  return <div><label className="text-sm text-text-muted">{label}</label><div className="text-text-secondary mt-1 prose prose-invert prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown></div></div>;
}

function ConnectionRow({ label, onDelete, disabled }: { label: string; onDelete: () => void; disabled: boolean }) {
  return <div className="flex items-center justify-between glass rounded-lg px-3 py-2 text-sm"><span className="text-text-secondary truncate">{label}</span><button disabled={disabled} onClick={onDelete} className="text-error hover:text-error/80 disabled:opacity-40"><X className="w-3 h-3" /></button></div>;
}
