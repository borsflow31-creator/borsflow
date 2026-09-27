'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';

interface CreateWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (workspace: any) => void;
}

export default function CreateWorkspaceModal({
    isOpen,
    onClose,
    onSuccess,
}: CreateWorkspaceModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setName('');
            setDescription('');
            setErrors({});
            // Focus on name input after animation
            setTimeout(() => nameInputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isSubmitting) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, isSubmitting, onClose]);

    // Handle click outside
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === modalRef.current && !isSubmitting) {
            onClose();
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!name.trim()) {
            newErrors.name = 'Workspace name is required';
        } else if (name.length < 2) {
            newErrors.name = 'Workspace name must be at least 2 characters';
        } else if (name.length > 100) {
            newErrors.name = 'Workspace name must be less than 100 characters';
        }

        if (description && description.length > 500) {
            newErrors.description = 'Description must be less than 500 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        setErrors({});

        try {
            const response = await fetch('/api/workspaces', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || undefined,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setErrors({ submit: data.error || 'Failed to create workspace' });
                return;
            }

            onSuccess(data.workspace);
            onClose();
        } catch (error) {
            console.error('Error creating workspace:', error);
            setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            ref={modalRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div
                className="bg-surface-container-highest rounded-xl shadow-2xl w-full max-w-md transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
                    <h2 id="modal-title" className="text-lg font-semibold text-on-surface">
                        Create New Workspace
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Close modal"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Name Field */}
                    <div>
                        <label htmlFor="workspace-name" className="block text-sm font-medium text-on-surface mb-2">
                            Workspace Name <span className="text-error">*</span>
                        </label>
                        <input
                            ref={nameInputRef}
                            id="workspace-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., My Project Workspace"
                            className={`w-full px-4 py-2.5 bg-surface-container-high rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 transition-all ${
                                errors.name ? 'ring-2 ring-error' : 'focus:ring-secondary/50'
                            }`}
                            disabled={isSubmitting}
                            aria-invalid={!!errors.name}
                            aria-describedby={errors.name ? 'name-error' : undefined}
                        />
                        {errors.name && (
                            <p id="name-error" className="mt-1 text-sm text-error">
                                {errors.name}
                            </p>
                        )}
                    </div>

                    {/* Description Field */}
                    <div>
                        <label htmlFor="workspace-description" className="block text-sm font-medium text-on-surface mb-2">
                            Description <span className="text-on-surface-variant text-xs">(optional)</span>
                        </label>
                        <textarea
                            id="workspace-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this workspace for?"
                            rows={3}
                            maxLength={500}
                            className={`w-full px-4 py-2.5 bg-surface-container-high rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 transition-all resize-none ${
                                errors.description ? 'ring-2 ring-error' : 'focus:ring-secondary/50'
                            }`}
                            disabled={isSubmitting}
                            aria-invalid={!!errors.description}
                            aria-describedby={errors.description ? 'description-error' : undefined}
                        />
                        <div className="flex justify-between mt-1">
                            {errors.description && (
                                <p id="description-error" className="text-sm text-error">
                                    {errors.description}
                                </p>
                            )}
                            <p className={`text-sm text-on-surface-variant ml-auto ${errors.description ? 'text-error' : ''}`}>
                                {description.length}/500
                            </p>
                        </div>
                    </div>

                    {/* Submit Error */}
                    {errors.submit && (
                        <div className="p-3 bg-error/10 border border-error/20 rounded-lg">
                            <p className="text-sm text-error">{errors.submit}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2.5 text-on-surface hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
                            className="flex-1 px-4 py-2.5 bg-secondary text-on-secondary hover:bg-secondary-dim rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Workspace'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
