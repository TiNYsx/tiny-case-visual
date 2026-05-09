'use client';

import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
  };

  const maxHeights = {
    sm: 'max-h-[60vh]',
    md: 'max-h-[70vh]',
    lg: 'max-h-[85vh]',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-bg-primary/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative z-[101] w-full ${sizes[size]} ${maxHeights[size]} mx-4 glass rounded-2xl flex flex-col`}
          >
            {title && (
              <div className="flex-shrink-0 flex items-center justify-between p-6 pb-0">
                <h2 className="text-xl font-semibold">{title}</h2>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
            {footer && <div className="flex-shrink-0 flex justify-end gap-3 px-6 pb-6">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}