'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, ArrowLeft, Settings, Users, CheckCircle, XCircle, Clock, 
  MessageSquare, MoreVertical, Edit2, Trash2, ChevronRight 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const ReactFlow = dynamic(() => import('reactflow'), { ssr: false });
import 'reactflow/dist/style.css';

interface TestCase {
  id: string;
  title: string;
  description: string | null;
  parentId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  checkedAt: string | null;
  steps: { id: string; text: string; imageUrl: string | null; order: number }[];
  _count: { comments: number };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdBy: { id: string; displayName: string; photoURL: string | null };
}

const statusColors = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-500', border: 'border-yellow-500/30' },
  pass: { bg: 'bg-green-500/20', text: 'text-green-500', border: 'border-green-500/30' },
  fail: { bg: 'bg-red-500/20', text: 'text-red-500', border: 'border-red-500/30' },
};

const statusIcons = {
  pending: Clock,
  pass: CheckCircle,
  fail: XCircle,
};

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
  const [formData, setFormData] = useState({ title: '', description: '', parentId: '' as string | null });
  const [steps, setSteps] = useState<{ text: string; imageUrl: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'steps' | 'comments'>('details');
  const [commentText, setCommentText] = useState('');
  const [commentType, setCommentType] = useState<'comment' | 'bug'>('comment');
  const [comments, setComments] = useState<any[]>([]);

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

  const fetchComments = async (testCaseId: string) => {
    try {
      const res = await fetch(`/api/comments?testCaseId=${testCaseId}`);
      if (res.ok) setComments(await res.json());
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const nodes = useMemo(() => {
    const nodeMap = new Map();
    testCases.forEach(tc => {
      nodeMap.set(tc.id, { ...tc, children: [] as TestCase[] });
    });
    testCases.forEach(tc => {
      if (tc.parentId && nodeMap.has(tc.parentId)) {
        nodeMap.get(tc.parentId).children.push(tc);
      }
    });
    const roots = Array.from(nodeMap.values()).filter((tc: any) => !tc.parentId);
    
    const result: any[] = [];
    let yOffset = 0;
    const traverse = (nodes: any[], x: number, y: number, level: number) => {
      nodes.forEach((node, i) => {
        result.push({
          id: node.id,
          position: { x: x + level * 300, y: y + i * 120 + yOffset },
          data: node,
        });
        if (node.children && node.children.length > 0) {
          traverse(node.children, x, y + i * 120 + yOffset, level + 1);
        }
      });
      if (nodes.length > 0) yOffset += (nodes.length - 1) * 120;
    };
    traverse(roots, 100, 100, 0);
    return result;
  }, [testCases]);

  const edges = useMemo(() => {
    return testCases
      .filter(tc => tc.parentId)
      .map(tc => ({
        id: `e-${tc.parentId}-${tc.id}`,
        source: tc.parentId!,
        target: tc.id,
        type: 'smoothstep',
      }));
  }, [testCases]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingTestCase ? `/api/testcases/${editingTestCase.id}` : '/api/testcases';
      const method = editingTestCase ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, projectId, steps }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingTestCase(null);
        setFormData({ title: '', description: '', parentId: null });
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

  const handleStatusChange = async (id: string, status: 'pass' | 'fail') => {
    try {
      const res = await fetch(`/api/testcases/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchData();
        if (selectedTestCase?.id === id) {
          setSelectedTestCase(prev => prev ? { ...prev, status } : null);
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedTestCase) return;
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseId: selectedTestCase.id, text: commentText, type: commentType }),
      });
      if (res.ok) {
        setCommentText('');
        fetchComments(selectedTestCase.id);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const openEditModal = (tc: TestCase) => {
    setEditingTestCase(tc);
    setFormData({ title: tc.title, description: tc.description || '', parentId: tc.parentId });
    setSteps(tc.steps.map(s => ({ text: s.text, imageUrl: s.imageUrl || '' })));
    setIsModalOpen(true);
  };

  const addStep = () => setSteps([...steps, { text: '', imageUrl: '' }]);
  const removeStep = (index: number) => setSteps(steps.filter((_, i) => i !== index));

  const handleNodeClick = (_: any, node: any) => {
    setSelectedTestCase(node.data);
    setActiveTab('details');
    fetchComments(node.data.id);
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
      <header className="glass border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">{project?.name}</h1>
            <p className="text-sm text-text-secondary">{project?.description || '-'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setEditingTestCase(null); setFormData({ title: '', description: '', parentId: null }); setSteps([]); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {t('testCase.create')}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes.map(n => ({
              ...n,
              type: 'default',
              style: { background: 'rgba(26, 26, 37, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', width: 200 },
            }))}
            edges={edges.map(e => ({ ...e, animated: false, style: { stroke: 'rgba(255,255,255,0.1)' } }))}
            onNodeClick={handleNodeClick}
            fitView
            attributionPosition="bottom-left"
          >
            {nodes.map(node => {
              const StatusIcon = statusIcons[node.data.status as keyof typeof statusIcons];
              const colors = statusColors[node.data.status as keyof typeof statusColors];
              return (
                <div key={node.id} className="w-[180px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${colors.bg.replace('/20', '')}`} />
                    <span className="font-medium text-sm truncate">{node.data.title}</span>
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${colors.text}`}>
                    <StatusIcon className="w-3 h-3" />
                    <span>{t(`testCase.${node.data.status}`)}</span>
                  </div>
                  {node.data._count?.comments > 0 && (
                    <div className="flex items-center gap-1 text-xs text-text-muted mt-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>{node.data._count.comments}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </ReactFlow>
        </div>

        <AnimatePresence>
          {selectedTestCase && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="w-[400px] glass border-l border-border flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold truncate">{selectedTestCase.title}</h3>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditModal(selectedTestCase)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(selectedTestCase.id)}>
                    <Trash2 className="w-4 h-4 text-error" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTestCase(null)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex border-b border-border">
                {(['details', 'steps', 'comments'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); if (tab === 'comments') fetchComments(selectedTestCase.id); }}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab ? 'text-accent border-b-2 border-accent' : 'text-text-muted'}`}
                  >
                    {t(`testCase.${tab}`)}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-text-muted">{t('testCase.description')}</label>
                      <p className="text-text-secondary mt-1">{selectedTestCase.description || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-text-muted">{t('testCase.status')}</label>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant={selectedTestCase.status === 'pass' ? 'primary' : 'secondary'} onClick={() => handleStatusChange(selectedTestCase.id, 'pass')}>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {t('testCase.pass')}
                        </Button>
                        <Button size="sm" variant={selectedTestCase.status === 'fail' ? 'danger' : 'secondary'} onClick={() => handleStatusChange(selectedTestCase.id, 'fail')}>
                          <XCircle className="w-4 h-4 mr-1" />
                          {t('testCase.fail')}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="text-text-muted">{t('testCase.checkedAt')}</label>
                        <p className="text-text-secondary">{selectedTestCase.checkedAt ? new Date(selectedTestCase.checkedAt).toLocaleString('th-TH') : '-'}</p>
                      </div>
                      <div>
                        <label className="text-text-muted">{t('project.createdAt')}</label>
                        <p className="text-text-secondary">{new Date(selectedTestCase.createdAt).toLocaleDateString('th-TH')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'steps' && (
                  <div className="space-y-4">
                    {selectedTestCase.steps.length === 0 ? (
                      <p className="text-text-muted text-center py-4">{t('testCase.addStep')}</p>
                    ) : (
                      selectedTestCase.steps.map((step, i) => (
                        <div key={step.id} className="glass rounded-xl p-3">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-sm flex items-center justify-center shrink-0">{i + 1}</span>
                            <div className="flex-1">
                              <p className="text-text-secondary">{step.text}</p>
                              {step.imageUrl && <img src={step.imageUrl} alt="" className="mt-2 rounded-lg max-w-full" />}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <select value={commentType} onChange={(e) => setCommentType(e.target.value as 'comment' | 'bug')} className="glass-input w-full px-3 py-2 rounded-xl text-sm">
                        <option value="comment">{t('comment.normal')}</option>
                        <option value="bug">{t('comment.bug')}</option>
                      </select>
                      <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder={t('comment.placeholder')} rows={2} />
                      <Button onClick={handleAddComment} size="sm">{t('comment.submit')}</Button>
                    </div>
                    <div className="space-y-2">
                      {comments.map(c => (
                        <div key={c.id} className={`glass rounded-xl p-3 ${c.type === 'bug' ? 'border border-error/30' : ''}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${c.type === 'bug' ? 'bg-error/20 text-error' : 'bg-accent/20 text-accent'}`}>
                              {t(`comment.${c.type}`)}
                            </span>
                            <span className="text-xs text-text-muted">{new Date(c.createdAt).toLocaleString('th-TH')}</span>
                          </div>
                          <p className="text-text-secondary text-sm">{c.text}</p>
                        </div>
                      ))}
                    </div>
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
            <Input label={t('testCase.name')} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
            <Textarea label={t('testCase.description')} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">{t('testCase.parent')}</label>
              <select value={formData.parentId || ''} onChange={(e) => setFormData({ ...formData, parentId: e.target.value || null })} className="glass-input w-full px-4 py-3 rounded-xl">
                <option value="">{t('testCase.noParent')}</option>
                {testCases.filter(tc => tc.id !== editingTestCase?.id).map(tc => (
                  <option key={tc.id} value={tc.id}>{tc.title}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-secondary">{t('testCase.steps')}</label>
                <Button type="button" variant="ghost" size="sm" onClick={addStep}><Plus className="w-4 h-4 mr-1" />{t('testCase.addStep')}</Button>
              </div>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={step.text} onChange={(e) => { const s = [...steps]; s[i].text = e.target.value; setSteps(s); }} placeholder={t('testCase.stepText')} />
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