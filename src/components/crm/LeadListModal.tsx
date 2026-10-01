'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';

interface LeadList {
    id: string;
    name: string;
    description?: string;
    color?: string;
    workspaceId: string;
    order: number;
    leads?: any[];
    _count?: {
        leads: number;
    };
}

interface LeadListModalProps {
    leadLists: LeadList[];
    onSave: (data: Partial<LeadList>) => void;
    onUpdate: (leadListId: string, updates: Partial<LeadList>) => void;
    onDelete: (leadListId: string) => void;
    onClose: () => void;
}

export default function LeadListModal({
    leadLists,
    onSave,
    onUpdate,
    onDelete,
    onClose,
}: LeadListModalProps) {
    const { t } = useI18n();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: '#10B981',
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        setFormData({ name: '', description: '', color: '#10B981' });
        setShowCreateForm(false);
    };

    const handleEdit = (leadList: LeadList) => {
        setEditingId(leadList.id);
        setFormData({
            name: leadList.name,
            description: leadList.description || '',
            color: leadList.color || '#10B981',
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            onUpdate(editingId, formData);
            setEditingId(null);
            setFormData({ name: '', description: '', color: '#10B981' });
        }
    };

    const handleDelete = (leadListId: string) => {
        if (confirm(t('crm.leadListModal.confirmDelete'))) {
            onDelete(leadListId);
        }
    };

    const handleCancel = () => {
        setShowCreateForm(false);
        setEditingId(null);
        setFormData({ name: '', description: '', color: '#10B981' });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="headline-lg text-on-surface">{t('crm.leadListModal.title')}</h2>
                        <button
                            onClick={onClose}
                            className="text-on-surface-variant hover:text-on-surface transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Create Button */}
                    {!showCreateForm && !editingId && (
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="w-full mb-6 px-4 py-3 bg-primary text-on-primary rounded text-sm hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {t('crm.leadListModal.createNewList')}
                        </button>
                    )}

                    {/* Create/Edit Form */}
                    {(showCreateForm || editingId) && (
                        <form onSubmit={editingId ? handleUpdate : handleCreate} className="mb-6 p-4 bg-surface-container rounded-lg">
                            <h3 className="headline-sm text-on-surface mb-4">
                                {editingId ? t('crm.leadListModal.formTitleEdit') : t('crm.leadListModal.createNewList')}
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        {t('crm.leadListModal.nameLabel')}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="premium-input w-full px-4 py-2.5 text-sm transition-all"
                                        placeholder={t('crm.leadListModal.namePlaceholder')}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        {t('crm.leadListModal.descriptionLabel')}
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        className="premium-input w-full px-4 py-2.5 text-sm transition-all resize-none"
                                        placeholder={t('crm.leadListModal.descriptionPlaceholder')}
                                    />
                                </div>
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        {t('crm.leadListModal.colorLabel')}
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
                                            placeholder="#10B981"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        className="px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high rounded transition-colors"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-primary text-on-primary rounded text-sm hover:bg-primary-container transition-colors"
                                    >
                                        {editingId ? t('common.update') : t('common.create')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* Lead Lists */}
                    <div className="space-y-3">
                        {leadLists.length === 0 ? (
                            <p className="body-md text-on-surface-variant text-center py-8">
                                {t('crm.leadListModal.emptyState')}
                            </p>
                        ) : (
                            leadLists.map((leadList) => (
                                <div
                                    key={leadList.id}
                                    className="p-4 bg-surface-container rounded-lg flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: leadList.color }}
                                        />
                                        <div>
                                            <h4 className="title-md text-on-surface">{leadList.name}</h4>
                                            {leadList.description && (
                                                <p className="body-sm text-on-surface-variant">
                                                    {leadList.description}
                                                </p>
                                            )}
                                            <p className="body-xs text-on-surface-variant mt-1">
                                                {t('crm.leadListModal.leadsCount', { count: leadList._count?.leads || 0 })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEdit(leadList)}
                                            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors"
                                            title={t('common.edit')}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(leadList.id)}
                                            className="p-2 text-error hover:bg-error-container rounded transition-colors"
                                            title={t('common.delete')}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
