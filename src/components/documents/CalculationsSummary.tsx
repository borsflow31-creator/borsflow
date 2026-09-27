'use client';

import React from 'react';

export type DiscountType = 'none' | 'percentage' | 'fixed';

interface CalculationsSummaryProps {
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  amountPaid?: number;
  amountDue?: number;
  showPaymentStatus?: boolean;
  onDiscountTypeChange?: (type: DiscountType) => void;
  onDiscountValueChange?: (value: number) => void;
  onTaxRateChange?: (rate: number) => void;
  readOnly?: boolean;
}

export default function CalculationsSummary({
  subtotal,
  discountType,
  discountValue,
  discountAmount,
  taxRate,
  taxAmount,
  total,
  currency,
  amountPaid = 0,
  amountDue,
  showPaymentStatus = false,
  onDiscountTypeChange,
  onDiscountValueChange,
  onTaxRateChange,
  readOnly = false,
}: CalculationsSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const calculatedAmountDue = amountDue !== undefined ? amountDue : total - amountPaid;

  return (
    <div className="bg-surface rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-on-surface">Summary</h3>
      
      <div className="space-y-3">
        {/* Subtotal */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-on-surface-variant">Subtotal</span>
          <span className="text-sm font-medium text-on-surface">
            {formatCurrency(subtotal)}
          </span>
        </div>

        {/* Discount */}
        {!readOnly ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface-variant">Discount</span>
              <div className="flex items-center gap-2">
                <select
                  value={discountType}
                  onChange={(e) => onDiscountTypeChange?.(e.target.value as DiscountType)}
                  className="px-2 py-1 bg-surface-container-low rounded text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50"
                  aria-label="Discount type"
                >
                  <option value="none">None</option>
                  <option value="percentage">%</option>
                  <option value="fixed">{currency}</option>
                </select>
                {discountType !== 'none' && (
                  <input
                    type="number"
                    min="0"
                    step={discountType === 'percentage' ? '1' : '0.01'}
                    value={discountValue}
                    onChange={(e) => onDiscountValueChange?.(parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 bg-surface-container-low rounded text-sm text-on-surface text-right focus:outline-none focus:ring-2 focus:ring-secondary/50"
                    aria-label="Discount value"
                  />
                )}
              </div>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between pl-4">
                <span className="text-xs text-on-surface-variant">
                  {discountType === 'percentage' ? `(${discountValue}%)` : `(${currency}${discountValue})`}
                </span>
                <span className="text-sm font-medium text-error">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
            )}
          </div>
        ) : (
          discountAmount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface-variant">
                Discount ({discountType === 'percentage' ? `${discountValue}%` : `${currency}${discountValue}`})
              </span>
              <span className="text-sm font-medium text-error">
                -{formatCurrency(discountAmount)}
              </span>
            </div>
          )
        )}

        {/* Tax */}
        {!readOnly ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface-variant">Tax</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={taxRate}
                  onChange={(e) => onTaxRateChange?.(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-surface-container-low rounded text-sm text-on-surface text-right focus:outline-none focus:ring-2 focus:ring-secondary/50"
                  aria-label="Tax rate"
                />
                <span className="text-sm text-on-surface-variant">%</span>
              </div>
            </div>
            {taxAmount > 0 && (
              <div className="flex items-center justify-between pl-4">
                <span className="text-xs text-on-surface-variant">({taxRate}%)</span>
                <span className="text-sm font-medium text-on-surface">
                  {formatCurrency(taxAmount)}
                </span>
              </div>
            )}
          </div>
        ) : (
          taxAmount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface-variant">Tax ({taxRate}%)</span>
              <span className="text-sm font-medium text-on-surface">
                {formatCurrency(taxAmount)}
              </span>
            </div>
          )
        )}

        {/* Divider */}
        <div className="border-t border-outline-variant/20" />

        {/* Total */}
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-on-surface">Total</span>
          <span className="text-xl font-bold text-on-surface">
            {formatCurrency(total)}
          </span>
        </div>

        {/* Payment Status (for invoices) */}
        {showPaymentStatus && (amountPaid > 0 || calculatedAmountDue > 0) && (
          <>
            <div className="border-t border-outline-variant/20" />
            
            {/* Amount Paid */}
            {amountPaid > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Amount Paid</span>
                <span className="text-sm font-medium text-success">
                  {formatCurrency(amountPaid)}
                </span>
              </div>
            )}

            {/* Amount Due */}
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-on-surface">
                {calculatedAmountDue > 0 ? 'Amount Due' : 'Balance'}
              </span>
              <span
                className={`text-xl font-bold ${
                  calculatedAmountDue > 0 ? 'text-error' : 'text-success'
                }`}
              >
                {formatCurrency(Math.abs(calculatedAmountDue))}
              </span>
            </div>

            {/* Payment Progress Bar */}
            {total > 0 && (
              <div className="mt-2">
                <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success transition-all duration-300"
                    style={{
                      width: `${Math.min((amountPaid / total) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-on-surface-variant text-right">
                  {Math.round((amountPaid / total) * 100)}% paid
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
