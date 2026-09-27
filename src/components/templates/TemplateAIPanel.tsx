'use client';

import React, { useState, useRef } from 'react';
import { Wand2, Loader2, RotateCcw, CheckCircle, X, AlertCircle } from 'lucide-react';
import { UniversalTemplate, TemplateType } from '@/types';

const PLACEHOLDERS: Record<TemplateType, string> = {
  page:    'e.g. "A weekly team status report with sections for goals, blockers, and wins"',
  quote:   'e.g. "A web design project for a small business, including discovery, design, and development phases"',
  invoice: 'e.g. "A monthly retainer invoice for ongoing SEO consulting services"',
  kanban:  'e.g. "A two-week software sprint board for a mobile app feature release"',
};

const CONTEXT_LABELS: Record<TemplateType, string> = {
  page:    'Document purpose or audience (optional)',
  quote:   'Client name or industry (optional)',
  invoice: 'Client name or project name (optional)',
  kanban:  'Team size or tech stack (optional)',
};

interface TemplateAIPanelProps {
  type: TemplateType;
  baseTemplate?: UniversalTemplate | null;
  workspaceId: string;
  onGenerated: (content: any) => void;
  onClose: () => void;
}

export default function TemplateAIPanel({
  type,
  baseTemplate,
  workspaceId,
  onGenerated,
  onClose,
}: TemplateAIPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<any>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || streaming) return;
    setStreaming(true);
    setStreamText('');
    setError(null);
    setGenerated(null);
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/templates/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, prompt: prompt.trim(), workspaceId, context: context.trim() || undefined }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'AI generation failed');
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamText(accumulated);
      }

      // Parse final JSON
      const parsed = JSON.parse(accumulated);
      setGenerated(parsed);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setStreaming(false);
    }
  };

  const handleApply = () => {
    if (generated) onGenerated(generated);
  };

  const handleReset = () => {
    setGenerated(null);
    setStreamText('');
    setError(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-secondary" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-on-surface">Generate with AI</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-surface-container rounded-lg transition-colors">
          <X className="h-4 w-4 text-on-surface-variant" />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {baseTemplate && (
          <div className="text-xs text-on-surface-variant bg-surface-container rounded-lg px-3 py-2">
            Based on: <span className="font-medium text-on-surface">{baseTemplate.name}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-on-surface mb-1.5">
            Describe what you want <span className="text-error">*</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={PLACEHOLDERS[type]}
            rows={3}
            disabled={streaming}
            className="w-full text-sm px-3 py-2.5 bg-surface border border-outline-variant rounded-lg text-on-surface placeholder-on-surface-variant resize-none focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-on-surface mb-1.5">
            {CONTEXT_LABELS[type]}
          </label>
          <input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            disabled={streaming}
            className="w-full text-sm px-3 py-2.5 bg-surface border border-outline-variant rounded-lg text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-50 transition-colors"
          />
        </div>

        {/* Streaming output */}
        {(streaming || streamText) && !generated && (
          <div>
            <p className="text-xs font-medium text-on-surface-variant mb-1.5 flex items-center gap-1.5">
              {streaming && <Loader2 className="h-3 w-3 animate-spin" />}
              {streaming ? 'Generating…' : 'Generated content'}
            </p>
            <pre className="text-[10px] text-on-surface-variant bg-surface-container rounded-lg p-3 overflow-auto max-h-48 font-mono leading-relaxed whitespace-pre-wrap">
              {streamText || '…'}
            </pre>
          </div>
        )}

        {/* Generated preview summary */}
        {generated && (
          <div className="bg-surface-container rounded-lg p-3 border border-secondary/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-success" strokeWidth={1.5} />
              <span className="text-xs font-semibold text-on-surface">Content ready</span>
            </div>
            <GeneratedSummary type={type} content={generated} />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-error bg-error/10 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-outline-variant space-y-2">
        {generated ? (
          <>
            <button
              onClick={handleApply}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors text-sm font-medium"
            >
              <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
              Apply this Template
            </button>
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-outline-variant text-on-surface rounded-lg hover:bg-surface-container transition-colors text-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
              Regenerate
            </button>
          </>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || streaming}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {streaming ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Wand2 className="h-4 w-4" strokeWidth={1.5} /> Generate</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Quick summary of generated content ───────────────────────────────────────

function GeneratedSummary({ type, content }: { type: TemplateType; content: any }) {
  if (type === 'page') {
    return (
      <div className="text-xs text-on-surface-variant space-y-0.5">
        <p><span className="font-medium text-on-surface">{content.icon} {content.title}</span></p>
        <p>{content.blocks?.length || 0} blocks</p>
      </div>
    );
  }
  if (type === 'quote' || type === 'invoice') {
    const total = (content.items || []).reduce(
      (s: number, i: any) => s + (i.quantity || 1) * (i.unitPrice || 0), 0
    );
    return (
      <div className="text-xs text-on-surface-variant space-y-0.5">
        <p>{content.items?.length || 0} line items</p>
        <p>Estimated total: <span className="font-medium text-on-surface">${total.toLocaleString()}</span></p>
      </div>
    );
  }
  if (type === 'kanban') {
    return (
      <div className="text-xs text-on-surface-variant space-y-0.5">
        <p><span className="font-medium text-on-surface">{content.projectName}</span></p>
        <p>{content.cards?.length || 0} cards across 3 columns</p>
      </div>
    );
  }
  return null;
}
