'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, CheckCircle, XCircle, Clock, Upload, Square, Play, Trash2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';

interface TemplateStep {
  id: string;
  title: string;
  instruction: string;
  expected: string | null;
  order: number;
}

interface TestCaseConnection {
  id: string;
  sourceId: string;
  targetId: string;
}

interface TestCaseStep {
  id: string;
  text: string;
  imageUrl: string | null;
}

interface TestCase {
  id: string;
  title: string;
  description: string | null;
  testCaseType: string | null;
  testData: string | null;
  expectedResult: string | null;
  steps: TestCaseStep[];
  connectionsAsSource: TestCaseConnection[];
  connectionsAsTarget: TestCaseConnection[];
  checkedAt: string | null;
  status: string | null;
}

interface Evidence {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number | null;
}

interface StepResult {
  id: string;
  status: 'pending' | 'pass' | 'fail';
  notes: string | null;
  actualResult: string | null;
  changedDetails: string | null;
  order: number;
  templateStep?: TemplateStep;
  testCase?: TestCase;
  evidence: Evidence[];
}

interface TestSession {
  id: string;
  status: 'running' | 'completed' | 'stopped';
  title: string | null;
  notes: string | null;
  startedAt: string;
  endedAt: string | null;
  testerId: string;
  tester: { id: string; name: string | null; email: string | null };
  stoppedBy?: { id: string; name: string | null; email: string | null } | null;
  stepResults: StepResult[];
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  isManager?: boolean;
  templateSteps: TemplateStep[];
  testSessions: TestSession[];
}

