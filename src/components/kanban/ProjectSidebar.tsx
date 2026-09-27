'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, ChevronRight, FolderOpen, Folder, LayoutTemplate } from 'lucide-react';

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

interface ProjectSidebarProps {
    workspaceId: string;
    projects: KanbanProject[];
    selectedProjectId: string | null;
    onProjectSelect: (projectId: string | null) => void;
    onProjectCreate: () => void;
    onTemplateCreate?: () => void;
    onProjectEdit: (project: KanbanProject) => void;
    onProjectDelete: (projectId: string) => void;
    loading?: boolean;
}

export default function ProjectSidebar({
    workspaceId,
    projects,
    selectedProjectId,
    onProjectSelect,
    onProjectCreate,
    onTemplateCreate,
    onProjectEdit,
    onProjectDelete,
    loading = false,
}: ProjectSidebarProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expanded, setExpanded] = useState(true);
    const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);

    const filteredProjects = projects.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalCards = projects.reduce((sum, project) => sum + (project._count?.cards || 0), 0);

    return (
        <div className={`
            flex flex-col bg-surface-container-low border-r border-outline-variant/30
            transition-all duration-300 ease-in-out
            ${expanded ? 'w-72' : 'w-16'}
        `}>
            {/* Header */}
            <div className="p-4 border-b border-outline-variant/30">
                <div className="flex items-center justify-between mb-4">
                    {expanded && (
                        <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                            <FolderOpen className="w-5 h-5 text-primary" />
                            Projects
                        </h2>
                    )}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
                        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        <ChevronRight className={`w-5 h-5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                </div>

                {expanded && (
                    <div className="flex flex-col gap-1.5">
                        <button
                            onClick={onProjectCreate}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary rounded-lg text-sm font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Project</span>
                        </button>
                        {onTemplateCreate && (
                            <button
                                onClick={onTemplateCreate}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-lg text-sm font-medium hover:bg-surface-container transition-colors disabled:opacity-50"
                            >
                                <LayoutTemplate className="w-4 h-4" />
                                <span>From Template</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Search */}
            {expanded && (
                <div className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                        />
                    </div>
                </div>
            )}

            {/* Project List */}
            <div className="flex-1 overflow-y-auto px-2">
                {/* All Cards Option */}
                <div
                    onClick={() => onProjectSelect(null)}
                    className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 mb-1
                        ${selectedProjectId === null
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'hover:bg-surface-container-high text-on-surface'
                        }
                    `}
                >
                    <Folder className="w-5 h-5 flex-shrink-0" />
                    {expanded && (
                        <>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">All Cards</p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded-full bg-surface-container-high">
                                {totalCards}
                            </span>
                        </>
                    )}
                </div>

                {/* Projects */}
                {filteredProjects.map((project) => (
                    <div
                        key={project.id}
                        onMouseEnter={() => setHoveredProjectId(project.id)}
                        onMouseLeave={() => setHoveredProjectId(null)}
                        className="group relative"
                    >
                        <div
                            onClick={() => onProjectSelect(project.id)}
                            className={`
                                flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 mb-1
                                ${selectedProjectId === project.id
                                    ? 'bg-secondary-container text-on-secondary-container'
                                    : 'hover:bg-surface-container-high text-on-surface'
                                }
                            `}
                        >
                            {/* Color Indicator */}
                            <div
                                className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-surface"
                                style={{ backgroundColor: project.color || '#6366f1' }}
                            />

                            {expanded && (
                                <>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{project.name}</p>
                                        {project.description && (
                                            <p className="text-xs text-on-surface-variant truncate">
                                                {project.description}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-full bg-surface-container-high">
                                        {project._count?.cards || 0}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Hover Actions */}
                        {expanded && hoveredProjectId === project.id && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-surface-container-high rounded-lg shadow-lg px-1 py-0.5">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onProjectEdit(project);
                                    }}
                                    className="p-1.5 rounded-md hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
                                    aria-label="Edit project"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onProjectDelete(project.id);
                                    }}
                                    className="p-1.5 rounded-md hover:bg-error-container text-error hover:text-on-error-container transition-colors"
                                    aria-label="Delete project"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {filteredProjects.length === 0 && searchQuery && (
                    <div className="text-center py-8">
                        <p className="text-sm text-on-surface-variant">No projects found</p>
                    </div>
                )}

                {!loading && projects.length === 0 && !searchQuery && (
                    <div className="text-center py-8 px-4">
                        <Folder className="w-12 h-12 mx-auto mb-3 text-on-surface-variant/30" />
                        <p className="text-sm text-on-surface-variant mb-2">No projects yet</p>
                        <button
                            onClick={onProjectCreate}
                            className="text-sm text-primary hover:text-primary-container font-medium"
                        >
                            Create your first project
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="space-y-2 px-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                                <div className="w-5 h-5 rounded-full bg-surface-container-high animate-pulse" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-surface-container-high rounded animate-pulse" />
                                    <div className="h-3 bg-surface-container-high rounded w-2/3 animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            {expanded && (
                <div className="p-4 border-t border-outline-variant/30">
                    <div className="text-xs text-on-surface-variant text-center">
                        {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                    </div>
                </div>
            )}
        </div>
    );
}
