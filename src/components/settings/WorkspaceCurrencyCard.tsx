'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Coins } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cachedJson } from '@/lib/client-cache';
import { DEFAULT_CURRENCY } from '@/lib/currencies';
import CurrencySelect from '@/components/workspace/CurrencySelect';

interface WorkspaceResponse {
  workspace?: {
    currency?: string;
    ownerId?: string;
    members?: { userId: string; role: string }[];
  };
}

/**
 * The currency this workspace prices everything in.
 *
 * It was only reachable from the Products page, which is not where anyone looks
 * for a setting that governs quotes, invoices, commissions, the dashboard's
 * revenue and every price in the developer module. The control itself is the
 * same one, so there is one way to change it and one place it is stored.
 *
 * Owners and admins can change it; everyone else sees what it is.
 */
export function WorkspaceCurrencyCard({ workspaceId }: { workspaceId: string | null }) {
  const { t } = useI18n();
  const { data: session } = useSession();
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [canChange, setCanChange] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!workspaceId || !session?.user?.id) return;
    let cancelled = false;
    cachedJson<WorkspaceResponse>(`/api/workspaces/${workspaceId}`)
      .then((data) => {
        const workspace = data.workspace;
        if (cancelled || !workspace) return;
        if (workspace.currency) setCurrency(workspace.currency);
        // The same rule the API enforces: the owner, or a member who is an admin.
        const role = workspace.members?.find((m) => m.userId === session.user.id)?.role;
        setCanChange(workspace.ownerId === session.user.id || role === 'admin');
      })
      .catch(() => { /* the card still shows the default */ });
    return () => { cancelled = true; };
  }, [workspaceId, session?.user?.id]);

  if (!workspaceId) return null;

  return (
    <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant mb-3">
        {t('settingsWorkspace.heading')}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
            <Coins className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-on-surface">{t('settingsWorkspace.currencyTitle')}</h2>
            <p className="text-sm text-on-surface-variant">{t('settingsWorkspace.currencyBody')}</p>
            {/* Said plainly, because it is the question people ask afterwards. */}
            <p className="mt-2 text-xs text-on-surface-variant">{t('settingsWorkspace.currencyNoConversion')}</p>
          </div>
        </div>

        <CurrencySelect
          workspaceId={workspaceId}
          currency={currency}
          canChange={canChange}
          onChanged={(code) => {
            setCurrency(code);
            setNotice({ ok: true, text: t('workspaceCurrency.changed', { currency: code }) });
          }}
          onError={(message) => setNotice({ ok: false, text: message })}
        />
      </div>

      {notice && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${notice.ok
            ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
            : 'bg-error/10 text-error'}`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
