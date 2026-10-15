'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, X, MoreHorizontal, Edit, Trash2, Paperclip, Phone, Mail } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/i18n/I18nProvider';
import { sourceLabel, stageLabel, statusLabel } from '@/components/crm/labels';
import { effectiveLeadStatus } from '@/lib/crm/lead-status';
import { useWorkspaceCurrency } from '@/components/workspace/useWorkspaceCurrency';
import { FollowUpChip, OwnerAvatar, ScoreBadge } from '@/components/developer/lead-meta';
import { useWorkspaceAgents } from '@/components/developer/useWorkspaceAgents';
import { matchesOwnerFilter, type OwnerFilterValue } from '@/components/developer/OwnerFilter';

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
    createdAt?: string;
    updatedAt?: string;
    /** Number of attached files (from the leads list) */
    fileCount?: number;
    /** Most recent history entry */
    lastActivityAt?: string;
    // Developer CRM
    ownerId?: string | null;
    score?: number;
    nextFollowUpAt?: string | null;
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

interface FilterConfig {
    status: string[];
    stage: string[];
    source: string[];
    tags: string[];
    search: string;
}

interface LeadListViewProps {
    pipeline: Pipeline;
    refreshKey?: number;
    onLeadUpdate: (leadId: string, updates: Partial<Lead>) => Promise<boolean>;
    onLeadDelete: (leadId: string) => Promise<boolean>;
    onOpenLeadModal: (lead?: Lead) => void;
    /** A developer's "my leads" / owner filter. */
    ownerFilter?: OwnerFilterValue;
}

