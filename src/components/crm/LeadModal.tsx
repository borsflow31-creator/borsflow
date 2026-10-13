import { aiComplete, aiErrorMessage } from '@/lib/ai/client';
import { promptInLocale } from '@/lib/ai/language';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import MeetingList from '@/components/scheduling/MeetingList';
import LeadFiles from '@/components/crm/LeadFiles';
import LeadTimeline from '@/components/crm/LeadTimeline';
import SelectRefined from '@/components/ui/SelectRefined';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { stageLabel } from '@/components/crm/labels';
import { leadStatusForStage } from '@/lib/crm/lead-status';
import LeadInterests from '@/components/realestate/LeadInterests';
import LeadBriefFields, { type LeadBriefValues } from '@/components/developer/LeadBriefFields';
import CustomerTab from '@/components/developer/CustomerTab';
import { useWorkspaceAgents } from '@/components/developer/useWorkspaceAgents';
import {
    AUTO_FIELDS, applyLots, changeProgram, markEdited,
    type AutoFilled, type PickedLot,
} from '@/components/developer/lead-autofill';
import { LEAD_TASK_TYPES, type LeadTaskType } from '@/lib/crm/lifecycle';
import { normalizeEmail, normalizePhone } from '@/lib/crm/contact-match';

/** A lead already on file with the same email or phone, as /api/leads/duplicates returns it. */
interface DuplicateMatch {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    stage: string;
    ownerName: string | null;
    programName: string | null;
    lastActivityAt: string | null;
    matchedOn: Array<'email' | 'phone'>;
}

/** One key per form: a retried submit sends it again and gets the same lead back. */
function newRequestKey(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

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
    // Developer CRM. Present on every lead the API returns; only read when the
    // account is a developer's.
    ownerId?: string | null;
    campaign?: string | null;
    interestedProgramId?: string | null;
    interestedTypology?: string | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
    preferredLocation?: string | null;
    score?: number;
    lastContactedAt?: string | null;
    nextFollowUpAt?: string | null;
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
    /** Resolves false when the save failed (the form then keeps what was typed). */
    onSave: (data: Partial<Lead>, options?: { keepOpen?: boolean }) => void | boolean | Promise<void | boolean>;
    onClose: () => void;
    /** Opens a lead already on file, offered when the new one looks like a duplicate. */
    onOpenExisting?: (leadId: string) => void;
    /** Open on this tab (deep links like ?lead=<id>&tab=files) */
    initialTab?: LeadModalTab;
}

export type LeadModalTab = 'details' | 'customer' | 'interests' | 'meetings' | 'files' | 'history';

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

