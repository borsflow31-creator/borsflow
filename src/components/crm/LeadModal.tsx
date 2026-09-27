import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import MeetingList from '@/components/scheduling/MeetingList';
import SelectRefined from '@/components/ui/SelectRefined';
import StatusBadge from '@/components/documents/StatusBadge';

interface Lead {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    status: string;
    stage: string;
    value?: number;
    source?: string;
    notes?: string;
    tags?: string[];
    pipelineId: string;
    order: number;
    leadLists?: any[];
}

interface LeadList {
    id: string;
    name: string;
    description?: string;
    color?: string;
    workspaceId: string;
    order: number;
    leads?: Lead[];
    _count?: {
        leads: number;
    };
}

interface Pipeline {
    id: string;
    name: string;
    description?: string;
    color?: string;
    stages: string[];
    workspaceId: string;
    order: number;
    leads?: Lead[];
    _count?: {
        leads: number;
    };
}

interface LeadModalProps {
    lead?: Lead | null;
    pipeline?: Pipeline | null;
    leadLists?: LeadList[];
    workspaceId?: string;
    onSave: (data: Partial<Lead>) => void;
    onClose: () => void;
}

interface ValidationErrors {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    status?: string;
    stage?: string;
    value?: string;
    source?: string;
    notes?: string;
}

interface PurchaseHistoryItem {
    id: string;
    type: 'quote' | 'invoice';
    number: string;
    status: string;
    total: number;
    date: string;
}

