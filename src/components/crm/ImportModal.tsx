'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useI18n } from '@/i18n/I18nProvider';

interface Pipeline {
    id: string;
    name: string;
    stages: string[];
}

interface ImportModalProps {
    pipeline: Pipeline;
    onClose: () => void;
    onImportComplete: () => void;
}

type CRMField =
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'phone'
    | 'company'
    | 'position'
    | 'status'
    | 'stage'
    | 'value'
    | 'source'
    | 'notes'
    | 'tags'
    | '__skip__';

interface FieldDef {
    key: CRMField;
    label: string;
    required?: boolean;
}

function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        if (!line.trim()) continue;
        const cols: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
                cols.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }
        cols.push(cur);
        rows.push(cols);
    }
    return rows;
}

function autoMatch(header: string): CRMField {
    const h = header.toLowerCase().replace(/[^a-z]/g, '');
    if (/^(firstname|fname|first)$/.test(h)) return 'firstName';
    if (/^(lastname|lname|last|surname|familyname)$/.test(h)) return 'lastName';
    if (/^(fullname|name)$/.test(h)) return '__skip__';
    if (/^(email|mail|emailaddress)$/.test(h)) return 'email';
    if (/^(phone|tel|telephone|mobile|cell|phonenumber)$/.test(h)) return 'phone';
    if (/^(company|organization|org|business|employer)$/.test(h)) return 'company';
    if (/^(position|title|jobtitle|role|designation)$/.test(h)) return 'position';
    if (/^(status|leadstatus)$/.test(h)) return 'status';
    if (/^(stage|pipelinestage)$/.test(h)) return 'stage';
    if (/^(value|dealvalue|amount|revenue|price)$/.test(h)) return 'value';
    if (/^(source|leadsource|origin)$/.test(h)) return 'source';
    if (/^(notes|note|comment|comments|description|remarks)$/.test(h)) return 'notes';
    if (/^(tags|tag|labels|label|category|categories)$/.test(h)) return 'tags';
    return '__skip__';
}

type Step = 'upload' | 'map' | 'preview' | 'done';

