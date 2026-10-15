'use client';

import React from 'react';
import type { MessageKey } from '@/i18n/I18nProvider';

/**
 * Display for the states a unit and a call for funds can be in. The chips always
 * carry the word, so the state never rests on colour alone.
 */

export const LOT_STATUS_LABEL: Record<string, MessageKey> = {
    available: 'developer.statusAvailable',
    optioned: 'developer.statusOptioned',
    reserved: 'developer.statusReserved',
    contract_signed: 'developer.statusContractSigned',
    deed_signed: 'developer.statusDeedSigned',
    delivered: 'developer.statusDelivered',
};

export const LOT_STATUS_TONE: Record<string, string> = {
    available: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    optioned: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    reserved: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    contract_signed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    deed_signed: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
    delivered: 'bg-surface-container-high text-on-surface-variant',
};

/** Solid fill for the building view's unit tiles. */
export const LOT_STATUS_TILE: Record<string, string> = {
    available: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300',
    optioned: 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300',
    reserved: 'bg-orange-500/15 border-orange-500/40 text-orange-800 dark:text-orange-300',
    contract_signed: 'bg-blue-500/15 border-blue-500/40 text-blue-800 dark:text-blue-300',
    deed_signed: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-800 dark:text-indigo-300',
    delivered: 'bg-surface-container-high border-outline-variant/40 text-on-surface-variant',
};

export const CALL_STATUS_LABEL: Record<string, MessageKey> = {
    draft: 'developer.callStatusDraft',
    issued: 'developer.callStatusIssued',
    sent_to_bank: 'developer.callStatusSentToBank',
    partially_paid: 'developer.callStatusPartiallyPaid',
    paid: 'developer.callStatusPaid',
    overdue: 'developer.callStatusOverdue',
};

export const CALL_STATUS_TONE: Record<string, string> = {
    draft: 'bg-surface-container-high text-on-surface-variant',
    issued: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    sent_to_bank: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
    partially_paid: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    paid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    overdue: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

export const TMA_STATUS_LABEL: Record<string, MessageKey> = {
    requested: 'developer.tmaStatusRequested',
    feasibility_approved: 'developer.tmaStatusFeasibilityApproved',
    quote_sent: 'developer.tmaStatusQuoteSent',
    accepted: 'developer.tmaStatusAccepted',
    rejected: 'developer.tmaStatusRejected',
    completed: 'developer.tmaStatusCompleted',
};

export const TMA_STATUS_TONE: Record<string, string> = {
    requested: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    feasibility_approved: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    quote_sent: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
    accepted: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    rejected: 'bg-red-500/10 text-red-700 dark:text-red-400',
    completed: 'bg-surface-container-high text-on-surface-variant',
};

export function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${tone}`}>
            {children}
        </span>
    );
}

/** A table shell shared by the developer list pages. */
export const tableClass = 'w-full text-sm';
export const thClass = 'text-start text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant px-3 py-2.5 whitespace-nowrap';
export const tdClass = 'px-3 py-2.5 align-middle';
