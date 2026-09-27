'use client'

/**
 * EmailBlockEditor
 *
 * Visual drag-and-drop email builder. Produces standard inline-styled HTML
 * saved to the existing `htmlContent` field — fully backward-compatible.
 *
 * Block types: header | text | image | button | divider | spacer | two-column
 *              social | video | quote
 *
 * Features: drag-and-drop reorder, duplicate, undo/redo (Ctrl+Z/Y),
 *           inline rich-text (bold/italic/underline), mobile/desktop preview.
 */

import { useState, useCallback, useId, useEffect, useRef, KeyboardEvent } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import {
  Type,
  Heading1,
  Image as ImageIcon,
  MousePointer2,
  Minus,
  Space,
  Columns2,
  GripVertical,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Code2,
  Copy,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Smartphone,
  Monitor,
  Share2,
  Video,
  Quote,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockType =
  | 'header' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'two-column'
  | 'social' | 'video' | 'quote'

export interface SocialLink {
  platform: 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'youtube'
  url: string
}

export interface EmailBlock {
  id: string
  type: BlockType
  // header
  headingText?: string
  headingLevel?: 'h1' | 'h2' | 'h3'
  headingAlign?: 'left' | 'center' | 'right'
  headingColor?: string
  // text
  bodyText?: string
  bodyAlign?: 'left' | 'center' | 'right'
  bodyColor?: string
  fontSize?: number
  // image
  imageUrl?: string
  imageAlt?: string
  imageWidth?: string
  // button
  buttonText?: string
  buttonUrl?: string
  buttonColor?: string
  buttonTextColor?: string
  buttonAlign?: 'left' | 'center' | 'right'
  // divider
  dividerColor?: string
  // spacer
  spacerHeight?: number
  // two-column
  colLeftText?: string
  colRightText?: string
  // social
  socialLinks?: SocialLink[]
  // video
  videoThumbnailUrl?: string
  videoUrl?: string
  videoCaption?: string
  videoPlayColor?: string
  // quote
  quoteText?: string
  quoteAuthor?: string
  quoteAuthorTitle?: string
  quoteAvatarUrl?: string
  quoteAccentColor?: string
  // shared
  backgroundColor?: string
  paddingV?: number
  paddingH?: number
}

interface PaletteItem {
  type: BlockType
  label: string
  icon: React.ElementType
  description: string
}

const PALETTE: PaletteItem[] = [
  { type: 'header',     label: 'Heading',     icon: Heading1,      description: 'H1 / H2 / H3 title' },
  { type: 'text',       label: 'Text',        icon: Type,          description: 'Body paragraph' },
  { type: 'image',      label: 'Image',       icon: ImageIcon,     description: 'Full-width image' },
  { type: 'button',     label: 'Button',      icon: MousePointer2, description: 'Call-to-action button' },
  { type: 'two-column', label: 'Two columns', icon: Columns2,      description: 'Side-by-side text' },
  { type: 'social',     label: 'Social',      icon: Share2,        description: 'Social media links' },
  { type: 'video',      label: 'Video',       icon: Video,         description: 'Video thumbnail' },
  { type: 'quote',      label: 'Quote',       icon: Quote,         description: 'Testimonial / blockquote' },
  { type: 'divider',    label: 'Divider',     icon: Minus,         description: 'Horizontal rule' },
  { type: 'spacer',     label: 'Spacer',      icon: Space,         description: 'Empty vertical gap' },
]

function makeBlock(type: BlockType, uid: string): EmailBlock {
  const base: EmailBlock = { id: uid, type, paddingV: 16, paddingH: 28, backgroundColor: '#ffffff' }
  switch (type) {
    case 'header':     return { ...base, headingText: 'Your headline here', headingLevel: 'h1', headingAlign: 'center', headingColor: '#111827' }
    case 'text':       return { ...base, bodyText: 'Write your message here. Keep it concise and compelling.', bodyAlign: 'left', bodyColor: '#4b5563', fontSize: 15 }
    case 'image':      return { ...base, imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=640&q=80', imageAlt: 'Email image', imageWidth: '100%' }
    case 'button':     return { ...base, buttonText: 'Get started', buttonUrl: '{{cta_url}}', buttonColor: '#4f46e5', buttonTextColor: '#ffffff', buttonAlign: 'center' }
    case 'divider':    return { ...base, dividerColor: '#e5e7eb', paddingV: 8 }
    case 'spacer':     return { ...base, spacerHeight: 32, paddingV: 0, paddingH: 0 }
    case 'two-column': return { ...base, colLeftText: 'Left column content.', colRightText: 'Right column content.' }
    case 'social':     return { ...base, paddingV: 20, socialLinks: [
      { platform: 'twitter', url: '{{twitter_url}}' },
      { platform: 'linkedin', url: '{{linkedin_url}}' },
      { platform: 'instagram', url: '{{instagram_url}}' },
    ]}
    case 'video':      return { ...base, videoThumbnailUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&q=80', videoUrl: '{{video_url}}', videoCaption: 'Watch our latest video', videoPlayColor: '#4f46e5' }
    case 'quote':      return { ...base, quoteText: 'This product changed the way we work. Highly recommended!', quoteAuthor: 'Jane Smith', quoteAuthorTitle: 'CEO, Acme Inc.', quoteAvatarUrl: '', quoteAccentColor: '#4f46e5', backgroundColor: '#f8f9ff' }
    default:           return base
  }
}

// ─── Social platform config ───────────────────────────────────────────────────

const SOCIAL_CONFIG: Record<string, { label: string; color: string; svg: string }> = {
  twitter: {
    label: 'X / Twitter',
    color: '#000000',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  },
  linkedin: {
    label: 'LinkedIn',
    color: '#0A66C2',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
  },
  instagram: {
    label: 'Instagram',
    color: '#E1306C',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
  },
  facebook: {
    label: 'Facebook',
    color: '#1877F2',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  },
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  },
}

// ─── HTML serialiser ──────────────────────────────────────────────────────────

function blockToHtml(b: EmailBlock): string {
  const pv = b.paddingV ?? 16
  const ph = b.paddingH ?? 28
  const bg = b.backgroundColor || '#ffffff'
  const cellStyle = `padding:${pv}px ${ph}px;background:${bg};`

  switch (b.type) {
    case 'header': {
      const tag = b.headingLevel || 'h1'
      const sizes: Record<string, string> = { h1: '36px', h2: '28px', h3: '22px' }
      return `<tr><td style="${cellStyle}text-align:${b.headingAlign || 'center'};"><${tag} style="margin:0;font-size:${sizes[tag]};line-height:1.15;color:${b.headingColor || '#111827'};font-family:Georgia,'Times New Roman',serif;">${b.headingText || ''}</${tag}></td></tr>`
    }
    case 'text':
      return `<tr><td style="${cellStyle}"><p style="margin:0;font-size:${b.fontSize || 15}px;line-height:1.75;color:${b.bodyColor || '#4b5563'};text-align:${b.bodyAlign || 'left'};">${(b.bodyText || '').replace(/\n/g, '<br/>')}</p></td></tr>`
    case 'image':
      return `<tr><td style="${cellStyle}text-align:center;"><img src="${b.imageUrl || ''}" alt="${b.imageAlt || ''}" width="${b.imageWidth || '100%'}" style="display:block;max-width:100%;height:auto;border-radius:8px;" /></td></tr>`
    case 'button': {
      const alignMap: Record<string, string> = { left: 'left', center: 'center', right: 'right' }
      return `<tr><td style="${cellStyle}text-align:${alignMap[b.buttonAlign || 'center']};"><a href="${b.buttonUrl || '#'}" style="display:inline-block;padding:13px 28px;border-radius:999px;background:${b.buttonColor || '#4f46e5'};color:${b.buttonTextColor || '#ffffff'};text-decoration:none;font-weight:700;font-size:15px;">${b.buttonText || 'Click here'}</a></td></tr>`
    }
    case 'divider':
      return `<tr><td style="${cellStyle}"><hr style="border:none;border-top:1px solid ${b.dividerColor || '#e5e7eb'};margin:0;" /></td></tr>`
    case 'spacer':
      return `<tr><td style="height:${b.spacerHeight || 32}px;line-height:${b.spacerHeight || 32}px;font-size:1px;">&nbsp;</td></tr>`
    case 'two-column':
      return `<tr><td style="${cellStyle}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="48%" style="vertical-align:top;padding-right:12px;font-size:15px;line-height:1.7;color:#4b5563;">${(b.colLeftText || '').replace(/\n/g, '<br/>')}</td><td width="4%"></td><td width="48%" style="vertical-align:top;padding-left:12px;font-size:15px;line-height:1.7;color:#4b5563;">${(b.colRightText || '').replace(/\n/g, '<br/>')}</td></tr></table></td></tr>`
    case 'social': {
      const links = b.socialLinks || []
      const icons = links.map(l => {
        const cfg = SOCIAL_CONFIG[l.platform]
        if (!cfg) return ''
        return `<a href="${l.url}" style="display:inline-block;width:40px;height:40px;border-radius:50%;background:${cfg.color};text-align:center;line-height:40px;margin:0 6px;text-decoration:none;">${cfg.svg}</a>`
      }).join('')
      return `<tr><td style="${cellStyle}text-align:center;">${icons}</td></tr>`
    }
    case 'video': {
      const thumb = b.videoThumbnailUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&q=80'
      const playColor = b.videoPlayColor || '#4f46e5'
      const caption = b.videoCaption ? `<p style="margin:10px 0 0;font-size:13px;color:#6b7280;text-align:center;">${b.videoCaption}</p>` : ''
      return `<tr><td style="${cellStyle}text-align:center;"><a href="${b.videoUrl || '#'}" style="display:block;position:relative;text-decoration:none;"><img src="${thumb}" alt="Watch video" style="display:block;max-width:100%;border-radius:8px;width:100%;" /><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:56px;height:56px;border-radius:50%;background:${playColor};display:flex;align-items:center;justify-content:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div></a>${caption}</td></tr>`
    }
    case 'quote': {
      const accent = b.quoteAccentColor || '#4f46e5'
      const avatar = b.quoteAvatarUrl
        ? `<img src="${b.quoteAvatarUrl}" width="40" height="40" alt="${b.quoteAuthor || ''}" style="border-radius:50%;margin-right:12px;vertical-align:middle;display:inline-block;" />`
        : ''
      return `<tr><td style="${cellStyle}border-left:4px solid ${accent};"><p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#374151;font-style:italic;">"${b.quoteText || ''}"</p><div style="display:flex;align-items:center;">${avatar}<div><span style="font-size:13px;font-weight:700;color:#111827;">${b.quoteAuthor || ''}</span>${b.quoteAuthorTitle ? `<span style="font-size:12px;color:#6b7280;display:block;">${b.quoteAuthorTitle}</span>` : ''}</div></div></td></tr>`
    }
    default:
      return ''
  }
}

export function blocksToHtml(blocks: EmailBlock[]): string {
  if (!blocks.length) return ''
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">${blocks.map(blockToHtml).join('')}<tr><td style="padding:20px 28px;background:#f9fafb;text-align:center;font-size:12px;color:#9ca3af;">© {{company_name}} · <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Unsubscribe</a></td></tr></table></td></tr></table></body></html>`
}

// Attempt to parse blocks from existing HTML (best-effort for re-editing)
export function htmlToBlocks(html: string, uid: string): EmailBlock[] | null {
  if (!html || typeof document === 'undefined') return null
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    // Each block is a <tr> inside the inner content table (skip the footer row)
    const rows = Array.from(doc.querySelectorAll('table table tr'))
    if (!rows.length) return null

    const blocks: EmailBlock[] = []
    let i = 0

    for (const row of rows) {
      const td = row.querySelector('td')
      if (!td) continue
      const cellStyle = td.getAttribute('style') || ''

      // Extract shared padding / background from cell style
      const pvMatch = cellStyle.match(/padding:(\d+)px (\d+)px/)
      const paddingV = pvMatch ? parseInt(pvMatch[1]) : 16
      const paddingH = pvMatch ? parseInt(pvMatch[2]) : 28
      const bgMatch  = cellStyle.match(/background:([^;]+)/)
      const backgroundColor = bgMatch ? bgMatch[1].trim() : '#ffffff'
      const base = { id: `${uid}-parsed-${i++}`, paddingV, paddingH, backgroundColor }

      // --- social (contains anchor + svg without img) ---
      const socialAnchors = Array.from(td.querySelectorAll('a')).filter(a => a.querySelector('svg') && !a.querySelector('img'))
      if (socialAnchors.length > 0) {
        const links: SocialLink[] = []
        for (const anchor of socialAnchors) {
          const bg = (anchor.getAttribute('style') || '').match(/background:([^;]+)/)?.[1]?.trim() || ''
          const platform = Object.keys(SOCIAL_CONFIG).find(k => SOCIAL_CONFIG[k].color === bg) as SocialLink['platform'] | undefined
          if (platform) links.push({ platform, url: anchor.getAttribute('href') || '' })
        }
        if (links.length > 0) {
          blocks.push({ ...base, type: 'social', socialLinks: links })
          continue
        }
      }

      // --- heading ---
      const heading = td.querySelector('h1,h2,h3')
      if (heading) {
        const tag = heading.tagName.toLowerCase() as 'h1' | 'h2' | 'h3'
        const style = heading.getAttribute('style') || ''
        const colorMatch = style.match(/color:([^;]+)/)
        const alignMatch = cellStyle.match(/text-align:([^;]+)/)
        blocks.push({
          ...base,
          type: 'header',
          headingText: heading.textContent || '',
          headingLevel: tag,
          headingAlign: (alignMatch?.[1]?.trim() as any) || 'center',
          headingColor: colorMatch?.[1]?.trim() || '#111827',
        })
        continue
      }

      // --- quote (left border) ---
      if (cellStyle.includes('border-left:')) {
        const accentMatch = cellStyle.match(/border-left:[^;]*?([#][0-9a-fA-F]{3,6})/)
        const pEl = td.querySelector('p')
        const authorSpan = td.querySelector('span[style*="font-weight:700"]')
        const titleSpan = td.querySelector('span[style*="font-size:12px"]')
        const avatarImg = td.querySelector('img')
        blocks.push({
          ...base,
          type: 'quote',
          quoteText: (pEl?.textContent || '').replace(/^"|"$/g, ''),
          quoteAuthor: authorSpan?.textContent || '',
          quoteAuthorTitle: titleSpan?.textContent || '',
          quoteAvatarUrl: avatarImg?.getAttribute('src') || '',
          quoteAccentColor: accentMatch?.[1] || '#4f46e5',
        })
        continue
      }

      // --- video (anchor wrapping img) ---
      const videoAnchor = td.querySelector('a')
      if (videoAnchor && videoAnchor.querySelector('img')) {
        const img = videoAnchor.querySelector('img')
        const playDiv = videoAnchor.querySelector('div')
        const playBgMatch = (playDiv?.getAttribute('style') || '').match(/background:([^;]+)/)
        const captionEl = td.querySelector('p')
        blocks.push({
          ...base,
          type: 'video',
          videoThumbnailUrl: img?.getAttribute('src') || '',
          videoUrl: videoAnchor.getAttribute('href') || '',
          videoCaption: captionEl?.textContent || '',
          videoPlayColor: playBgMatch?.[1]?.trim() || '#4f46e5',
        })
        continue
      }

      // --- button (anchor inside td, no img) ---
      const anchor = td.querySelector('a')
      if (anchor && !anchor.querySelector('img')) {
        const aStyle = anchor.getAttribute('style') || ''
        const bgAMatch = aStyle.match(/background:([^;]+)/)
        const colorAMatch = aStyle.match(/(?:^|;)\s*color:([^;]+)/)
        const alignMatch = cellStyle.match(/text-align:([^;]+)/)
        blocks.push({
          ...base,
          type: 'button',
          buttonText: anchor.textContent || 'Click here',
          buttonUrl: anchor.getAttribute('href') || '#',
          buttonColor: bgAMatch?.[1]?.trim() || '#4f46e5',
          buttonTextColor: colorAMatch?.[1]?.trim() || '#ffffff',
          buttonAlign: (alignMatch?.[1]?.trim() as any) || 'center',
        })
        continue
      }

      // --- image ---
      const img = td.querySelector('img')
      if (img) {
        blocks.push({
          ...base,
          type: 'image',
          imageUrl: img.getAttribute('src') || '',
          imageAlt: img.getAttribute('alt') || '',
          imageWidth: img.getAttribute('width') || '100%',
        })
        continue
      }

      // --- divider ---
      const hr = td.querySelector('hr')
      if (hr) {
        const hrStyle = hr.getAttribute('style') || ''
        const colorMatch = hrStyle.match(/border-top:[^;]*?([#][0-9a-fA-F]{3,6}|rgb[^;]*)/)
        blocks.push({
          ...base,
          type: 'divider',
          dividerColor: colorMatch?.[1]?.trim() || '#e5e7eb',
        })
        continue
      }

      // --- spacer (height style on td, no visible child content) ---
      const heightMatch = cellStyle.match(/height:(\d+)px/)
      if (heightMatch && !td.textContent?.trim()) {
        blocks.push({
          ...base,
          type: 'spacer',
          spacerHeight: parseInt(heightMatch[1]),
          paddingV: 0,
          paddingH: 0,
        })
        continue
      }

      // --- two-column (nested table with two td children) ---
      const innerTable = td.querySelector('table')
      if (innerTable) {
        const cols = innerTable.querySelectorAll('tr > td')
        if (cols.length >= 2) {
          blocks.push({
            ...base,
            type: 'two-column',
            colLeftText: cols[0].textContent?.trim() || '',
            colRightText: cols[cols.length - 1].textContent?.trim() || '',
          })
          continue
        }
      }

      // --- paragraph / text ---
      const p = td.querySelector('p')
      if (p) {
        const pStyle = p.getAttribute('style') || ''
        const colorMatch = pStyle.match(/color:([^;]+)/)
        const alignMatch = pStyle.match(/text-align:([^;]+)/)
        const sizeMatch  = pStyle.match(/font-size:(\d+)px/)
        blocks.push({
          ...base,
          type: 'text',
          bodyText: p.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''),
          bodyColor: colorMatch?.[1]?.trim() || '#4b5563',
          bodyAlign: (alignMatch?.[1]?.trim() as any) || 'left',
          fontSize: sizeMatch ? parseInt(sizeMatch[1]) : 15,
        })
        continue
      }

      // fallback: treat as plain text block
      const text = td.textContent?.trim()
      if (text) {
        blocks.push({ ...base, type: 'text', bodyText: text, bodyColor: '#4b5563', bodyAlign: 'left', fontSize: 15 })
      }
    }

    return blocks.length ? blocks : null
  } catch {
    return null
  }
}

// ─── Block property editor ────────────────────────────────────────────────────

function BlockPropertyPanel({
  block,
  variables,
  onChange,
}: {
  block: EmailBlock
  variables: string[]
  onChange: (updated: Partial<EmailBlock>) => void
}) {
  const field = (label: string, el: React.ReactNode) => (
    <label className="flex flex-col gap-1 text-xs text-stone-600">
      <span className="font-medium text-stone-700">{label}</span>
      {el}
    </label>
  )
  const input = (key: keyof EmailBlock, type = 'text', placeholder = '') => (
    <input
      type={type}
      value={(block[key] as string | number) ?? ''}
      onChange={e => onChange({ [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
      placeholder={placeholder}
      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
    />
  )
  const select = (key: keyof EmailBlock, options: { value: string; label: string }[]) => (
    <select
      value={(block[key] as string) ?? ''}
      onChange={e => onChange({ [key]: e.target.value })}
      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
  const textarea = (key: keyof EmailBlock, rows = 4, placeholder = '') => (
    <textarea
      rows={rows}
      value={(block[key] as string) ?? ''}
      onChange={e => onChange({ [key]: e.target.value })}
      placeholder={placeholder}
      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
    />
  )
  const colorRow = (label: string, key: keyof EmailBlock) => (
    <label className="flex items-center gap-2 text-xs text-stone-600">
      <span className="font-medium text-stone-700 flex-1">{label}</span>
      <input
        type="color"
        value={(block[key] as string) || '#ffffff'}
        onChange={e => onChange({ [key]: e.target.value })}
        className="h-7 w-10 rounded border border-stone-200 cursor-pointer p-0.5"
      />
      <input
        type="text"
        value={(block[key] as string) || ''}
        onChange={e => onChange({ [key]: e.target.value })}
        className="w-24 rounded border border-stone-200 px-2 py-1 text-xs font-mono"
      />
    </label>
  )

  const alignOptions = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
  ]

  const varPills = variables.length > 0 && (
    <div className="space-y-1">
      <span className="text-xs font-medium text-stone-600">Insert variable:</span>
      <div className="flex flex-wrap gap-1">
        {variables.map(v => (
          <button
            key={v}
            type="button"
            onClick={() => {
              const key: keyof EmailBlock =
                block.type === 'header' ? 'headingText'
                : block.type === 'button' ? 'buttonText'
                : block.type === 'two-column' ? 'colLeftText'
                : block.type === 'quote' ? 'quoteText'
                : 'bodyText'
              const cur = (block[key] as string) || ''
              onChange({ [key]: cur + `{{${v}}}` })
            }}
            className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-mono text-indigo-700 hover:bg-indigo-100"
          >
            {`{{${v}}}`}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-3 text-xs">
      {/* shared: background + padding */}
      {colorRow('Background', 'backgroundColor')}
      <div className="grid grid-cols-2 gap-2">
        {field('Padding V (px)', input('paddingV', 'number'))}
        {field('Padding H (px)', input('paddingH', 'number'))}
      </div>
      <hr className="border-stone-100" />

      {block.type === 'header' && <>
        {field('Heading text', textarea('headingText', 2))}
        {field('Level', select('headingLevel', [{ value: 'h1', label: 'H1 – large' }, { value: 'h2', label: 'H2 – medium' }, { value: 'h3', label: 'H3 – small' }]))}
        {field('Align', select('headingAlign', alignOptions))}
        {colorRow('Text colour', 'headingColor')}
        {varPills}
      </>}

      {block.type === 'text' && <>
        {field('Body text', textarea('bodyText', 4, 'Your paragraph text…'))}
        {field('Align', select('bodyAlign', alignOptions))}
        {field('Font size (px)', input('fontSize', 'number'))}
        {colorRow('Text colour', 'bodyColor')}
        {varPills}
      </>}

      {block.type === 'image' && <>
        {field('Image URL', input('imageUrl', 'text', 'https://…'))}
        {field('Alt text', input('imageAlt', 'text', 'Describe the image'))}
        {field('Width', input('imageWidth', 'text', '100%'))}
      </>}

      {block.type === 'button' && <>
        {field('Button label', input('buttonText', 'text', 'Click here'))}
        {field('URL / variable', input('buttonUrl', 'text', '{{cta_url}}'))}
        {field('Align', select('buttonAlign', alignOptions))}
        {colorRow('Button colour', 'buttonColor')}
        {colorRow('Text colour', 'buttonTextColor')}
        {varPills}
      </>}

      {block.type === 'divider' && <>
        {colorRow('Line colour', 'dividerColor')}
      </>}

      {block.type === 'spacer' && <>
        {field('Height (px)', input('spacerHeight', 'number'))}
      </>}

      {block.type === 'two-column' && <>
        {field('Left column', textarea('colLeftText', 3))}
        {field('Right column', textarea('colRightText', 3))}
        {varPills}
      </>}

      {block.type === 'social' && (
        <div className="space-y-3">
          <p className="text-[10px] text-stone-400">Add URLs for the platforms you want to show. Leave empty to hide.</p>
          {(Object.keys(SOCIAL_CONFIG) as Array<keyof typeof SOCIAL_CONFIG>).map(platform => {
            const link = (block.socialLinks || []).find(l => l.platform === platform)
            return (
              <label key={platform} className="flex flex-col gap-1">
                <span className="font-medium text-stone-700 text-xs">{SOCIAL_CONFIG[platform].label}</span>
                <input
                  type="text"
                  value={link?.url || ''}
                  onChange={e => {
                    const links = [...(block.socialLinks || [])]
                    const idx = links.findIndex(l => l.platform === platform)
                    if (e.target.value) {
                      if (idx === -1) links.push({ platform: platform as SocialLink['platform'], url: e.target.value })
                      else links[idx] = { ...links[idx], url: e.target.value }
                    } else {
                      if (idx !== -1) links.splice(idx, 1)
                    }
                    onChange({ socialLinks: links })
                  }}
                  placeholder={`https://...`}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
            )
          })}
        </div>
      )}

      {block.type === 'video' && <>
        {field('Thumbnail URL', input('videoThumbnailUrl', 'text', 'https://…'))}
        {field('Video URL', input('videoUrl', 'text', '{{video_url}}'))}
        {field('Caption', input('videoCaption', 'text', 'Watch our latest video'))}
        {colorRow('Play button colour', 'videoPlayColor')}
      </>}

      {block.type === 'quote' && <>
        {field('Quote text', textarea('quoteText', 3, 'This product is amazing…'))}
        {field('Author name', input('quoteAuthor', 'text', 'Jane Smith'))}
        {field('Author title', input('quoteAuthorTitle', 'text', 'CEO, Acme Inc.'))}
        {field('Avatar URL (optional)', input('quoteAvatarUrl', 'text', 'https://…'))}
        {colorRow('Accent colour', 'quoteAccentColor')}
        {varPills}
      </>}
    </div>
  )
}

// ─── Canvas block card ────────────────────────────────────────────────────────

function BlockCard({
  block,
  index,
  selected,
  variables,
  onSelect,
  onDelete,
  onDuplicate,
  onChange,
}: {
  block: EmailBlock
  index: number
  selected: boolean
  variables: string[]
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
  onChange: (updated: Partial<EmailBlock>) => void
}) {
  const labelMap: Record<BlockType, string> = {
    header: 'Heading', text: 'Text', image: 'Image', button: 'Button',
    divider: 'Divider', spacer: 'Spacer', 'two-column': 'Two columns',
    social: 'Social Links', video: 'Video', quote: 'Quote',
  }

  const preview = () => {
    switch (block.type) {
      case 'header':
        return (
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={e => onChange({ headingText: e.currentTarget.textContent || '' })}
            style={{ color: block.headingColor || '#111827', textAlign: block.headingAlign as any || 'center', fontFamily: "Georgia,'Times New Roman',serif" }}
            className={`outline-none font-bold ${block.headingLevel === 'h1' ? 'text-3xl' : block.headingLevel === 'h2' ? 'text-2xl' : 'text-xl'}`}
          >
            {block.headingText}
          </div>
        )
      case 'text':
        return (
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={e => onChange({ bodyText: e.currentTarget.textContent || '' })}
            style={{ color: block.bodyColor || '#4b5563', textAlign: block.bodyAlign as any || 'left', fontSize: (block.fontSize || 15) + 'px', lineHeight: 1.75 }}
            className="outline-none"
          >
            {block.bodyText}
          </div>
        )
      case 'image':
        return (
          <img
            src={block.imageUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=640&q=80'}
            alt={block.imageAlt || ''}
            style={{ width: block.imageWidth || '100%', maxWidth: '100%', borderRadius: 8, display: 'block' }}
          />
        )
      case 'button':
        return (
          <div style={{ textAlign: block.buttonAlign as any || 'center' }}>
            <span
              contentEditable
              suppressContentEditableWarning
              onBlur={e => onChange({ buttonText: e.currentTarget.textContent || '' })}
              style={{ background: block.buttonColor || '#4f46e5', color: block.buttonTextColor || '#fff', padding: '12px 24px', borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'text', display: 'inline-block' }}
              className="outline-none"
            >
              {block.buttonText || 'Click here'}
            </span>
          </div>
        )
      case 'divider':
        return <hr style={{ border: 'none', borderTop: `1px solid ${block.dividerColor || '#e5e7eb'}` }} />
      case 'spacer':
        return <div style={{ height: (block.spacerHeight || 32) + 'px', background: 'repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 4px,#fff 4px,#fff 12px)' }} />
      case 'two-column':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={e => onChange({ colLeftText: e.currentTarget.textContent || '' })}
              className="outline-none text-sm text-stone-600 border-r border-stone-100 pr-3"
            >
              {block.colLeftText}
            </div>
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={e => onChange({ colRightText: e.currentTarget.textContent || '' })}
              className="outline-none text-sm text-stone-600"
            >
              {block.colRightText}
            </div>
          </div>
        )
      case 'social': {
        const links = block.socialLinks || []
        return (
          <div style={{ textAlign: 'center' }}>
            {links.map((l, i) => {
              const cfg = SOCIAL_CONFIG[l.platform]
              if (!cfg) return null
              return (
                <span
                  key={i}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: cfg.color, margin: '0 5px' }}
                  dangerouslySetInnerHTML={{ __html: cfg.svg }}
                />
              )
            })}
            {links.length === 0 && <span className="text-stone-400 text-xs">Add social links in the properties panel →</span>}
          </div>
        )
      }
      case 'video':
        return (
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <img
              src={block.videoThumbnailUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&q=80'}
              alt="Video thumbnail"
              style={{ width: '100%', borderRadius: 8, display: 'block' }}
            />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 48, height: 48, borderRadius: '50%', background: block.videoPlayColor || '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
            {block.videoCaption && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280' }}>{block.videoCaption}</p>}
          </div>
        )
      case 'quote':
        return (
          <div style={{ borderLeft: `4px solid ${block.quoteAccentColor || '#4f46e5'}`, paddingLeft: 16 }}>
            <p style={{ margin: '0 0 10px', fontStyle: 'italic', color: '#374151', fontSize: 15, lineHeight: 1.7 }}>&quot;{block.quoteText || ''}&quot;</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {block.quoteAvatarUrl && <img src={block.quoteAvatarUrl} alt={block.quoteAuthor || ''} style={{ width: 32, height: 32, borderRadius: '50%' }} />}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{block.quoteAuthor || 'Author Name'}</div>
                {block.quoteAuthorTitle && <div style={{ fontSize: 11, color: '#6b7280' }}>{block.quoteAuthorTitle}</div>}
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <Draggable draggableId={block.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          onClick={onSelect}
          className={`group relative rounded-xl border-2 transition-all ${
            snapshot.isDragging
              ? 'border-indigo-400 shadow-xl rotate-1 opacity-90'
              : selected
                ? 'border-indigo-400 shadow-md'
                : 'border-transparent hover:border-stone-200'
          }`}
          style={{ ...provided.draggableProps.style, background: block.backgroundColor || '#fff' }}
        >
          {/* Drag handle + label + actions */}
          <div className={`absolute -top-px left-0 right-0 flex items-center justify-between rounded-t-xl px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-opacity ${selected || snapshot.isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} bg-indigo-500 text-white`}>
            <div {...provided.dragHandleProps} className="flex items-center gap-1 cursor-grab active:cursor-grabbing">
              <GripVertical className="h-3 w-3" />
              {labelMap[block.type]}
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={e => { e.stopPropagation(); onDuplicate() }} className="hover:text-indigo-200" title="Duplicate">
                <Copy className="h-3 w-3" />
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); onDelete() }} className="hover:text-red-200" title="Delete">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div style={{ padding: `${block.paddingV ?? 16}px ${block.paddingH ?? 28}px` }}>
            {preview()}
          </div>
        </div>
      )}
    </Draggable>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface EmailBlockEditorProps {
  initialHtml?: string
  variables?: string[]
  onChange: (html: string) => void
  fullHeight?: boolean
}

export default function EmailBlockEditor({ initialHtml, variables = [], onChange, fullHeight = false }: EmailBlockEditorProps) {
  const uid = useId()
  const nextId = useCallback((i: number) => `${uid}-${Date.now()}-${i}`, [uid])

  const initBlocks = useCallback((): EmailBlock[] => {
    if (initialHtml) {
      const parsed = htmlToBlocks(initialHtml, uid)
      if (parsed) return parsed
    }
    return [
      makeBlock('header', `${uid}-0`),
      makeBlock('text',   `${uid}-1`),
      makeBlock('button', `${uid}-2`),
    ]
  }, [initialHtml, uid])

  const [blocks, setBlocks] = useState<EmailBlock[]>(initBlocks)
  const [history, setHistory] = useState<EmailBlock[][]>([initBlocks()])
  const [historyIdx, setHistoryIdx] = useState(0)

  const [selectedId, setSelectedId] = useState<string | null>(blocks[0]?.id ?? null)
  const [showPreview, setShowPreview] = useState(false)
  const [showHtml, setShowHtml] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')

  // Re-parse when the template changes (modal re-opened with different template)
  const prevHtmlRef = useRef(initialHtml)
  useEffect(() => {
    if (initialHtml === prevHtmlRef.current) return
    prevHtmlRef.current = initialHtml
    if (initialHtml) {
      const parsed = htmlToBlocks(initialHtml, uid)
      if (parsed) {
        setBlocks(parsed)
        setHistory([parsed])
        setHistoryIdx(0)
        setSelectedId(parsed[0]?.id ?? null)
        return
      }
    }
    const defaults = [
      makeBlock('header', `${uid}-0`),
      makeBlock('text',   `${uid}-1`),
      makeBlock('button', `${uid}-2`),
    ]
    setBlocks(defaults)
    setHistory([defaults])
    setHistoryIdx(0)
    setSelectedId(defaults[0].id)
  }, [initialHtml, uid])

  const pushHistory = useCallback((next: EmailBlock[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIdx + 1)
      return [...trimmed, next].slice(-50) // cap at 50 states
    })
    setHistoryIdx(prev => Math.min(prev + 1, 50))
  }, [historyIdx])

  const undo = useCallback(() => {
    if (historyIdx <= 0) return
    const newIdx = historyIdx - 1
    const restored = history[newIdx]
    setHistoryIdx(newIdx)
    setBlocks(restored)
    onChange(blocksToHtml(restored))
  }, [historyIdx, history, onChange])

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return
    const newIdx = historyIdx + 1
    const restored = history[newIdx]
    setHistoryIdx(newIdx)
    setBlocks(restored)
    onChange(blocksToHtml(restored))
  }, [historyIdx, history, onChange])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  const emit = useCallback((next: EmailBlock[]) => {
    onChange(blocksToHtml(next))
  }, [onChange])

  const commitBlocks = useCallback((next: EmailBlock[]) => {
    setBlocks(next)
    emit(next)
    pushHistory(next)
  }, [emit, pushHistory])

  const updateBlock = (id: string, patch: Partial<EmailBlock>) => {
    const next = blocks.map(b => b.id === id ? { ...b, ...patch } : b)
    commitBlocks(next)
  }

  const deleteBlock = (id: string) => {
    const next = blocks.filter(b => b.id !== id)
    commitBlocks(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex(b => b.id === id)
    if (idx === -1) return
    const original = blocks[idx]
    const copy: EmailBlock = { ...original, id: nextId(blocks.length) }
    const next = [...blocks]
    next.splice(idx + 1, 0, copy)
    commitBlocks(next)
    setSelectedId(copy.id)
  }

  const addBlock = (type: BlockType) => {
    const block = makeBlock(type, nextId(blocks.length))
    const idx = blocks.findIndex(b => b.id === selectedId)
    const next = [...blocks]
    next.splice(idx === -1 ? next.length : idx + 1, 0, block)
    commitBlocks(next)
    setSelectedId(block.id)
  }

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    if (result.source.droppableId === 'palette' && result.destination.droppableId === 'canvas') {
      const type = PALETTE[result.source.index].type
      const block = makeBlock(type, nextId(blocks.length))
      const next = [...blocks]
      next.splice(result.destination.index, 0, block)
      commitBlocks(next)
      setSelectedId(block.id)
      return
    }
    if (result.source.droppableId === 'canvas' && result.destination.droppableId === 'canvas') {
      const next = [...blocks]
      const [moved] = next.splice(result.source.index, 1)
      next.splice(result.destination.index, 0, moved)
      commitBlocks(next)
    }
  }

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null
  const html = blocksToHtml(blocks)
  const canUndo = historyIdx > 0
  const canRedo = historyIdx < history.length - 1

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={`flex flex-col gap-0 border-stone-200 overflow-hidden ${fullHeight ? 'h-full border-0 rounded-none' : 'rounded-2xl border shadow-sm'}`} style={fullHeight ? {} : { minHeight: 520 }}>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-stone-400 ml-1 hidden sm:inline">
              {blocks.length} block{blocks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowHtml(false); setShowPreview(v => !v) }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${showPreview ? 'bg-indigo-600 text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-100'}`}
            >
              {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPreview ? 'Close preview' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={() => { setShowPreview(false); setShowHtml(v => !v) }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${showHtml ? 'bg-stone-700 text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-100'}`}
            >
              <Code2 className="h-3.5 w-3.5" />
              {showHtml ? 'Close HTML' : 'View HTML'}
            </button>
          </div>
        </div>

        {/* Preview mode */}
        {showPreview && (
          <div className="flex-1 bg-stone-100 flex flex-col">
            <div className="flex items-center justify-center gap-2 border-b border-stone-200 bg-white py-2 px-4">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${previewDevice === 'desktop' ? 'bg-stone-800 text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-100'}`}
              >
                <Monitor className="h-3.5 w-3.5" /> Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${previewDevice === 'mobile' ? 'bg-stone-800 text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-100'}`}
              >
                <Smartphone className="h-3.5 w-3.5" /> Mobile
              </button>
            </div>
            <div className="flex-1 p-4 flex items-start justify-center overflow-auto">
              <iframe
                srcDoc={html}
                sandbox="allow-same-origin"
                title="Email preview"
                className="rounded-xl border border-stone-200 shadow-md bg-white transition-all"
                style={{ width: previewDevice === 'mobile' ? 375 : 640, height: 600, border: 'none', flexShrink: 0 }}
              />
            </div>
          </div>
        )}

        {/* HTML view */}
        {showHtml && (
          <div className="flex-1 p-4 bg-stone-900">
            <pre className="text-xs text-green-300 font-mono overflow-auto whitespace-pre-wrap" style={{ maxHeight: 500 }}>
              {html}
            </pre>
          </div>
        )}

        {/* Editor (hidden when preview/html shown) */}
        {!showPreview && !showHtml && (
          <div className={`flex overflow-hidden ${fullHeight ? 'flex-1' : 'flex-1'}`} style={fullHeight ? {} : { minHeight: 480 }}>

            {/* Left: palette */}
            <div className="w-44 shrink-0 border-r border-stone-200 bg-stone-50 p-3 flex flex-col gap-1 overflow-y-auto">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Blocks</p>
              <Droppable droppableId="palette" isDropDisabled>
                {provided => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1">
                    {PALETTE.map((item, i) => (
                      <Draggable key={item.type} draggableId={`palette-${item.type}`} index={i}>
                        {(provided, snapshot) => (
                          <>
                            {snapshot.isDragging && (
                              <div className="rounded-lg border border-indigo-200 bg-white p-2 opacity-50">
                                <item.icon className="h-4 w-4 text-indigo-400" />
                              </div>
                            )}
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => addBlock(item.type)}
                              className={`flex items-center gap-2 rounded-lg border px-2 py-2 cursor-grab active:cursor-grabbing text-xs font-medium transition select-none ${
                                snapshot.isDragging
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-lg'
                                  : 'border-stone-200 bg-white text-stone-600 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                              title={item.description}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              {item.label}
                            </div>
                          </>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              <button
                type="button"
                onClick={() => addBlock('text')}
                className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 py-2 text-xs text-stone-400 hover:border-indigo-300 hover:text-indigo-500 transition"
              >
                <Plus className="h-3 w-3" />
                Add block
              </button>
            </div>

            {/* Center: canvas */}
            <div className="flex-1 overflow-y-auto bg-stone-100 p-4">
              <div className="mx-auto max-w-[600px]">
                <Droppable droppableId="canvas">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[400px] rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50 ring-2 ring-indigo-300 ring-inset' : 'bg-white'} shadow-sm overflow-hidden`}
                    >
                      {blocks.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex flex-col items-center justify-center gap-3 py-20 text-stone-400">
                          <Columns2 className="h-10 w-10 opacity-30" />
                          <p className="text-sm">Drag blocks from the left panel<br/>or click them to add</p>
                        </div>
                      )}
                      {blocks.map((block, index) => (
                        <BlockCard
                          key={block.id}
                          block={block}
                          index={index}
                          selected={selectedId === block.id}
                          variables={variables}
                          onSelect={() => setSelectedId(block.id)}
                          onDelete={() => deleteBlock(block.id)}
                          onDuplicate={() => duplicateBlock(block.id)}
                          onChange={patch => updateBlock(block.id, patch)}
                        />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>

            {/* Right: properties panel */}
            <div className="w-56 shrink-0 border-l border-stone-200 bg-white overflow-y-auto">
              {selectedBlock ? (
                <div className="p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Properties</p>
                  <BlockPropertyPanel
                    block={selectedBlock}
                    variables={variables}
                    onChange={patch => updateBlock(selectedBlock.id, patch)}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center text-stone-400">
                  <Type className="h-8 w-8 opacity-30" />
                  <p className="text-xs">Select a block to edit its properties</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </DragDropContext>
  )
}
