'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/i18n/I18nProvider';

interface Workspace {
    id: string;
    name: string;
    icon?: string | null;
}

interface WorkspaceSwitcherProps {
    currentWorkspace?: Workspace | null;
    onCreateWorkspace?: () => void;
}

export default function WorkspaceSwitcher({ currentWorkspace, onCreateWorkspace }: WorkspaceSwitcherProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { currentWorkspaceId, setWorkspace } = useAppStore();
    const { data: session } = useSession();
    const { t } = useI18n();

    useEffect(() => {
        const fetchWorkspaces = async () => {
            if (!session?.user?.id) return;
            
            setIsLoading(true);
            try {
                const response = await fetch('/api/workspaces');
                if (response.ok) {
                    const data = await response.json();
                    setWorkspaces(data.workspaces || []);
                }
            } catch (error) {
                console.error('Error fetching workspaces:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWorkspaces();
    }, [session]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const handleWorkspaceSelect = (workspaceId: string) => {
        setWorkspace(workspaceId);
        router.push(`/workspaces/${workspaceId}`);
        setIsOpen(false);
    };

    const effectiveWorkspace = currentWorkspace || workspaces.find(w => w.id === currentWorkspaceId);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Workspace Selector Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container-highest transition-colors duration-150"
                aria-label={t('workspace.switcher.switchWorkspace')}
            >
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-on-secondary font-semibold text-sm flex-shrink-0">
                    {effectiveWorkspace?.icon || effectiveWorkspace ? getInitials(effectiveWorkspace.name) : 'W'}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-semibold text-sm text-on-surface truncate">
                        {effectiveWorkspace?.name || 'Select Workspace'}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                        {effectiveWorkspace ? 'Workspace' : 'Choose a workspace'}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface-container-highest rounded-xl shadow-xl border border-outline-variant/10 overflow-hidden">
                    <div className="p-2">
                        {/* Workspaces List */}
                        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="px-3 py-4 text-center text-sm text-on-surface-variant">
                                    {t('workspace.switcher.loading')}
                                </div>
                            ) : workspaces.length === 0 ? (
                                <div className="px-3 py-4 text-center text-sm text-on-surface-variant">
                                    {t('workspace.switcher.noWorkspaces')}
                                </div>
                            ) : (
                                workspaces.map((workspace) => {
                                    const isSelected = workspace.id === currentWorkspaceId;
                                    return (
                                        <button
                                            key={workspace.id}
                                            onClick={() => handleWorkspaceSelect(workspace.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150 ${
                                                isSelected
                                                    ? 'bg-secondary/10 text-secondary'
                                                    : 'text-on-surface hover:bg-surface-container-high'
                                            }`}
                                        >
                                            <div className="w-7 h-7 rounded-md bg-secondary/20 flex items-center justify-center text-secondary font-semibold text-xs flex-shrink-0">
                                                {workspace.icon || getInitials(workspace.name)}
                                            </div>
                                            <span className="flex-1 text-sm font-medium truncate text-left">
                                                {workspace.name}
                                            </span>
                                            {isSelected && (
                                                <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-outline-variant/20 my-2" />

                        {/* Create New Workspace Button */}
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onCreateWorkspace?.();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-secondary hover:bg-secondary/10 transition-colors duration-150"
                        >
                            <div className="w-7 h-7 rounded-md bg-secondary/20 flex items-center justify-center flex-shrink-0">
                                <Plus className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-medium">{t('workspace.switcher.createNew')}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
