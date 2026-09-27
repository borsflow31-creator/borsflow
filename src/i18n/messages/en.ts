// English message catalog — foundation keys (app, common, nav, auth)
export interface Messages {
  app: {
    name: string;
    tagline: string;
  };
  common: {
    save: string;
    saving: string;
    cancel: string;
    confirm: string;
    delete: string;
    remove: string;
    edit: string;
    view: string;
    close: string;
    back: string;
    next: string;
    loading: string;
    search: string;
    filter: string;
    refresh: string;
    add: string;
    create: string;
    submit: string;
    update: string;
    yes: string;
    no: string;
    error: string;
    success: string;
    required: string;
    optional: string;
    none: string;
    all: string;
    noResults: string;
    comingSoon: string;
  };
  language: {
    select: string;
    en: string;
    fr: string;
    ar: string;
  };
  nav: {
    dashboard: string;
    calendar: string;
    clients: string;
    documents: string;
    invoices: string;
    quotes: string;
    tasks: string;
    laws: string;
    jurisprudence: string;
    caseAnalyzer: string;
    jorad: string;
    settings: string;
    logout: string;
  };
  auth: {
    login: string;
    logout: string;
    register: string;
    email: string;
    password: string;
    forgotPassword: string;
    rememberMe: string;
    noAccount: string;
    hasAccount: string;
    signInWith: string;
  };
}

const en: Messages = {
  app: {
    name: 'Qanoun Dz',
    tagline: 'Professional Legal Platform',
  },
  common: {
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    remove: 'Remove',
    edit: 'Edit',
    view: 'View',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    loading: 'Loading…',
    search: 'Search',
    filter: 'Filter',
    refresh: 'Refresh',
    add: 'Add',
    create: 'Create',
    submit: 'Submit',
    update: 'Update',
    yes: 'Yes',
    no: 'No',
    error: 'An error occurred',
    success: 'Success',
    required: 'Required',
    optional: 'Optional',
    none: 'None',
    all: 'All',
    noResults: 'No results found',
    comingSoon: 'Coming soon',
  },
  language: {
    select: 'Select language',
    en: 'English',
    fr: 'French',
    ar: 'Arabic',
  },
  nav: {
    dashboard: 'Dashboard',
    calendar: 'Calendar',
    clients: 'Clients',
    documents: 'Documents',
    invoices: 'Invoices',
    quotes: 'Quotes',
    tasks: 'Tasks',
    laws: 'Laws',
    jurisprudence: 'Jurisprudence',
    caseAnalyzer: 'Case Analyzer',
    jorad: 'JORAD',
    settings: 'Settings',
    logout: 'Log Out',
  },
  auth: {
    login: 'Sign In',
    logout: 'Sign Out',
    register: 'Create Account',
    email: 'Email',
    password: 'Password',
    forgotPassword: 'Forgot password?',
    rememberMe: 'Remember me',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    signInWith: 'Sign in with {provider}',
  },
};

export default en;
