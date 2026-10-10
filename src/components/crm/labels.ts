import type { MessageKey } from '@/i18n/I18nProvider';
import { DEFAULT_PIPELINE_KEYS, DEFAULT_STAGE_KEYS } from '@/lib/crm/default-names';

type T = (key: MessageKey, values?: Record<string, string | number>) => string;

const STATUSES = new Set(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']);

/** A built-in pipeline name in the reader's language; a renamed one as typed. */
export function pipelineLabel(name: string, t: T): string {
    const key = DEFAULT_PIPELINE_KEYS[name];
    return key ? t(`crmDefaults.pipelines.${key}` as MessageKey) : name;
}

/** A built-in stage name in the reader's language; a custom one as typed. */
export function stageLabel(stage: string | null | undefined, t: T): string {
    if (!stage) return '';
    const key = DEFAULT_STAGE_KEYS[stage];
    return key ? t(`crmDefaults.stages.${key}` as MessageKey) : stage;
}

/** A lead status (stored lowercase in English) in the reader's language. */
export function statusLabel(status: string | null | undefined, t: T): string {
    if (!status) return '';
    return STATUSES.has(status) ? t(`crm.leadModal.status.${status}` as MessageKey) : status;
}

/** A lead source picked from the list (stored as a code like `walk_in`); a typed one as typed. */
export function sourceLabel(source: string | null | undefined, t: T): string {
    if (!source) return '';
    const key = `developerCrm.sources.${source}` as MessageKey;
    const text = t(key);
    return text === key ? source : text;
}
