'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, CheckCircle, XCircle, ChevronRight, ChevronLeft, Image, Paperclip, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';

const ReactFlow = dynamic(() => import('reactflow').then(m => ({ default: m.ReactFlow })), { ssr: false });

interface TestCase {
  id: string;
  title: string;
  description: string | null;
  status: string;
  parentId: string | null;
  steps: { id: string; text: string; imageUrl: string | null; order: number }[];
}

interface TestRunStep {
  stepId: string;
  status: 'pending' | 'pass' | 'fail';
  notes: string;
}

export default function RunTestPage() {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepResults, setStepResults] = useState<TestRunStep[]>([]);
  const [testRunStatus, setTestRunStatus] = useState<'pending' | 'pass' | 'fail'>('pending');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    else if (status === 'authenticated') fetchData();
  }, [status, router]);

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

  const startTestCase = (tc: TestCase) => {
    setSelectedTestCase(tc);
    setCurrentStepIndex(0);
    setStepResults(tc.steps.map(s => ({ stepId: s.id, status: 'pending', notes: '' })));
    setTestRunStatus('pending');
    setNotes('');
  };

  const handleStepPass = () => {
    const newResults = [...stepResults];
    newResults[currentStepIndex].status = 'pass';
    setStepResults(newResults);
  };

  const handleStepFail = () => {
    const newResults = [...stepResults];
    newResults[currentStepIndex].status = 'fail';
    setStepResults(newResults);
  };

  const handleStepNotesChange = (text: string) => {
    const newResults = [...stepResults];
    newResults[currentStepIndex].notes = text;
    setStepResults(newResults);
  };

  const nextStep = () => {
    if (selectedTestCase && currentStepIndex < selectedTestCase?.steps?.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const finishTestRun = async (finalStatus: 'pass' | 'fail') => {
    if (!selectedTestCase) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/test-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCaseId: selectedTestCase.id,
          status: finalStatus,
          stepResults: JSON.stringify(stepResults),
          notes,
        }),
      });

      if (res.ok) {
        setTestRunStatus(finalStatus);
        if (finalStatus === 'pass') {
          await fetch(`/api/testcases/${selectedTestCase.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pass' }),
          });
        } else {
          await fetch(`/api/testcases/${selectedTestCase.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'fail' }),
          });
        }
      }
    } catch (error) {
      console.error('Error saving test run:', error);
    }
    setSubmitting(false);
  };

  const resetTestCase = () => {
    setSelectedTestCase(null);
    setCurrentStepIndex(0);
    setStepResults([]);
    setTestRunStatus('pending');
    setNotes('');
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

  if (testRunStatus !== 'pending' && selectedTestCase) {
    return (
      <div className="min-h-screen flex flex-col bg-grid bg-gradient-radial">
        <header className="glass border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={resetTestCase}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">{selectedTestCase.title}</h1>
              <p className="text-sm text-text-muted">Test Complete</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-xl ${testRunStatus === 'pass' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {testRunStatus === 'pass' ? t('testCase.pass') : t('testCase.fail')}
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="glass rounded-xl p-6">
              <h3 className="font-semibold mb-4">Step Results</h3>
              <div className="space-y-2">
                {stepResults.map((result, i) => (
                  <div key={result.stepId} className="flex items-center gap-3 p-2 rounded-lg bg-bg-primary/50">
                    <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-sm flex items-center justify-center">{i + 1}</span>
                    <span className="flex-1 text-text-secondary text-sm">
                      {selectedTestCase.steps.find(s => s.id === result.stepId)?.text.substring(0, 50)}...
                    </span>
                    {result.status === 'pass' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {notes && (
              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-text-secondary text-sm whitespace-pre-wrap">{notes}</p>
              </div>
            )}

            <Button onClick={() => startTestCase(selectedTestCase)} className="w-full">
              Run Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-grid bg-gradient-radial">
      <header className="glass border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/project/${projectId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Run Test - {project?.name}</h1>
            <p className="text-sm text-text-secondary">Select a test case to run</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!selectedTestCase ? (
          <div className="flex-1 p-6 overflow-auto">
            <div className="grid gap-4 max-w-4xl mx-auto">
              {testCases.filter(tc => !tc.parentId).map(tc => (
                <div key={tc.id} className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{tc.title}</h3>
                      <p className="text-sm text-text-muted mt-1">{tc.steps?.length || 0} steps</p>
                    </div>
                    <Button onClick={() => startTestCase(tc)}>
                      Start Test
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 p-6 overflow-auto">
              <div className="max-w-2xl mx-auto">
                <div className="mb-4 flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={resetTestCase}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <div className="text-text-muted text-sm">
                    Step {currentStepIndex + 1} of {selectedTestCase?.steps?.length}
                  </div>
                </div>

                <div className="glass rounded-xl p-6 mb-4">
                  <h2 className="text-xl font-semibold mb-2">{selectedTestCase.title}</h2>
                  {selectedTestCase.description && (
                    <div className="text-text-secondary prose prose-invert prose-sm max-w-none mb-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedTestCase.description}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {selectedTestCase?.steps?.length > 0 && (
                  <div className="glass rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold">
                        {currentStepIndex + 1}
                      </span>
                      <h3 className="font-semibold">Step {currentStepIndex + 1}</h3>
                    </div>
                    
                    <div className="text-text-secondary prose prose-invert prose-sm max-w-none mb-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedTestCase.steps[currentStepIndex]?.text || ''}
                      </ReactMarkdown>
                    </div>

                    {selectedTestCase.steps[currentStepIndex]?.imageUrl && (
                      <img 
                        src={selectedTestCase.steps[currentStepIndex].imageUrl!} 
                        alt="Step" 
                        className="rounded-lg max-w-full mb-4"
                      />
                    )}

                    <Textarea
                      placeholder="Add notes for this step..."
                      value={stepResults[currentStepIndex]?.notes || ''}
                      onChange={(e) => handleStepNotesChange(e.target.value)}
                      rows={2}
                      className="mb-4"
                    />

                    <div className="flex gap-2">
                      <Button 
                        variant={stepResults[currentStepIndex]?.status === 'pass' ? 'primary' : 'secondary'}
                        onClick={handleStepPass}
                        className="flex-1"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Pass
                      </Button>
                      <Button 
                        variant={stepResults[currentStepIndex]?.status === 'fail' ? 'danger' : 'secondary'}
                        onClick={handleStepFail}
                        className="flex-1"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Fail
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex justify-between mt-4">
                  <Button 
                    variant="ghost" 
                    onClick={prevStep}
                    disabled={currentStepIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  
                  {currentStepIndex === selectedTestCase?.steps?.length - 1 ? (
                    <div className="flex gap-2">
                      <Button 
                        variant="danger" 
                        onClick={() => finishTestRun('fail')}
                        loading={submitting}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Mark as Fail
                      </Button>
                      <Button 
                        variant="primary" 
                        onClick={() => finishTestRun('pass')}
                        loading={submitting}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as Pass
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={nextStep}>
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="w-80 border-l border-border p-4 overflow-auto">
              <h3 className="font-semibold mb-4">Steps Overview</h3>
              <div className="space-y-2">
                {selectedTestCase.steps.map((step, i) => (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStepIndex(i)}
                    className={`w-full text-left p-2 rounded-lg ${
                      currentStepIndex === i ? 'bg-accent/20 border border-accent' : 'glass'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        stepResults[i]?.status === 'pass' ? 'bg-green-500' : 
                        stepResults[i]?.status === 'fail' ? 'bg-red-500' : 'bg-accent/20 text-accent'
                      }`}>
                        {stepResults[i]?.status === 'pass' ? <CheckCircle className="w-3 h-3" /> :
                         stepResults[i]?.status === 'fail' ? <XCircle className="w-3 h-3" /> :
                         i + 1}
                      </span>
                      <span className="text-sm truncate">{step.text.substring(0, 30)}...</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="text-sm text-text-muted mb-2 block">Overall Notes</label>
                <Textarea
                  placeholder="Add overall notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}