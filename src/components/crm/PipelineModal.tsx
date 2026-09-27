'use client';

import { useState } from 'react';

interface Pipeline {
    id: string;
    name: string;
    description?: string;
    color?: string;
    stages: string[];
    workspaceId: string;
    order: number;
    leads?: any[];
    _count?: {
        leads: number;
    };
}

interface PipelineModalProps {
    pipeline?: Pipeline | null;
    leadCountsByStage?: Record<string, number>;
    leadCountsLoaded?: boolean;
    onSave: (data: Partial<Pipeline> & { stageRenames?: Array<{ from: string; to: string }> }) => void;
    onClose: () => void;
}

export default function PipelineModal({ pipeline, leadCountsByStage = {}, leadCountsLoaded = false, onSave, onClose }: PipelineModalProps) {
    const [formData, setFormData] = useState({
        name: pipeline?.name || '',
        description: pipeline?.description || '',
        color: pipeline?.color || '#3B82F6',
        stages: pipeline?.stages || ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
    });

    // Stages are identified by name, so a rename is otherwise indistinguishable
    // from deleting one and adding another - which would move every lead in that
    // column to the first stage. Tracking each stage's original name by position
    // lets us tell the API what was actually renamed.
    const [originalStages] = useState<string[]>(() => (pipeline?.stages ? [...pipeline.stages] : []));
    const [stageOrigins, setStageOrigins] = useState<Array<string | null>>(
        () => (pipeline?.stages || []).map(stage => stage)
    );

    const [newStage, setNewStage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const stageRenames = formData.stages
            .map((stage, index) => ({ from: stageOrigins[index], to: stage }))
            .filter((r): r is { from: string; to: string } =>
                !!r.from && r.from !== r.to && originalStages.includes(r.from)
            );

        onSave({ ...formData, ...(stageRenames.length > 0 && { stageRenames }) });
    };

    const handleAddStage = () => {
        if (newStage.trim() && !formData.stages.includes(newStage.trim())) {
            setFormData({
                ...formData,
                stages: [...formData.stages, newStage.trim()],
            });
            // A brand new stage has no original name to rename from.
            setStageOrigins([...stageOrigins, null]);
            setNewStage('');
        }
    };

    const handleRenameStage = (index: number, nextName: string) => {
        const nextStages = [...formData.stages];
        nextStages[index] = nextName;
        setFormData({ ...formData, stages: nextStages });
    };

    const handleRemoveStage = (stageToRemove: string) => {
        const removedIndex = formData.stages.indexOf(stageToRemove);
        if (removedIndex === -1) return;

        const remaining = formData.stages.filter((_, i) => i !== removedIndex);

        if (remaining.length === 0) {
            alert('A pipeline needs at least one stage.');
            return;
        }

        // Leads in a removed stage are moved to the first remaining stage by the API,
        // so say that up front rather than letting them silently change column.
        const affected = leadCountsByStage[stageToRemove] ?? 0;
        // Counts load asynchronously; until they arrive, warn generically rather than
        // silently skipping the guard.
        if (!leadCountsLoaded) {
            if (!confirm(
                `Remove "${stageToRemove}"? Any leads in it will be moved to "${remaining[0]}".`
            )) return;
        } else if (affected > 0) {
            if (!confirm(
                `"${stageToRemove}" holds ${affected} lead${affected === 1 ? '' : 's'}. ` +
                `Removing it will move ${affected === 1 ? 'it' : 'them'} to "${remaining[0]}". Continue?`
            )) return;
        }

        setFormData({ ...formData, stages: remaining });
        setStageOrigins(stageOrigins.filter((_, i) => i !== removedIndex));
    };

    const handleMoveStage = (index: number, direction: 'up' | 'down') => {
        const newStages = [...formData.stages];
        const newOrigins = [...stageOrigins];
        const swapWith = direction === 'up' ? index - 1 : index + 1;

        if (swapWith < 0 || swapWith > newStages.length - 1) return;

        [newStages[index], newStages[swapWith]] = [newStages[swapWith], newStages[index]];
        [newOrigins[index], newOrigins[swapWith]] = [newOrigins[swapWith], newOrigins[index]];

        setFormData({ ...formData, stages: newStages });
        setStageOrigins(newOrigins);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddStage();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="headline-lg text-on-surface">
                            {pipeline ? 'Edit Pipeline' : 'Create New Pipeline'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-on-surface-variant hover:text-on-surface transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Pipeline Details */}
                        <div>
                            <label className="block body-sm text-on-surface-variant mb-2">
                                Pipeline Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="premium-input w-full px-4 py-2.5 text-sm transition-all"
                                placeholder="e.g., Sales Pipeline"
                                required
                            />
                        </div>

                        <div>
                            <label className="block body-sm text-on-surface-variant mb-2">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                className="premium-input w-full px-4 py-2.5 text-sm transition-all resize-none"
                                placeholder="Describe this pipeline..."
                            />
                        </div>

                        <div>
                            <label className="block body-sm text-on-surface-variant mb-2">
                                Color
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    className="w-12 h-12 rounded cursor-pointer border-2 border-surface-container-high"
                                />
                                <input
                                    type="text"
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    className="premium-input flex-1 px-4 py-2.5 text-sm transition-all"
                                    placeholder="#3B82F6"
                                />
                            </div>
                        </div>

                        {/* Stages */}
                        <div>
                            <label className="block body-sm text-on-surface-variant mb-2">
                                Pipeline Stages
                            </label>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={newStage}
                                    onChange={(e) => setNewStage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="premium-input flex-1 px-4 py-2.5 text-sm transition-all"
                                    placeholder="Add a new stage..."
                                />
                                <button
                                    type="button"
                                    onClick={handleAddStage}
                                    className="px-4 py-2 bg-primary text-on-primary rounded text-sm hover:bg-primary-container transition-colors"
                                >
                                    Add Stage
                                </button>
                            </div>

                            {/* Stage List */}
                            <div className="space-y-2">
                                {formData.stages.map((stage, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2 p-3 bg-surface-container rounded"
                                    >
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={stage}
                                                onChange={(e) => handleRenameStage(index, e.target.value)}
                                                className="premium-input w-full px-3 py-1.5 text-sm transition-all"
                                                aria-label={`Stage ${index + 1} name`}
                                            />
                                            {stageOrigins[index] && stageOrigins[index] !== stage && (
                                                <p className="body-sm text-on-surface-variant mt-1">
                                                    Renaming from &quot;{stageOrigins[index]}&quot; - leads stay in this column.
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleMoveStage(index, 'up')}
                                                disabled={index === 0}
                                                className="p-1 text-on-surface-variant hover:text-on-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                title="Move Up"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleMoveStage(index, 'down')}
                                                disabled={index === formData.stages.length - 1}
                                                className="p-1 text-on-surface-variant hover:text-on-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                title="Move Down"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveStage(stage)}
                                                className="p-1 text-error hover:bg-error-container rounded transition-colors"
                                                title="Remove Stage"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {formData.stages.length === 0 && (
                                <p className="body-sm text-on-surface-variant text-center py-4">
                                    No stages added yet. Add at least one stage to continue.
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-surface-container-high">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2 text-sm text-on-surface hover:bg-surface-container-high rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={formData.stages.length === 0}
                                className="px-6 py-2 bg-primary text-on-primary rounded text-sm hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {pipeline ? 'Update Pipeline' : 'Create Pipeline'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
