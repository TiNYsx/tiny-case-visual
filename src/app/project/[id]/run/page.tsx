'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, CheckCircle, XCircle, ChevronRight, ChevronLeft, Image, Paperclip, Clock, Eye, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea, Input } from '@/components/ui/Input';

interface TestCaseStep {
  id: string;
  text: string;
  imageUrl: string | null;
  order: number;
}

interface TestCase {
  id: string;
  title: string;
  description: string | null;
  testCaseType: string | null;
  testData: string | null;
  expectedResult: string | null;
  status: string;
  steps: TestCaseStep[];
}

interface TestRunStep {
  stepId: string;
  status: 'pending' | 'pass' | 'fail';
  notes: string;
}

interface TestRun {
  id: string;
  testCaseId: string;
  status: string;
  testData: string | null;
  actualResult: string | null;
  notes: string | null;
  stepResults: string | null;
  checkedAt: string;
  comments: any[];
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
  
  // New fields
  const [testData, setTestData] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [testCaseType, setTestCaseType] = useState('');
  
  // History view
  const [showHistory, setShowHistory] = useState(false);
  const [testHistory, setTestHistory] = useState<TestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);

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

  const fetchTestHistory = async (testCaseId: string) => {
    try {
      const res = await fetch(`/api/test-runs?testCaseId=${testCaseId}`);
      if (res.ok) {
        const data = await res.json();
        setTestHistory(data);
        setShowHistory(true);
      }
    } catch (error) {
      console.error('Error fetching test history:', error);
    }
  };

  const startTestCase = (tc: TestCase) => {
    setSelectedTestCase(tc);
    setCurrentStepIndex(0);
    setStepResults((tc.steps || []).map(s => ({ stepId: s.id, status: 'pending', notes: '' })));
    setTestRunStatus('pending');
    setNotes('');
    setTestData(tc.testData || '');
    setActualResult('');
    setTestCaseType(tc.testCaseType || '');
    setSelectedRun(null);
  };

  const startTestFromHistory = (run: TestRun) => {
    if (!selectedTestCase) return;
    setSelectedRun(run);
    setCurrentStepIndex(0);
    
    let parsedResults: TestRunStep[] = [];
    try {
      if (run.stepResults) {
        parsedResults = JSON.parse(run.stepResults);
      }
    } catch {
      parsedResults = (selectedTestCase.steps || []).map(s => ({ stepId: s.id, status: 'pending', notes: '' }));
    }
    
    setStepResults(parsedResults);
    setTestRunStatus('pending');
    setNotes(run.notes || '');
    setTestData(run.testData || selectedTestCase.testData || '');
    setActualResult(run.actualResult || '');
    setTestCaseType(selectedTestCase.testCaseType || '');
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
    if (selectedTestCase && selectedTestCase.steps && selectedTestCase.steps.length > 0) {
      if (currentStepIndex < selectedTestCase.steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      }
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
          testData,
          actualResult,
          testCaseType,
        }),
      });

      if (res.ok) {
        setTestRunStatus(finalStatus);
        await fetch(`/api/testcases/${selectedTestCase.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: finalStatus }),
        });
        fetchData();
      }
    } catch (error) {
      console.error('Error saving test run:', error);
    }
    setSubmitting(false);
  };

  const resetTestCase = () => {
    setSelectedTestCase(null);
    setSelectedRun(null);
    setCurrentStepIndex(0);
    setStepResults([]);
    setTestRunStatus('pending');
    setNotes('');
    setTestData('');
    setActualResult('');
    setTestCaseType('');
    setShowHistory(false);
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

  if (showHistory) {
    return (
      <div className="min-h-screen flex flex-col bg-grid bg-gradient-radial">
        <header className="glass border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Test History</h1>
              <p className="text-sm text-text-muted">{selectedTestCase?.title}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-2xl mx-auto space-y-4">
            {testHistory.length === 0 ? (
              <p className="text-text-muted text-center py-8">No test history yet</p>
            ) : (
              testHistory.map((run) => (
                <div 
                  key={run.id} 
                  className={`glass rounded-xl p-4 cursor-pointer hover:border-accent transition-colors ${run.status === 'pass' ? 'border-l-4 border-green-500' : run.status === 'fail' ? 'border-l-4 border-red-500' : 'border-l-4 border-yellow-500'}`}
                  onClick={() => startTestFromHistory(run)}
                >
                  <div className="flex items-center justify-between mb-3">
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
                      <span className="font-medium">Test Data:</span> {run.testData.substring(0, 50)}...
                    </div>
                  )}
                  {run.actualResult && (
                    <div className="text-sm text-text-secondary mb-2">
                      <span className="font-medium">Actual Result:</span> {run.actualResult.substring(0, 50)}...
                    </div>
                  )}
                  {run.notes && (
                    <div className="text-sm text-text-muted">
                      {run.notes.substring(0, 50)}...
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 mt-3 text-xs text-accent">
                    <Eye className="w-3 h-3" />
                    <span>Click to re-check this run</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (testRunStatus !== 'pending' && selectedTestCase) {
    return (
      <div className="min-h-screen flex flex-col bg-grid bg-gradient-radial">
        <header className="glass border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between">
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
            {testRunStatus === 'pass' ? 'Passed' : 'Failed'}
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="glass rounded-xl p-4 sm:p-6">
              <h3 className="font-semibold mb-4">Test Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-text-muted">Test Case Type</label>
                  <p className="text-text-secondary">{testCaseType || '-'}</p>
                </div>
                <div>
                  <label className="text-text-muted">Test Data Used</label>
                  <p className="text-text-secondary">{testData || '-'}</p>
                </div>
                <div>
                  <label className="text-text-muted">Expected Result</label>
                  <p className="text-text-secondary">{selectedTestCase.expectedResult || '-'}</p>
                </div>
                <div>
                  <label className="text-text-muted">Actual Result</label>
                  <p className="text-text-secondary">{actualResult || '-'}</p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-4 sm:p-6">
              <h3 className="font-semibold mb-4">Step Results</h3>
              <div className="space-y-2">
                {stepResults.map((result, i) => {
                  const step = selectedTestCase.steps?.find(s => s.id === result.stepId);
                  return step ? (
                    <div key={result.stepId} className="flex items-center gap-3 p-2 rounded-lg bg-bg-primary/50">
                      <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-sm flex items-center justify-center">{i + 1}</span>
                      <span className="flex-1 text-text-secondary text-sm truncate">
                        {step.text.substring(0, 40)}...
                      </span>
                      {result.status === 'pass' ? (
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      ) : result.status === 'fail' ? (
                        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-500 shrink-0" />
                      )}
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {notes && (
              <div className="glass rounded-xl p-4 sm:p-6">
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-text-secondary text-sm whitespace-pre-wrap">{notes}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={() => startTestCase(selectedTestCase)} className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />
                Run Again
              </Button>
              <Button variant="secondary" onClick={() => fetchTestHistory(selectedTestCase.id)} className="flex-1">
                <Clock className="w-4 h-4 mr-2" />
                View History
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-grid bg-gradient-radial">
      <header className="glass border-b border-border px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button variant="ghost" size="sm" className="!p-1.5 shrink-0" onClick={() => router.push(`/project/${projectId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold truncate">Run Test - {project?.name}</h1>
            <p className="text-xs sm:text-sm text-text-secondary hidden sm:block">Select a test case to run</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!selectedTestCase ? (
          <div className="flex-1 p-4 sm:p-6 overflow-auto">
            <div className="grid gap-3 sm:gap-4 max-w-4xl mx-auto">
              {testCases.map(tc => (
                <div key={tc.id} className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{tc.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-text-muted">
                        <span>{tc.steps?.length || 0} steps</span>
                        {tc.testCaseType && <span className="px-2 py-0.5 bg-accent/20 rounded text-xs">{tc.testCaseType}</span>}
                      </div>
                    </div>
                    <Button onClick={() => startTestCase(tc)} className="ml-3 shrink-0">
                      Start Test
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 p-4 sm:p-6 overflow-auto">
              <div className="max-w-2xl mx-auto">
                <div className="mb-4 flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="!p-1.5" onClick={resetTestCase}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <div className="text-text-muted text-xs sm:text-sm">
                    {selectedTestCase.steps && selectedTestCase.steps.length > 0 
                      ? `Step ${currentStepIndex + 1} of ${selectedTestCase.steps.length}`
                      : 'No steps'}
                  </div>
                </div>

                <div className="glass rounded-xl p-4 sm:p-6 mb-4">
                  <h2 className="text-lg sm:text-xl font-semibold mb-2">{selectedTestCase.title}</h2>
                  {selectedTestCase.description && (
                    <div className="text-text-secondary prose prose-invert prose-sm max-w-none mb-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedTestCase.description}</ReactMarkdown>
                    </div>
                  )}
                </div>

                <div className="glass rounded-xl p-4 sm:p-6 mb-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-text-muted mb-1 block">Test Case Type</label>
                      <select 
                        value={testCaseType} 
                        onChange={(e) => setTestCaseType(e.target.value)}
                        className="glass-input w-full px-3 py-2 rounded-xl text-sm"
                      >
                        <option value="">Select Type</option>
                        <option value="Positive Case">Positive Case</option>
                        <option value="Negative Case">Negative Case</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-text-muted mb-1 block">Test Data</label>
                      <Input 
                        value={testData} 
                        onChange={(e) => setTestData(e.target.value)}
                        placeholder="Enter or override test data"
                      />
                    </div>
                  </div>
                  
                  {selectedTestCase.expectedResult && (
                    <div>
                      <label className="text-sm text-text-muted mb-1 block">Expected Result</label>
                      <div className="text-text-secondary prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedTestCase.expectedResult}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm text-text-muted mb-1 block">Actual Result</label>
                    <Textarea 
                      value={actualResult} 
                      onChange={(e) => setActualResult(e.target.value)}
                      placeholder="Record actual result after testing"
                      rows={2}
                    />
                  </div>
                </div>

                {selectedTestCase.steps && selectedTestCase.steps.length > 0 ? (
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
                ) : (
                  <div className="glass rounded-xl p-6 text-center text-text-muted">
                    No steps defined for this test case. You can still submit the test result.
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
                  
                  {selectedTestCase.steps && selectedTestCase.steps.length > 0 && currentStepIndex === selectedTestCase.steps.length - 1 ? (
                    <div className="flex gap-2">
                      <Button 
                        variant="danger" 
                        onClick={() => finishTestRun('fail')}
                        loading={submitting}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Fail
                      </Button>
                      <Button 
                        variant="primary" 
                        onClick={() => finishTestRun('pass')}
                        loading={submitting}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Pass
                      </Button>
                    </div>
                  ) : selectedTestCase.steps && selectedTestCase.steps.length > 0 ? (
                    <Button onClick={nextStep}>
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        variant="danger" 
                        onClick={() => finishTestRun('fail')}
                        loading={submitting}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Fail
                      </Button>
                      <Button 
                        variant="primary" 
                        onClick={() => finishTestRun('pass')}
                        loading={submitting}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Pass
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full sm:w-64 md:w-80 border-t sm:border-t-0 sm:border-l border-border p-3 sm:p-4 overflow-auto max-h-[40vh] sm:max-h-none">
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Steps Overview</h3>
              {selectedTestCase.steps && selectedTestCase.steps.length > 0 ? (
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
                        <span className="text-sm truncate">{step.text.substring(0, 25)}...</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted text-sm">No steps defined</p>
              )}

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