type SortField = 'name' | 'company' | 'email' | 'status' | 'stage' | 'value' | 'source' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function LeadListView({
    pipeline,
    refreshKey = 0,
    onLeadUpdate,
    onLeadDelete,
    onOpenLeadModal,
    ownerFilter = '',
}: LeadListViewProps) {
    const { t, formatCurrency, formatDate: formatDateI18n } = useI18n();
    const workspaceCurrency = useWorkspaceCurrency(pipeline.workspaceId);
    const { data: session } = useSession();
    const isDeveloper = session?.user?.businessType === 'DEVELOPER';
    const agents = useWorkspaceAgents(pipeline.workspaceId);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection } | null>(null);
    const [filters, setFilters] = useState<FilterConfig>({
        status: [],
        stage: [],
        source: [],
        tags: [],
        search: '',
    });
    const [showFilters, setShowFilters] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);

    const fetchLeads = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/leads?pipelineId=${pipeline.id}`);
            if (response.ok) {
                const data = await response.json();
                setLeads(data);
            }
        } catch (error) {
            console.error('Error fetching leads:', error);
        } finally {
            setLoading(false);
        }
    }, [pipeline.id]);

    // Reload when the board changes or the parent asks for fresh data.
    useEffect(() => {
        fetchLeads();
    }, [fetchLeads, refreshKey]);

    // Get unique values for filters
    const uniqueStatuses = useMemo(() => {
        return Array.from(new Set(leads.map(lead => effectiveLeadStatus(lead)))).sort();
    }, [leads]);

    const uniqueStages = useMemo(() => {
        return pipeline.stages;
    }, [pipeline.stages]);

    const uniqueSources = useMemo(() => {
        return Array.from(new Set(leads.map(lead => lead.source).filter((s): s is string => Boolean(s)))).sort();
    }, [leads]);

    const uniqueTags = useMemo(() => {
        const allTags = leads.flatMap(lead => lead.tags || []);
        return Array.from(new Set(allTags)).sort();
    }, [leads]);

    // Filter leads
    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            if (!matchesOwnerFilter(lead, ownerFilter, session?.user?.id)) return false;

            // Status filter
            if (filters.status.length > 0 && !filters.status.includes(effectiveLeadStatus(lead))) {
                return false;
            }

            // Stage filter
            if (filters.stage.length > 0 && !filters.stage.includes(lead.stage)) {
                return false;
            }

            // Source filter
            if (filters.source.length > 0 && !filters.source.includes(lead.source || '')) {
                return false;
            }

            // Tags filter
            if (filters.tags.length > 0) {
                const leadTags = lead.tags || [];
                const hasMatchingTag = filters.tags.some(tag => leadTags.includes(tag));
                if (!hasMatchingTag) {
                    return false;
                }
            }

            // Search filter
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const searchableText = [
                    lead.firstName,
                    lead.lastName,
                    lead.email,
                    lead.phone,
                    lead.company,
                    lead.position,
                    lead.source,
                ].join(' ').toLowerCase();
                // Phones are stored as typed ("+213 662 54 36 54"): digits match digits.
                const digits = filters.search.replace(/\D/g, '');
                const phoneMatch = digits.length >= 3 && (lead.phone ?? '').replace(/\D/g, '').includes(digits);

                if (!searchableText.includes(searchLower) && !phoneMatch) {
                    return false;
                }
            }

            return true;
        });
    }, [leads, filters, ownerFilter, session?.user?.id]);

    // Sort leads
    const sortedLeads = useMemo(() => {
        if (!sortConfig) return filteredLeads;

        return [...filteredLeads].sort((a, b) => {
            let comparison = 0;

            switch (sortConfig.field) {
                case 'name':
                    comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
                    break;
                case 'company':
                    comparison = (a.company || '').localeCompare(b.company || '');
                    break;
                case 'email':
                    comparison = (a.email || '').localeCompare(b.email || '');
                    break;
                case 'status':
                    comparison = effectiveLeadStatus(a).localeCompare(effectiveLeadStatus(b));
                    break;
                case 'stage':
                    comparison = a.stage.localeCompare(b.stage);
                    break;
                case 'value':
                    comparison = (a.value || 0) - (b.value || 0);
                    break;
                case 'source':
                    comparison = (a.source || '').localeCompare(b.source || '');
                    break;
                case 'createdAt':
                    comparison = new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();
                    break;
            }

            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [filteredLeads, sortConfig]);

    const handleSort = (field: SortField) => {
        setSortConfig(prev => {
            if (prev?.field === field) {
                if (prev.direction === 'asc') {
                    return { field, direction: 'desc' };
                } else {
                    return null;
                }
            }
            return { field, direction: 'asc' };
        });
    };

    const handleFilterToggle = (filterType: keyof FilterConfig, value: string) => {
        setFilters(prev => {
            const currentValues = prev[filterType] as string[];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [filterType]: newValues };
        });
    };

    const handleClearFilters = () => {
        setFilters({
            status: [],
            stage: [],
            source: [],
            tags: [],
            search: '',
        });
    };

    const handleDelete = async (lead: Lead) => {
        if (!confirm(t('crm.pipelineBoard.confirmDeleteLead', { firstName: lead.firstName, lastName: lead.lastName }))) return;

        const previousLeads = leads;
        setLeads(prev => prev.filter(l => l.id !== lead.id));
        setShowActionsMenu(null);

        // Only keep the row hidden if the server actually deleted it
        const ok = await onLeadDelete(lead.id);
        if (!ok) setLeads(previousLeads);
    };

    /** Won and lost stand out; every other stage reads as plain text on a grey wash. */
    const stageTone = (lead: Lead) => {
        const status = effectiveLeadStatus(lead);
        if (status === 'won') return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300';
        if (status === 'lost') return 'bg-error-container text-error';
        return 'bg-surface-container-high text-on-surface';
    };

    const formatValue = (value?: number | null) => {
        if (value == null) return '–';
        return formatCurrency(value, workspaceCurrency);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '–';
        return formatDateI18n(dateString, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getSortIcon = (field: SortField) => {
        if (!sortConfig || sortConfig.field !== field) {
            return <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />;
        }
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-3.5 h-3.5" />
            : <ArrowDown className="w-3.5 h-3.5" />;
    };

    const activeFiltersCount =
        filters.status.length +
        filters.stage.length +
        filters.source.length +
        filters.tags.length +
        (filters.search ? 1 : 0);

    // How many prospects sit at each stage, for the quick filter above the table.
    const stageCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const lead of leads) {
            if (matchesOwnerFilter(lead, ownerFilter, session?.user?.id)) counts[lead.stage] = (counts[lead.stage] ?? 0) + 1;
        }
        return counts;
    }, [leads, ownerFilter, session?.user?.id]);
    const ownedTotal = useMemo(() => Object.values(stageCounts).reduce((a, b) => a + b, 0), [stageCounts]);

    // Columns that would be a wall of dashes earn no space.
    const showCompany = leads.some((l) => l.company);
    const showTags = leads.some((l) => l.tags && l.tags.length > 0);
    const showOwner = isDeveloper || leads.some((l) => l.ownerId);
    const showFollowUp = isDeveloper || leads.some((l) => l.nextFollowUpAt);
    const columnCount = 6 + Number(showCompany) + Number(showTags) + Number(showOwner) + Number(showFollowUp) + Number(isDeveloper);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="skeleton w-64 h-8 rounded mb-4 mx-auto"></div>
                    <div className="skeleton w-96 h-32 rounded mx-auto"></div>
                </div>
            </div>
        );
    }

    const sortHeader = (field: SortField, label: string, className = '') => (
        <th className={`px-3 py-2.5 text-start ${className}`}>
            <button
                onClick={() => handleSort(field)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors"
            >
                {label}
                {getSortIcon(field)}
            </button>
        </th>
    );
    const plainHeader = (label: string, className = '') => (
        <th className={`px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant ${className}`}>{label}</th>
    );

    const stageChip = (stage: string | null, label: string, count: number) => {
        const active = stage === null ? filters.stage.length === 0 : filters.stage.length === 1 && filters.stage[0] === stage;
        return (
            <button
                key={stage ?? '__all__'}
                type="button"
                aria-pressed={active}
                onClick={() => setFilters((prev) => ({ ...prev, stage: stage === null || active ? [] : [stage] }))}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    active
                        ? 'bg-on-surface text-surface'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
            >
                {label}
                <span className={`tabular-nums text-xs ${active ? 'opacity-80' : 'opacity-60'}`}>{count}</span>
            </button>
        );
    };

    return (
        <div className="h-full flex flex-col">
            <div className="mb-4 space-y-3">
                {/* Stages at a glance: one click narrows the list to a stage */}
                <div role="group" aria-label={t('crm.leadListView.stageFilterAria')} className="flex gap-2 overflow-x-auto pb-1 -mb-1">
                    {stageChip(null, t('crm.leadListView.allStages'), ownedTotal)}
                    {pipeline.stages.map((stage) => stageChip(stage, stageLabel(stage, t), stageCounts[stage] ?? 0))}
                </div>

                <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                            <input
                                type="search"
                                placeholder={t('crm.leadListView.searchPlaceholder')}
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="w-full ps-10 pe-4 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            />
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            aria-expanded={showFilters}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                showFilters
                                    ? 'bg-surface-container-highest text-on-surface'
                                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            <span>{t('crm.leadListView.filtersButton')}</span>
                            {activeFiltersCount > 0 && (
                                <span className="px-1.5 py-0.5 bg-on-surface text-surface rounded-full text-[11px] leading-none tabular-nums">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>

                        {activeFiltersCount > 0 && (
                            <button
                                onClick={handleClearFilters}
                                className="flex items-center gap-1.5 px-2 py-2 text-sm text-on-surface-variant hover:text-on-surface rounded-lg transition-all"
                            >
                                <X className="w-4 h-4" />
                                <span>{t('common.clearFilters')}</span>
                            </button>
                        )}
                    </div>

                    <div className="text-sm text-on-surface-variant tabular-nums">
                        {t('crm.leadListView.resultsCount', { shown: sortedLeads.length, total: leads.length })}
                    </div>
                </div>

                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-surface-container-low border border-outline-variant/20 rounded-lg">
                        {[
                            { key: 'status' as const, label: t('crm.leadListView.fieldStatus'), values: uniqueStatuses, name: (v: string) => statusLabel(v, t) },
                            { key: 'stage' as const, label: t('crm.leadListView.fieldStage'), values: uniqueStages, name: (v: string) => stageLabel(v, t) },
                            { key: 'source' as const, label: t('crm.leadListView.fieldSource'), values: uniqueSources, name: (v: string) => sourceLabel(v, t) },
                            { key: 'tags' as const, label: t('crm.leadListView.fieldTags'), values: uniqueTags, name: (v: string) => v },
                        ].filter((group) => group.values.length > 0).map((group) => (
                            <fieldset key={group.key}>
                                <legend className="block text-xs font-semibold text-on-surface-variant mb-2">{group.label}</legend>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {group.values.map((value) => (
                                        <label key={value} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={filters[group.key].includes(value)}
                                                onChange={() => handleFilterToggle(group.key, value)}
                                                className="w-4 h-4 rounded border-surface-container-high text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm text-on-surface">{group.name(value)}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto border border-outline-variant/20 rounded-xl">
                <table className="w-full min-w-[760px]">
                    <thead className="bg-surface-container-low sticky top-0 z-[1]">
                        <tr>
                            {sortHeader('name', t('crm.leadListView.fieldProspect'))}
                            {showCompany && sortHeader('company', t('crm.leadListView.fieldCompany'), 'hidden lg:table-cell')}
                            {sortHeader('stage', t('crm.leadListView.fieldStage'))}
                            {sortHeader('value', t('crm.leadListView.fieldBudget'), 'text-end [&>button]:flex-row-reverse')}
                            {sortHeader('source', t('crm.leadListView.fieldSource'), 'hidden lg:table-cell')}
                            {showTags && plainHeader(t('crm.leadListView.fieldTags'), 'hidden xl:table-cell')}
                            {showOwner && plainHeader(t('crm.leadListView.fieldOwner'), 'hidden md:table-cell')}
                            {isDeveloper && plainHeader(t('developerCrm.lead.score'), 'hidden md:table-cell')}
                            {showFollowUp && plainHeader(t('crm.leadListView.fieldFollowUp'), 'hidden md:table-cell')}
                            {sortHeader('createdAt', t('crm.leadListView.fieldCreated'), 'hidden 2xl:table-cell')}
                            <th className="px-3 py-2.5"><span className="sr-only">{t('crm.leadListView.fieldActions')}</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/15">
                        {sortedLeads.length === 0 ? (
                            <tr>
                                <td colSpan={columnCount} className="px-4 py-14 text-center">
                                    <p className="text-sm text-on-surface-variant mb-4">
                                        {activeFiltersCount > 0 ? t('crm.leadListView.emptyFiltered') : t('crm.leadListView.emptyState')}
                                    </p>
                                    {activeFiltersCount > 0 ? (
                                        <button onClick={handleClearFilters} className="px-4 py-2 rounded-lg bg-surface-container-high text-sm text-on-surface hover:bg-surface-container-highest">
                                            {t('common.clearFilters')}
                                        </button>
                                    ) : (
                                        <button onClick={() => onOpenLeadModal()} className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm hover:bg-primary-container">
                                            {t('crm.page.addLeadButton')}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            sortedLeads.map((lead) => {
                                const name = `${lead.firstName} ${lead.lastName}`.trim();
                                const contact = [lead.phone, lead.email].filter(Boolean).join(' · ');
                                return (
                                    <tr
                                        key={lead.id}
                                        className="group hover:bg-surface-container-low transition-colors cursor-pointer"
                                        onClick={() => onOpenLeadModal(lead)}
                                    >
                                        <td className="px-3 py-2.5 max-w-[280px]">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span aria-hidden="true" className="shrink-0 w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-semibold inline-flex items-center justify-center">
                                                    {initialsOf(name)}
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 text-sm font-medium text-on-surface">
                                                        <span className="truncate">{name}</span>
                                                        {lead.fileCount ? (
                                                            <span className="shrink-0 flex items-center gap-0.5 text-[11px] font-normal text-on-surface-variant" title={t('crm.files.countTitle', { count: lead.fileCount })}>
                                                                <Paperclip className="h-3 w-3" />
                                                                {lead.fileCount}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {(contact || lead.position) && (
                                                        <div className="text-xs text-on-surface-variant truncate">{contact || lead.position}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        {showCompany && (
                                            <td className="hidden lg:table-cell px-3 py-2.5 text-sm text-on-surface">{lead.company || '–'}</td>
                                        )}
                                        <td className="px-3 py-2.5">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${stageTone(lead)}`}>
                                                {stageLabel(lead.stage, t)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-sm text-on-surface text-end tabular-nums whitespace-nowrap">
                                            {formatValue(lead.value)}
                                        </td>
                                        <td className="hidden lg:table-cell px-3 py-2.5 text-sm text-on-surface-variant whitespace-nowrap">
                                            {lead.source ? sourceLabel(lead.source, t) : '–'}
                                        </td>
                                        {showTags && (
                                            <td className="hidden xl:table-cell px-3 py-2.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {(lead.tags ?? []).slice(0, 2).map((tag) => (
                                                        <span key={tag} className="text-[11px] px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant rounded">{tag}</span>
                                                    ))}
                                                    {lead.tags && lead.tags.length > 2 && (
                                                        <span className="text-[11px] px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant rounded">+{lead.tags.length - 2}</span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        {showOwner && (
                                            <td className="hidden md:table-cell px-3 py-2.5"><OwnerAvatar ownerId={lead.ownerId} agents={agents} /></td>
                                        )}
                                        {isDeveloper && (
                                            <td className="hidden md:table-cell px-3 py-2.5">{typeof lead.score === 'number' ? <ScoreBadge score={lead.score} /> : null}</td>
                                        )}
                                        {showFollowUp && (
                                            <td className="hidden md:table-cell px-3 py-2.5 whitespace-nowrap"><FollowUpChip nextFollowUpAt={lead.nextFollowUpAt} /></td>
                                        )}
                                        <td className="hidden 2xl:table-cell px-3 py-2.5 text-sm text-on-surface-variant whitespace-nowrap">
                                            {formatDate(lead.createdAt)}
                                        </td>
                                        <td className="px-2 py-2.5 text-end whitespace-nowrap">
                                            <div className="inline-flex items-center gap-0.5">
                                                {/* One click to reach the prospect, without opening the record */}
                                                {lead.phone && (
                                                    <a
                                                        href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                                                        aria-label={t('crm.leadListView.callAria', { name })}
                                                        title={lead.phone}
                                                    >
                                                        <Phone className="w-4 h-4" />
                                                    </a>
                                                )}
                                                {lead.email && (
                                                    <a
                                                        href={`mailto:${lead.email}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                                                        aria-label={t('crm.leadListView.emailAria', { name })}
                                                        title={lead.email}
                                                    >
                                                        <Mail className="w-4 h-4" />
                                                    </a>
                                                )}
                                                <div className="relative inline-block">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowActionsMenu(showActionsMenu === lead.id ? null : lead.id);
                                                        }}
                                                        className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors"
                                                        aria-label={t('crm.leadListView.actionsAria')}
                                                        aria-expanded={showActionsMenu === lead.id}
                                                    >
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </button>
                                                    {showActionsMenu === lead.id && (
                                                        <div className="absolute end-0 top-full mt-1 bg-surface rounded-lg shadow-lg border border-outline-variant/20 py-1 z-10 min-w-[140px]">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onOpenLeadModal(lead);
                                                                    setShowActionsMenu(null);
                                                                }}
                                                                className="w-full px-3 py-2 text-start text-sm text-on-surface hover:bg-surface-container-high flex items-center gap-2 transition-colors"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                                {t('common.edit')}
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDelete(lead);
                                                                }}
                                                                className="w-full px-3 py-2 text-start text-sm text-error hover:bg-error-container flex items-center gap-2 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                                {t('common.delete')}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function initialsOf(name: string): string {
    return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
