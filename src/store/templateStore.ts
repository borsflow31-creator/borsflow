import { create } from 'zustand'
import { UniversalTemplate, TemplateCategory, TemplateType } from '@/types'

interface TemplateState {
  templates: UniversalTemplate[]
  categories: TemplateCategory[]
  selectedTemplate: UniversalTemplate | null
  typeFilter: TemplateType | 'all'
  categoryFilter: string | null
  searchQuery: string
  isPreviewOpen: boolean
  isAIPanelOpen: boolean
  isLoading: boolean

  // Setters
  setTemplates: (templates: UniversalTemplate[]) => void
  setCategories: (categories: TemplateCategory[]) => void
  setSelectedTemplate: (template: UniversalTemplate | null) => void
  setTypeFilter: (filter: TemplateType | 'all') => void
  setCategoryFilter: (categoryId: string | null) => void
  setSearchQuery: (query: string) => void
  setIsLoading: (loading: boolean) => void
  openPreview: (template: UniversalTemplate) => void
  closePreview: () => void
  openAIPanel: () => void
  closeAIPanel: () => void
  incrementUsage: (templateId: string) => void

  // Computed helpers
  getFilteredTemplates: () => UniversalTemplate[]
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  categories: [],
  selectedTemplate: null,
  typeFilter: 'all',
  categoryFilter: null,
  searchQuery: '',
  isPreviewOpen: false,
  isAIPanelOpen: false,
  isLoading: false,

  setTemplates: (templates) => set({ templates }),
  setCategories: (categories) => set({ categories }),
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  setTypeFilter: (filter) => set({ typeFilter: filter, categoryFilter: null }),
  setCategoryFilter: (categoryId) => set({ categoryFilter: categoryId }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsLoading: (loading) => set({ isLoading: loading }),

  openPreview: (template) => set({ selectedTemplate: template, isPreviewOpen: true, isAIPanelOpen: false }),
  closePreview: () => set({ isPreviewOpen: false, selectedTemplate: null }),
  openAIPanel: () => set({ isAIPanelOpen: true }),
  closeAIPanel: () => set({ isAIPanelOpen: false }),

  incrementUsage: (templateId) =>
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === templateId ? { ...t, usageCount: t.usageCount + 1 } : t
      ),
    })),

  getFilteredTemplates: () => {
    const { templates, typeFilter, categoryFilter, searchQuery } = get()
    return templates.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (categoryFilter && t.categoryId !== categoryFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = t.name.toLowerCase().includes(q)
        const matchesDesc = t.description?.toLowerCase().includes(q) ?? false
        if (!matchesName && !matchesDesc) return false
      }
      return true
    })
  },
}))
