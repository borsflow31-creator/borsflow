'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface KanbanProject {
    id: string;
    name: string;
    description?: string;
    color?: string;
    order: number;
    _count?: {
        cards: number;
    };
}

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: ProjectFormData) => Promise<void>;
    project?: KanbanProject | null; // null = create mode
    loading?: boolean;
}

interface ProjectFormData {
    name: string;
    description?: string;
    color?: string;
}

const PREDEFINED_COLORS = [
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Violet', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Sky', value: '#0ea5e9' },
    { name: 'Slate', value: '#64748b' },
];

export default function ProjectModal({
    isOpen,
    onClose,
    onSubmit,
    project,
    loading = false,
}: ProjectModalProps) {
    const [formData, setFormData] = useState<ProjectFormData>({
        name: '',
        description: '',
        color: PREDEFINED_COLORS[0].value,
    });
    const [errors, setErrors] = useState<Partial<ProjectFormData>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (project) {
                setFormData({
                    name: project.name,
                    description: project.description || '',
                    color: project.color || PREDEFINED_COLORS[0].value,
                });
            } else {
                setFormData({
                    name: '',
                    description: '',
                    color: PREDEFINED_COLORS[0].value,
                });
            }
            setErrors({});
        }
    }, [isOpen, project]);

    const validateForm = (): boolean => {
        const newErrors: Partial<ProjectFormData> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Project name is required';
        } else if (formData.name.trim().length < 2) {
            newErrors.name = 'Project name must be at least 2 characters';
        } else if (formData.name.trim().length > 100) {
            newErrors.name = 'Project name must be less than 100 characters';
        }

        if (formData.description && formData.description.length > 500) {
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
        try {
            await onSubmit({
                name: formData.name.trim(),
                description: formData.description?.trim() || undefined,
                color: formData.color,
            });
            onClose();
        } catch (error: any) {
            console.error('Error submitting project:', error);
            setErrors({ name: error.message || 'Failed to save project' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSubmitting) {
                    onClose();
                }
            }}
        >
            <div className="bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-lg">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
                    <h3 className="text-lg font-semibold text-on-surface">
                        {project ? 'Edit Project' : 'Create New Project'}
                    </h3>
                    <button
                        onClick={() => !isSubmitting && onClose()}
                        disabled={isSubmitting}
                        className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5 text-on-surface-variant" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Name */}
                    <div>
                        <label htmlFor="project-name" className="block text-sm font-medium text-on-surface mb-2">
                            Project Name *
                        </label>
                        <input
                            id="project-name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Website Redesign"
                            className="w-full px-4 py-2.5 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                            disabled={isSubmitting}
                            autoFocus
                        />
                        {errors.name && (
                            <p className="mt-1.5 text-sm text-error">{errors.name}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="project-description" className="block text-sm font-medium text-on-surface mb-2">
                            Description
                        </label>
                        <textarea
                            id="project-description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            placeholder="Add a brief description of this project..."
                            className="w-full px-4 py-2.5 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all resize-none"
                            disabled={isSubmitting}
                        />
                        {errors.description && (
                            <p className="mt-1.5 text-sm text-error">{errors.description}</p>
                        )}
                        <p className="mt-1 text-xs text-on-surface-variant">
                            {formData.description?.length || 0} / 500 characters
                        </p>
                    </div>

                    {/* Color */}
                    <div>
                        <label className="block text-sm font-medium text-on-surface mb-3">
                            Project Color
                        </label>
                        <div className="grid grid-cols-5 gap-3">
                            {PREDEFINED_COLORS.map((color) => (
                                <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, color: color.value })}
                                    disabled={isSubmitting}
                                    className={`
                                        relative w-12 h-12 rounded-lg border-2 transition-all duration-200
                                        ${formData.color === color.value
                                            ? 'border-secondary scale-110 shadow-lg'
                                            : 'border-transparent hover:scale-105 hover:shadow-md'
                                        }
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    `}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                    aria-label={`Select ${color.name} color`}
                                >
                                    {formData.color === color.value && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center">
                                                <div className="w-3 h-3 bg-current rounded-full" style={{ color: color.value }} />
                                            </div>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => !isSubmitting && onClose()}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2.5 bg-secondary text-on-secondary rounded-lg text-sm font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    {project ? 'Updating...' : 'Creating...'}
                                </span>
                            ) : (
                                project ? 'Update Project' : 'Create Project'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
