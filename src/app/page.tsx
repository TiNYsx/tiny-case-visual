'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, FolderOpen, Settings, LogOut, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  _count?: { testCases: number };
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchProjects();
    }
  }, [status, router]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingProject ? `/api/projects/${editingProject.id}` : '/api/projects';
      const method = editingProject ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingProject(null);
        setFormData({ name: '', description: '' });
        fetchProjects();
      }
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProjects();
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setFormData({ name: project.name, description: project.description || '' });
    setIsModalOpen(true);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-8 rounded-2xl">
          <div className="text-text-secondary animate-pulse">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid bg-gradient-radial">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gradient">{t('app.name')}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" className="!p-2" onClick={() => router.push('/settings')}>
              <Settings className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 sm:ml-2 sm:gap-3">
              {session?.user?.image && (
                <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
              )}
              <Button variant="ghost" size="sm" className="!p-2" onClick={() => router.push('/api/auth/signout')}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h2 className="text-2xl font-bold">{t('nav.projects')}</h2>
            <p className="text-text-secondary mt-1">{t('project.testCases')}</p>
          </div>
          <Button onClick={() => { setEditingProject(null); setFormData({ name: '', description: '' }); setIsModalOpen(true); }}>
            <Plus className="w-5 h-5 mr-2" />
            {t('project.create')}
          </Button>
        </div>

        {projects.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-bg-card flex items-center justify-center">
              <FolderOpen className="w-12 h-12 text-text-muted" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('project.noProjects')}</h3>
            <p className="text-text-secondary mb-6">{t('project.createFirst')}</p>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-5 h-5 mr-2" />
              {t('project.create')}
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-2xl p-4 sm:p-6 cursor-pointer glass-hover"
                onClick={() => router.push(`/project/${project.id}`)}
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center">
                    <FolderOpen className="w-5 sm:w-6 h-5 sm:h-6 text-accent" />
                  </div>
                  <div className="relative">
                    <Button variant="ghost" size="sm" className="!p-1.5" onClick={(e) => e.stopPropagation()}>
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                    <div className="absolute right-0 top-full mt-1 w-36 sm:w-40 glass rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <button
                        className="w-full px-4 py-2 text-left text-sm hover:bg-bg-tertiary rounded-xl flex items-center gap-2"
                        onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                      >
                        <Edit2 className="w-4 h-4" />
                        {t('common.edit')}
                      </button>
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-error hover:bg-bg-tertiary rounded-xl flex items-center gap-2"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(project.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">{project.name}</h3>
                <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                  {project.description || '-'}
                </p>
                <div className="flex items-center justify-between text-sm text-text-muted">
                  <span className="truncate">{project._count?.testCases || 0} {t('project.testCases')}</span>
                  <span className="whitespace-nowrap text-xs">{new Date(project.updatedAt).toLocaleDateString('th-TH')}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingProject(null); }}
        title={editingProject ? t('project.edit') : t('project.create')}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setIsModalOpen(false); setEditingProject(null); }}>
              {t('common.cancel')}
            </Button>
            <Button loading={submitting} onClick={handleSubmit}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label={t('project.name')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('project.name')}
              required
            />
            <Textarea
              label={t('project.description')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('project.description')}
              rows={3}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t('project.delete')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => handleDelete(deleteConfirm!)}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-text-secondary">{t('project.confirmDelete')}</p>
      </Modal>
    </div>
  );
}