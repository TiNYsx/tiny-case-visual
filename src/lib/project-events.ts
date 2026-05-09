type ProjectEvent = {
  projectId: string;
  type: string;
  payload?: unknown;
  createdAt: string;
};

type Listener = (event: ProjectEvent) => void;

const globalForEvents = globalThis as unknown as {
  tinyCaseProjectListeners?: Map<string, Set<Listener>>;
};

const listeners = globalForEvents.tinyCaseProjectListeners ?? new Map<string, Set<Listener>>();

globalForEvents.tinyCaseProjectListeners = listeners;

export function subscribeProjectEvents(projectId: string, listener: Listener) {
  const projectListeners = listeners.get(projectId) ?? new Set<Listener>();
  projectListeners.add(listener);
  listeners.set(projectId, projectListeners);

  return () => {
    projectListeners.delete(listener);
    if (projectListeners.size === 0) listeners.delete(projectId);
  };
}

export function publishProjectEvent(projectId: string, type: string, payload?: unknown) {
  const event: ProjectEvent = {
    projectId,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };

  const projectListeners = listeners.get(projectId);
  if (!projectListeners) return;

  for (const listener of projectListeners) {
    listener(event);
  }
}
