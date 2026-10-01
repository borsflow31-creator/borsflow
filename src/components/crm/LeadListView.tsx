'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, X, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

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
}

type SortField = 'name' | 'company' | 'email' | 'status' | 'stage' | 'value' | 'source' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function LeadListView({
    pipeline,
    refreshKey = 0,
    onLeadUpdate,
    onLeadDelete,
    onOpenLeadModal,
}: LeadListViewProps) {
    const { t, formatCurrency, formatDate: formatDateI18n } = useI18n();
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

    useEffect(() => {
        fetchLeads();
    }, [pipeline.id, refreshKey]);

    const fetchLeads = async () => {
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
    };

    // Get unique values for filters
    const uniqueStatuses = useMemo(() => {
        return Array.from(new Set(leads.map(lead => lead.status))).sort();
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
            // Status filter
            if (filters.status.length > 0 && !filters.status.includes(lead.status)) {
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
                    lead.company,
                    lead.position,
                    lead.source,
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(searchLower)) {
                    return false;
                }
            }

            return true;
        });
    }, [leads, filters]);

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
                    comparison = a.status.localeCompare(b.status);
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

    const getStatusColor = (status: string) => {
        const colors: { [key: string]: string } = {
            new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            contacted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
            qualified: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            proposal: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
            negotiation: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
            won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
            lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        };
        return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    };

    const formatValue = (value?: number | null) => {
        if (value == null) return '-';
        return formatCurrency(value, 'USD');
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        return formatDateI18n(dateString, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getSortIcon = (field: SortField) => {
        if (!sortConfig || sortConfig.field !== field) {
            return <ArrowUpDown className="w-4 h-4 opacity-30" />;
        }
        return sortConfig.direction === 'asc' 
            ? <ArrowUp className="w-4 h-4" />
            : <ArrowDown className="w-4 h-4" />;
    };

    const activeFiltersCount = 
        filters.status.length + 
        filters.stage.length + 
        filters.source.length + 
        filters.tags.length + 
        (filters.search ? 1 : 0);

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

    return (
        <div className="h-full flex flex-col">
            {/* Header with filters */}
            <div className="mb-4 space-y-4">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                            <input
                                type="text"
                                placeholder={t('crm.leadListView.searchPlaceholder')}
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="w-full pl-10 pr-4 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            />
                        </div>

                        {/* Filter toggle */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                showFilters || activeFiltersCount > 0
                                    ? 'bg-primary text-on-primary'
                                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            <span>{t('crm.leadListView.filtersButton')}</span>
                            {activeFiltersCount > 0 && (
                                <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>

                        {/* Clear filters */}
                        {activeFiltersCount > 0 && (
                            <button
                                onClick={handleClearFilters}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-all"
                            >
                                <X className="w-4 h-4" />
                                <span>{t('common.clearFilters')}</span>
                            </button>
                        )}
                    </div>

                    {/* Results count */}
                    <div className="text-sm text-on-surface-variant">
                        {t('crm.leadListView.resultsCount', { shown: sortedLeads.length, total: leads.length })}
                    </div>
                </div>

                {/* Filter panels */}
                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-surface-container-high rounded-lg">
                        {/* Status filter */}
                        <div>
                            <label className="block body-sm text-on-surface-variant mb-2">{t('crm.leadListView.fieldStatus')}</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {uniqueStatuses.map(status => (
                                    <label key={status} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filters.status.includes(status)}
                                            onChange={() => handleFilterToggle('status', status)}
                                            className="w-4 h-4 rounded border-surface-container-high text-primary focus:ring-primary"
                                        />
                                        <span className="body-sm text-on-surface capitalize">{status}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Stage filter */}
                        <div>
                            <label className="block body-sm text-on-surface-variant mb-2">{t('crm.leadListView.fieldStage')}</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {uniqueStages.map(stage => (
                                    <label key={stage} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filters.stage.includes(stage)}
                                            onChange={() => handleFilterToggle('stage', stage)}
                                            className="w-4 h-4 rounded border-surface-container-high text-primary focus:ring-primary"
                                        />
                                        <span className="body-sm text-on-surface">{stage}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Source filter */}
                        <div>
                            <label className="block body-sm text-on-surface-variant mb-2">{t('crm.leadListView.fieldSource')}</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {uniqueSources.map(source => (
                                    <label key={source} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filters.source.includes(source)}
                                            onChange={() => handleFilterToggle('source', source)}
                                            className="w-4 h-4 rounded border-surface-container-high text-primary focus:ring-primary"
                                        />
                                        <span className="body-sm text-on-surface">{source}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Tags filter */}
                        <div>
                            <label className="block body-sm text-on-surface-variant mb-2">{t('crm.leadListView.fieldTags')}</label>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {uniqueTags.map(tag => (
                                    <label key={tag} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filters.tags.includes(tag)}
                                            onChange={() => handleFilterToggle('tags', tag)}
                                            className="w-4 h-4 rounded border-surface-container-high text-primary focus:ring-primary"
                                        />
                                        <span className="body-sm text-on-surface">{tag}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto border border-outline-variant/20 rounded-lg">
                <table className="w-full min-w-[800px]">
                    <thead className="bg-surface-container-high sticky top-0">
                        <tr>
                            <th className="px-3 sm:px-4 py-3 text-left">
                                <button
                                    onClick={() => handleSort('name')}
                                    className="flex items-center gap-2 text-xs sm:text-sm font-medium text-on-surface hover:text-primary transition-colors"
                                >
                                    {t('crm.leadListView.fieldName')}
                                    {getSortIcon('name')}
                                </button>
                            </th>
                            <th className="hidden sm:table-cell px-4 py-3 text-left">
                                <button
                                    onClick={() => handleSort('company')}
                                    className="flex items-center gap-2 text-sm font-medium text-on-surface hover:text-primary transition-colors"
                                >
                                    {t('crm.leadListView.fieldCompany')}
                                    {getSortIcon('company')}
                                </button>
                            </th>
                            <th className="hidden md:table-cell px-4 py-3 text-left">
                                <button
                                    onClick={() => handleSort('email')}
                                    className="flex items-center gap-2 text-sm font-medium text-on-surface hover:text-primary transition-colors"
                                >
                                    {t('crm.leadListView.fieldEmail')}
                                    {getSortIcon('email')}
                                </button>
                            </th>
                            <th className="px-3 sm:px-4 py-3 text-left">
                                <button
                                    onClick={() => handleSort('status')}
                                    className="flex items-center gap-2 text-xs sm:text-sm font-medium text-on-surface hover:text-primary transition-colors"
                                >
                                    {t('crm.leadListView.fieldStatus')}
                                    {getSortIcon('status')}
                                </button>
                            </th>
                            <th className="hidden sm:table-cell px-4 py-3 text-left">
                                <button
                                    onClick={() => handleSort('stage')}
                                    className="flex items-center gap-2 text-sm font-medium text-on-surface hover:text-primary transition-colors"
                                >
                                    {t('crm.leadListView.fieldStage')}
                                    {getSortIcon('stage')}
                                </button>
                            </th>
                            <th className="hidden md:table-cell px-4 py-3 text-left">
                                <button
                                    onClick={() => handleSort('value')}
                                    className="flex items-center gap-2 text-sm font-medium text-on-surface hover:text-primary transition-colors"
                                >
                                    {t('crm.leadListView.fieldValue')}
                                    {getSortIcon('value')}
                                </button>
                            </th>
                            <th className="hidden lg:table-cell px-4 py-3 text-left">
                                <button
                                    onClick={() => handleSort('source')}
                                    className="flex items-center gap-2 text-sm font-medium text-on-surface hover:text-primary transition-colors"
                                >
                                    {t('crm.leadListView.fieldSource')}
                                    {getSortIcon('source')}
                                </button>
                            </th>
                            <th className="hidden md:table-cell px-4 py-3 text-left">{t('crm.leadListView.fieldTags')}</th>
                            <th className="hidden lg:table-cell px-4 py-3 text-left">
                                <button
                                    onClick={() => handleSort('createdAt')}
                                    className="flex items-center gap-2 text-sm font-medium text-on-surface hover:text-primary transition-colors"
                                >
                                    {t('crm.leadListView.fieldCreated')}
                                    {getSortIcon('createdAt')}
                                </button>
                            </th>
                            <th className="px-3 sm:px-4 py-3 text-right">{t('crm.leadListView.fieldActions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedLeads.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-on-surface-variant">
                                    {activeFiltersCount > 0
                                        ? t('crm.leadListView.emptyFiltered')
                                        : t('crm.leadListView.emptyState')
                                    }
                                </td>
                            </tr>
                        ) : (
                            sortedLeads.map((lead, index) => (
                                <tr
                                    key={lead.id}
                                    className={`border-t border-outline-variant/10 hover:bg-surface-container-high/50 transition-colors cursor-pointer ${
                                        index % 2 === 0 ? 'bg-surface' : 'bg-surface-container-low/30'
                                    }`}
                                    onClick={() => onOpenLeadModal(lead)}
                                >
                                    <td className="px-3 sm:px-4 py-3">
                                        <div>
                                            <div className="font-medium text-sm text-on-surface">
                                                {lead.firstName} {lead.lastName}
                                            </div>
                                            {lead.position && (
                                                <div className="text-xs text-on-surface-variant">{lead.position}</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-on-surface">
                                        {lead.company || '-'}
                                    </td>
                                    <td className="hidden md:table-cell px-4 py-3 text-sm text-on-surface">
                                        {lead.email || '-'}
                                    </td>
                                    <td className="px-3 sm:px-4 py-3">
                                        <span className={`body-xs px-2 py-1 rounded ${getStatusColor(lead.status)}`}>
                                            {lead.status}
                                        </span>
                                    </td>
                                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-on-surface">
                                        {lead.stage}
                                    </td>
                                    <td className="hidden md:table-cell px-4 py-3 text-sm font-medium text-on-surface">
                                        {formatValue(lead.value)}
                                    </td>
                                    <td className="hidden lg:table-cell px-4 py-3 text-sm text-on-surface">
                                        {lead.source || '-'}
                                    </td>
                                    <td className="hidden md:table-cell px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {lead.tags && lead.tags.length > 0 ? (
                                                lead.tags.slice(0, 2).map((tag, tagIndex) => (
                                                    <span
                                                        key={tagIndex}
                                                        className="body-xs px-2 py-1 bg-surface-container-highest text-on-surface-variant rounded"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-sm text-on-surface-variant">-</span>
                                            )}
                                            {lead.tags && lead.tags.length > 2 && (
                                                <span className="body-xs px-2 py-1 bg-surface-container-highest text-on-surface-variant rounded">
                                                    +{lead.tags.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="hidden lg:table-cell px-4 py-3 text-sm text-on-surface-variant">
                                        {formatDate(lead.createdAt)}
                                    </td>
                                    <td className="px-3 sm:px-4 py-3 text-right">
                                        <div className="relative inline-block">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowActionsMenu(showActionsMenu === lead.id ? null : lead.id);
                                                }}
                                                className="p-1.5 text-on-surface-variant hover:bg-surface-container-high rounded transition-colors"
                                                aria-label={t('crm.leadListView.actionsAria')}
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                            {showActionsMenu === lead.id && (
                                                <div className="absolute right-0 top-full mt-1 bg-surface rounded-lg shadow-lg border border-outline-variant/20 py-1 z-10 min-w-[120px]">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onOpenLeadModal(lead);
                                                            setShowActionsMenu(null);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high flex items-center gap-2 transition-colors"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                        {t('common.edit')}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(lead);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm text-error hover:bg-error-container flex items-center gap-2 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        {t('common.delete')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