export default function LeadModal({ lead, pipeline, leadLists = [], workspaceId, onSave, onClose, onOpenExisting, initialTab = 'details' }: LeadModalProps) {
    const { t, locale, formatDate } = useI18n();
    const { data: session } = useSession();
    // A developer's lead carries a buyer brief and a Customer tab; an agency's
    // form and payload are exactly what they were.
    const isDeveloper = session?.user?.businessType === 'DEVELOPER';
    const [activeTab, setActiveTab] = useState<LeadModalTab>(lead ? initialTab : 'details');
    // Shown on the Files tab label; starts from the list's count, updated by the tab
    const [fileCount, setFileCount] = useState<number>((lead as (Lead & { fileCount?: number }) | null | undefined)?.fileCount ?? 0);
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

    const [brief, setBrief] = useState<Omit<LeadBriefValues, 'source'>>({
        ownerId: lead?.ownerId || '',
        campaign: lead?.campaign || '',
        interestedProgramId: lead?.interestedProgramId || '',
        interestedTypology: lead?.interestedTypology || '',
        budgetMin: lead?.budgetMin ? String(lead.budgetMin) : '',
        budgetMax: lead?.budgetMax ? String(lead.budgetMax) : '',
        preferredLocation: lead?.preferredLocation || '',
    });

    // Company and position matter for a B2B lead and are noise for a buyer, so
    // they stay folded away unless the lead already has them.
    const [showCompany, setShowCompany] = useState(!!(lead?.company || lead?.position));
    const [newTag, setNewTag] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Anything typed since the form opened, so closing can ask before throwing it away.
    const [dirty, setDirty] = useState(false);
    // Said once a lead is saved and the form is cleared for the next one.
    const [notice, setNotice] = useState('');
    const requestKey = useRef(newRequestKey());
    const firstNameRef = useRef<HTMLInputElement>(null);

    // Developer: the units the buyer asked about, and which brief fields they filled.
    // An existing lead's units load from the server; until they have, they are not
    // sent, so a failed load cannot wipe them on save.
    const [lots, setLots] = useState<PickedLot[]>([]);
    const [lotsLoaded, setLotsLoaded] = useState(!lead);
    const [autoFilled, setAutoFilled] = useState<AutoFilled>({});
    useEffect(() => {
        if (!lead?.id || !isDeveloper) return;
        let cancelled = false;
        fetch(`/api/leads/${lead.id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (cancelled || !data) return;
                setLots(data.interestedLots ?? []);
                setLotsLoaded(true);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [lead?.id, isDeveloper]);

    // Possible duplicates of the person being entered, by email or phone.
    const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
    const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);
    const lastDuplicateKey = useRef('');

    // The first follow-up, created with the lead (developer, new lead only).
    const agents = useWorkspaceAgents(isDeveloper && workspaceId ? workspaceId : '');
    const emptyTask = { open: false, type: 'call' as LeadTaskType, title: '', dueAt: '', assigneeId: '' };
    const [task, setTask] = useState(emptyTask);
    const [taskError, setTaskError] = useState('');
    const offersTask = !lead && isDeveloper && !!workspaceId;

    // AI state
    const [aiPanel, setAiPanel] = useState<'none' | 'summary' | 'emailDraft'>('none');
    const [aiResult, setAiResult] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    const statusOptions = useMemo(() => [
        { value: 'new', label: t('crm.leadModal.status.new') },
        { value: 'contacted', label: t('crm.leadModal.status.contacted') },
        { value: 'qualified', label: t('crm.leadModal.status.qualified') },
        { value: 'proposal', label: t('crm.leadModal.status.proposal') },
        { value: 'negotiation', label: t('crm.leadModal.status.negotiation') },
        { value: 'won', label: t('crm.leadModal.status.won') },
        { value: 'lost', label: t('crm.leadModal.status.lost') },
    ], [t]);

    const impliedStatus = leadStatusForStage(formData.stage);

    const stageOptions = useMemo(() => 
        pipeline?.stages.map(s => ({ value: s, label: stageLabel(s, t) })) || [], 
    [pipeline, t]);

    const runAI = async (type: 'summary' | 'emailDraft') => {
        setAiPanel(type);
        setAiResult('');
        setIsAiLoading(true);
        const name = `${formData.firstName} ${formData.lastName}`.trim();
        const context = [
            name && `Name: ${name}`,
            formData.company && `Company: ${formData.company}`,
            formData.position && `Position: ${formData.position}`,
            formData.stage && `Pipeline stage: ${stageLabel(formData.stage, t)}`,
            // No currency sign: the workspace's currency is not the dollar, and a
            // wrong one in the summary reads as a wrong amount.
            formData.value && `Deal value: ${formData.value}`,
            formData.source && `Source: ${formData.source}`,
            // What a developer's buyer is looking for, which is most of the lead.
            isDeveloper && brief.interestedTypology && `Unit type wanted: ${brief.interestedTypology}`,
            isDeveloper && brief.preferredLocation && `Preferred location: ${brief.preferredLocation}`,
            isDeveloper && (brief.budgetMin || brief.budgetMax) &&
                `Budget: ${brief.budgetMin || '?'} – ${brief.budgetMax || '?'}`,
            // The units themselves, from the database, so the summary and email
            // name real units and real prices rather than a typed description.
            isDeveloper && lots.length > 0 && `Project: ${lots[0].program.name}`,
            isDeveloper && lots.length > 0 && `Units of interest: ${lots.map((l) => [
                l.lotNumber,
                l.typology,
                l.surfaceArea > 0 ? `${l.surfaceArea} m²` : null,
                l.totalPrice > 0 ? `price ${l.totalPrice}` : null,
            ].filter(Boolean).join(', ')).join('; ')}`,
            formData.notes && `Notes: ${formData.notes}`,
        ].filter(Boolean).join('\n');

        // The answer goes straight into the UI, so it has to be in the UI's language.
        const prompt = promptInLocale(
            type === 'summary'
                ? 'Summarize this CRM lead in two or three sentences and suggest the best next action.'
                : 'Write a short, professional follow-up email to this lead. Return only the email body (no subject line).',
            locale,
        );

        const billingWorkspaceId = workspaceId ?? pipeline?.workspaceId;
        if (!billingWorkspaceId) {
            setAiResult(t('crm.leadModal.aiNoWorkspace'));
            setIsAiLoading(false);
            return;
        }

        try {
            let text = '';
            await aiComplete({ workspaceId: billingWorkspaceId }, { prompt, text: context }, (chunk) => {
                text += chunk;
                setAiResult(text);
            });
        } catch (error) {
            setAiResult(aiErrorMessage(error, t('crm.leadModal.aiError')));
        } finally {
            setIsAiLoading(false);
        }
    };

    // Validation functions
    const validateEmail = (email: string): string | null => {
        if (!email) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return t('crm.leadModal.errors.emailInvalid');
        }
        return null;
    };

    const validatePhone = (phone: string): string | null => {
        if (!phone) return null;
        // Any national or international format: digits with spaces, dots, dashes,
        // brackets, and a leading + or 00. The old fixed 3-3-4 pattern refused
        // ordinary numbers such as "+213 697 67 90 51". At most 15 digits (E.164).
        const normalized = normalizePhone(phone);
        if (!normalized || normalized.replace(/\D/g, '').length > 15) {
            return t('crm.leadModal.errors.phoneInvalid');
        }
        return null;
    };

    const validateField = (name: string, value: any): string | null => {
        switch (name) {
            case 'firstName':
                if (!value || value.trim().length === 0) {
                    return t('crm.leadModal.errors.firstNameRequired');
                }
                if (value.trim().length > 50) {
                    return t('crm.leadModal.errors.firstNameTooLong');
                }
                return null;
            case 'lastName':
                if (!value || value.trim().length === 0) {
                    return t('crm.leadModal.errors.lastNameRequired');
                }
                if (value.trim().length > 50) {
                    return t('crm.leadModal.errors.lastNameTooLong');
                }
                return null;
            case 'email':
                return validateEmail(value);
            case 'phone':
                return validatePhone(value);
            case 'company':
                if (value && value.trim().length > 100) {
                    return t('crm.leadModal.errors.companyTooLong');
                }
                return null;
            case 'position':
                if (value && value.trim().length > 100) {
                    return t('crm.leadModal.errors.positionTooLong');
                }
                return null;
            case 'value':
                if (value && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
                    return t('crm.leadModal.errors.valueInvalid');
                }
                if (value && parseFloat(value) > 999999999) {
                    return t('crm.leadModal.errors.valueTooLarge');
                }
                return null;
            case 'source':
                if (value && value.trim().length > 100) {
                    return t('crm.leadModal.errors.sourceTooLong');
                }
                return null;
            case 'notes':
                if (value && value.trim().length > 2000) {
                    return t('crm.leadModal.errors.notesTooLong');
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
        // A built-in stage decides the status, so the two can never disagree.
        const implied = name === 'stage' ? leadStatusForStage(value) : null;
        setFormData(prev => ({ ...prev, [name]: value, ...(implied && { status: implied }) }));
        setDirty(true);
        
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
        if ((name === 'email' || name === 'phone') && !error) void checkDuplicates();
    };

    /**
     * Looks for leads already on file with this email or phone. Runs when either
     * field is left, and only when what would be searched has changed, so moving
     * through the form does not fire a request per blur. Names are never matched:
     * two buyers can share one.
     */
    const checkDuplicates = async () => {
        if (lead || !workspaceId) return;
        const email = normalizeEmail(formData.email) ?? '';
        const phone = normalizePhone(formData.phone) ?? '';
        const key = `${email}|${phone}`;
        if (key === lastDuplicateKey.current) return;
        lastDuplicateKey.current = key;
        setDuplicatesDismissed(false);
        if (!email && !phone) {
            setDuplicates([]);
            return;
        }
        try {
            const params = new URLSearchParams({ workspaceId });
            if (email) params.set('email', email);
            if (phone) params.set('phone', phone);
            const res = await fetch(`/api/leads/duplicates?${params}`);
            if (!res.ok) return;
            const data = await res.json();
            // A later check may have started while this one was in flight.
            if (lastDuplicateKey.current === key) setDuplicates(data.matches ?? []);
        } catch {
            // Advisory only: a failed check never blocks entering the lead.
        }
    };

    const autoFields = (b: typeof brief) => ({
        interestedTypology: b.interestedTypology,
        preferredLocation: b.preferredLocation,
        budgetMin: b.budgetMin,
        budgetMax: b.budgetMax,
    });

    /** A brief field changed. Typing in one a unit filled makes it the user's. */
    const handleBriefChange = (name: keyof LeadBriefValues, value: string) => {
        setDirty(true);
        if (name === 'source') {
            handleFieldChange('source', value);
            return;
        }
        if (name === 'interestedProgramId') {
            // Units from another project go, and what they filled goes with them.
            const next = { ...brief, interestedProgramId: value };
            const result = changeProgram(autoFields(next), autoFilled, lots, value);
            setBrief({ ...next, ...result.brief });
            setAutoFilled(result.autoFilled);
            setLots(result.lots);
            return;
        }
        setBrief((prev) => ({ ...prev, [name]: value }));
        if ((AUTO_FIELDS as readonly string[]).includes(name)) setAutoFilled((prev) => markEdited(prev, name));
    };

    const handleLotsChange = (next: PickedLot[]) => {
        setDirty(true);
        const result = applyLots(autoFields(brief), autoFilled, next);
        setBrief((prev) => ({ ...prev, ...result.brief }));
        setAutoFilled(result.autoFilled);
        setLots(next);
    };

    /** Ask before closing over unsaved input. */
    const requestClose = () => {
        if (isSubmitting) return;
        if (dirty && !window.confirm(t('crm.leadModal.discardConfirm'))) return;
        onClose();
    };

    /**
     * After "create and add another": a blank form for the next buyer, keeping
     * what a run of entries usually shares (stage, owner, source, campaign,
     * project, lists). Only called once the server has confirmed the save.
     */
    const resetForNext = (savedName: string) => {
        setFormData((prev) => ({
            firstName: '', lastName: '', email: '', phone: '', company: '', position: '',
            status: prev.status, stage: prev.stage, value: '', source: prev.source,
            notes: '', tags: [], leadListIds: prev.leadListIds,
        }));
        setBrief((prev) => ({
            ownerId: prev.ownerId, campaign: prev.campaign, interestedProgramId: prev.interestedProgramId,
            interestedTypology: '', budgetMin: '', budgetMax: '', preferredLocation: '',
        }));
        setLots([]);
        setAutoFilled({});
        setTask(emptyTask);
        setTaskError('');
        setTouched(new Set());
        setErrors({});
        setDuplicates([]);
        lastDuplicateKey.current = '';
        setAiPanel('none');
        setNewTag('');
        setDirty(false);
        requestKey.current = newRequestKey();
        setNotice(t('crm.leadModal.createdAnother', { name: savedName }));
        firstNameRef.current?.focus();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void submit(false);
    };

    const submit = async (keepOpen: boolean) => {
        if (isSubmitting) return;
        setNotice('');

        // Mark all fields as touched
        const fieldNames: (keyof ValidationErrors)[] = [
            'firstName', 'lastName', 'email', 'phone', 'company', 
            'position', 'status', 'stage', 'value', 'source', 'notes'
        ];
        setTouched(new Set(fieldNames));

        if (!validateForm()) {
            return;
        }

        // An opened "next action" needs a date; an empty one is simply not sent.
        const sendTask = offersTask && task.open && (task.dueAt !== '' || task.title.trim() !== '');
        if (sendTask && (!task.dueAt || Number.isNaN(new Date(task.dueAt).getTime()))) {
            setTaskError(t('crm.leadModal.nextActionDueRequired'));
            return;
        }
        setTaskError('');

        setIsSubmitting(true);
        try {
            // null (not undefined) so the API clears these rather than skipping them
            // The brief is sent only by a developer's form. null (not undefined)
            // so clearing a field clears it; a new lead with no owner chosen
            // sends none, which lets the server assign one.
            const developerFields = isDeveloper && workspaceId
                ? {
                    ownerId: brief.ownerId || (lead ? null : undefined),
                    campaign: brief.campaign.trim() || null,
                    interestedProgramId: brief.interestedProgramId || null,
                    interestedTypology: brief.interestedTypology.trim() || null,
                    budgetMin: brief.budgetMin === '' ? null : Number(brief.budgetMin),
                    budgetMax: brief.budgetMax === '' ? null : Number(brief.budgetMax),
                    preferredLocation: brief.preferredLocation.trim() || null,
                    // Ids only: the server reads each unit's facts from the database.
                    ...(lotsLoaded && { interestedLotIds: lots.map((l) => l.id) }),
                }
                : {};

            const createOnly = lead
                ? {}
                : {
                    clientRequestId: requestKey.current,
                    ...(sendTask && {
                        firstTask: {
                            type: task.type,
                            title: task.title.trim() || t(`developerCrm.taskTypes.${task.type}` as MessageKey),
                            dueAt: new Date(task.dueAt).toISOString(),
                            ...(task.assigneeId && { assigneeId: task.assigneeId }),
                        },
                    }),
                };

            const result = await onSave({
                ...formData,
                value: formData.value === '' || formData.value === null
                    ? null
                    : parseFloat(String(formData.value)),
                tags: formData.tags,
                ...developerFields,
                ...createOnly,
            } as Partial<Lead>, keepOpen ? { keepOpen: true } : undefined);

            // Nothing is cleared until the server has the lead.
            if (result !== false && keepOpen && !lead) {
                resetForNext(`${formData.firstName} ${formData.lastName}`.trim());
            }
        } catch (error) {
            console.error('Error saving lead:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Put the assistant's text in the notes. It is added after whatever is
     * already there rather than replacing it, because replacing threw away
     * notes someone had typed.
     */
    const addResultToNotes = () => {
        const existing = formData.notes.trim();
        const merged = existing ? `${existing}\n\n${aiResult.trim()}` : aiResult.trim();
        handleFieldChange('notes', merged.slice(0, 2000));
        setAiPanel('none');
    };

    const handleAddTag = () => {
        // Spaces collapsed, and "VIP" and "vip" counted as one tag.
        const tag = newTag.trim().replace(/\s+/g, ' ');
        if (!tag) return;
        if (formData.tags.length < 20 && !formData.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
            setFormData({
                ...formData,
                tags: [...formData.tags, tag],
            });
            setDirty(true);
        }
        setNewTag('');
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setDirty(true);
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
                            {lead ? t('crm.leadModal.editTitle') : t('crm.leadModal.createTitle')}
                        </h2>
                        <button
                            type="button"
                            onClick={requestClose}
                            className="text-on-surface-variant hover:text-on-surface transition-colors"
                            aria-label={t('crm.leadModal.closeAria')}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Tabs (only for existing leads) */}
                    {lead && workspaceId && (
                        <div className="flex gap-1 overflow-x-auto border-b border-surface-container-high -mx-6 px-6" role="tablist">
                            {([
                                ['details', t('crm.leadModal.tabDetails')],
                                ...(isDeveloper ? [['customer', t('developerCrm.customer.tab')] as [LeadModalTab, string]] : []),
                                ...(isDeveloper ? [] : [['interests', t('realEstate.nav.properties')] as [LeadModalTab, string]]),
                                ['meetings', t('crm.leadModal.tabMeetings')],
                                ['files', fileCount > 0 ? `${t('crm.files.tab')} (${fileCount})` : t('crm.files.tab')],
                                ['history', t('crm.leadModal.tabHistory')],
                            ] as Array<[LeadModalTab, string]>).map(([id, label]) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === id}
                                    onClick={() => setActiveTab(id)}
                                    className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${
                                        activeTab === id
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-on-surface-variant hover:text-on-surface'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
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

                    {lead && workspaceId && isDeveloper && activeTab === 'customer' && (
                        <CustomerTab
                            workspaceId={workspaceId}
                            leadId={lead.id}
                            leadName={`${lead.firstName} ${lead.lastName}`.trim()}
                            onOpenFiles={() => setActiveTab('files')}
                        />
                    )}

                    {lead && workspaceId && activeTab === 'interests' && (
                        <div className="p-6">
                            <LeadInterests workspaceId={workspaceId} lead={lead} />
                        </div>
                    )}

                    {lead && workspaceId && activeTab === 'files' && (
                        <div className="p-6">
                            <LeadFiles leadId={lead.id} onCountChange={setFileCount} />
                        </div>
                    )}

                    {lead && workspaceId && activeTab === 'history' && (
                        <div className="p-6">
                            <LeadTimeline leadId={lead.id} workspaceId={workspaceId} />
                        </div>
                    )}

                    {/* Details Tab / New lead form */}
                    {activeTab === 'details' && (
                    <div className="p-6">
                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Contact */}
                        <div>
                            <h3 className="headline-sm text-on-surface mb-4">{t('crm.leadModal.personalInfoHeading')}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        {t('crm.leadModal.firstNameLabel')}
                                    </label>
                                    <input
                                        ref={firstNameRef}
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
                                        {t('crm.leadModal.lastNameLabel')}
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
                                        {t('crm.leadModal.emailLabel')}
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
                                        {t('crm.leadModal.phoneLabel')}
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

                        {/* Someone with this email or phone is already on file. Shown,
                            never merged: the user decides whether it is the same person. */}
                        {!lead && duplicates.length > 0 && !duplicatesDismissed && (
                            <div
                                role="status"
                                className="rounded-lg border border-secondary/40 bg-secondary/5 p-4 space-y-3"
                            >
                                <p className="body-sm font-medium text-on-surface flex items-center gap-2">
                                    <span className="material-symbols-outlined text-secondary text-base" aria-hidden="true">group</span>
                                    {t('crm.leadModal.duplicateHeading')}
                                </p>
                                <ul className="space-y-2">
                                    {duplicates.map((match) => (
                                        <li key={match.id} className="flex flex-wrap items-start justify-between gap-3 body-sm">
                                            <div className="min-w-0">
                                                <p className="text-on-surface font-medium">
                                                    {`${match.firstName} ${match.lastName}`.trim()}
                                                    <span className="ml-2 text-xs font-normal text-secondary">
                                                        {match.matchedOn
                                                            .map((m) => t(m === 'email' ? 'crm.leadModal.duplicateMatchedEmail' : 'crm.leadModal.duplicateMatchedPhone'))
                                                            .join(' · ')}
                                                    </span>
                                                </p>
                                                <p className="text-on-surface-variant text-xs">
                                                    {[match.email, match.phone].filter(Boolean).join(' · ')}
                                                </p>
                                                <p className="text-on-surface-variant text-xs">
                                                    {[
                                                        stageLabel(match.stage, t),
                                                        match.ownerName,
                                                        match.programName,
                                                        match.lastActivityAt && `${t('crm.leadModal.duplicateLastActivity')} ${formatDate(match.lastActivityAt)}`,
                                                    ].filter(Boolean).join(' · ')}
                                                </p>
                                            </div>
                                            {onOpenExisting && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (dirty && !window.confirm(t('crm.leadModal.discardConfirm'))) return;
                                                        onOpenExisting(match.id);
                                                    }}
                                                    className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
                                                >
                                                    {t('crm.leadModal.duplicateOpen')}
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    type="button"
                                    onClick={() => setDuplicatesDismissed(true)}
                                    className="text-xs font-medium text-on-surface-variant hover:text-on-surface hover:underline"
                                >
                                    {t('crm.leadModal.duplicateContinue')}
                                </button>
                            </div>
                        )}

                        {/* Company, folded away until it is wanted */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowCompany((open) => !open)}
                                aria-expanded={showCompany}
                                className="flex items-center gap-1 body-sm text-on-surface-variant hover:text-on-surface transition-colors"
                            >
                                <span className={`material-symbols-outlined text-base transition-transform ${showCompany ? 'rotate-90' : ''}`}>
                                    chevron_right
                                </span>
                                {t('crm.leadModal.companyInfoHeading')}
                            </button>
                            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 ${showCompany ? '' : 'hidden'}`}>
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        {t('crm.leadModal.companyLabel')}
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
                                        {t('crm.leadModal.positionLabel')}
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
                            <h3 className="headline-sm text-on-surface mb-4">{t('crm.leadModal.pipelineInfoHeading')}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <SelectRefined
                                        label={t('crm.leadModal.stageLabel')}
                                        value={formData.stage}
                                        options={stageOptions}
                                        onChange={(val) => handleFieldChange('stage', val)}
                                        disabled={!pipeline}
                                        placeholder={!pipeline ? t('crm.leadModal.noPipelineSelected') : t('crm.leadModal.selectStagePlaceholder')}
                                    />
                                    {impliedStatus && (
                                        // Set by the stage, so it is a note under the stage rather than a
                                        // second field that looks editable and is not.
                                        <p className="body-xs text-on-surface-variant mt-1.5" title={t('leadStatusSync.followsStage')}>
                                            {t('crm.leadModal.statusLabel')}: {t(`crm.leadModal.status.${impliedStatus}` as MessageKey)}
                                        </p>
                                    )}
                                </div>
                                {!impliedStatus && (
                                    <div>
                                        <SelectRefined
                                            label={t('crm.leadModal.statusLabel')}
                                            value={formData.status}
                                            options={statusOptions}
                                            onChange={(val) => handleFieldChange('status', val)}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block body-sm text-on-surface-variant mb-2">
                                        {t('crm.leadModal.dealValueLabel')}
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
                                {/* A developer edits the source in the buyer brief below, as a
                                    select over the known channels, so it is not asked twice. */}
                                {!(isDeveloper && workspaceId) && (
                                    <div>
                                        <label className="block body-sm text-on-surface-variant mb-2">
                                            {t('crm.leadModal.sourceLabel')}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.source}
                                            onChange={(e) => handleFieldChange('source', e.target.value)}
                                            onBlur={() => handleFieldBlur('source')}
                                            className={getFieldClassName('source')}
                                            maxLength={100}
                                            placeholder={t('crm.leadModal.sourcePlaceholder')}
                                            aria-invalid={!!getFieldError('source')}
                                            aria-describedby={getFieldError('source') ? 'source-error' : undefined}
                                        />
                                        {getFieldError('source') && (
                                            <p id="source-error" className="body-xs text-error mt-1">
                                                {getFieldError('source')}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Developer buyer brief: owner, source, project and budget */}
                        {isDeveloper && workspaceId && (
                            <LeadBriefFields
                                workspaceId={workspaceId}
                                values={{ ...brief, source: formData.source }}
                                onChange={handleBriefChange}
                                score={lead?.score}
                                lastContactedAt={lead?.lastContactedAt}
                                nextFollowUpAt={lead?.nextFollowUpAt}
                                lots={lotsLoaded ? lots : undefined}
                                onLotsChange={handleLotsChange}
                                autoFilled={autoFilled}
                            />
                        )}

                        {/* The first follow-up, saved with the lead in one go. Folded
                            away: not every lead has a next step yet, and no date is
                            imposed on one that does not. */}
                        {offersTask && (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setTask((prev) => ({ ...prev, open: !prev.open }))}
                                    aria-expanded={task.open}
                                    className="flex items-center gap-1 body-sm text-on-surface-variant hover:text-on-surface transition-colors"
                                >
                                    <span className={`material-symbols-outlined text-base transition-transform ${task.open ? 'rotate-90' : ''}`}>
                                        chevron_right
                                    </span>
                                    {t('crm.leadModal.nextActionHeading')}
                                </button>
                                {task.open && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                        <label className="block">
                                            <span className="block body-sm text-on-surface-variant mb-2">{t('crm.leadModal.nextActionType')}</span>
                                            <select
                                                className="premium-input w-full px-4 py-2.5 text-sm transition-all"
                                                value={task.type}
                                                onChange={(e) => { setDirty(true); setTask((prev) => ({ ...prev, type: e.target.value as LeadTaskType })); }}
                                            >
                                                {LEAD_TASK_TYPES.map((type) => (
                                                    <option key={type} value={type}>{t(`developerCrm.taskTypes.${type}` as MessageKey)}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="block body-sm text-on-surface-variant mb-2">{t('crm.leadModal.nextActionTitle')}</span>
                                            <input
                                                type="text"
                                                maxLength={200}
                                                className="premium-input w-full px-4 py-2.5 text-sm transition-all"
                                                value={task.title}
                                                placeholder={t(`developerCrm.taskTypes.${task.type}` as MessageKey)}
                                                onChange={(e) => { setDirty(true); setTask((prev) => ({ ...prev, title: e.target.value })); }}
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="block body-sm text-on-surface-variant mb-2">{t('crm.leadModal.nextActionDue')}</span>
                                            <input
                                                type="datetime-local"
                                                className={`premium-input w-full px-4 py-2.5 text-sm transition-all${taskError ? ' border-error ring-error/20' : ''}`}
                                                value={task.dueAt}
                                                aria-invalid={!!taskError}
                                                aria-describedby={taskError ? 'next-action-error' : undefined}
                                                onChange={(e) => { setDirty(true); setTaskError(''); setTask((prev) => ({ ...prev, dueAt: e.target.value })); }}
                                            />
                                            {taskError && <span id="next-action-error" className="block body-xs text-error mt-1">{taskError}</span>}
                                        </label>
                                        <label className="block">
                                            <span className="block body-sm text-on-surface-variant mb-2">{t('crm.leadModal.nextActionAssignee')}</span>
                                            <select
                                                className="premium-input w-full px-4 py-2.5 text-sm transition-all"
                                                value={task.assigneeId}
                                                onChange={(e) => { setDirty(true); setTask((prev) => ({ ...prev, assigneeId: e.target.value })); }}
                                            >
                                                <option value="">{t('crm.leadModal.nextActionAssigneeDefault')}</option>
                                                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                            </select>
                                        </label>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Notes, with the assistant in their header: what it writes is
                            what goes into the notes, so the two belong together. */}
                        <div>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <label htmlFor="lead-notes" className="body-sm text-on-surface-variant">
                                    {t('crm.leadModal.notesLabel')}
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-secondary text-base" style={{ fontVariationSettings: 'FILL 1' }} aria-hidden="true">auto_awesome</span>
                                    {([['summary', t('crm.leadModal.summarizeLeadButton')], ['emailDraft', t('crm.leadModal.draftEmailButton')]] as Array<['summary' | 'emailDraft', string]>).map(([kind, label]) => (
                                        <button
                                            key={kind}
                                            type="button"
                                            aria-pressed={aiPanel === kind}
                                            onClick={() => aiPanel === kind ? setAiPanel('none') : runAI(kind)}
                                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                                aiPanel === kind
                                                    ? 'bg-secondary/20 text-secondary'
                                                    : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                                            }`}
                                        >
                                            {isAiLoading && aiPanel === kind
                                                ? <Loader2 className="h-3 w-3 animate-spin inline" />
                                                : label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <textarea
                                id="lead-notes"
                                value={formData.notes}
                                onChange={(e) => handleFieldChange('notes', e.target.value)}
                                onBlur={() => handleFieldBlur('notes')}
                                rows={4}
                                className={getFieldClassName('notes')}
                                placeholder={t('crm.leadModal.notesPlaceholder')}
                                maxLength={2000}
                                aria-invalid={!!getFieldError('notes')}
                                aria-describedby={getFieldError('notes') ? 'notes-error' : undefined}
                            />
                            {getFieldError('notes') && (
                                <p id="notes-error" className="body-xs text-error mt-1">
                                    {getFieldError('notes')}
                                </p>
                            )}
                            {/* The count is only news when the limit is close. */}
                            {formData.notes.length > 1800 && (
                                <p className="body-xs text-on-surface-variant mt-1">
                                    {t('crm.leadModal.notesCharCount', { count: formData.notes.length })}
                                </p>
                            )}

                            {aiPanel !== 'none' && (
                                <div className="mt-2 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3 space-y-2">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                        {aiPanel === 'summary' ? t('crm.leadModal.leadSummaryHeading') : t('crm.leadModal.emailDraftHeading')}
                                    </div>
                                    <div className="min-h-[60px] text-sm text-on-surface whitespace-pre-wrap">
                                        {isAiLoading && !aiResult ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                                        ) : aiResult || '…'}
                                    </div>
                                    {!isAiLoading && aiResult && (
                                        <button
                                            type="button"
                                            onClick={addResultToNotes}
                                            className="text-xs font-medium text-secondary hover:underline"
                                        >
                                            {t('crm.leadModal.copyToNotes')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>


                        {/* Tags */}
                        <div>
                            <label className="block body-sm text-on-surface-variant mb-2">
                                {t('crm.leadModal.tagsLabel')}
                            </label>
                            {/* Enter adds the tag; the placeholder says so, so no button. */}
                            <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={handleKeyPress}
                                onBlur={handleAddTag}
                                className="premium-input w-full px-4 py-2.5 text-sm transition-all mb-2"
                                placeholder={t('crm.leadModal.tagPlaceholder')}
                                maxLength={50}
                            />
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
                                                aria-label={t('crm.leadModal.removeTagAria', { tag })}
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
                                    {t('crm.leadModal.leadListsLabel')}
                                </label>
                                <div className="space-y-2">
                                    {leadLists.map((leadList) => (
                                        <label key={leadList.id} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.leadListIds.includes(leadList.id)}
                                                onChange={(e) => {
                                                    setDirty(true);
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

                        {/* Actions */}
                        <p role="status" aria-live="polite" className={notice ? 'body-sm text-primary' : 'sr-only'}>
                            {notice}
                        </p>
                        <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-surface-container-high">
                            <button
                                type="button"
                                onClick={requestClose}
                                disabled={isSubmitting}
                                className="px-6 py-2 text-sm text-on-surface hover:bg-surface-container-high rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('common.cancel')}
                            </button>
                            {!lead && (
                                <button
                                    type="button"
                                    onClick={() => void submit(true)}
                                    disabled={isSubmitting}
                                    className="px-6 py-2 text-sm text-primary border border-primary/40 rounded hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t('crm.leadModal.createAndAddAnother')}
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-6 py-2 bg-primary text-on-primary rounded text-sm hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-on-primary border-t-transparent" />
                                        <span>{t('common.saving')}</span>
                                    </>
                                ) : (
                                    <span>{lead ? t('crm.leadModal.updateButton') : t('crm.leadModal.createButton')}</span>
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
