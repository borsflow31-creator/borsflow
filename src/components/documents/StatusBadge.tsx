'use client';

import React from 'react';

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

interface StatusBadgeProps {
  status: QuoteStatus | InvoiceStatus;
  type: 'quote' | 'invoice';
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

const statusConfig: Record<QuoteStatus | InvoiceStatus, { color: string; bgColor: string; label: string }> = {
  // Quote statuses
  draft: { color: '#6b7280', bgColor: '#f3f4f6', label: 'Draft' },
  sent: { color: '#3b82f6', bgColor: '#dbeafe', label: 'Sent' },
  viewed: { color: '#6366f1', bgColor: '#e0e7ff', label: 'Viewed' },
  accepted: { color: '#10b981', bgColor: '#d1fae5', label: 'Accepted' },
  rejected: { color: '#ef4444', bgColor: '#fee2e2', label: 'Rejected' },
  expired: { color: '#f97316', bgColor: '#fed7aa', label: 'Expired' },
  // Invoice statuses
  partially_paid: { color: '#f59e0b', bgColor: '#fef3c7', label: 'Partially Paid' },
  paid: { color: '#10b981', bgColor: '#d1fae5', label: 'Paid' },
  overdue: { color: '#ef4444', bgColor: '#fee2e2', label: 'Overdue' },
  cancelled: { color: '#6b7280', bgColor: '#f3f4f6', label: 'Cancelled' },
};

const sizeStyles = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

const dotSizes = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export default function StatusBadge({ status, type, size = 'md', showDot = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  if (!config) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200 ${sizeStyles[size]}`}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
      }}
      title={`${type === 'quote' ? 'Quote' : 'Invoice'} Status: ${config.label}`}
    >
      {showDot && (
        <div
          className={`rounded-full ${dotSizes[size]}`}
          style={{ backgroundColor: config.color }}
        />
      )}
      <span>{config.label}</span>
    </div>
  );
}
