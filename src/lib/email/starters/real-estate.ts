import type { StarterBody, StarterTemplateLayout, StarterTemplateType } from './index'

/**
 * The ten letters an estate agency writes, in English and French.
 *
 * Written as text, not as layout: a property email earns its reply by saying
 * what the property is and what happens next, and anything an agent cannot edit
 * in thirty seconds goes out unedited or not at all. Each one is a few
 * paragraphs and, where it helps, a short list of facts.
 *
 * Square brackets mark what no token can fill — a viewing time, a date — so it
 * is obvious at a glance what still needs a human. Tokens come from
 * src/lib/email/tokens.ts and are filled in at send time.
 */

export type StarterLocale = 'en' | 'fr'

export interface StarterContent {
  name: string
  tagline: string
  description: string
  category: string
  subject: string
  mood: string
  metrics: { industry: string; useCase: string; layout: string }
  highlights: string[]
  body: StarterBody
}

export interface StarterSource {
  id: string
  type: StarterTemplateType
  layout: StarterTemplateLayout
  accent: string
  tags: string[]
  variables: string[]
  content: Record<StarterLocale, StarterContent>
}

// Shared chrome for the gallery cards, so ten templates do not repeat it.
const EN = { industry: 'Real estate', layoutText: 'Plain letter', mood: 'Personal' }
const FR = { industry: 'Immobilier', layoutText: 'Lettre simple', mood: 'Personnel' }
const CAT = {
  listings: { en: 'Listings', fr: 'Annonces' },
  viewings: { en: 'Viewings', fr: 'Visites' },
  buyers: { en: 'Buyers', fr: 'Acquéreurs' },
  vendors: { en: 'Vendors', fr: 'Vendeurs' },
}