function PurchaseHistory({
    workspaceId,
    leadId,
}: {
    workspaceId: string;
    leadId: string;
}) {
    const [items, setItems] = useState<PurchaseHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);

            try {
                const [quotesResponse, invoicesResponse] = await Promise.all([
                    fetch(`/api/quotes?workspaceId=${workspaceId}&leadId=${leadId}&limit=100`),
                    fetch(`/api/invoices?workspaceId=${workspaceId}&leadId=${leadId}&limit=100`),
                ]);

                const [quotesData, invoicesData] = await Promise.all([
                    quotesResponse.json(),
                    invoicesResponse.json(),
                ]);

                const quoteItems: PurchaseHistoryItem[] = (quotesData.quotes || []).map((quote: any) => ({
                    id: quote.id,
                    type: 'quote',
                    number: quote.quoteNumber,
                    status: quote.status,
                    total: quote.total,
                    date: quote.issueDate,
                }));

                const invoiceItems: PurchaseHistoryItem[] = (invoicesData.invoices || []).map((invoice: any) => ({
                    id: invoice.id,
                    type: 'invoice',
                    number: invoice.invoiceNumber,
                    status: invoice.status,
                    total: invoice.total,
                    date: invoice.issueDate,
                }));

                const mergedItems = [...quoteItems, ...invoiceItems].sort(
                    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
                );

                setItems(mergedItems);
            } catch {
                setItems([]);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [leadId, workspaceId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-secondary" strokeWidth={1.75} />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="rounded-xl bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">
                No quotes or invoices linked to this contact yet.
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low">
            <table className="w-full">
                <thead className="bg-surface-container">
                    <tr>
                        {['Type', 'Document', 'Status', 'Total', 'Date'].map((heading) => (
                            <th
                                key={heading}
                                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant"
                            >
                                {heading}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                    {items.map((item) => (
                        <tr key={`${item.type}-${item.id}`} className="transition-colors hover:bg-surface-container-high/60">
                            <td className="px-4 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                    item.type === 'quote'
                                        ? 'bg-secondary/10 text-secondary'
                                        : 'bg-primary/10 text-primary'
                                }`}>
                                    {item.type === 'quote' ? 'Quote' : 'Invoice'}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <Link
                                    href={`/${item.type === 'quote' ? 'quotes' : 'invoices'}/${item.id}`}
                                    className="text-sm font-medium text-on-surface hover:text-secondary"
                                >
                                    {item.number}
                                </Link>
                            </td>
                            <td className="px-4 py-3">
                                <StatusBadge
                                    status={item.status as any}
                                    type={item.type}
                                    size="sm"
                                />
                            </td>
                            <td className="px-4 py-3 text-sm text-on-surface">
                                {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                }).format(item.total)}
                            </td>
                            <td className="px-4 py-3 text-sm text-on-surface-variant">
                                {new Date(item.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function LeadModal({ lead, pipeline, leadLists = [], workspaceId, onSave, onClose }: LeadModalProps) {
    const [activeTab, setActiveTab] = useState<'details' | 'meetings' | 'history'>('details');
    const [formData, setFormData] = useState({
        firstName: lead?.firstName || '',
        lastName: lead?.lastName || '',
        email: lead?.email || '',
        phone: lead?.phone || '',
        company: lead?.company || '',
        position: lead?.position || '',
        status: lead?.status || 'new',
        stage: lead?.stage || (pipeline?.stages[0] || 'new'),
        value: lead?.value || '',
        source: lead?.source || '',
        notes: lead?.notes || '',
        tags: lead?.tags || [],
        leadListIds: lead?.leadLists?.map((l: any) => l.id) || [],
    });

    const [newTag, setNewTag] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // AI state
    const [aiPanel, setAiPanel] = useState<'none' | 'summary' | 'emailDraft'>('none');
    const [aiResult, setAiResult] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    const statusOptions = useMemo(() => [
        { value: 'new', label: 'New' },
        { value: 'contacted', label: 'Contacted' },
        { value: 'qualified', label: 'Qualified' },
        { value: 'proposal', label: 'Proposal' },
        { value: 'negotiation', label: 'Negotiation' },
        { value: 'won', label: 'Won' },
        { value: 'lost', label: 'Lost' },
    ], []);

    const stageOptions = useMemo(() => 
        pipeline?.stages.map(s => ({ value: s, label: s })) || [], 
    [pipeline]);

    const runAI = async (type: 'summary' | 'emailDraft') => {
        setAiPanel(type);
        setAiResult('');
        setIsAiLoading(true);
        const name = `${formData.firstName} ${formData.lastName}`.trim();
        const context = [
            name && `Name: ${name}`,
            formData.company && `Company: ${formData.company}`,
            formData.position && `Position: ${formData.position}`,
            formData.stage && `Pipeline stage: ${formData.stage}`,
            formData.value && `Deal value: $${formData.value}`,
            formData.source && `Source: ${formData.source}`,
            formData.notes && `Notes: ${formData.notes}`,
        ].filter(Boolean).join('\n');

        const prompt = type === 'summary'
            ? `Summarize this CRM lead and suggest the best next action:\n\n${context}`
            : `Write a short, professional follow-up email to this lead:\n\n${context}\n\nReturn only the email body (no subject line).`;

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
            });
            if (!res.ok || !res.body) throw new Error('failed');
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let text = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                text += decoder.decode(value);
                setAiResult(text);
            }
        } catch {
            setAiResult('Something went wrong. Please try again.');
        } finally {
            setIsAiLoading(false);
        }
    };

    // Validation functions
    const validateEmail = (email: string): string | null => {
        if (!email) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return 'Please enter a valid email address';
        }
        return null;
    };

    const validatePhone = (phone: string): string | null => {
        if (!phone) return null;
        // Allow various phone formats: (123) 456-7890, 123-456-7890, 1234567890, +1 123 456 7890
        const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        if (!phoneRegex.test(phone)) {
            return 'Please enter a valid phone number';
        }
        return null;
    };

    const validateField = (name: string, value: any): string | null => {
        switch (name) {
            case 'firstName':
                if (!value || value.trim().length === 0) {
                    return 'First name is required';
                }
                if (value.trim().length > 50) {
                    return 'First name must be less than 50 characters';
                }
                return null;
            case 'lastName':
                if (!value || value.trim().length === 0) {
                    return 'Last name is required';
                }
                if (value.trim().length > 50) {
                    return 'Last name must be less than 50 characters';
                }
                return null;
            case 'email':
                return validateEmail(value);
            case 'phone':
                return validatePhone(value);
            case 'company':
                if (value && value.trim().length > 100) {
                    return 'Company name must be less than 100 characters';
                }
                return null;
            case 'position':
                if (value && value.trim().length > 100) {
                    return 'Position must be less than 100 characters';
                }
                return null;
            case 'value':
                if (value && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
                    return 'Please enter a valid positive number';
                }
                if (value && parseFloat(value) > 999999999) {
                    return 'Value cannot exceed $999,999,999';
                }
                return null;
            case 'source':
                if (value && value.trim().length > 100) {
                    return 'Source must be less than 100 characters';
                }
                return null;
            case 'notes':
                if (value && value.trim().length > 2000) {
                    return 'Notes must be less than 2000 characters';
                }
                return null;
            default:
                return null;
        }
    };

    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};
        let isValid = true;

        // Validate all fields that have validation rules
        const fieldNames: (keyof ValidationErrors)[] = [
            'firstName', 'lastName', 'email', 'phone', 'company', 
            'position', 'status', 'stage', 'value', 'source', 'notes'
        ];

        fieldNames.forEach(name => {
            const error = validateField(name, formData[name as keyof typeof formData]);
            if (error) {
                newErrors[name] = error;
                isValid = false;
            }
        });

        setErrors(newErrors);
        return isValid;
    };

    const handleFieldChange = (name: keyof typeof formData, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        
        // Validate field on change if it's been touched
        if (touched.has(name)) {
            const error = validateField(name, value);
            setErrors(prev => ({
                ...prev,
                [name]: error || undefined
            }));
        }
    };

    const handleFieldBlur = (name: keyof typeof formData) => {
        setTouched(prev => new Set(prev).add(name));
        const error = validateField(name, formData[name]);
        setErrors(prev => ({
            ...prev,
            [name]: error || undefined
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Mark all fields as touched
        const fieldNames: (keyof ValidationErrors)[] = [
            'firstName', 'lastName', 'email', 'phone', 'company', 
            'position', 'status', 'stage', 'value', 'source', 'notes'
        ];
        setTouched(new Set(fieldNames));

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        try {
            // null (not undefined) so the API clears these rather than skipping them
            await onSave({
                ...formData,
                value: formData.value === '' || formData.value === null
                    ? null
                    : parseFloat(String(formData.value)),
                tags: formData.tags,
            } as Partial<Lead>);
        } catch (error) {
            console.error('Error saving lead:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddTag = () => {
        if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
            setFormData({
                ...formData,
                tags: [...formData.tags, newTag.trim()],
            });
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setFormData({
            ...formData,
            tags: formData.tags.filter(tag => tag !== tagToRemove),
        });
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    const getFieldError = (name: keyof ValidationErrors): string | undefined => {
        return touched.has(name) ? errors[name] : undefined;
    };

    const getFieldClassName = (name: keyof ValidationErrors): string => {
        const error = getFieldError(name);
        const baseClass = 'premium-input w-full px-4 py-2.5 text-sm transition-all';
        const isSelect = name === 'status' || name === 'stage';
        
        let dynamicClass = baseClass;
        if (isSelect) dynamicClass += ' premium-select cursor-pointer';
        if (error) dynamicClass += ' border-error ring-error/20';
        
        return dynamicClass;
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-6 pb-0 flex-shrink-0">
                    {/* Header */}
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="headline-lg text-on-surface">
                            {lead ? 'Edit Lead' : 'Add New Lead'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-on-surface-variant hover:text-on-surface transition-colors"
                            aria-label="Close modal"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Tabs (only for existing leads) */}
                    {lead && workspaceId && (
                        <div className="flex gap-1 border-b border-surface-container-high -mx-6 px-6">
                            <button
                                type="button"
                                onClick={() => setActiveTab('details')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${
                                    activeTab === 'details'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                Details
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('meetings')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${
                                    activeTab === 'meetings'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                Meetings
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${
                                    activeTab === 'history'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                Purchase History
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Meetings Tab */}
                    {lead && workspaceId && activeTab === 'meetings' && (
                        <div className="p-6">
                            <MeetingList
                                workspaceId={workspaceId}
                                leadId={lead.id}
                                leadName={`${lead.firstName} ${lead.lastName}`}
                                compact
                            />
                        </div>
                    )}

                    {lead && workspaceId && activeTab === 'history' && (
                        <div className="p-6">
                            <PurchaseHistory workspaceId={workspaceId} leadId={lead.id} />
                        </div>
                    )}

                    {/* Details Tab / New lead form */}
                    {activeTab === 'details' && (
                    <div className="p-6">
                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Personal Information */}
                        <div>
                            <h3 className="headline-sm text-on-surface mb-4">Personal Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        First Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.firstName}
                                        onChange={(e) => handleFieldChange('firstName', e.target.value)}
                                        onBlur={() => handleFieldBlur('firstName')}
                                        className={getFieldClassName('firstName')}
                                        required
                                        maxLength={50}
                                        aria-invalid={!!getFieldError('firstName')}
                                        aria-describedby={getFieldError('firstName') ? 'firstName-error' : undefined}
                                    />
                                    {getFieldError('firstName') && (
                                        <p id="firstName-error" className="body-xs text-error mt-1">
                                            {getFieldError('firstName')}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        Last Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.lastName}
                                        onChange={(e) => handleFieldChange('lastName', e.target.value)}
                                        onBlur={() => handleFieldBlur('lastName')}
                                        className={getFieldClassName('lastName')}
                                        required
                                        maxLength={50}
                                        aria-invalid={!!getFieldError('lastName')}
                                        aria-describedby={getFieldError('lastName') ? 'lastName-error' : undefined}
                                    />
                                    {getFieldError('lastName') && (
                                        <p id="lastName-error" className="body-xs text-error mt-1">
                                            {getFieldError('lastName')}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleFieldChange('email', e.target.value)}
                                        onBlur={() => handleFieldBlur('email')}
                                        className={getFieldClassName('email')}
                                        aria-invalid={!!getFieldError('email')}
                                        aria-describedby={getFieldError('email') ? 'email-error' : undefined}
                                    />
                                    {getFieldError('email') && (
                                        <p id="email-error" className="body-xs text-error mt-1">
                                            {getFieldError('email')}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        Phone
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                                        onBlur={() => handleFieldBlur('phone')}
                                        className={getFieldClassName('phone')}
                                        aria-invalid={!!getFieldError('phone')}
                                        aria-describedby={getFieldError('phone') ? 'phone-error' : undefined}
                                    />
                                    {getFieldError('phone') && (
                                        <p id="phone-error" className="body-xs text-error mt-1">
                                            {getFieldError('phone')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Company Information */}
                        <div>
                            <h3 className="headline-sm text-on-surface mb-4">Company Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        Company
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.company}
                                        onChange={(e) => handleFieldChange('company', e.target.value)}
                                        onBlur={() => handleFieldBlur('company')}
                                        className={getFieldClassName('company')}
                                        maxLength={100}
                                        aria-invalid={!!getFieldError('company')}
                                        aria-describedby={getFieldError('company') ? 'company-error' : undefined}
                                    />
                                    {getFieldError('company') && (
                                        <p id="company-error" className="body-xs text-error mt-1">
                                            {getFieldError('company')}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        Position
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.position}
                                        onChange={(e) => handleFieldChange('position', e.target.value)}
                                        onBlur={() => handleFieldBlur('position')}
                                        className={getFieldClassName('position')}
                                        maxLength={100}
                                        aria-invalid={!!getFieldError('position')}
                                        aria-describedby={getFieldError('position') ? 'position-error' : undefined}
                                    />
                                    {getFieldError('position') && (
                                        <p id="position-error" className="body-xs text-error mt-1">
                                            {getFieldError('position')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Pipeline Information */}
                        <div>
                            <h3 className="headline-sm text-on-surface mb-4">Pipeline Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <SelectRefined
                                        label="Status"
                                        value={formData.status}
                                        options={statusOptions}
                                        onChange={(val) => handleFieldChange('status', val)}
                                    />
                                </div>
                                <div>
                                    <SelectRefined
                                        label="Stage"
                                        value={formData.stage}
                                        options={stageOptions}
                                        onChange={(val) => handleFieldChange('stage', val)}
                                        disabled={!pipeline}
                                        placeholder={!pipeline ? 'No pipeline selected' : 'Select stage'}
                                    />
                                </div>
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        Deal Value ($)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.value}
                                        onChange={(e) => handleFieldChange('value', e.target.value)}
                                        onBlur={() => handleFieldBlur('value')}
                                        className={getFieldClassName('value')}
                                        min="0"
                                        step="0.01"
                                        aria-invalid={!!getFieldError('value')}
                                        aria-describedby={getFieldError('value') ? 'value-error' : undefined}
                                    />
                                    {getFieldError('value') && (
                                        <p id="value-error" className="body-xs text-error mt-1">
                                            {getFieldError('value')}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        Source
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.source}
                                        onChange={(e) => handleFieldChange('source', e.target.value)}
                                        onBlur={() => handleFieldBlur('source')}
                                        className={getFieldClassName('source')}
                                        maxLength={100}
                                        placeholder="e.g., Website, Referral, LinkedIn"
                                        aria-invalid={!!getFieldError('source')}
                                        aria-describedby={getFieldError('source') ? 'source-error' : undefined}
                                    />
                                    {getFieldError('source') && (
                                        <p id="source-error" className="body-xs text-error mt-1">
                                            {getFieldError('source')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="block body-sm text-on-surface-variant mb-2">
                                Tags
                            </label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="flex-1 px-4 py-2 bg-surface-container-high rounded text-sm text-on-surface focus:bg-surface-container-highest focus:outline-none transition-colors"
                                    placeholder="Add a tag..."
                                    maxLength={50}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddTag}
                                    className="px-4 py-2 bg-primary text-on-primary rounded text-sm hover:bg-primary-container transition-colors"
                                >
                                    Add
                                </button>
                            </div>
                            {formData.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {formData.tags.map((tag, index) => (
                                        <span
                                            key={index}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-surface-container-highest text-on-surface-variant rounded-full body-sm"
                                        >
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveTag(tag)}
                                                className="text-on-surface-variant hover:text-on-surface"
                                                aria-label={`Remove tag ${tag}`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Lead Lists */}
                        {leadLists.length > 0 && (
                            <div>
                                <label className="block body-sm text-on-surface-variant mb-2">
                                    Lead Lists
                                </label>
                                <div className="space-y-2">
                                    {leadLists.map((leadList) => (
                                        <label key={leadList.id} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.leadListIds.includes(leadList.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setFormData({
                                                            ...formData,
                                                            leadListIds: [...formData.leadListIds, leadList.id],
                                                        });
                                                    } else {
                                                        setFormData({
                                                            ...formData,
                                                            leadListIds: formData.leadListIds.filter(id => id !== leadList.id),
                                                        });
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-surface-container-high text-primary focus:ring-primary"
                                            />
                                            <span className="body-sm text-on-surface">{leadList.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI Tools */}
                        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-secondary text-base" style={{ fontVariationSettings: 'FILL 1' }}>auto_awesome</span>
                                <span className="body-sm font-semibold text-on-surface">AI Assistant</span>
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        type="button"
                                        onClick={() => aiPanel === 'summary' ? setAiPanel('none') : runAI('summary')}
                                        className="px-3 py-1 text-xs font-medium rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
                                    >
                                        {isAiLoading && aiPanel === 'summary' ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Summarize lead'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => aiPanel === 'emailDraft' ? setAiPanel('none') : runAI('emailDraft')}
                                        className="px-3 py-1 text-xs font-medium rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
                                    >
                                        {isAiLoading && aiPanel === 'emailDraft' ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Draft email'}
                                    </button>
                                </div>
                            </div>
                            {aiPanel !== 'none' && (
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                        {aiPanel === 'summary' ? 'Lead Summary' : 'Email Draft'}
                                    </div>
                                    <div className="min-h-[80px] text-sm text-on-surface whitespace-pre-wrap bg-surface-container rounded-lg p-3 border border-outline-variant/20">
                                        {isAiLoading && !aiResult ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                                        ) : aiResult || '…'}
                                    </div>
                                    {!isAiLoading && aiResult && aiPanel === 'emailDraft' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, notes: aiResult }));
                                                setAiPanel('none');
                                            }}
                                            className="text-xs text-secondary hover:underline"
                                        >
                                            Copy to notes
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block body-sm text-on-surface-variant mb-2">
                                Notes
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => handleFieldChange('notes', e.target.value)}
                                onBlur={() => handleFieldBlur('notes')}
                                rows={4}
                                className={getFieldClassName('notes')}
                                placeholder="Add any additional notes about this lead..."
                                maxLength={2000}
                                aria-invalid={!!getFieldError('notes')}
                                aria-describedby={getFieldError('notes') ? 'notes-error' : undefined}
                            />
                            {getFieldError('notes') && (
                                <p id="notes-error" className="body-xs text-error mt-1">
                                    {getFieldError('notes')}
                                </p>
                            )}
                            <p className="body-xs text-on-surface-variant mt-1">
                                {formData.notes.length} / 2000 characters
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-surface-container-high">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-6 py-2 text-sm text-on-surface hover:bg-surface-container-high rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-6 py-2 bg-primary text-on-primary rounded text-sm hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-on-primary border-t-transparent" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <span>{lead ? 'Update Lead' : 'Add Lead'}</span>
                                )}
                            </button>
                        </div>
                    </form>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
}
