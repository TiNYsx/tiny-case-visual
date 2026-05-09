'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BlockBasedEditor from '@/components/editor/BlockBasedEditor';
import { Loader2, ArrowLeft, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface Document {
  id: string;
  title: string;
  content: JsonValue;
  markdown?: string;
  updatedAt: string;
}

interface DocumentListItem {
  id: string;
  title: string;
  updatedAt: string;
}

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params?.id as string | undefined;
  const isNew = documentId === 'new';

  const [document, setDocument] = useState<Document | null>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(!isNew && !!documentId);
  const [mentionItems, setMentionItems] = useState<Array<{ id: string; label: string }>>([]);

  // Fetch document list for sidebar and mention suggestions
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Fetch specific document
  useEffect(() => {
    if (documentId && !isNew) {
      fetchDocument(documentId);
    } else if (isNew) {
      setDocument(null);
      setLoading(false);
    }
  }, [documentId, isNew]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        setMentionItems(
          data.map((doc: DocumentListItem) => ({
            id: doc.id,
            label: doc.title,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchDocument = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDocument(data);
      } else {
        toast.error('Document not found');
        router.push('/documents');
      }
    } catch (error) {
      console.error('Error fetching document:', error);
      toast.error('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(
    async (docData: { title: string; content: JsonValue; markdown: string }) => {
      try {
        if (isNew || !documentId) {
          // Create new document
          const res = await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(docData),
          });

          if (res.ok) {
            const newDoc = await res.json();
            toast.success('Document created');
            router.push(`/documents/${newDoc.id}`);
            fetchDocuments();
          } else {
            throw new Error('Failed to create document');
          }
        } else {
          // Update existing document
          const res = await fetch(`/api/documents/${documentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(docData),
          });

          if (res.ok) {
            toast.success('Document saved');
            fetchDocuments();
          } else {
            throw new Error('Failed to save document');
          }
        }
      } catch (error) {
        console.error('Error saving document:', error);
        toast.error('Failed to save document');
        throw error;
      }
    },
    [documentId, isNew, router]
  );

  const createNewDocument = () => {
    router.push('/documents/new');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-50">
        <Loader2 size={32} className="text-stone-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-stone-50">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r border-stone-200 flex flex-col">
        <div className="p-4 border-b border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-stone-600 hover:text-stone-800 transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-medium">Back</span>
            </button>
          </div>
          <button
            onClick={createNewDocument}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            New Document
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-medium text-stone-400 uppercase tracking-wider">
            Documents
          </div>
          <div className="px-2">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => router.push(`/documents/${doc.id}`)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  documentId === doc.id
                    ? 'bg-stone-100 text-stone-800'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <FileText size={16} className="flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{doc.title}</div>
                  <div className="text-xs text-stone-400">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))}

            {documents.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-stone-400">
                No documents yet.
                <br />
                Create your first one!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 overflow-hidden">
        <BlockBasedEditor
          document={document || undefined}
          onSave={handleSave}
          mentionItems={mentionItems}
        />
      </div>
    </div>
  );
}