export const REAL_ESTATE_STARTERS: StarterSource[] = [
  {
    id: 're-new-listing',
    type: 'marketing',
    layout: 'promotion',
    accent: '#1d4ed8',
    tags: ['listing', 'new', 'buyers'],
    variables: ['first_name', 'property_title', 'property_city', 'property_type', 'property_price', 'property_bedrooms', 'property_surface', 'company_name', 'unsubscribe_url'],
    content: {
      en: {
        name: 'New listing on the market',
        tagline: 'Announce a property to the buyers waiting for it',
        description: 'Sent the day a property goes live, to the buyers whose search it matches. Leads with what it is and what it costs, because that is what decides whether they read on.',
        category: CAT.listings.en,
        subject: 'New in {{property_city}}: {{property_title}}',
        mood: EN.mood,
        metrics: { industry: EN.industry, useCase: 'New listing', layout: EN.layoutText },
        highlights: ['Opens with the property, not the agency', 'The five facts a buyer decides on', 'Ends with one clear next step'],
        body: [
          'Hello {{first_name}},',
          'We have just listed {{property_title}} in {{property_city}}, and it looks close to what you are looking for.',
          { list: ['{{property_type}}, {{property_bedrooms}} bedrooms', '{{property_surface}} m²', '{{property_price}}'] },
          'I can send you the full file with photos and the floor plan, or arrange a viewing this week. Just reply to this email and tell me which suits you.',
          '{{company_name}}',
        ],
      },
      fr: {
        name: 'Nouveau bien en ligne',
        tagline: 'Annoncer un bien aux acquéreurs qui l’attendent',
        description: 'Envoyé le jour de la mise en ligne, aux acquéreurs dont la recherche correspond. Commence par le bien et son prix, car c’est ce qui décide de la suite de la lecture.',
        category: CAT.listings.fr,
        subject: 'Nouveauté à {{property_city}} : {{property_title}}',
        mood: FR.mood,
        metrics: { industry: FR.industry, useCase: 'Nouveau bien', layout: FR.layoutText },
        highlights: ['Commence par le bien, pas par l’agence', 'Les cinq informations qui décident', 'Une seule action à la fin'],
        body: [
          'Bonjour {{first_name}},',
          'Nous venons de mettre en ligne {{property_title}} à {{property_city}}, et il correspond de près à votre recherche.',
          { list: ['{{property_type}}, {{property_bedrooms}} chambres', '{{property_surface}} m²', '{{property_price}}'] },
          'Je peux vous envoyer le dossier complet avec les photos et le plan, ou organiser une visite cette semaine. Répondez simplement à cet e-mail en me disant ce qui vous convient.',
          '{{company_name}}',
        ],
      },
    },
  },

  {
    id: 're-price-drop',
    type: 'marketing',
    layout: 'promotion',
    accent: '#b91c1c',
    tags: ['price', 'listing', 'buyers'],
    variables: ['first_name', 'property_title', 'property_reference', 'property_price', 'company_name', 'unsubscribe_url'],
    content: {
      en: {
        name: 'Price reduced',
        tagline: 'Tell the buyers who passed on it at the old price',
        description: 'A price change is the one reason to write again about a property someone has already seen. Short, factual, no persuasion.',
        category: CAT.listings.en,
        subject: 'Price reduced: {{property_title}}',
        mood: EN.mood,
        metrics: { industry: EN.industry, useCase: 'Price change', layout: EN.layoutText },
        highlights: ['The new price in the first line', 'No pressure, no countdown', 'Reference included for their records'],
        body: [
          'Hello {{first_name}},',
          'The price of {{property_title}} ({{property_reference}}) has been reduced to {{property_price}}.',
          'You looked at this one when it was first listed, so I thought you would want to know before it is viewed again this week.',
          'If you would like a second viewing, reply to this email and I will arrange it.',
          '{{company_name}}',
        ],
      },
      fr: {
        name: 'Baisse de prix',
        tagline: 'Prévenir ceux qui avaient renoncé à l’ancien prix',
        description: 'Un changement de prix est la seule bonne raison de réécrire au sujet d’un bien déjà vu. Court, factuel, sans argumentaire.',
        category: CAT.listings.fr,
        subject: 'Baisse de prix : {{property_title}}',
        mood: FR.mood,
        metrics: { industry: FR.industry, useCase: 'Changement de prix', layout: FR.layoutText },
        highlights: ['Le nouveau prix dès la première ligne', 'Sans pression ni compte à rebours', 'La référence pour mémoire'],
        body: [
          'Bonjour {{first_name}},',
          'Le prix de {{property_title}} ({{property_reference}}) vient de passer à {{property_price}}.',
          'Vous aviez regardé ce bien à sa mise en ligne : je préfère vous prévenir avant les visites de cette semaine.',
          'Si vous souhaitez le revoir, répondez à cet e-mail et j’organise la visite.',
          '{{company_name}}',
        ],
      },
    },
  },

  {
    id: 're-matching-properties',
    type: 'automation',
    layout: 'editorial',
    accent: '#0f766e',
    tags: ['matching', 'buyers', 'search'],
    variables: ['first_name', 'property_title', 'property_city', 'property_price', 'company_name', 'unsubscribe_url'],
    content: {
      en: {
        name: 'Properties matching your search',
        tagline: 'The regular note to a registered buyer',
        description: 'For a buyer whose brief you hold: what has come in since you last wrote. Works as an automation step.',
        category: CAT.buyers.en,
        subject: 'A property matching your search in {{property_city}}',
        mood: EN.mood,
        metrics: { industry: EN.industry, useCase: 'Buyer matching', layout: EN.layoutText },
        highlights: ['Written as one agent to one buyer', 'Says why it was sent', 'Invites a correction to the brief'],
        body: [
          'Hello {{first_name}},',
          'Something has come in that fits what you described: {{property_title}} in {{property_city}}, at {{property_price}}.',
          'Tell me if you would like to see it, and I will hold a slot. If it is wide of the mark, say so and I will narrow what I send you.',
          '{{company_name}}',
        ],
      },
      fr: {
        name: 'Des biens pour votre recherche',
        tagline: 'Le point régulier à un acquéreur inscrit',
        description: 'Pour un acquéreur dont vous avez le brief : ce qui est arrivé depuis votre dernier message. Convient comme étape d’automatisation.',
        category: CAT.buyers.fr,
        subject: 'Un bien pour votre recherche à {{property_city}}',
        mood: FR.mood,
        metrics: { industry: FR.industry, useCase: 'Mise en relation', layout: FR.layoutText },
        highlights: ['Écrit d’un agent à un acquéreur', 'Dit pourquoi il est envoyé', 'Invite à corriger le brief'],
        body: [
          'Bonjour {{first_name}},',
          'Un bien vient d’arriver et correspond à ce que vous cherchez : {{property_title}} à {{property_city}}, à {{property_price}}.',
          'Dites-moi si vous voulez le visiter, je vous réserve un créneau. Si ce n’est pas du tout cela, dites-le moi aussi : j’affinerai ce que je vous envoie.',
          '{{company_name}}',
        ],
      },
    },
  },

  {
    id: 're-viewing-confirmed',
    type: 'transactional',
    layout: 'confirmation',
    accent: '#15803d',
    tags: ['viewing', 'confirmation'],
    variables: ['first_name', 'property_title', 'property_city', 'property_reference', 'company_name', 'unsubscribe_url'],
    content: {
      en: {
        name: 'Viewing confirmed',
        tagline: 'Everything they need to turn up at the right door',
        description: 'Sent straight after a viewing is booked. The address, the time and who will be there — the three things people email back to ask.',
        category: CAT.viewings.en,
        subject: 'Your viewing is confirmed: {{property_title}}',
        mood: EN.mood,
        metrics: { industry: EN.industry, useCase: 'Viewing booked', layout: EN.layoutText },
        highlights: ['Time and address together', 'Names the agent meeting them', 'Says how to change it'],
        body: [
          'Hello {{first_name}},',
          'Your viewing of {{property_title}} in {{property_city}} is confirmed.',
          { list: ['When: [date and time]', 'Where: [meeting point]', 'With: [agent name], reachable on [phone]'] },
          'Reference {{property_reference}}, in case you need it. If something comes up, reply to this email and we will find another slot.',
          '{{company_name}}',
        ],
      },
      fr: {
        name: 'Visite confirmée',
        tagline: 'Tout ce qu’il faut pour se présenter au bon endroit',
        description: 'Envoyé juste après la prise de rendez-vous. L’adresse, l’heure et la personne présente : les trois questions qu’on vous repose par e-mail.',
        category: CAT.viewings.fr,
        subject: 'Votre visite est confirmée : {{property_title}}',
        mood: FR.mood,
        metrics: { industry: FR.industry, useCase: 'Visite programmée', layout: FR.layoutText },
        highlights: ['L’heure et l’adresse ensemble', 'Le nom de l’agent présent', 'Comment décaler le rendez-vous'],
        body: [
          'Bonjour {{first_name}},',
          'Votre visite de {{property_title}} à {{property_city}} est confirmée.',
          { list: ['Quand : [date et heure]', 'Où : [point de rendez-vous]', 'Avec : [nom de l’agent], joignable au [téléphone]'] },
          'Référence {{property_reference}}, si besoin. En cas d’empêchement, répondez à cet e-mail et nous trouverons un autre créneau.',
          '{{company_name}}',
        ],
      },
    },
  },

  {
    id: 're-viewing-reminder',
    type: 'automation',
    layout: 'confirmation',
    accent: '#a16207',
    tags: ['viewing', 'reminder'],
    variables: ['first_name', 'property_title', 'property_city', 'company_name', 'unsubscribe_url'],
    content: {
      en: {
        name: 'Viewing reminder',
        tagline: 'The day before, so the slot is not wasted',
        description: 'A one-paragraph reminder the day before a viewing, with the one question that prevents a wasted trip: are you still coming?',
        category: CAT.viewings.en,
        subject: 'Tomorrow: your viewing in {{property_city}}',
        mood: EN.mood,
        metrics: { industry: EN.industry, useCase: 'Viewing reminder', layout: EN.layoutText },
        highlights: ['Short enough to read on a phone', 'Asks for a yes or a no', 'Repeats the meeting point'],
        body: [
          'Hello {{first_name}},',
          'A quick reminder that we are seeing {{property_title}} tomorrow at [time], meeting at [meeting point].',
          'If anything has changed, just reply and we will move it — no trouble at all.',
          '{{company_name}}',
        ],
      },
      fr: {
        name: 'Rappel de visite',
        tagline: 'La veille, pour ne pas perdre le créneau',
        description: 'Un rappel d’un paragraphe la veille de la visite, avec la seule question qui évite un déplacement inutile : venez-vous toujours ?',
        category: CAT.viewings.fr,
        subject: 'Demain : votre visite à {{property_city}}',
        mood: FR.mood,
        metrics: { industry: FR.industry, useCase: 'Rappel de visite', layout: FR.layoutText },
        highlights: ['Assez court pour être lu sur un téléphone', 'Demande un oui ou un non', 'Rappelle le point de rendez-vous'],
        body: [
          'Bonjour {{first_name}},',
          'Petit rappel : nous visitons {{property_title}} demain à [heure], rendez-vous à [point de rendez-vous].',
          'Si quelque chose a changé, répondez-moi et nous décalons — sans aucun problème.',
          '{{company_name}}',
        ],
      },
    },
  },

  {
    id: 're-offer-update',
    type: 'transactional',
    layout: 'confirmation',
    accent: '#6d28d9',
    tags: ['offer', 'negotiation'],
    variables: ['first_name', 'property_title', 'asking_price', 'interest_stage', 'company_name', 'unsubscribe_url'],
    content: {
      en: {
        name: 'Offer update',
        tagline: 'Where the offer stands, in plain words',
        description: 'The email people chase you for. Says what has happened, what it means and when they will hear next.',
        category: CAT.buyers.en,
        subject: 'Update on your offer: {{property_title}}',
        mood: EN.mood,
        metrics: { industry: EN.industry, useCase: 'Offer progress', layout: EN.layoutText },
        highlights: ['States the position first', 'No jargon about the process', 'Commits to a next date'],
        body: [
          'Hello {{first_name}},',
          'An update on {{property_title}}: your offer is now at the [stage] stage, against an asking price of {{asking_price}}.',
          '[One or two sentences on what has actually happened, and what it means for them.]',
          'I will come back to you by [date] either way. If you would rather talk it through, call me on [phone].',
          '{{company_name}}',
        ],
      },
      fr: {
        name: 'Suivi de votre offre',
        tagline: 'Où en est l’offre, en termes clairs',
        description: 'L’e-mail qu’on vous réclame. Il dit ce qui s’est passé, ce que cela implique et quand la suite arrivera.',
        category: CAT.buyers.fr,
        subject: 'Suivi de votre offre : {{property_title}}',
        mood: FR.mood,
        metrics: { industry: FR.industry, useCase: 'Avancement de l’offre', layout: FR.layoutText },
        highlights: ['La situation d’abord', 'Sans jargon de procédure', 'S’engage sur une date'],
        body: [
          'Bonjour {{first_name}},',
          'Un point sur {{property_title}} : votre offre est à l’étape [étape], face à un prix demandé de {{asking_price}}.',
          '[Une ou deux phrases sur ce qui s’est réellement passé et ce que cela implique pour eux.]',
          'Je reviens vers vous d’ici [date], quoi qu’il arrive. Si vous préférez en parler, appelez-moi au [téléphone].',
          '{{company_name}}',
        ],
      },
    },
  },

  {
    id: 're-open-house',
    type: 'marketing',
    layout: 'promotion',
    accent: '#c2410c',
    tags: ['open house', 'event', 'listing'],
    variables: ['first_name', 'property_title', 'property_city', 'property_district', 'company_name', 'unsubscribe_url'],
    content: {
      en: {
        name: 'Open house invitation',
        tagline: 'An hour, an address, no appointment needed',
        description: 'For the buyers in one area: come when you like between these hours. Lower commitment than a viewing, which is the point.',
        category: CAT.viewings.en,
        subject: 'Open house in {{property_district}} this [day]',
        mood: EN.mood,
        metrics: { industry: EN.industry, useCase: 'Open house', layout: EN.layoutText },
        highlights: ['The hours stand out', 'No appointment to make', 'Says who else will be there'],
        body: [
          'Hello {{first_name}},',
          'We are opening {{property_title}} in {{property_district}}, {{property_city}}, on [day] from [start] to [end]. No appointment — come when it suits you.',
          'I will be there the whole time, with the file, the plans and the charges. If you cannot make it, reply and I will arrange a private viewing.',
          '{{company_name}}',
        ],
      },
      fr: {
        name: 'Invitation à une porte ouverte',
        tagline: 'Une plage horaire, une adresse, sans rendez-vous',
        description: 'Pour les acquéreurs d’un secteur : venez quand vous voulez entre telle et telle heure. Moins engageant qu’une visite, et c’est le but.',
        category: CAT.viewings.fr,
        subject: 'Porte ouverte à {{property_district}} [jour]',
        mood: FR.mood,
        metrics: { industry: FR.industry, useCase: 'Porte ouverte', layout: FR.layoutText },
        highlights: ['Les horaires bien visibles', 'Aucun rendez-vous à prendre', 'Dit qui sera présent'],
        body: [
          'Bonjour {{first_name}},',
          'Nous ouvrons {{property_title}} à {{property_district}}, {{property_city}}, [jour] de [début] à [fin]. Sans rendez-vous : venez quand cela vous arrange.',
          'Je serai présent tout du long, avec le dossier, les plans et les charges. Si vous ne pouvez pas venir, répondez-moi et j’organise une visite privée.',
          '{{company_name}}',
        ],
      },
    },
  },

  {
    id: 're-vendor-report',
    type: 'automation',
    layout: 'editorial',
    accent: '#334155',
    tags: ['vendor', 'report', 'mandate'],
    variables: ['first_name', 'property_title', 'property_reference', 'mandate_reference', 'company_name', 'unsubscribe_url'],
    content: {
      en: {
        name: 'Vendor progress report',
        tagline: 'What happened to their property this month',
        description: 'The report that keeps a vendor from ringing every Friday: views, viewings, feedback, and what you are doing next.',
        category: CAT.vendors.en,
        subject: 'Your monthly report: {{property_title}}',
        mood: EN.mood,
        metrics: { industry: EN.industry, useCase: 'Vendor reporting', layout: EN.layoutText },
        highlights: ['Numbers before commentary', 'Honest about weak interest', 'Ends with the next action'],
        body: [
          'Hello {{first_name}},',
          'Here is this month on {{property_title}} ({{property_reference}}), under mandate {{mandate_reference}}.',
          { list: ['Enquiries: [number]', 'Viewings: [number]', 'Offers: [number]'] },
          '[What the feedback has in common, in one or two sentences — including when it is not what you both hoped.]',
          'Next month I will [what you are changing or continuing]. Call me on [phone] if you would like to discuss the price.',
          '{{company_name}}',
        ],
      },
      fr: {
        name: 'Compte rendu au vendeur',
        tagline: 'Ce qui s’est passé sur son bien ce mois-ci',
        description: 'Le compte rendu qui évite l’appel du vendredi : contacts, visites, retours, et ce que vous faites ensuite.',
        category: CAT.vendors.fr,
        subject: 'Votre compte rendu mensuel : {{property_title}}',
        mood: FR.mood,
        metrics: { industry: FR.industry, useCase: 'Suivi vendeur', layout: FR.layoutText },
        highlights: ['Les chiffres avant les commentaires', 'Honnête quand l’intérêt est faible', 'Se termine par l’action suivante'],
        body: [
          'Bonjour {{first_name}},',
          'Voici le mois écoulé pour {{property_title}} ({{property_reference}}), sous le mandat {{mandate_reference}}.',
          { list: ['Demandes : [nombre]', 'Visites : [nombre]', 'Offres : [nombre]'] },
          '[Ce que les retours ont en commun, en une ou deux phrases — y compris quand ce n’est pas ce que vous espériez.]',
          'Le mois prochain, je vais [ce que vous changez ou poursuivez]. Appelez-moi au [téléphone] si vous souhaitez parler du prix.',
          '{{company_name}}',
        ],
      },
    },
  },

  {
    id: 're-mandate-renewal',
    type: 'automation',
    layout: 'editorial',
    accent: '#0369a1',
    tags: ['mandate', 'vendor', 'renewal'],
    variables: ['first_name', 'property_title', 'mandate_reference', 'mandate_end_date', 'company_name', 'unsubscribe_url'],
    content: {
      en: {
        name: 'Mandate renewal',
        tagline: 'Raised before it expires, not after',
        description: 'Sent a few weeks before a mandate ends. Says the date plainly and asks for a decision, rather than letting it lapse in silence.',
        category: CAT.vendors.en,
        subject: 'Your mandate ends on {{mandate_end_date}}',
        mood: EN.mood,
        metrics: { industry: EN.industry, useCase: 'Mandate renewal', layout: EN.layoutText },
        highlights: ['The date in the subject line', 'Reviews the period honestly', 'Asks for a decision'],
        body: [
          'Hello {{first_name}},',
          'Mandate {{mandate_reference}} for {{property_title}} ends on {{mandate_end_date}}.',
          '[A short, honest review of the period: what worked, what did not, and what you would do differently.]',
          'If you would like to continue, I will send the renewal for signature. If you would rather we talked about the price or the approach first, call me on [phone].',
          '{{company_name}}',
        ],
      },
      fr: {
        name: 'Renouvellement de mandat',
        tagline: 'Abordé avant l’échéance, pas après',
        description: 'Envoyé quelques semaines avant la fin du mandat. Annonce la date clairement et demande une décision, plutôt que de le laisser expirer en silence.',
        category: CAT.vendors.fr,
        subject: 'Votre mandat se termine le {{mandate_end_date}}',
        mood: FR.mood,
        metrics: { industry: FR.industry, useCase: 'Renouvellement', layout: FR.layoutText },
        highlights: ['La date dans l’objet', 'Un bilan honnête de la période', 'Demande une décision'],
        body: [
          'Bonjour {{first_name}},',
          'Le mandat {{mandate_reference}} pour {{property_title}} se termine le {{mandate_end_date}}.',
          '[Un bilan court et honnête de la période : ce qui a fonctionné, ce qui n’a pas marché, ce que vous feriez autrement.]',
          'Si vous souhaitez poursuivre, je vous envoie le renouvellement à signer. Si vous préférez d’abord parler du prix ou de la stratégie, appelez-moi au [téléphone].',
          '{{company_name}}',
        ],
      },
    },
  },

  {
    id: 're-market-update',
    type: 'marketing',
    layout: 'editorial',
    accent: '#4d7c0f',
    tags: ['newsletter', 'market', 'monthly'],
    variables: ['first_name', 'property_city', 'company_name', 'unsubscribe_url'],
    content: {
      en: {
        name: 'Monthly market update',
        tagline: 'The local letter people stay subscribed to',
        description: 'One area, three numbers, one opinion. Sent to buyers and vendors alike — the one email that is worth reading when nobody is buying this month.',
        category: CAT.listings.en,
        subject: 'The {{property_city}} market this month',
        mood: EN.mood,
        metrics: { industry: EN.industry, useCase: 'Monthly newsletter', layout: EN.layoutText },
        highlights: ['About the area, not the agency', 'Three figures, not a report', 'An opinion worth disagreeing with'],
        body: [
          'Hello {{first_name}},',
          'A short note on {{property_city}} this month.',
          { list: ['Average asking price: [figure]', 'Time on the market: [figure]', 'New listings: [figure]'] },
          '[What you make of it, in two or three sentences. An opinion is what makes this worth opening; a table is not.]',
          'If you are weighing up a move, reply and tell me what you are thinking — I will give you a straight answer.',
          '{{company_name}}',
        ],
      },
      fr: {
        name: 'Le marché ce mois-ci',
        tagline: 'La lettre locale à laquelle on reste abonné',
        description: 'Un secteur, trois chiffres, un avis. Pour les acquéreurs comme pour les vendeurs — l’e-mail qui mérite d’être lu même le mois où personne n’achète.',
        category: CAT.listings.fr,
        subject: 'Le marché à {{property_city}} ce mois-ci',
        mood: FR.mood,
        metrics: { industry: FR.industry, useCase: 'Lettre mensuelle', layout: FR.layoutText },
        highlights: ['Parle du secteur, pas de l’agence', 'Trois chiffres, pas un rapport', 'Un avis qu’on peut contester'],
        body: [
          'Bonjour {{first_name}},',
          'Quelques mots sur {{property_city}} ce mois-ci.',
          { list: ['Prix moyen demandé : [chiffre]', 'Délai de vente : [chiffre]', 'Nouvelles annonces : [chiffre]'] },
          '[Ce que vous en retenez, en deux ou trois phrases. C’est l’avis qui donne envie d’ouvrir, pas le tableau.]',
          'Si vous hésitez à bouger, répondez-moi en me disant ce que vous envisagez — je vous répondrai franchement.',
          '{{company_name}}',
        ],
      },
    },
  },
]
