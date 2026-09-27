'use client';

import React, { useState } from 'react';
import { X, Loader2, Link2, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface Platform {
  key: string;
  label: string;
  icon: React.ReactNode;
}

interface DirectConnectModalProps {
  platform: Platform;
  workspaceId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const PLATFORM_HELP: Record<string, {
  tokenLabel: string;
  tokenPlaceholder: string;
  hint: string;
  docsUrl: string;
}> = {
  google_calendar: {
    tokenLabel: 'Access Token',
    tokenPlaceholder: 'ya29.xxx...',
    hint: 'Get your token from Google OAuth Playground or use a service account JSON access token.',
    docsUrl: 'https://developers.google.com/oauthplayground',
  },
  calcom: {
    tokenLabel: 'API Key',
    tokenPlaceholder: 'cal_live_xxxxxxxxxxxx',
    hint: 'Find your API key in Cal.com → Settings → Developer → API Keys.',
    docsUrl: 'https://app.cal.com/settings/developer/api-keys',
  },
  zoom: {
    tokenLabel: 'Access Token / JWT',
    tokenPlaceholder: 'eyJ...',
    hint: 'Generate a Server-to-Server OAuth token or JWT from your Zoom App Marketplace account.',
    docsUrl: 'https://marketplace.zoom.us/develop/apps',
  },
};

export default function DirectConnectModal({ platform, workspaceId, onSuccess, onClose }: DirectConnectModalProps) {
  const [accessToken, setAccessToken] = useState('');
  const [email, setEmail]             = useState('');
  const [showToken, setShowToken]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const help = PLATFORM_HELP[platform.key] || {
    tokenLabel: 'Access Token',
    tokenPlaceholder: 'Enter your token...',
    hint: 'Paste your access token or API key.',
    docsUrl: '#',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken.trim() || !email.trim()) {
      setError('All fields are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/scheduling/integrations/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          platform: platform.key,
          accessToken: accessToken.trim(),
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connection failed.');
      } else {
        onSuccess();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-container-lowest opacity-100 rounded-2xl border border-outline-variant/30 shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-lg">
              {platform.icon}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-on-surface">Connect {platform.label}</h2>
              <p className="text-xs text-on-surface-variant">Enter your credentials directly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
              Account Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 bg-surface-container-high border border-outline-variant/30 rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-secondary transition-colors"
              required
            />
          </div>

          {/* Token */}
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
              {help.tokenLabel}
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                placeholder={help.tokenPlaceholder}
                className="w-full px-3 py-2.5 pr-10 bg-surface-container-high border border-outline-variant/30 rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-secondary transition-colors font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowToken(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Hint */}
          <div className="flex items-start gap-2 p-3 bg-surface-container-high rounded-xl">
            <p className="text-xs text-on-surface-variant flex-1">{help.hint}</p>
            <a
              href={help.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-secondary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-xl">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-on-surface-variant hover:text-on-surface bg-surface-container-high rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-secondary text-on-secondary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
                : <><Link2 className="w-4 h-4" /> Connect</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
