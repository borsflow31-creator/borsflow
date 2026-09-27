'use client';

import { Draggable } from '@hello-pangea/dnd';
import { useState } from 'react';
import SelectRefined from '@/components/ui/SelectRefined';

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
];

const STATUS_OPTIONS = [
    { value: 'todo', label: 'To Do' },
    { value: 'inprogress', label: 'In Progress' },
    { value: 'done', label: 'Done' },
];

interface KanbanCardProps {
    id: string;
    title: string;
    description?: string;
    status: 'todo' | 'inprogress' | 'done';
    priority: 'low' | 'medium' | 'high';
    tags?: string[];
    dueDate?: Date;
    assignees?: string[];
    attachments?: number;
    comments?: number;
    checklistCompleted?: number;
    checklistTotal?: number;
    index: number;
    onUpdate?: (updates: Partial<Omit<KanbanCardProps, 'index' | 'onUpdate' | 'onDelete'>>) => void;
    onDelete?: () => void;
}

export default function KanbanCard({
    id,
    title,
    description,
    status,
    priority,
    tags,
    dueDate,
    assignees,
    attachments = 0,
    comments = 0,
    checklistCompleted = 0,
    checklistTotal = 0,
    index,
    onUpdate,
    onDelete,
}: KanbanCardProps) {
    const [showEditModal, setShowEditModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Edit form state
    const [editTitle, setEditTitle] = useState(title);
    const [editDescription, setEditDescription] = useState(description || '');
    const [editPriority, setEditPriority] = useState(priority);
    const [editStatus, setEditStatus] = useState(status);
    const [editDueDate, setEditDueDate] = useState(
        dueDate ? dueDate.toISOString().split('T')[0] : ''
    );
    const parsedTags = Array.isArray(tags) ? tags : (typeof tags === 'string' ? JSON.parse(tags || '[]') : []);
    const parsedAssignees = Array.isArray(assignees) ? assignees : (typeof assignees === 'string' ? JSON.parse(assignees || '[]') : []);
    const [editTagsRaw, setEditTagsRaw] = useState(parsedTags.join(', '));
    const [editAssigneesRaw, setEditAssigneesRaw] = useState(parsedAssignees.join(', '));

    const openEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditTitle(title);
        setEditDescription(description || '');
        setEditPriority(priority);
        setEditStatus(status);
        setEditDueDate(dueDate ? dueDate.toISOString().split('T')[0] : '');
        setEditTagsRaw(parsedTags.join(', '));
        setEditAssigneesRaw(parsedAssignees.join(', '));
        setShowEditModal(true);
    };

    const handleSave = async () => {
        if (!editTitle.trim()) return;
        setIsSaving(true);
        try {
            await onUpdate?.({
                title: editTitle.trim(),
                description: editDescription.trim() || undefined,
                priority: editPriority,
                status: editStatus,
                dueDate: editDueDate ? new Date(editDueDate) : undefined,
                tags: editTagsRaw.split(',').map((t: string) => t.trim()).filter(Boolean),
                assignees: editAssigneesRaw.split(',').map((a: string) => a.trim()).filter(Boolean),
            });
            setShowEditModal(false);
        } finally {
            setIsSaving(false);
        }
    };

    const priorityColor = {
        high: 'bg-error-container text-on-error-container',
        medium: 'bg-surface-container-high text-on-surface-variant',
        low: 'bg-surface-container-low text-on-surface-variant',
    }[priority];

    const getDueDateStatus = () => {
        if (!dueDate) return null;
        const diff = dueDate.getTime() - Date.now();
        const days = Math.ceil(diff / 86400000);
        if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: 'text-error' };
        if (days === 0) return { text: 'Due today', color: 'text-error' };
        if (days === 1) return { text: 'Due tomorrow', color: 'text-on-surface-variant' };
        if (days <= 7) return { text: `Due in ${days}d`, color: 'text-on-surface-variant' };
        return { text: dueDate.toLocaleDateString(), color: 'text-on-surface-variant' };
    };

    const dueDateStatus = getDueDateStatus();

    return (
        <>
            <Draggable draggableId={id} index={index}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`
                            group bg-gradient-to-br from-surface-container-lowest to-surface rounded-xl p-4 cursor-grab active:cursor-grabbing
                            transition-shadow duration-200
                            ${snapshot.isDragging ? 'shadow-2xl' : 'shadow-sm hover:shadow-xl'}
                            border border-outline-variant/20
                        `}
                    >
                        {/* Priority Badge + Actions */}
                        <div className="flex items-center justify-between mb-3">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${priorityColor} shadow-sm`}>
                                {priority.charAt(0).toUpperCase() + priority.slice(1)}
                            </span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                                {onUpdate && (
                                    <button
                                        onClick={openEdit}
                                        className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors duration-200"
                                        aria-label="Edit card"
                                    >
                                        <span className="material-symbols-outlined text-lg text-on-surface-variant">edit</span>
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                        className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors duration-200"
                                        aria-label="Delete card"
                                    >
                                        <span className="material-symbols-outlined text-lg text-error">delete</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-semibold text-on-surface mb-2 line-clamp-2">{title}</h3>

                        {/* Description */}
                        {description && (
                            <p className="text-sm text-on-surface-variant mb-3 line-clamp-3">{description}</p>
                        )}

                        {/* Tags */}
                        {Array.isArray(tags) && tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {tags.map((tag, i) => (
                                    <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant shadow-sm">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20">
                            <div className="flex items-center gap-3">
                                {dueDateStatus && (
                                    <div className={`flex items-center gap-1.5 text-xs ${dueDateStatus.color}`}>
                                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                                        <span>{dueDateStatus.text}</span>
                                    </div>
                                )}
                                {attachments > 0 && (
                                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                                        <span className="material-symbols-outlined text-sm">attach_file</span>
                                        <span>{attachments}</span>
                                    </div>
                                )}
                                {comments > 0 && (
                                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                                        <span className="material-symbols-outlined text-sm">chat_bubble</span>
                                        <span>{comments}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {checklistTotal > 0 && (
                                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        <span>{checklistCompleted}/{checklistTotal}</span>
                                    </div>
                                )}
                                {Array.isArray(assignees) && assignees.length > 0 && (
                                    <div className="flex -space-x-2">
                                        {assignees.slice(0, 3).map((assignee, i) => (
                                            <div
                                                key={i}
                                                className="w-7 h-7 rounded-full bg-gradient-to-br from-surface-container-high to-surface-container border-2 border-surface-container-lowest flex items-center justify-center text-xs font-medium shadow-sm"
                                                title={assignee}
                                            >
                                                {assignee.slice(0, 2).toUpperCase()}
                                            </div>
                                        ))}
                                        {assignees.length > 3 && (
                                            <div className="w-7 h-7 rounded-full bg-surface-container-high border-2 border-surface-container-lowest flex items-center justify-center text-xs font-medium shadow-sm">
                                                +{assignees.length - 3}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Draggable>

            {/* Edit Modal */}
            {showEditModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}
                >
                    <div className="bg-surface-container-lowest rounded-xl p-6 w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-on-surface">Edit Card</h3>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1.5">Title *</label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1.5">Description</label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all resize-none"
                                    placeholder="Add a description..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Priority */}
                                <SelectRefined
                                    label="Priority"
                                    size="sm"
                                    variant="filled"
                                    value={editPriority}
                                    options={PRIORITY_OPTIONS}
                                    onChange={(v) => setEditPriority(v as any)}
                                />

                                {/* Status */}
                                <SelectRefined
                                    label="Status"
                                    size="sm"
                                    variant="filled"
                                    value={editStatus}
                                    options={STATUS_OPTIONS}
                                    onChange={(v) => setEditStatus(v as any)}
                                />
                            </div>

                            {/* Due Date */}
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1.5">Due Date</label>
                                <input
                                    type="date"
                                    value={editDueDate}
                                    onChange={(e) => setEditDueDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                />
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1.5">Tags</label>
                                <input
                                    type="text"
                                    value={editTagsRaw}
                                    onChange={(e) => setEditTagsRaw(e.target.value)}
                                    placeholder="design, frontend, bug (comma-separated)"
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                />
                            </div>

                            {/* Assignees */}
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1.5">Assignees</label>
                                <input
                                    type="text"
                                    value={editAssigneesRaw}
                                    onChange={(e) => setEditAssigneesRaw(e.target.value)}
                                    placeholder="Alice, Bob (comma-separated)"
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end mt-6">
                            <button
                                onClick={() => setShowEditModal(false)}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!editTitle.trim() || isSaving}
                                className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
