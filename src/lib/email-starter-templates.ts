export type StarterTemplateType = 'marketing' | 'transactional' | 'automation'

export type StarterTemplateLayout =

  | 'editorial'

  | 'survey'

  | 'review'

  | 'confirmation'

  | 'promotion'

  | 'seasonal'



export interface EmailStarterTemplate {

  id: string

  name: string

  tagline: string

  description: string

  category: string

  type: StarterTemplateType

  layout: StarterTemplateLayout

  subject: string

  accent: string

  mood: string

  previewImage: string

  variables: string[]

  tags: string[]

  metrics: {

    industry: string

    useCase: string

    layout: string

  }

  highlights: string[]

  htmlContent: string

  textContent: string

}



interface TemplateBuildConfig {

  eyebrow: string

  heroTitle: string

  heroCopy: string

  cta: string

  accent: string

  accentSoft: string

  cardBackground: string

  previewImage: string

  contentImage?: string

  sectionTitles: readonly string[]

  sectionBodies: readonly string[]

  stats?: readonly string[]

  quote?: string

  footerNote: string
  layout: StarterTemplateLayout

}

type TemplateRenderKey =
  | 'monthly-marketing-dispatch'
  | 'inside-insights-monthly-marketing-roundup'
  | 'your-voice-matters'
  | 'your-journey-in-review'
  | 'just-one-last-step'
  | 'voices-that-shape-us'
  | 'surprise-your-valentine'
  | 'kids-fall-collection'
  | 'black-friday-watch-sale'
  | 'spooktacular-offers'
  | 'thanksgiving-staycation-email'
  | 'the-season-of-gratitude'
  | 'no-tricks-only-treats'

interface StarterTemplateConfig extends Omit<EmailStarterTemplate, 'htmlContent'> {
  build: Omit<TemplateBuildConfig, 'layout'>
  renderKey?: TemplateRenderKey
}



const remoteImages = {

  marketingDesk:

    'https://images.unsplash.com/photo-1709281847802-9aef10b6d4bf?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=1600',

  phoneApps:

    'https://images.unsplash.com/photo-1756575433591-0d82418dd67b?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=1600',

  kidsFashion:

    'https://images.unsplash.com/photo-1682802739047-24fa5d983e71?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=1600',

  luxuryWatch:

    'https://images.unsplash.com/photo-1749831754129-3a84b9fdeb87?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=1600',

  valentineFlowers:

    'https://images.unsplash.com/photo-1512056495345-913a0c261dc8?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dmFsZW50aW5lJTIwZmxvd2Vyc3xlbnwwfHwwfHx8MA%3D%3D&ixlib=rb-4.1.0&q=60&w=1600',

  thanksgivingTable:

    'https://images.unsplash.com/photo-1474221550179-c492fb337327?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fHRoYW5rc2dpdmluZyUyMHRhYmxlfGVufDB8fDB8fHww&ixlib=rb-4.1.0&q=60&w=1600',

  halloweenCandy:

    'https://images.unsplash.com/photo-1767498051840-04b3e1aff64e?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=1600',

} as const



function buildSectionRow(config: TemplateBuildConfig) {

  return config.sectionTitles

    .map(

      (title, index) => `

    <td style="padding:0 7px 14px;vertical-align:top;">

      <div style="height:100%;border-radius:24px;background:${config.cardBackground};padding:18px;border:1px solid rgba(17,24,39,0.06);">

        <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${config.accent};font-weight:700;margin-bottom:10px;">0${index + 1}</div>

        <div style="font-size:18px;line-height:1.25;color:#111827;font-weight:700;margin-bottom:8px;">${title}</div>

        <div style="font-size:14px;line-height:1.7;color:#4b5563;">${config.sectionBodies[index]}</div>

      </div>

    </td>

  `

    )

    .join('')

}



function renderStatCards(stats: readonly string[]) {
  return stats
    .map(
      (stat) => `<td style="padding:0 6px 12px;vertical-align:top;"><div style="border-radius:22px;background:#ffffff;border:1px solid #ece7df;padding:18px 16px;text-align:center;font-size:14px;line-height:1.6;color:#374151;font-weight:700;">${stat}</div></td>`
    )
    .join('')
}

function renderTextCards(config: TemplateBuildConfig, tone: 'soft' | 'bold' = 'soft') {
  return config.sectionTitles
    .map((title, index) => {
      const bg = tone === 'bold' ? '#111827' : config.cardBackground
      const bodyColor = tone === 'bold' ? '#d1d5db' : '#4b5563'
      const titleColor = tone === 'bold' ? '#ffffff' : '#111827'
      return `<td style="padding:0 7px 14px;vertical-align:top;"><div style="height:100%;border-radius:24px;background:${bg};padding:18px;border:1px solid rgba(17,24,39,0.06);"><div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${config.accent};font-weight:700;margin-bottom:10px;">0${index + 1}</div><div style="font-size:18px;line-height:1.25;color:${titleColor};font-weight:700;margin-bottom:8px;">${title}</div><div style="font-size:14px;line-height:1.7;color:${bodyColor};">${config.sectionBodies[index]}</div></div></td>`
    })
    .join('')
}

function renderQuote(config: TemplateBuildConfig, dark = true) {
  if (!config.quote) return ''
  const background = dark ? '#111827' : config.cardBackground
  const textColor = dark ? '#f9fafb' : '#1f2937'
  const labelColor = dark ? '#fbbf24' : config.accent
  return `<tr><td style="padding:0 28px 26px;"><div style="border-radius:24px;background:${background};padding:22px 24px;color:${textColor};"><div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${labelColor};margin-bottom:10px;">Spotlight</div><div style="font-size:18px;line-height:1.65;font-family:Georgia,'Times New Roman',serif;">${config.quote}</div></div></td></tr>`
}

function renderPersonalizer(config: TemplateBuildConfig, label = 'Personalize') {
  return `<tr><td style="padding:0 28px 28px;"><div style="padding:20px 22px;border-radius:24px;background:${config.cardBackground};border:1px solid rgba(17,24,39,0.06);"><div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${config.accent};font-weight:700;margin-bottom:10px;">${label}</div><div style="font-size:15px;line-height:1.7;color:#374151;">Drop in variables like {{first_name}}, {{company_name}}, {{cta_url}}, and {{unsubscribe_url}} so the layout feels tailored without losing the polished campaign look.</div></div></td></tr>`
}