export default function RunTestPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const startWithTestCaseId = searchParams.get('startWith');

  const [project, setProject] = useState<Project | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [runningSession, setRunningSession] = useState<TestSession | null>(null);
  const [history, setHistory] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [sessionNotes, setSessionNotes] = useState('');
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      const requests = [
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/sessions`),
      ];
      if (startWithTestCaseId) {
        requests.push(fetch(`/api/testcases?projectId=${projectId}`));
      }

      const results = await Promise.all(requests);

      if (results[0].ok) setProject(await results[0].json());
      if (results[1].ok) {
        const data = await results[1].json();
        setRunningSession(data.runningSession);
        setHistory(data.history || []);
        setSessionNotes(data.runningSession?.notes || '');
      }
      if (startWithTestCaseId && results[2]?.ok) {
        setTestCases(await results[2].json());
      }
    } catch (err) {
      console.error('Error fetching run data:', err);
      setError('Could not load test session data.');
    } finally {
      setLoading(false);
    }
  }, [projectId, startWithTestCaseId]);

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

  const activeTesterIsMe = runningSession?.testerId === session?.user?.id;
  const selectedResult = runningSession?.stepResults[selectedStepIndex] || null;

  const buildTestSequence = (startId: string): TestCase[] => {
    const visited = new Set<string>();
    const sequence: TestCase[] = [];
    const queue = [startId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const tc = testCases.find(t => t.id === currentId);
      if (tc) {
        sequence.push(tc);
        // Add connected test cases (following outgoing connections)
        tc.connectionsAsSource.forEach(conn => {
          if (!visited.has(conn.targetId)) {
            queue.push(conn.targetId);
          }
        });
      }
    }
    return sequence;
  };

  const startSession = async () => {
    setStarting(true);
    setError(null);
    try {
      const body: { title: string; testCaseIds?: string[] } = { title: `${project?.name || 'Project'} test` };

      if (startWithTestCaseId && testCases.length > 0) {
        const sequence = buildTestSequence(startWithTestCaseId);
        body.testCaseIds = sequence.map(tc => tc.id);
      }

      const res = await fetch(`/api/projects/${projectId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not start test session.');
        return;
      }
      setRunningSession(data);
      setSelectedStepIndex(0);
    } finally {
      setStarting(false);
    }
  };

  const updateCurrentResult = (patch: Partial<StepResult>) => {
    if (!runningSession || !selectedResult) return;
    setRunningSession({
      ...runningSession,
      stepResults: runningSession.stepResults.map(result => result.id === selectedResult.id ? { ...result, ...patch } : result),
    });
  };

  const saveSession = async () => {
    if (!runningSession) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/sessions/${runningSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: sessionNotes, stepResults: runningSession.stepResults }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save test session.');
        return;
      }
      setRunningSession(data);
    } finally {
      setSaving(false);
    }
  };

  const finishSession = async () => {
    if (!runningSession) return;
    await saveSession();
    const res = await fetch(`/api/projects/${projectId}/sessions/${runningSession.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'finish', notes: sessionNotes }),
    });
    if (res.ok) fetchData();
  };

  const stopSession = async () => {
    if (!runningSession) return;
    const res = await fetch(`/api/projects/${projectId}/sessions/${runningSession.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', notes: sessionNotes }),
    });
    if (res.ok) fetchData();
  };

  const deleteHistory = async (sessionId: string) => {
    const res = await fetch(`/api/projects/${projectId}/sessions/${sessionId}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  const uploadEvidence = async (file: File) => {
    if (!runningSession || !selectedResult) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const upload = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(upload.error || 'Could not upload evidence.');
        return;
      }

      const evidenceRes = await fetch(`/api/projects/${projectId}/sessions/${runningSession.id}/results/${selectedResult.id}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(upload),
      });
      if (evidenceRes.ok) fetchData();
    } finally {
      setSaving(false);
    }
  };

  if (loading || status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><div className="glass p-8 rounded-2xl text-text-secondary animate-pulse">Loading...</div></div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-grid bg-gradient-radial">
      <header className="glass border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="sm" className="!p-1.5" onClick={() => router.push(`/project/${projectId}`)}><ArrowLeft className="w-5 h-5" /></Button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{project?.name} Test Session</h1>
            <p className="text-sm text-text-muted truncate">One active tester per project</p>
          </div>
        </div>
        {runningSession ? <StatusBadge status={runningSession.status} /> : <Button onClick={startSession} loading={starting} disabled={!project?.templateSteps?.length}><Play className="w-4 h-4 mr-2" />Start Test</Button>}
      </header>

      {error && <div className="bg-error/15 border-b border-error/30 px-6 py-2 text-sm text-red-200">{error}</div>}

      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_360px] gap-6">
          <section className="space-y-4">
            {!runningSession && (
              <div className="glass rounded-2xl p-6 text-center">
                <Lock className="w-10 h-10 mx-auto text-text-muted mb-3" />
                <h2 className="text-xl font-semibold mb-2">No active test</h2>
                <p className="text-text-secondary mb-4">Start a project test session to lock the template and record step-by-step evidence.</p>
                {!project?.templateSteps?.length && <p className="text-yellow-200 text-sm">Create template steps on the project page before starting.</p>}
              </div>
            )}

            {runningSession && (
              <div className="glass rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Active test</h2>
                    <p className="text-sm text-text-muted">Testing by {runningSession.tester.name || runningSession.tester.email}</p>
                  </div>
                  <div className="flex gap-2">
                    {activeTesterIsMe && <Button variant="secondary" onClick={saveSession} loading={saving}>Save</Button>}
                    {activeTesterIsMe && <Button onClick={finishSession}>Finish</Button>}
                    {project?.isManager && <Button variant="danger" onClick={stopSession}><Square className="w-4 h-4 mr-2" />Stop</Button>}
                  </div>
                </div>

                {!activeTesterIsMe && <div className="mb-4 glass rounded-xl p-3 text-sm text-yellow-200">This session is read-only for you because another tester is active.</div>}

                {selectedResult && (
                  <div className="space-y-5">
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0">{selectedStepIndex + 1}</span>
                      <div className="min-w-0 flex-1">
                        {selectedResult.testCase ? (
                          <>
                            <h3 className="font-semibold">{selectedResult.testCase.title}</h3>
                            {selectedResult.testCase.description && <div className="prose prose-invert prose-sm max-w-none mt-2 text-text-secondary"><ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedResult.testCase.description}</ReactMarkdown></div>}
                            {selectedResult.testCase.testData && <div className="mt-3 text-sm"><span className="font-medium text-text-muted">Test Data:</span> <span className="text-text-secondary">{selectedResult.testCase.testData}</span></div>}
                            {selectedResult.testCase.expectedResult && <div className="mt-2 text-sm"><span className="font-medium text-text-muted">Expected Result:</span> <span className="text-text-secondary">{selectedResult.testCase.expectedResult}</span></div>}
                            {selectedResult.testCase.steps && selectedResult.testCase.steps.length > 0 && (
                              <div className="mt-3 space-y-2">
                                <span className="text-sm font-medium text-text-muted">Steps:</span>
                                {selectedResult.testCase.steps.map((step, i) => (
                                  <div key={step.id} className="glass rounded-lg p-2 text-sm text-text-secondary">
                                    <span className="font-medium">{i + 1}.</span> {step.text}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <h3 className="font-semibold">{selectedResult.templateStep?.title}</h3>
                            <div className="prose prose-invert prose-sm max-w-none mt-2 text-text-secondary"><ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedResult.templateStep?.instruction}</ReactMarkdown></div>
                            {selectedResult.templateStep?.expected && <div className="mt-3 text-sm text-text-muted"><span className="font-medium">Expected:</span> {selectedResult.templateStep?.expected}</div>}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant={selectedResult.status === 'pass' ? 'primary' : 'secondary'} disabled={!activeTesterIsMe} onClick={() => updateCurrentResult({ status: 'pass' })}><CheckCircle className="w-4 h-4 mr-2" />Pass</Button>
                      <Button variant={selectedResult.status === 'fail' ? 'danger' : 'secondary'} disabled={!activeTesterIsMe} onClick={() => updateCurrentResult({ status: 'fail' })}><XCircle className="w-4 h-4 mr-2" />Fail</Button>
                      <Button variant="secondary" disabled={!activeTesterIsMe} onClick={() => updateCurrentResult({ status: 'pending' })}><Clock className="w-4 h-4 mr-2" />Pending</Button>
                    </div>

                    <FieldEditor label="Notes / Markdown / Code blocks" value={selectedResult.notes || ''} disabled={!activeTesterIsMe} onChange={(notes) => updateCurrentResult({ notes })} />
                    <FieldEditor label="Actual result" value={selectedResult.actualResult || ''} disabled={!activeTesterIsMe} onChange={(actualResult) => updateCurrentResult({ actualResult })} />
                    <FieldEditor label="Changes made" value={selectedResult.changedDetails || ''} disabled={!activeTesterIsMe} onChange={(changedDetails) => updateCurrentResult({ changedDetails })} />

                    <div>
                      <label className="text-sm text-text-secondary mb-2 block">Evidence</label>
                      <div className="space-y-2 mb-3">{selectedResult.evidence.map(item => <a key={item.id} href={item.url} target="_blank" className="glass rounded-lg px-3 py-2 text-sm text-accent flex items-center gap-2"><Upload className="w-4 h-4" />{item.name}</a>)}</div>
                      {activeTesterIsMe && <label className="inline-flex items-center gap-2 cursor-pointer glass-button rounded-xl px-4 py-2 text-sm"><Upload className="w-4 h-4" />Upload evidence<input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadEvidence(e.target.files[0])} /></label>}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <Button variant="secondary" disabled={selectedStepIndex === 0} onClick={() => setSelectedStepIndex(selectedStepIndex - 1)}>Previous</Button>
                      <span className="text-sm text-text-muted">Step {selectedStepIndex + 1} of {runningSession.stepResults.length}</span>
                      <Button variant="secondary" disabled={selectedStepIndex >= runningSession.stepResults.length - 1} onClick={() => setSelectedStepIndex(selectedStepIndex + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            {runningSession && (
              <div className="glass rounded-2xl p-4">
                <h3 className="font-semibold mb-3">Session steps</h3>
                <div className="space-y-2">{runningSession.stepResults.map((result, index) => <button key={result.id} onClick={() => setSelectedStepIndex(index)} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${selectedStepIndex === index ? 'bg-accent/20 text-accent' : 'bg-bg-primary/50 text-text-secondary'}`}><StepIcon status={result.status} /><span className="truncate">{result.testCase?.title || result.templateStep?.title}</span></button>)}</div>
                <div className="mt-4"><FieldEditor label="Session notes" value={sessionNotes} disabled={!activeTesterIsMe} onChange={setSessionNotes} rows={4} /></div>
              </div>
            )}

            <div className="glass rounded-2xl p-4">
              <h3 className="font-semibold mb-3">History</h3>
              <div className="space-y-3 max-h-[520px] overflow-y-auto">{history.length === 0 ? <p className="text-sm text-text-muted">No finished sessions yet.</p> : history.map(item => <div key={item.id} className="bg-bg-primary/50 rounded-xl p-3"><div className="flex items-center justify-between gap-2"><div className="text-sm font-medium">{item.title || 'Test session'}</div><StatusBadge status={item.status} /></div><div className="text-xs text-text-muted mt-1">{item.tester.name || item.tester.email} · {new Date(item.startedAt).toLocaleString()}</div><div className="flex justify-end mt-2"><Button variant="ghost" size="sm" className="!p-1" onClick={() => deleteHistory(item.id)}><Trash2 className="w-4 h-4 text-error" /></Button></div></div>)}</div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function FieldEditor({ label, value, onChange, disabled, rows = 5 }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; rows?: number }) {
  return <div><label className="text-sm text-text-secondary mb-2 block">{label}</label>{disabled ? <div className="prose prose-invert prose-sm max-w-none glass rounded-xl p-3 min-h-24 text-text-secondary"><ReactMarkdown remarkPlugins={[remarkGfm]}>{value || '-'}</ReactMarkdown></div> : <MarkdownEditor value={value} onChange={onChange} rows={rows} placeholder={label} />}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const className = status === 'completed' ? 'bg-green-500/20 text-green-300' : status === 'stopped' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300';
  return <span className={`text-xs rounded-full px-2 py-1 ${className}`}>{status}</span>;
}

function StepIcon({ status }: { status: string }) {
  if (status === 'pass') return <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <Clock className="w-4 h-4 text-yellow-400 shrink-0" />;
}