export default function ImportModal({ pipeline, onClose, onImportComplete }: ImportModalProps) {
    const { t } = useI18n();
    const CRM_FIELDS: FieldDef[] = useMemo(() => [
        { key: 'firstName', label: t('crm.importModal.fields.firstName'), required: true },
        { key: 'lastName', label: t('crm.importModal.fields.lastName'), required: true },
        { key: 'email', label: t('crm.importModal.fields.email') },
        { key: 'phone', label: t('crm.importModal.fields.phone') },
        { key: 'company', label: t('crm.importModal.fields.company') },
        { key: 'position', label: t('crm.importModal.fields.position') },
        { key: 'status', label: t('crm.importModal.fields.status') },
        { key: 'stage', label: t('crm.importModal.fields.stage') },
        { key: 'value', label: t('crm.importModal.fields.value') },
        { key: 'source', label: t('crm.importModal.fields.source') },
        { key: 'notes', label: t('crm.importModal.fields.notes') },
        { key: 'tags', label: t('crm.importModal.fields.tags') },
    ], [t]);
    const [step, setStep] = useState<Step>('upload');
    const [dragOver, setDragOver] = useState(false);
    const [fileName, setFileName] = useState('');
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<string[][]>([]);
    const [mapping, setMapping] = useState<CRMField[]>([]);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ created: number; skipped: number; stageCoerced?: number; errors: string[] } | null>(null);
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const processFile = (file: File) => {
        setError('');
        if (!file.name.match(/\.(csv|xlsx|xls|tsv|txt)$/i)) {
            setError(t('crm.importModal.invalidFileType'));
            return;
        }

        // For Excel files, show a friendly notice
        if (file.name.match(/\.(xlsx|xls)$/i)) {
            setError(t('crm.importModal.excelNotice'));
            return;
        }

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const parsed = parseCSV(text);
            if (parsed.length < 2) {
                setError(t('crm.importModal.minRowsError'));
                return;
            }
            const hdrs = parsed[0];
            const dataRows = parsed.slice(1).filter(r => r.some(c => c.trim()));
            if (dataRows.length === 0) {
                setError(t('crm.importModal.noDataRowsError'));
                return;
            }
            setHeaders(hdrs);
            setRows(dataRows);
            setMapping(hdrs.map(h => autoMatch(h)));
            setStep('map');
        };
        reader.onerror = () => setError(t('crm.importModal.readFileError'));
        reader.readAsText(file, 'UTF-8');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, []);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => setDragOver(false);

    const mappedLeads = rows.map(row => {
        const lead: Record<string, string> = {};
        headers.forEach((_, i) => {
            const field = mapping[i];
            if (field && field !== '__skip__') {
                lead[field] = row[i] ?? '';
            }
        });
        return lead;
    });

    const canImport = mapping.some(m => m === 'firstName') && mapping.some(m => m === 'lastName');

    const handleImport = async () => {
        setImporting(true);
        setError('');
        try {
            const res = await fetch('/api/leads/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pipelineId: pipeline.id, leads: mappedLeads }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || t('crm.importModal.importFailed'));
                return;
            }
            setResult(data);
            setStep('done');
        } catch {
            setError(t('crm.importModal.networkError'));
        } finally {
            setImporting(false);
        }
    };

    const handleClose = () => {
        if (result) onImportComplete();
        else onClose();
    };

    const previewRows = mappedLeads.slice(0, 5);
    const previewFields = CRM_FIELDS.filter(f => mapping.includes(f.key));

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-outline-variant">
                    <div>
                        <h2 className="title-lg text-on-surface">{t('crm.importModal.title')}</h2>
                        <p className="body-sm text-on-surface-variant mt-0.5">
                            {t('crm.importModal.pipelineLabel')} <span className="font-medium">{pipeline.name}</span>
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded transition-colors"
                        aria-label={t('common.close')}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Steps indicator */}
                <div className="flex items-center gap-2 px-6 pt-4">
                    {(['upload', 'map', 'preview', 'done'] as Step[]).map((s, i) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                                step === s
                                    ? 'bg-primary text-on-primary'
                                    : ['map', 'preview', 'done'].indexOf(s) <= ['map', 'preview', 'done'].indexOf(step)
                                        ? 'bg-primary/30 text-primary'
                                        : 'bg-surface-container-high text-on-surface-variant'
                            }`}>
                                {i + 1}
                            </div>
                            <span className={`text-xs capitalize hidden sm:inline ${step === s ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>
                                {s === 'upload' ? t('crm.importModal.stepUpload') : s === 'map' ? t('crm.importModal.stepMap') : s === 'preview' ? t('crm.importModal.stepPreview') : t('crm.importModal.stepDone')}
                            </span>
                            {i < 3 && <div className="w-6 h-px bg-outline-variant mx-1" />}
                        </div>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded text-error text-sm">
                            {error}
                        </div>
                    )}

                    {/* STEP: Upload */}
                    {step === 'upload' && (
                        <div className="space-y-4">
                            <div
                                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                                    dragOver
                                        ? 'border-primary bg-primary/5'
                                        : 'border-outline-variant hover:border-primary/50 hover:bg-surface-container'
                                }`}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onClick={() => fileRef.current?.click()}
                            >
                                <svg className="w-10 h-10 mx-auto text-on-surface-variant mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="body-md text-on-surface font-medium">{t('crm.importModal.dropZoneTitle')}</p>
                                <p className="body-sm text-on-surface-variant mt-1">{t('crm.importModal.dropZoneSubtitle')}</p>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".csv,.tsv,.txt,.xlsx,.xls"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            <div className="bg-surface-container rounded-lg p-4">
                                <p className="body-sm font-medium text-on-surface mb-2">{t('crm.importModal.expectedColumns')}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {CRM_FIELDS.map(f => (
                                        <span key={f.key} className={`px-2 py-0.5 rounded text-xs ${f.required ? 'bg-primary/20 text-primary font-medium' : 'bg-surface-container-high text-on-surface-variant'}`}>
                                            {f.label}{f.required ? ' *' : ''}
                                        </span>
                                    ))}
                                </div>
                                <p className="body-xs text-on-surface-variant mt-2">{t('crm.importModal.requiredNote')}</p>
                            </div>
                        </div>
                    )}

                    {/* STEP: Map columns */}
                    {step === 'map' && (
                        <div className="space-y-4">
                            <p className="body-sm text-on-surface-variant">
                                {t('crm.importModal.mapInstructions', { count: rows.length, fileName })}
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-outline-variant">
                                            <th className="text-left py-2 pr-4 text-on-surface-variant font-medium">{t('crm.importModal.colFileColumn')}</th>
                                            <th className="text-left py-2 pr-4 text-on-surface-variant font-medium">{t('crm.importModal.colSampleValue')}</th>
                                            <th className="text-left py-2 text-on-surface-variant font-medium">{t('crm.importModal.colMapsTo')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {headers.map((header, i) => (
                                            <tr key={i} className="border-b border-outline-variant/50">
                                                <td className="py-2 pr-4 text-on-surface font-medium">{header}</td>
                                                <td className="py-2 pr-4 text-on-surface-variant truncate max-w-[140px]">
                                                    {rows[0]?.[i] || <span className="italic text-on-surface-variant/50">{t('crm.importModal.emptyValue')}</span>}
                                                </td>
                                                <td className="py-2">
                                                    <select
                                                        value={mapping[i]}
                                                        onChange={e => {
                                                            const newMapping = [...mapping];
                                                            newMapping[i] = e.target.value as CRMField;
                                                            setMapping(newMapping);
                                                        }}
                                                        className="w-full px-2 py-1 bg-surface-container-high rounded text-on-surface text-sm focus:outline-none focus:bg-surface-container-highest"
                                                    >
                                                        <option value="__skip__">{t('crm.importModal.skipOption')}</option>
                                                        {CRM_FIELDS.map(f => (
                                                            <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {!canImport && (
                                <p className="text-error text-sm">{t('crm.importModal.mapRequiredError')}</p>
                            )}
                        </div>
                    )}

                    {/* STEP: Preview */}
                    {step === 'preview' && (
                        <div className="space-y-4">
                            <p className="body-sm text-on-surface-variant">
                                {t('crm.importModal.previewInstructions', { shown: previewRows.length, total: rows.length })}
                            </p>
                            <div className="overflow-x-auto rounded-lg border border-outline-variant">
                                <table className="w-full text-sm">
                                    <thead className="bg-surface-container">
                                        <tr>
                                            {previewFields.map(f => (
                                                <th key={f.key} className="text-left px-3 py-2 text-on-surface-variant font-medium whitespace-nowrap">
                                                    {f.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewRows.map((row, i) => (
                                            <tr key={i} className="border-t border-outline-variant/50 hover:bg-surface-container/50">
                                                {previewFields.map(f => (
                                                    <td key={f.key} className="px-3 py-2 text-on-surface truncate max-w-[150px]">
                                                        {(row as Record<string, string>)[f.key] || <span className="text-on-surface-variant/40 italic">—</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {rows.length > 5 && (
                                <p className="body-xs text-on-surface-variant text-center">
                                    {t('crm.importModal.moreRows', { count: rows.length - 5 })}
                                </p>
                            )}
                        </div>
                    )}

                    {/* STEP: Done */}
                    {step === 'done' && result && (
                        <div className="text-center py-8 space-y-4">
                            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                                <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <p className="title-md text-on-surface">{t('crm.importModal.importComplete')}</p>
                                <p className="body-sm text-on-surface-variant mt-1">
                                    <span className="text-primary font-semibold">{t('crm.importModal.resultCreated', { count: result.created })}</span>
                                    {result.skipped > 0 && <span className="text-on-surface-variant">{t('crm.importModal.resultSkipped', { count: result.skipped })}</span>}.
                                </p>
                            </div>
                            {!!result.stageCoerced && (
                                <p className="body-sm text-on-surface-variant">
                                    {t('crm.importModal.stageCoercedNotice', { count: result.stageCoerced, pipelineName: pipeline.name, firstStage: pipeline.stages[0] })}
                                </p>
                            )}
                            {result.errors.length > 0 && (
                                <div className="text-left bg-surface-container rounded-lg p-3 max-h-32 overflow-y-auto">
                                    <p className="text-xs font-medium text-on-surface-variant mb-1">{t('crm.importModal.errorsHeading')}</p>
                                    {result.errors.map((e, i) => (
                                        <p key={i} className="text-xs text-error">{e}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-outline-variant">
                    <div>
                        {step !== 'upload' && step !== 'done' && (
                            <button
                                onClick={() => setStep(step === 'map' ? 'upload' : 'map')}
                                className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high rounded transition-colors"
                            >
                                {t('common.back')}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high rounded transition-colors"
                        >
                            {step === 'done' ? t('common.close') : t('common.cancel')}
                        </button>
                        {step === 'map' && (
                            <button
                                onClick={() => setStep('preview')}
                                disabled={!canImport}
                                className="px-4 py-2 text-sm bg-primary text-on-primary rounded hover:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {t('crm.importModal.previewButton')}
                            </button>
                        )}
                        {step === 'preview' && (
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="px-4 py-2 text-sm bg-primary text-on-primary rounded hover:bg-primary-container transition-colors disabled:opacity-60"
                            >
                                {importing ? t('crm.importModal.importingButton') : t('crm.importModal.importButton', { count: rows.length })}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