function renderShell(config: TemplateBuildConfig, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.heroTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5efe8;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5efe8;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdf9;border-radius:32px;overflow:hidden;border:1px solid #eadfd2;box-shadow:0 18px 54px rgba(54,37,25,0.12);">
            <tr>
              <td style="padding:20px 28px;background:linear-gradient(135deg,${config.accentSoft} 0%,#fff8ef 100%);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="font-size:11px;line-height:1;text-transform:uppercase;letter-spacing:0.28em;color:${config.accent};font-weight:700;">${config.eyebrow}</td><td align="right" style="font-size:12px;color:#6b7280;">{{company_name}}</td></tr></table>
              </td>
            </tr>
            ${body}
            <tr>
              <td style="padding:0 28px 30px;font-size:13px;line-height:1.75;color:#6b7280;">${config.footerNote}<br /><br />{{company_name}}<br />{{company_address}}<br /><a href="{{unsubscribe_url}}" style="color:${config.accent};text-decoration:underline;">Unsubscribe</a></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildTemplateHtml(templateId: string, config: TemplateBuildConfig) {
  const stats = config.stats && config.stats.length ? `<tr><td style="padding:0 28px 18px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${renderStatCards(config.stats)}</tr></table></td></tr>` : ''

  switch (templateId) {
    case 'monthly-marketing-dispatch':
      return renderShell(config, `
        <tr><td style="padding:14px 14px 0;"><img src="${config.previewImage}" alt="" width="652" style="display:block;width:100%;max-width:652px;height:auto;border-radius:26px;" /></td></tr>
        <tr><td style="padding:34px 28px 10px;"><div style="display:inline-block;padding:7px 14px;border-radius:999px;background:${config.accentSoft};font-size:12px;font-weight:700;letter-spacing:0.08em;color:${config.accent};text-transform:uppercase;">Magazine issue</div><h1 style="margin:18px 0 14px;font-size:42px;line-height:1.02;font-family:Georgia,'Times New Roman',serif;color:#111827;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 0 22px;font-size:16px;line-height:1.8;color:#4b5563;">${config.heroCopy}</p><a href="{{cta_url}}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${config.accent};color:#fff;text-decoration:none;font-weight:700;">${config.cta}</a></td></tr>
        ${stats}
        <tr><td style="padding:0 28px 10px;"><table role="presentation" width="100%"><tr><td style="padding:0 0 18px;border-bottom:1px solid #ece7df;"><div style="font-size:22px;font-family:Georgia,'Times New Roman',serif;color:#111827;font-weight:700;margin-bottom:8px;">Feature story</div><div style="font-size:15px;line-height:1.8;color:#4b5563;">${config.sectionBodies[0]}</div></td></tr></table></td></tr>
        <tr><td style="padding:8px 21px 8px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        <tr><td style="padding:0 28px 24px;"><img src="${config.contentImage || config.previewImage}" alt="" width="624" style="display:block;width:100%;max-width:624px;height:auto;border-radius:24px;" /></td></tr>
        ${renderQuote(config, true)}
        ${renderPersonalizer(config, 'Issue notes')}`)
    case 'inside-insights-monthly-marketing-roundup':
      return renderShell(config, `
        <tr><td style="padding:24px 28px 8px;text-align:center;"><div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${config.accent};font-weight:700;">Inside insights</div><h1 style="margin:16px auto 12px;max-width:560px;font-size:38px;line-height:1.05;color:#111827;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 auto 20px;max-width:540px;font-size:16px;line-height:1.8;color:#4b5563;">${config.heroCopy}</p><a href="{{cta_url}}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${config.accent};color:#fff;text-decoration:none;font-weight:700;">${config.cta}</a></td></tr>
        <tr><td style="padding:0 16px 20px;"><table role="presentation" width="100%"><tr><td style="width:58%;padding-right:10px;"><img src="${config.previewImage}" alt="" width="360" style="display:block;width:100%;border-radius:24px;" /></td><td style="width:42%;padding-left:10px;vertical-align:top;"><div style="border-radius:24px;background:${config.cardBackground};padding:20px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.16em;color:${config.accent};font-weight:700;">Briefing</div><div style="margin-top:10px;font-size:22px;line-height:1.25;color:#111827;font-weight:700;">${config.sectionTitles[0]}</div><div style="margin-top:8px;font-size:14px;line-height:1.7;color:#4b5563;">${config.sectionBodies[0]}</div></div></td></tr></table></td></tr>
        ${stats}
        <tr><td style="padding:0 21px 12px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        ${renderQuote(config, false)}
        ${renderPersonalizer(config, 'Roundup variables')}`)
    case 'your-voice-matters':
      return renderShell(config, `
        <tr><td style="padding:30px 28px 18px;text-align:center;"><img src="${config.previewImage}" alt="" width="250" style="display:block;width:100%;max-width:250px;border-radius:28px;margin:0 auto 20px;" /><div style="display:inline-block;padding:7px 14px;border-radius:999px;background:${config.accentSoft};font-size:12px;font-weight:700;letter-spacing:0.08em;color:${config.accent};text-transform:uppercase;">Survey invite</div><h1 style="margin:18px 0 12px;font-size:36px;line-height:1.08;color:#111827;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 auto 20px;max-width:520px;font-size:16px;line-height:1.8;color:#4b5563;">${config.heroCopy}</p><a href="{{cta_url}}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${config.accent};color:#fff;text-decoration:none;font-weight:700;">${config.cta}</a></td></tr>
        ${stats}
        <tr><td style="padding:0 28px 18px;"><div style="border-radius:24px;background:${config.cardBackground};padding:22px;"><div style="font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:${config.accent};font-weight:700;margin-bottom:10px;">Why we are asking</div><div style="font-size:15px;line-height:1.8;color:#4b5563;">${config.sectionBodies[0]}</div></div></td></tr>
        <tr><td style="padding:0 21px 8px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        ${renderQuote(config, true)}
        ${renderPersonalizer(config, 'Feedback fields')}`)
    case 'your-journey-in-review':
      return renderShell(config, `
        <tr><td style="padding:18px 18px 0;"><div style="border-radius:30px;background:linear-gradient(145deg,${config.accentSoft},#ffffff);padding:20px 20px 10px;"><div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${config.accent};font-weight:700;">Annual recap</div><h1 style="margin:16px 0 10px;font-size:42px;line-height:1.02;font-family:Georgia,'Times New Roman',serif;color:#111827;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#4b5563;">${config.heroCopy}</p><img src="${config.previewImage}" alt="" width="604" style="display:block;width:100%;border-radius:24px;" /></div></td></tr>
        <tr><td style="padding:24px 28px 10px;"><a href="{{cta_url}}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${config.accent};color:#fff;text-decoration:none;font-weight:700;">${config.cta}</a></td></tr>
        ${stats}
        <tr><td style="padding:0 21px 12px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        ${renderQuote(config, false)}
        ${renderPersonalizer(config, 'Milestone variables')}`)
    case 'just-one-last-step':
      return renderShell(config, `
        <tr><td style="padding:42px 28px 18px;text-align:center;"><img src="${config.previewImage}" alt="" width="220" style="display:block;width:100%;max-width:220px;border-radius:30px;margin:0 auto 20px;" /><div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${config.accent};font-weight:700;">Final step</div><h1 style="margin:16px 0 12px;font-size:40px;line-height:1.02;color:#111827;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 auto 22px;max-width:480px;font-size:16px;line-height:1.8;color:#4b5563;">${config.heroCopy}</p><a href="{{cta_url}}" style="display:inline-block;padding:15px 30px;border-radius:999px;background:${config.accent};color:#fff;text-decoration:none;font-weight:700;">${config.cta}</a></td></tr>
        <tr><td style="padding:0 28px 22px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        ${renderPersonalizer(config, 'Confirmation fields')}`)
    case 'voices-that-shape-us':
      return renderShell(config, `
        <tr><td style="padding:24px 16px 12px;"><table role="presentation" width="100%"><tr><td style="width:52%;padding:0 12px 0 12px;vertical-align:middle;"><div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${config.accent};font-weight:700;">Voice of customer</div><h1 style="margin:14px 0 12px;font-size:36px;line-height:1.08;color:#111827;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#4b5563;">${config.heroCopy}</p><a href="{{cta_url}}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${config.accent};color:#fff;text-decoration:none;font-weight:700;">${config.cta}</a></td><td style="width:48%;padding:0 12px;"><img src="${config.previewImage}" alt="" width="280" style="display:block;width:100%;border-radius:28px;" /></td></tr></table></td></tr>
        ${stats}
        ${renderQuote(config, true)}
        <tr><td style="padding:0 21px 12px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        ${renderPersonalizer(config, 'Listening loop')}`)
    case 'surprise-your-valentine':
      return renderShell(config, `
        <tr><td style="padding:14px 14px 0;"><img src="${config.previewImage}" alt="" width="652" style="display:block;width:100%;max-width:652px;height:auto;border-radius:26px;" /></td></tr>
        <tr><td style="padding:34px 28px 18px;text-align:center;"><div style="display:inline-block;padding:7px 14px;border-radius:999px;background:${config.accentSoft};font-size:12px;font-weight:700;letter-spacing:0.08em;color:${config.accent};text-transform:uppercase;">Gift edit</div><h1 style="margin:18px auto 12px;max-width:520px;font-size:40px;line-height:1.04;font-family:Georgia,'Times New Roman',serif;color:#111827;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 auto 20px;max-width:520px;font-size:16px;line-height:1.8;color:#4b5563;">${config.heroCopy}</p><a href="{{cta_url}}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${config.accent};color:#fff;text-decoration:none;font-weight:700;">${config.cta}</a></td></tr>
        ${stats}
        <tr><td style="padding:0 21px 8px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        ${renderQuote(config, false)}
        ${renderPersonalizer(config, 'Gift variables')}`)
    case 'kids-fall-collection':
      return renderShell(config, `
        <tr><td style="padding:18px 18px 0;"><table role="presentation" width="100%"><tr><td style="width:60%;padding-right:10px;"><img src="${config.previewImage}" alt="" width="360" style="display:block;width:100%;border-radius:28px;" /></td><td style="width:40%;padding-left:10px;vertical-align:middle;"><div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${config.accent};font-weight:700;">New collection</div><h1 style="margin:16px 0 12px;font-size:34px;line-height:1.08;font-family:Georgia,'Times New Roman',serif;color:#111827;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4b5563;">${config.heroCopy}</p><a href="{{cta_url}}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:${config.accent};color:#fff;text-decoration:none;font-weight:700;">${config.cta}</a></td></tr></table></td></tr>
        ${stats}
        <tr><td style="padding:0 21px 10px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        ${renderPersonalizer(config, 'Collection fields')}`)
    case 'black-friday-watch-sale':
      return renderShell(config, `
        <tr><td style="padding:18px 18px 0;"><div style="border-radius:30px;overflow:hidden;background:#0f172a;padding:22px;"><div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${config.accent};font-weight:700;">Black Friday</div><h1 style="margin:16px 0 12px;font-size:42px;line-height:1.02;color:#ffffff;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#cbd5e1;">${config.heroCopy}</p><a href="{{cta_url}}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${config.accent};color:#111827;text-decoration:none;font-weight:800;">${config.cta}</a><img src="${config.previewImage}" alt="" width="604" style="display:block;width:100%;border-radius:24px;margin-top:22px;" /></div></td></tr>
        ${stats}
        <tr><td style="padding:0 21px 8px;"><table role="presentation" width="100%"><tr>${renderTextCards(config, 'bold')}</tr></table></td></tr>
        ${renderQuote(config, true)}
        ${renderPersonalizer(config, 'Sale variables')}`)
    case 'spooktacular-offers':
      return renderShell(config, `
        <tr><td style="padding:14px 14px 0;"><img src="${config.previewImage}" alt="" width="652" style="display:block;width:100%;max-width:652px;height:auto;border-radius:26px;" /></td></tr>
        <tr><td style="padding:30px 28px 16px;"><div style="display:inline-block;padding:7px 14px;border-radius:999px;background:${config.accentSoft};font-size:12px;font-weight:700;letter-spacing:0.08em;color:${config.accent};text-transform:uppercase;">Seasonal drop</div><h1 style="margin:18px 0 12px;font-size:38px;line-height:1.04;color:#111827;font-weight:800;">${config.heroTitle}</h1><p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#4b5563;">${config.heroCopy}</p><a href="{{cta_url}}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${config.accent};color:#fff;text-decoration:none;font-weight:700;">${config.cta}</a></td></tr>
        ${stats}
        <tr><td style="padding:0 21px 10px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        ${renderQuote(config, false)}
        ${renderPersonalizer(config, 'Offer variables')}`)
    case 'thanksgiving-staycation-email':
      return renderShell(config, `
        <tr><td style="padding:18px 18px 0;"><img src="${config.previewImage}" alt="" width="620" style="display:block;width:100%;border-radius:28px;" /></td></tr>
        <tr><td style="padding:32px 28px 16px;"><div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${config.accent};font-weight:700;">Holiday escape</div><h1 style="margin:16px 0 12px;font-size:38px;line-height:1.05;font-family:Georgia,'Times New Roman',serif;color:#111827;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#4b5563;">${config.heroCopy}</p><a href="{{cta_url}}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${config.accent};color:#fff;text-decoration:none;font-weight:700;">${config.cta}</a></td></tr>
        ${stats}
        <tr><td style="padding:0 21px 10px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        ${renderQuote(config, false)}
        ${renderPersonalizer(config, 'Booking variables')}`)
    case 'the-season-of-gratitude':
      return renderShell(config, `
        <tr><td style="padding:26px 28px 12px;text-align:center;"><div style="display:inline-block;padding:7px 14px;border-radius:999px;background:${config.accentSoft};font-size:12px;font-weight:700;letter-spacing:0.08em;color:${config.accent};text-transform:uppercase;">Gratitude note</div><h1 style="margin:18px auto 12px;max-width:560px;font-size:40px;line-height:1.04;font-family:Georgia,'Times New Roman',serif;color:#111827;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 auto 22px;max-width:540px;font-size:16px;line-height:1.85;color:#4b5563;">${config.heroCopy}</p><img src="${config.previewImage}" alt="" width="624" style="display:block;width:100%;max-width:624px;border-radius:26px;margin:0 auto;" /></td></tr>
        ${stats}
        ${renderQuote(config, false)}
        <tr><td style="padding:0 21px 10px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        ${renderPersonalizer(config, 'Gratitude details')}`)
    case 'no-tricks-only-treats':
      return renderShell(config, `
        <tr><td style="padding:16px 16px 0;"><div style="border-radius:30px;background:linear-gradient(145deg,${config.accentSoft},#fff7ea);padding:18px;"><table role="presentation" width="100%"><tr><td style="width:48%;padding-right:12px;vertical-align:middle;"><div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${config.accent};font-weight:700;">Sweet specials</div><h1 style="margin:16px 0 12px;font-size:36px;line-height:1.06;color:#111827;font-weight:800;">${config.heroTitle}</h1><p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4b5563;">${config.heroCopy}</p><a href="{{cta_url}}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:${config.accent};color:#fff;text-decoration:none;font-weight:700;">${config.cta}</a></td><td style="width:52%;padding-left:12px;"><img src="${config.previewImage}" alt="" width="290" style="display:block;width:100%;border-radius:26px;" /></td></tr></table></div></td></tr>
        ${stats}
        <tr><td style="padding:0 21px 10px;"><table role="presentation" width="100%"><tr>${renderTextCards(config)}</tr></table></td></tr>
        ${renderQuote(config, false)}
        ${renderPersonalizer(config, 'Menu variables')}`)
    default:
      return renderShell(config, `<tr><td style="padding:34px 28px 24px;"><h1 style="margin:0 0 14px;font-size:38px;line-height:1.06;color:#111827;font-weight:700;">${config.heroTitle}</h1><p style="margin:0 0 24px;font-size:16px;line-height:1.75;color:#4b5563;">${config.heroCopy}</p></td></tr>${renderPersonalizer(config)}`)
  }
}

const starterConfigs: StarterTemplateConfig[] = [

  {

    id: 'monthly-marketing-dispatch',

    name: 'Monthly Marketing Dispatch — Stories that Move You',

    tagline: 'Editorial monthly dispatch with strong feature-story hierarchy',

    description: 'A close visual recreation of BeeFree editorial marketing newsletter styling with a magazine-like hero and polished content pacing.',

    category: 'Newsletter',

    type: 'marketing',

    layout: 'editorial',

    subject: 'Monthly Marketing Dispatch from {{company_name}}',

    accent: '#ac5c36',

    mood: 'Editorial journal',

    previewImage: remoteImages.marketingDesk,

    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['newsletter', 'marketing', 'dispatch'],

    metrics: { industry: 'Marketing & Design', useCase: 'Monthly roundup', layout: 'Editorial hero + three stories' },

    highlights: ['Magazine header', 'Curated article cadence', 'Warm editorial palette'],

    textContent: 'Monthly Marketing Dispatch from {{company_name}}. Read the latest stories here: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Monthly Dispatch',

      heroTitle: 'Stories, shifts, and ideas shaping the month ahead',

      heroCopy: 'Built for agencies and content teams, this layout turns your monthly update into a polished editorial moment with featured reads, trend signals, and a confident CTA.',

      cta: "Read this month's issue",

      accent: '#ac5c36',

      accentSoft: '#f9e6db',

      cardBackground: '#f8efe8',

      previewImage: remoteImages.marketingDesk,

      contentImage: remoteImages.marketingDesk,

      sectionTitles: ['Lead story', 'What to watch', 'Team notes'],

      sectionBodies: ['Give the top article a generous summary that feels premium and worth clicking.', 'Package trend observations, campaign shifts, or social changes into a concise second panel.', 'Wrap with people, process, or product updates so the dispatch feels human and current.'],

      stats: ['3 featured reads', '1 strategic takeaway', 'Fresh issue every month'],

      quote: 'Design this like a publication, not a promo blast, and readers will treat it like one.',

      footerNote: 'You are receiving this editorial update from {{company_name}}.',

    },

  },

  {

    id: 'inside-insights-monthly-marketing-roundup',

    name: 'Inside Insights — Your Monthly Marketing Roundup',

    tagline: 'Clean editorial roundup with strong conversion cues',

    description: 'A close recreation of the Inside Insights newsletter pattern, balancing crisp marketing content with approachable visual rhythm.',

    category: 'Newsletter',

    type: 'marketing',

    layout: 'editorial',

    subject: 'Inside Insights: your monthly roundup is here',

    accent: '#1d4ed8',

    mood: 'Studio briefing',

    previewImage: remoteImages.marketingDesk,

    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['newsletter', 'roundup', 'insights'],

    metrics: { industry: 'SaaS / Marketing', useCase: 'Thought leadership', layout: 'Roundup with feature panels' },

    highlights: ['Insight-led headline', 'SaaS editorial feel', 'Structured CTA moments'],

    textContent: 'Inside Insights from {{company_name}} is ready. Explore the roundup: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Inside Insights',

      heroTitle: 'Your monthly marketing roundup, distilled and designed to land',

      heroCopy: 'Use this layout for strategic updates, product moves, thought leadership, and resource highlights in a format that feels informative first and promotional second.',

      cta: 'Explore the roundup',

      accent: '#1d4ed8',

      accentSoft: '#e4efff',

      cardBackground: '#eef5ff',

      previewImage: remoteImages.marketingDesk,

      contentImage: remoteImages.phoneApps,

      sectionTitles: ['Trend signals', 'Featured resource', 'From the team'],

      sectionBodies: ['Highlight what changed this month and why it matters for your audience.', 'Use the middle block for a report, webinar replay, or strategy guide.', 'Keep the last panel conversational with a short note from marketing or leadership.'],

      stats: ['Roundup-ready layout', 'Mobile-friendly reading flow', 'Works for content teams'],

      quote: 'The best roundup emails feel curated, not crowded.',

      footerNote: 'This monthly roundup was sent by {{company_name}}.',

    },

  },

  {

    id: 'your-voice-matters',

    name: 'Your Voice Matters — Share What You Think',

    tagline: 'Customer feedback email with testimonial framing',

    description: 'A close recreation of BeeFree survey-and-social-proof composition for collecting insights while showing readers their opinion matters.',

    category: 'Survey',

    type: 'automation',

    layout: 'survey',

    subject: '{{first_name}}, your voice matters to {{company_name}}',

    accent: '#0f766e',

    mood: 'Thoughtful product feedback',

    previewImage: remoteImages.phoneApps,

    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['survey', 'feedback', 'testimonial'],

    metrics: { industry: 'SaaS', useCase: 'User feedback', layout: 'Survey invite + social proof' },

    highlights: ['Soft SaaS palette', 'Trust-building testimonial style', 'Feedback-first CTA'],

    textContent: 'Your voice matters to {{company_name}}. Share your feedback here: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Feedback Request',

      heroTitle: 'Your voice helps shape what comes next',

      heroCopy: 'Designed for product and customer teams, this email invites thoughtful feedback while reinforcing trust with a polished, modern layout and clean CTA path.',

      cta: 'Share your feedback',

      accent: '#0f766e',

      accentSoft: '#dcf7f2',

      cardBackground: '#ebfbf7',

      previewImage: remoteImages.phoneApps,

      contentImage: remoteImages.phoneApps,

      sectionTitles: ['Quick survey', 'Why it matters', 'What happens next'],

      sectionBodies: ['Set expectations with a short survey length and one clear button.', 'Explain how feedback shapes roadmap decisions, onboarding, or support priorities.', 'Close the loop by telling readers their responses are reviewed by a real team.'],

      stats: ['2-minute survey', 'Product-led feedback', 'Ideal after onboarding'],

      quote: 'It felt like the product team was actually listening, not just collecting a score.',

      footerNote: 'Thank you for helping {{company_name}} improve.',

    },

  },

  {

    id: 'your-journey-in-review',

    name: 'A Year Together — Your Journey in Review',

    tagline: 'Warm year-in-review recap with milestone storytelling',

    description: 'A close recreation of BeeFree annual review styling, combining celebratory copy, milestone cards, and polished data-inspired structure.',

    category: 'Annual Review',

    type: 'marketing',

    layout: 'review',

    subject: '{{first_name}}, your journey with {{company_name}} in review',

    accent: '#7c3aed',

    mood: 'Reflective annual recap',

    previewImage: remoteImages.marketingDesk,

    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['year in review', 'retention', 'milestone'],

    metrics: { industry: 'SaaS', useCase: 'Annual recap', layout: 'Hero + milestone cards' },

    highlights: ['Milestone framing', 'Usage recap look', 'Retention-friendly warmth'],

    textContent: 'Here is your journey in review with {{company_name}}. See the full recap: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Year In Review',

      heroTitle: 'A year of progress, milestones, and momentum',

      heroCopy: 'Celebrate wins with a recap layout that feels personal and premium, perfect for sharing growth numbers, adoption highlights, and what comes next for loyal customers.',

      cta: 'See your full recap',

      accent: '#7c3aed',

      accentSoft: '#efe5ff',

      cardBackground: '#f6efff',

      previewImage: remoteImages.marketingDesk,

      contentImage: remoteImages.phoneApps,

      sectionTitles: ['Big milestone', 'Most-used feature', 'Next chapter'],

      sectionBodies: ['Spotlight the headline achievement that made the year memorable.', 'Use the center card for your most valuable usage stat or engagement moment.', 'Invite readers into the next phase with an upgrade, event, or roadmap teaser.'],

      stats: ['12 months together', 'Top moments highlighted', 'Built for loyalty campaigns'],

      quote: 'A strong year-in-review email turns retention into celebration.',

      footerNote: 'You are receiving this annual recap from {{company_name}}.',

    },

  },

  {

    id: 'just-one-last-step',

    name: 'Confirm Your Subscription — Just One Last Step',

    tagline: 'Minimal confirmation email with app-forward visuals',

    description: 'A close recreation of the clean confirmation-email pattern, using mobile-focused imagery and a simple one-action structure.',

    category: 'Confirmation',

    type: 'transactional',

    layout: 'confirmation',

    subject: 'Just one last step to confirm your subscription',

    accent: '#111827',

    mood: 'Minimal activation',

    previewImage: remoteImages.phoneApps,

    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['confirmation', 'activation', 'subscription'],

    metrics: { industry: 'SaaS', useCase: 'Double opt-in', layout: 'Minimal hero + single CTA' },

    highlights: ['Single-step focus', 'Phone-forward composition', 'Clean transactional hierarchy'],

    textContent: 'Just one last step. Confirm your subscription here: {{cta_url}}. If you did not request this, ignore this email.',

    build: {

      eyebrow: 'Confirm Subscription',

      heroTitle: 'One last tap and you are in',

      heroCopy: 'Keep the confirmation flow frictionless with a clear headline, an unmistakable button, and a layout that feels modern without adding noise.',

      cta: 'Confirm email address',

      accent: '#111827',

      accentSoft: '#eceff3',

      cardBackground: '#f3f4f6',

      previewImage: remoteImages.phoneApps,

      contentImage: remoteImages.phoneApps,

      sectionTitles: ['Fast confirm', 'Safe account access', 'Clear next step'],

      sectionBodies: ['Make the action obvious and remove every other competing decision.', 'Reassure readers this protects their account and preferences.', 'Explain exactly what they unlock after confirmation.'],

      stats: ['One action', 'Activation-ready', 'Best for double opt-in'],

      quote: 'The strongest confirmation emails remove every unnecessary sentence.',

      footerNote: 'If you did not request this email from {{company_name}}, you can safely ignore it.',

    },

  },

  {

    id: 'voices-that-shape-us',

    name: 'We’d Love Your Feedback — Voices That Shape Us',

    tagline: 'Survey and testimonial blend for SaaS teams',

    description: 'A close recreation of BeeFree feedback-plus-social-proof layout, balancing user-request language with credibility-building testimonials.',

    category: 'Survey',

    type: 'automation',

    layout: 'survey',

    subject: 'We would love your feedback, {{first_name}}',

    accent: '#2563eb',

    mood: 'Customer trust loop',

    previewImage: remoteImages.phoneApps,

    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['feedback', 'voice of customer', 'survey'],

    metrics: { industry: 'SaaS', useCase: 'Feedback + reviews', layout: 'Survey invite + trust panel' },

    highlights: ['Voice-of-customer framing', 'Testimonial-ready block', 'Simple survey CTA'],

    textContent: 'We would love your feedback. Share your thoughts here: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Customer Voices',

      heroTitle: 'The voices that shape us are the ones already using the product',

      heroCopy: 'Invite feedback while displaying the confidence of a mature product team. This recreation gives you a soft survey entry point and room for social proof in the same message.',

      cta: 'Leave feedback',

      accent: '#2563eb',

      accentSoft: '#e7f0ff',

      cardBackground: '#eef4ff',

      previewImage: remoteImages.phoneApps,

      contentImage: remoteImages.marketingDesk,

      sectionTitles: ['Tell us how it feels', 'See what others say', 'Help us improve'],

      sectionBodies: ['Open with the question you most want users to answer.', 'Use the center panel for a review quote or testimonial snippet.', 'Close with how product, support, and onboarding teams use responses.'],

      stats: ['Survey + testimonials', 'Strong for marketplaces', 'Built for product loops'],

      quote: 'The product kept getting better because the team clearly listened.',

      footerNote: 'This feedback request comes from {{company_name}}.',

    },

  },

  {

    id: 'surprise-your-valentine',

    name: 'Surprise Your Valentine',

    tagline: 'Romantic product-promo email with floral softness',

    description: 'A close recreation of the seasonal Valentine promo style with a gift-forward hero image, warm palette, and elegant promotional blocks.',

    category: 'Seasonal Promotion',

    type: 'marketing',

    layout: 'promotion',

    subject: 'Surprise your Valentine with something unforgettable',

    accent: '#be185d',

    mood: 'Romantic retail',

    previewImage: remoteImages.valentineFlowers,

    variables: ['first_name', 'company_name', 'discount_code', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['valentine', 'seasonal', 'promotion'],

    metrics: { industry: 'Retail / Lifestyle', useCase: 'Valentine promo', layout: 'Hero image + promo cards' },

    highlights: ['Seasonal romance palette', 'Gift-focused layout', 'Soft high-end promo feel'],

    textContent: 'Surprise your Valentine with something unforgettable. Shop now: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Valentine Collection',

      heroTitle: 'A softer, sweeter campaign for love-season shopping',

      heroCopy: 'Recreate that Valentine promo feeling with floral visuals, elevated copy, and space for featured gifts, bundles, or limited-time codes.',

      cta: 'Shop Valentine picks',

      accent: '#be185d',

      accentSoft: '#ffe4ef',

      cardBackground: '#fff0f6',

      previewImage: remoteImages.valentineFlowers,

      contentImage: remoteImages.valentineFlowers,

      sectionTitles: ['Gift idea', 'Bundle highlight', 'Last day reminder'],

      sectionBodies: ['Feature one anchor product that sets the emotional tone.', 'Use the second panel for pairings, delivery perks, or gift wrapping.', 'Close with urgency so the seasonal CTA feels timely.'],

      stats: ['Romance-led visuals', 'Gift CTA built-in', 'Seasonal offer ready'],

      quote: 'A Valentine email should feel like a gift before the click even happens.',

      footerNote: 'Seasonal offers from {{company_name}} are valid while supplies last.',

    },

  },

  {

    id: 'kids-fall-collection',

    name: 'Kids Fall Collection',

    tagline: 'Autumn kidswear promo with boutique warmth',

    description: 'A close recreation of a cozy fall fashion email, using boutique-style photography, earthy tones, and collection-focused merchandising blocks.',

    category: 'Product Promotion',

    type: 'marketing',

    layout: 'promotion',

    subject: 'Discover the kids fall collection from {{company_name}}',

    accent: '#92400e',

    mood: 'Cozy boutique',

    previewImage: remoteImages.kidsFashion,

    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['kidswear', 'fall', 'collection'],

    metrics: { industry: 'Fashion', useCase: 'Seasonal collection launch', layout: 'Collection promo + merch cards' },

    highlights: ['Warm autumn palette', 'Fashion retail styling', 'Collection-first messaging'],

    textContent: 'Explore the kids fall collection at {{company_name}}: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Fall Collection',

      heroTitle: 'Layered, playful, and ready for cooler days',

      heroCopy: 'This boutique-inspired recreation gives you a polished structure for new arrivals, category edits, and fall collection storytelling with cozy visual energy.',

      cta: 'Shop the collection',

      accent: '#92400e',

      accentSoft: '#f7e7d6',

      cardBackground: '#faf1e7',

      previewImage: remoteImages.kidsFashion,

      contentImage: remoteImages.kidsFashion,

      sectionTitles: ['New arrivals', 'Texture story', 'Weekend edit'],

      sectionBodies: ['Lead with the strongest seasonal pieces and your main collection headline.', 'Use the center block for materials, comfort, or styling notes parents will care about.', 'Finish with a curated set of looks for gifting, school, or weekend outfits.'],

      stats: ['Seasonal merch feel', 'Warm lifestyle mood', 'Ideal for collection drops'],

      quote: 'Retail emails work harder when the collection tells a story, not just a SKU list.',

      footerNote: 'This seasonal collection email was sent by {{company_name}}.',

    },

  },

  {

    id: 'black-friday-watch-sale',

    name: 'Black Friday Watch Sale',

    tagline: 'Luxury watch promo with dark-sale energy',

    description: 'A close recreation of the premium Black Friday sale look with dark contrast, strong pricing urgency, and luxury-product focus.',

    category: 'Black Friday',

    type: 'marketing',

    layout: 'promotion',

    subject: 'Black Friday watch sale now live',

    accent: '#f59e0b',

    mood: 'Luxury midnight sale',

    previewImage: remoteImages.luxuryWatch,

    variables: ['first_name', 'company_name', 'discount_code', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['black friday', 'watch', 'sale'],

    metrics: { industry: 'Luxury Retail', useCase: 'Black Friday promo', layout: 'Dark hero + offer cards' },

    highlights: ['Dark premium styling', 'Sale urgency', 'Product-led hero image'],

    textContent: 'The Black Friday watch sale is live. Shop now: {{cta_url}}. Code: {{discount_code}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Black Friday',

      heroTitle: 'A darker, sharper sale email built for statement products',

      heroCopy: 'For premium watch drops and limited-time offers, this recreation leans into drama, clarity, and urgency while keeping the layout clean enough to feel expensive.',

      cta: 'Unlock the sale',

      accent: '#f59e0b',

      accentSoft: '#fff3d8',

      cardBackground: '#f8f3eb',

      previewImage: remoteImages.luxuryWatch,

      contentImage: remoteImages.luxuryWatch,

      sectionTitles: ['Hero offer', 'Featured model', 'Ends soon'],

      sectionBodies: ['Open with the event headline and your strongest percentage or price-drop statement.', 'Use the center block for craftsmanship, material, or signature product details.', 'Close with a timer-style message or deadline to sharpen conversion urgency.'],

      stats: ['Black Friday ready', 'Luxury product focus', 'Dark storefront mood'],

      quote: 'Premium sale emails should feel controlled, not crowded.',

      footerNote: 'Black Friday pricing from {{company_name}} is available for a limited time.',

    },

  },

  {

    id: 'spooktacular-offers',

    name: 'Spooktacular Offers',

    tagline: 'Halloween retail promo with punchy seasonal color',

    description: 'A close recreation of a bright, festive Halloween promotion with playful energy, punchy CTA treatment, and candy-colored sections.',

    category: 'Halloween',

    type: 'marketing',

    layout: 'seasonal',

    subject: 'Spooktacular offers are here',

    accent: '#ea580c',

    mood: 'Playful seasonal retail',

    previewImage: remoteImages.halloweenCandy,

    variables: ['first_name', 'company_name', 'discount_code', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['halloween', 'offers', 'seasonal'],

    metrics: { industry: 'Retail / Food', useCase: 'Halloween promo', layout: 'Seasonal hero + playful blocks' },

    highlights: ['Bright seasonal energy', 'Halloween promo feel', 'Offer-focused CTA'],

    textContent: 'Spooktacular offers are here. Shop the seasonal picks: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Halloween Sale',

      heroTitle: 'High-energy seasonal offers without losing polish',

      heroCopy: 'This Halloween-themed recreation uses festive imagery and high-contrast accents to spotlight bundles, treats, or limited-time category promos.',

      cta: 'Reveal the offers',

      accent: '#ea580c',

      accentSoft: '#ffe8dc',

      cardBackground: '#fff1e9',

      previewImage: remoteImages.halloweenCandy,

      contentImage: remoteImages.halloweenCandy,

      sectionTitles: ['Treat drop', 'Costume-ready picks', 'Last chance'],

      sectionBodies: ['Feature your biggest seasonal item or bundle first.', 'Use the middle block for category highlights or themed collections.', 'Finish with the urgency note that gets readers to act before the holiday passes.'],

      stats: ['Seasonal CTA built-in', 'Retail-ready color story', 'Fun but structured'],

      quote: 'Seasonal campaigns win when the energy is memorable and the action is obvious.',

      footerNote: 'Halloween offers from {{company_name}} may end without notice.',

    },

  },

  {

    id: 'thanksgiving-staycation-email',

    name: 'Thanksgiving Staycation Email',

    tagline: 'Travel and hospitality holiday campaign with warm escape vibes',

    description: 'A close recreation of a Thanksgiving travel-style promo, pairing cozy hospitality imagery with gratitude-season booking language.',

    category: 'Thanksgiving',

    type: 'marketing',

    layout: 'seasonal',

    subject: 'Plan your Thanksgiving staycation with {{company_name}}',

    accent: '#b45309',

    mood: 'Warm hospitality',

    previewImage: remoteImages.thanksgivingTable,

    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['thanksgiving', 'staycation', 'travel'],

    metrics: { industry: 'Travel / Hospitality', useCase: 'Holiday booking push', layout: 'Warm hero + offer itinerary' },

    highlights: ['Hospitality warmth', 'Holiday travel tone', 'Booking-oriented CTA'],

    textContent: 'Plan your Thanksgiving staycation with {{company_name}}. Explore offers: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Thanksgiving Escape',

      heroTitle: 'A holiday campaign designed to feel like a cozy getaway',

      heroCopy: 'Use this layout for staycation promotions, dining packages, or holiday retreat offers with a warm visual tone and a clear booking CTA.',

      cta: 'Plan your staycation',

      accent: '#b45309',

      accentSoft: '#faebd6',

      cardBackground: '#faf3e8',

      previewImage: remoteImages.thanksgivingTable,

      contentImage: remoteImages.thanksgivingTable,

      sectionTitles: ['Holiday package', 'Dining detail', 'Book early'],

      sectionBodies: ['Lead with the main staycation or holiday package headline.', 'Use the second block for dining, spa, or room upgrade details.', 'End with urgency around availability, dates, or early-booking incentives.'],

      stats: ['Holiday-ready layout', 'Ideal for hotels', 'Warm booking CTA'],

      quote: 'Hospitality emails convert best when the stay starts feeling real inside the email itself.',

      footerNote: 'Holiday availability at {{company_name}} may be limited.',

    },

  },

  {

    id: 'the-season-of-gratitude',

    name: "Tis' The Season of Gratitude",

    tagline: 'Thankful-season message with soft editorial warmth',

    description: 'A close recreation of the gratitude-themed holiday email style, ideal for appreciation messages, soft offers, or seasonal storytelling.',

    category: 'Thanksgiving',

    type: 'marketing',

    layout: 'seasonal',

    subject: "It's the season of gratitude at {{company_name}}",

    accent: '#9a3412',

    mood: 'Reflective holiday warmth',

    previewImage: remoteImages.thanksgivingTable,

    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['thanksgiving', 'gratitude', 'seasonal'],

    metrics: { industry: 'Retail / Hospitality', useCase: 'Thank-you seasonal message', layout: 'Warm editorial appreciation' },

    highlights: ['Gratitude-led messaging', 'Soft thanksgiving palette', 'Flexible thank-you promo mix'],

    textContent: 'It is the season of gratitude at {{company_name}}. See more here: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Season Of Gratitude',

      heroTitle: 'Thankfulness, warmth, and a campaign that feels genuinely human',

      heroCopy: 'This recreation gives you a polished Thanksgiving-season layout for appreciation notes, gentle offers, community updates, or heartfelt holiday storytelling.',

      cta: 'See our gratitude note',

      accent: '#9a3412',

      accentSoft: '#fde8dd',

      cardBackground: '#fff4ec',

      previewImage: remoteImages.thanksgivingTable,

      contentImage: remoteImages.marketingDesk,

      sectionTitles: ['Thank you note', 'Seasonal update', 'What comes next'],

      sectionBodies: ['Start with appreciation before asking for the click.', 'Use the center panel for a light offer, community story, or holiday schedule.', 'Close by connecting this season to the next campaign or invitation.'],

      stats: ['Appreciation-first layout', 'Holiday-friendly warmth', 'Great for retention'],

      quote: 'The strongest gratitude emails feel sincere before they feel strategic.',

      footerNote: 'Thank you for being part of {{company_name}}.',

    },

  },

  {

    id: 'no-tricks-only-treats',

    name: 'No Tricks Only Treats!',

    tagline: 'Food-and-fun Halloween campaign with playful appetite appeal',

    description: 'A close recreation of BeeFree playful Halloween food-promo vibe, using bold treats imagery and bright seasonal blocks.',

    category: 'Halloween',

    type: 'marketing',

    layout: 'seasonal',

    subject: 'No tricks, only treats from {{company_name}}',

    accent: '#d97706',

    mood: 'Playful food promo',

    previewImage: remoteImages.halloweenCandy,

    variables: ['first_name', 'company_name', 'discount_code', 'cta_url', 'unsubscribe_url', 'company_address'],

    tags: ['halloween', 'treats', 'food'],

    metrics: { industry: 'Food & Beverage', useCase: 'Holiday treats promo', layout: 'Fun hero + offer blocks' },

    highlights: ['Candy-forward visuals', 'Playful headline tone', 'Food promo flexibility'],

    textContent: 'No tricks, only treats from {{company_name}}. Grab the offer: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',

    build: {

      eyebrow: 'Holiday Treats',

      heroTitle: 'A Halloween campaign that sells with charm instead of clutter',

      heroCopy: 'Perfect for food, beverage, or festive product promos, this recreation leans into appetite, color, and seasonal cheer while keeping conversion cues clear.',

      cta: 'Claim the treats',

      accent: '#d97706',

      accentSoft: '#fff1da',

      cardBackground: '#fff7ea',

      previewImage: remoteImages.halloweenCandy,

      contentImage: remoteImages.halloweenCandy,

      sectionTitles: ['Featured treat', 'Seasonal special', 'Limited run'],

      sectionBodies: ['Show the hero item or menu feature that anchors the campaign.', 'Use the second panel for a bundle, combo, or flavor assortment.', 'Close with the short urgency line that makes readers click before the season fades.'],

      stats: ['Food-friendly layout', 'Halloween energy', 'Perfect for specials'],

      quote: 'Seasonal food emails should feel delicious before the first order starts.',

      footerNote: 'Holiday specials from {{company_name}} are available for a limited time.',

    },

  },

  {
    id: 'founders-notebook-product-launch',
    renderKey: 'monthly-marketing-dispatch',
    name: "Founder's Notebook - Product Launch Edition",
    tagline: 'Editorial launch email for announcing a major feature or product debut',
    description: 'A narrative-led product launch template with founder-note energy, feature framing, and enough structure to ship a polished launch announcement fast.',
    category: 'Product Launch',
    type: 'marketing',
    layout: 'editorial',
    subject: 'Introducing the next chapter from {{company_name}}',
    accent: '#9f1239',
    mood: 'Confident launch editorial',
    previewImage: remoteImages.phoneApps,
    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],
    tags: ['product launch', 'announcement', 'editorial'],
    metrics: { industry: 'SaaS', useCase: 'Launch announcement', layout: 'Editorial hero + launch story' },
    highlights: ['Founder-note tone', 'Launch storytelling', 'Feature recap cards'],
    textContent: 'A new launch from {{company_name}} is here. See what is new: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',
    build: {
      eyebrow: 'Launch Edition',
      heroTitle: 'A launch email that reads like a confident product story',
      heroCopy: 'Use this when the release matters and you want more than a generic announcement. It gives product, marketing, and founder teams room to explain the why, not just the what.',
      cta: 'See the launch',
      accent: '#9f1239',
      accentSoft: '#ffe4ec',
      cardBackground: '#fff0f5',
      previewImage: remoteImages.phoneApps,
      contentImage: remoteImages.marketingDesk,
      sectionTitles: ['What launched', 'Why it matters', 'How to try it'],
      sectionBodies: ['Lead with the highest-signal product reveal or new capability.', 'Translate the launch into outcomes customers will immediately understand.', 'Close with the one action you want readers to take next.'],
      stats: ['Launch-ready flow', 'Strong editorial hierarchy', 'Ideal for major releases'],
      quote: 'A strong launch email should create momentum, not just awareness.',
      footerNote: 'You are receiving this product launch update from {{company_name}}.',
    },
  },

  {
    id: 'creator-digest-weekly-drop',
    renderKey: 'inside-insights-monthly-marketing-roundup',
    name: 'Creator Digest - Weekly Drop',
    tagline: 'Clean content newsletter for creators, communities, and media brands',
    description: 'A fast-moving editorial digest built for weekly drops, curated links, audience notes, and community highlights without feeling crowded.',
    category: 'Newsletter',
    type: 'marketing',
    layout: 'editorial',
    subject: 'Your weekly drop from {{company_name}}',
    accent: '#7c2d12',
    mood: 'Creator newsroom',
    previewImage: remoteImages.marketingDesk,
    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],
    tags: ['newsletter', 'creator', 'weekly digest'],
    metrics: { industry: 'Media / Creator', useCase: 'Weekly digest', layout: 'Editorial roundup + feature card' },
    highlights: ['Weekly digest pacing', 'Creator-friendly tone', 'Flexible link roundup'],
    textContent: 'Your weekly drop from {{company_name}} is ready. Dive in: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',
    build: {
      eyebrow: 'Weekly Drop',
      heroTitle: 'A weekly digest built to feel curated, current, and worth opening',
      heroCopy: 'Perfect for audience updates, creator newsletters, and editorial link roundups that need a premium frame without slowing the team down.',
      cta: 'Open this week\'s drop',
      accent: '#7c2d12',
      accentSoft: '#fcebdd',
      cardBackground: '#fff5ed',
      previewImage: remoteImages.marketingDesk,
      contentImage: remoteImages.phoneApps,
      sectionTitles: ['Featured story', 'Top links', 'Community note'],
      sectionBodies: ['Open with your strongest piece or headline takeaway.', 'Use the second panel for a compact roundup of must-see links.', 'End with a human note that keeps the newsletter feeling personal.'],
      stats: ['Built for weekly sends', 'Digest-friendly rhythm', 'Great for creator brands'],
      quote: 'The best weekly newsletters feel hand-picked, not auto-filled.',
      footerNote: 'This weekly digest was sent by {{company_name}}.',
    },
  },

  {
    id: 'onboarding-check-in-pulse',
    renderKey: 'your-voice-matters',
    name: 'Onboarding Check-In Pulse',
    tagline: 'Customer onboarding feedback request with a calm SaaS tone',
    description: 'A short and thoughtful feedback email for capturing onboarding friction, activation sentiment, and first impressions while the experience is still fresh.',
    category: 'Survey',
    type: 'automation',
    layout: 'survey',
    subject: '{{first_name}}, how is onboarding going so far?',
    accent: '#0369a1',
    mood: 'Calm onboarding pulse',
    previewImage: remoteImages.phoneApps,
    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],
    tags: ['onboarding', 'feedback', 'survey'],
    metrics: { industry: 'SaaS', useCase: 'Onboarding pulse', layout: 'Survey invite + trust cards' },
    highlights: ['Activation feedback', 'Support-friendly framing', 'Short survey CTA'],
    textContent: 'How is onboarding going so far? Share your feedback here: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',
    build: {
      eyebrow: 'Onboarding Pulse',
      heroTitle: 'Catch onboarding friction before it becomes churn',
      heroCopy: 'This template helps customer success and product teams gather quick, honest feedback during the first days of setup, when improvement opportunities are most visible.',
      cta: 'Answer the quick check-in',
      accent: '#0369a1',
      accentSoft: '#dff2ff',
      cardBackground: '#edf8ff',
      previewImage: remoteImages.phoneApps,
      contentImage: remoteImages.phoneApps,
      sectionTitles: ['What felt smooth', 'What felt unclear', 'What we improve'],
      sectionBodies: ['Ask one or two simple questions that encourage honest replies.', 'Show readers you specifically want friction points, not just praise.', 'Reinforce that their answers directly shape onboarding improvements.'],
      stats: ['Great after week one', 'CS-friendly workflow', 'Built for activation'],
      quote: 'Feedback lands better when customers can tell it will change something real.',
      footerNote: 'Thank you for helping {{company_name}} improve onboarding.',
    },
  },

  {
    id: 'customer-story-spotlight',
    renderKey: 'voices-that-shape-us',
    name: 'Customer Story Spotlight',
    tagline: 'Case-study style email that blends social proof with a strong CTA',
    description: 'A customer-story template for spotlighting wins, testimonials, and measurable outcomes while still driving readers to the full story or demo.',
    category: 'Customer Story',
    type: 'marketing',
    layout: 'survey',
    subject: 'See how customers are growing with {{company_name}}',
    accent: '#4338ca',
    mood: 'Confident proof-driven story',
    previewImage: remoteImages.phoneApps,
    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],
    tags: ['customer story', 'testimonial', 'case study'],
    metrics: { industry: 'SaaS', useCase: 'Case study promotion', layout: 'Story panel + proof blocks' },
    highlights: ['Social-proof led', 'Case-study structure', 'Demo-friendly CTA'],
    textContent: 'See how customers are growing with {{company_name}}: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',
    build: {
      eyebrow: 'Customer Story',
      heroTitle: 'Turn one strong success story into a compelling campaign',
      heroCopy: 'Use this layout to feature customer wins, pull in proof points, and connect outcomes back to the action you want the next reader to take.',
      cta: 'Read the full story',
      accent: '#4338ca',
      accentSoft: '#e8e7ff',
      cardBackground: '#f1f0ff',
      previewImage: remoteImages.phoneApps,
      contentImage: remoteImages.marketingDesk,
      sectionTitles: ['The challenge', 'The outcome', 'What to do next'],
      sectionBodies: ['Frame the before-state in a way your audience instantly recognizes.', 'Highlight the specific win, metric, or transformation that proves value.', 'Invite readers to book a demo, read the case study, or explore the feature.'],
      stats: ['Proof-first layout', 'Perfect for case studies', 'Easy CTA handoff'],
      quote: 'Customer proof works hardest when it still feels like a story, not a sales slide.',
      footerNote: 'This customer spotlight was sent by {{company_name}}.',
    },
  },

  {
    id: 'account-activation-reminder',
    renderKey: 'just-one-last-step',
    name: 'Account Activation Reminder',
    tagline: 'Minimal account activation follow-up with one clear action',
    description: 'A simple and modern reminder email for unfinished account activation, built to be unmistakable, low-friction, and safe-looking.',
    category: 'Confirmation',
    type: 'transactional',
    layout: 'confirmation',
    subject: 'Finish activating your {{company_name}} account',
    accent: '#0f172a',
    mood: 'Secure activation reminder',
    previewImage: remoteImages.phoneApps,
    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],
    tags: ['activation', 'confirmation', 'reminder'],
    metrics: { industry: 'SaaS', useCase: 'Activation reminder', layout: 'Minimal reminder + single CTA' },
    highlights: ['Security-forward tone', 'Single CTA focus', 'Ideal for retries'],
    textContent: 'Finish activating your account here: {{cta_url}}. If this was not you, ignore this email.',
    build: {
      eyebrow: 'Activation Reminder',
      heroTitle: 'Your account is almost ready',
      heroCopy: 'Send this follow-up when someone started but did not finish activation. The message stays tight, clear, and reassuring so the path back feels easy.',
      cta: 'Activate account',
      accent: '#0f172a',
      accentSoft: '#e8edf5',
      cardBackground: '#f3f6fb',
      previewImage: remoteImages.phoneApps,
      contentImage: remoteImages.phoneApps,
      sectionTitles: ['Finish setup', 'Stay secure', 'Get started faster'],
      sectionBodies: ['Remind readers activation only takes a moment.', 'Reinforce that confirmation protects their access and settings.', 'Tell them exactly what opens up once the account is active.'],
      stats: ['Retry-friendly', 'Built for activation', 'Security reassurance'],
      quote: 'Reminder emails work best when they feel helpful, not pushy.',
      footerNote: 'If you did not start an account with {{company_name}}, you can safely ignore this message.',
    },
  },

  {
    id: 'cyber-monday-tech-flash',
    renderKey: 'black-friday-watch-sale',
    name: 'Cyber Monday Tech Flash',
    tagline: 'Dark-mode sale email for electronics, accessories, and flash offers',
    description: 'A sharper, high-contrast promotional template for Cyber Monday or limited-time tech deals that need urgency without visual chaos.',
    category: 'Black Friday',
    type: 'marketing',
    layout: 'promotion',
    subject: 'Cyber Monday deals are live at {{company_name}}',
    accent: '#22c55e',
    mood: 'High-contrast tech sale',
    previewImage: remoteImages.phoneApps,
    variables: ['first_name', 'company_name', 'discount_code', 'cta_url', 'unsubscribe_url', 'company_address'],
    tags: ['cyber monday', 'flash sale', 'tech'],
    metrics: { industry: 'Electronics', useCase: 'Cyber Monday sale', layout: 'Dark hero + offer cards' },
    highlights: ['Dark sale treatment', 'Tech-friendly visual tone', 'Strong urgency blocks'],
    textContent: 'Cyber Monday deals are live. Shop now: {{cta_url}}. Code: {{discount_code}}. Unsubscribe: {{unsubscribe_url}}',
    build: {
      eyebrow: 'Cyber Monday',
      heroTitle: 'A fast, dark sale layout for serious deal-driven campaigns',
      heroCopy: 'Ideal for electronics, accessories, software, or gadget bundles where urgency matters but the design still needs to feel premium and controlled.',
      cta: 'Unlock the deals',
      accent: '#22c55e',
      accentSoft: '#dcfce7',
      cardBackground: '#eefcf1',
      previewImage: remoteImages.phoneApps,
      contentImage: remoteImages.phoneApps,
      sectionTitles: ['Flash deal', 'Best-value bundle', 'Offer ends tonight'],
      sectionBodies: ['Lead with your strongest discount or best-known item.', 'Use the middle card for a high-conversion bundle or add-on stack.', 'Finish with a sharp deadline so the click feels urgent.'],
      stats: ['Cyber Monday ready', 'Great for tech brands', 'Urgency-first structure'],
      quote: 'The best sale emails feel expensive even when they are shouting about discounts.',
      footerNote: 'Cyber Monday pricing from {{company_name}} is available for a limited time.',
    },
  },

  {
    id: 'webinar-countdown-invite',
    renderKey: 'spooktacular-offers',
    name: 'Webinar Countdown Invite',
    tagline: 'High-energy event registration email with a bright CTA path',
    description: 'A registration-driven email for webinars, demos, and live sessions that needs movement, contrast, and obvious next steps.',
    category: 'Event',
    type: 'marketing',
    layout: 'seasonal',
    subject: 'Save your seat for our next live session',
    accent: '#7c3aed',
    mood: 'Energetic event invite',
    previewImage: remoteImages.marketingDesk,
    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],
    tags: ['webinar', 'event', 'registration'],
    metrics: { industry: 'SaaS / Education', useCase: 'Webinar registration', layout: 'Hero + event detail blocks' },
    highlights: ['Event-ready CTA', 'Bright registration pacing', 'Flexible speaker/session cards'],
    textContent: 'Save your seat for our next live session: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',
    build: {
      eyebrow: 'Live Webinar',
      heroTitle: 'A registration email designed to build momentum fast',
      heroCopy: 'Use this layout for webinars, panel events, demos, and launch sessions where you want the value proposition and CTA visible immediately.',
      cta: 'Reserve your seat',
      accent: '#7c3aed',
      accentSoft: '#efe6ff',
      cardBackground: '#f6f0ff',
      previewImage: remoteImages.marketingDesk,
      contentImage: remoteImages.marketingDesk,
      sectionTitles: ['What you will learn', 'Who is speaking', 'When to join'],
      sectionBodies: ['Open with the outcome readers care about most.', 'Use the middle block for speaker credibility or session format.', 'Close with timing, attendance perks, or replay details.'],
      stats: ['Registration-focused', 'Built for live events', 'Strong CTA visibility'],
      quote: 'Event emails win when the next step is obvious and the value is immediate.',
      footerNote: 'This event invitation was sent by {{company_name}}.',
    },
  },

  {
    id: 'holiday-escape-weekend',
    renderKey: 'thanksgiving-staycation-email',
    name: 'Holiday Escape Weekend',
    tagline: 'Hospitality and experience-led promotional email with booking warmth',
    description: 'A warm booking template for resorts, spas, venues, and destination experiences where the visual mood has to do half the selling.',
    category: 'Event',
    type: 'marketing',
    layout: 'seasonal',
    subject: 'Book your holiday escape with {{company_name}}',
    accent: '#92400e',
    mood: 'Warm getaway promotion',
    previewImage: remoteImages.thanksgivingTable,
    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],
    tags: ['travel', 'hospitality', 'booking'],
    metrics: { industry: 'Hospitality', useCase: 'Holiday booking campaign', layout: 'Warm hero + itinerary cards' },
    highlights: ['Hospitality warmth', 'Booking CTA focus', 'Experience-led structure'],
    textContent: 'Book your holiday escape with {{company_name}}: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',
    build: {
      eyebrow: 'Holiday Escape',
      heroTitle: 'Turn a booking email into a vivid invitation',
      heroCopy: 'Designed for hotels, retreats, and experience brands, this layout gives room for atmosphere, package details, and a polished call to reserve.',
      cta: 'Book the experience',
      accent: '#92400e',
      accentSoft: '#f9ead9',
      cardBackground: '#fcf3e8',
      previewImage: remoteImages.thanksgivingTable,
      contentImage: remoteImages.thanksgivingTable,
      sectionTitles: ['What is included', 'Why now', 'Reserve your dates'],
      sectionBodies: ['Show the package, room, or featured experience at a glance.', 'Use the second card for timing, seasonal value, or guest perks.', 'Close with availability urgency and the booking path.'],
      stats: ['Booking-friendly flow', 'Warm visual tone', 'Great for experiences'],
      quote: 'Hospitality campaigns convert when the email itself feels like part of the escape.',
      footerNote: 'Availability at {{company_name}} may change as dates fill.',
    },
  },

  {
    id: 'founder-thank-you-note',
    renderKey: 'the-season-of-gratitude',
    name: 'Founder Thank-You Note',
    tagline: 'Warm appreciation email for customers, communities, and supporters',
    description: 'A sincere thank-you template with editorial warmth, ideal for milestones, customer appreciation, and founder-led gratitude messages.',
    category: 'Thank You',
    type: 'marketing',
    layout: 'seasonal',
    subject: 'Thank you for building this with us',
    accent: '#b45309',
    mood: 'Human and appreciative',
    previewImage: remoteImages.marketingDesk,
    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],
    tags: ['thank you', 'founder note', 'community'],
    metrics: { industry: 'SaaS / Community', useCase: 'Appreciation note', layout: 'Warm editorial thank-you' },
    highlights: ['Founder-note warmth', 'Retention-friendly tone', 'Flexible gratitude CTA'],
    textContent: 'Thank you for being part of {{company_name}}. Read our note here: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',
    build: {
      eyebrow: 'Thank You',
      heroTitle: 'A gratitude email that feels personal enough to remember',
      heroCopy: 'Built for teams who want to slow down and speak like humans for a moment, whether that means thanking customers, donors, members, or early believers.',
      cta: 'Read the note',
      accent: '#b45309',
      accentSoft: '#fce9d6',
      cardBackground: '#fff6ed',
      previewImage: remoteImages.marketingDesk,
      contentImage: remoteImages.marketingDesk,
      sectionTitles: ['What you made possible', 'What we learned', 'Where we go next'],
      sectionBodies: ['Acknowledge the impact your audience has had clearly and directly.', 'Share one honest reflection or lesson from the recent chapter.', 'Invite readers into the next season with warmth, not pressure.'],
      stats: ['Gratitude-first framing', 'Great for retention', 'Founder/community fit'],
      quote: 'Appreciation emails work when they sound like people, not campaigns.',
      footerNote: 'Thank you for being part of {{company_name}}.',
    },
  },

  {
    id: 'year-together-anniversary-recap',
    renderKey: 'your-journey-in-review',
    name: 'Year Together Anniversary Recap',
    tagline: 'Celebratory customer-anniversary template with milestone framing',
    description: 'A retention-friendly recap template for anniversaries, membership milestones, and personalized progress highlights.',
    category: 'Annual Review',
    type: 'marketing',
    layout: 'review',
    subject: '{{first_name}}, look at what you built with {{company_name}}',
    accent: '#2563eb',
    mood: 'Celebratory milestone recap',
    previewImage: remoteImages.marketingDesk,
    variables: ['first_name', 'company_name', 'cta_url', 'unsubscribe_url', 'company_address'],
    tags: ['anniversary', 'milestone', 'retention'],
    metrics: { industry: 'SaaS / Membership', useCase: 'Anniversary recap', layout: 'Hero + milestone cards' },
    highlights: ['Personal milestone framing', 'Retention warmth', 'Upgrade-friendly recap'],
    textContent: 'Look at what you built with {{company_name}} this year: {{cta_url}}. Unsubscribe: {{unsubscribe_url}}',
    build: {
      eyebrow: 'Anniversary Recap',
      heroTitle: 'A milestone email that celebrates progress without feeling generic',
      heroCopy: 'Use this for customer anniversaries, annual membership recaps, or progress summaries that should feel personal, generous, and polished.',
      cta: 'See your highlights',
      accent: '#2563eb',
      accentSoft: '#e6f0ff',
      cardBackground: '#eff5ff',
      previewImage: remoteImages.marketingDesk,
      contentImage: remoteImages.phoneApps,
      sectionTitles: ['Best moment', 'Biggest habit', 'What is next'],
      sectionBodies: ['Highlight the one milestone that best captures the journey.', 'Use the second card for a behavior, usage trend, or progress pattern.', 'Invite readers into the next upgrade, feature, or chapter.'],
      stats: ['Anniversary-ready', 'Personalized recap feel', 'Retention-oriented'],
      quote: 'Milestone emails matter when they help customers see their own progress.',
      footerNote: 'You are receiving this milestone recap from {{company_name}}.',
    },
  },

] as const



export const emailStarterTemplates: EmailStarterTemplate[] = starterConfigs.map((template) => ({

  id: template.id,

  name: template.name,

  tagline: template.tagline,

  description: template.description,

  category: template.category,

  type: template.type,

  layout: template.layout,

  subject: template.subject,

  accent: template.accent,

  mood: template.mood,

  previewImage: template.previewImage,

  variables: [...template.variables],

  tags: [...template.tags],

  metrics: { ...template.metrics },

  highlights: [...template.highlights],

  htmlContent: buildTemplateHtml((template.renderKey || template.id) as TemplateRenderKey, { ...template.build, layout: template.layout }),

  textContent: template.textContent,

}))



export const starterTemplateCategories = [

  'All',

  ...Array.from(new Set(emailStarterTemplates.map((template) => template.category))),

]

