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
    download: string;
    dismiss: string;
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
    unexpectedError: string;
    tryAgain: string;
    clearFilters: string;
    previous: string;
    errorRetry: string;
    or: string;
  };
  language: {
    select: string;
    en: string;
    fr: string;
    es: string;
    de: string;
    ar: string;
  };
  nav: {
    dashboard: string;
    invoices: string;
    quotes: string;
    settings: string;
    logout: string;
    crm: string;
    kanban: string;
    products: string;
    pages: string;
    groupGeneral: string;
    home: string;
    chat: string;
    groupBusiness: string;
    meetings: string;
    emailMarketing: string;
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
    signIn: string;
    nameRequired: string;
    passwordTooShort: string;
    passwordMismatch: string;
    name: string;
    createWorkspace: string;
    loginTitle: string;
    loginSubtitle: string;
    signingIn: string;
    continueWithGoogle: string;
    createOne: string;
    emailRequired: string;
    passwordRequired: string;
    registrationFailed: string;
    checkEmailTitle: string;
    checkEmailBody: string;
    takingYouToSignIn: string;
    registerTitle: string;
    registerSubtitle: string;
    passwordPlaceholder: string;
    passwordHint: string;
    confirmPassword: string;
    creatingWorkspace: string;
    signUpWithGoogle: string;
    verifyingEmail: string;
    noVerificationToken: string;
    emailVerifiedSuccess: string;
    verifyEmailFailed: string;
    verifying: string;
    verified: string;
    verificationFailed: string;
    redirectingToDashboard: string;
    takingYouToInvitation: string;
    backToLogin: string;
  };
  misc: {
    actionSend: string;
    moreOptions: string;
    statusLabel: string;
    statusDraft: string;
    statusSent: string;
    statusViewed: string;
    statusAccepted: string;
    statusRejected: string;
    statusExpired: string;
    saveChanges: string;
    sendQuote: string;
    downloadPdf: string;
    convertToInvoice: string;
    duplicateQuote: string;
    deleteQuote: string;
    updating: string;
    updatePassword: string;
    integrations: string;
    integrationsDesc: string;
    loadingIntegrations: string;
    calendar: string;
    videoConferencing: string;
    disconnect: string;
    watchVideo: string;
    unsubscribe: string;
    videoThumbnail: string;
    emailPreview: string;
    searchMeetings: string;
    listView: string;
    calendarView: string;
    refresh: string;
    syncFromCalcom: string;
    phoneNumber: string;
    locationLabel: string;
    meetingAgendaPlaceholder: string;
    crmContact: string;
    searchCrmContacts: string;
    firstNameRequired: string;
    lastName: string;
    emailLabel: string;
    companyLabel: string;
    phoneLabel: string;
    estimatedTotal: string;
    customTemplate: string;
    searchTemplates: string;
    yourCompany: string;
    companyAddress: string;
    itemDescription: string;
    rateLabel: string;
    amountLabel: string;
    subtotalLabel: string;
    totalLabel: string;
    billedTo: string;
    detailsLabel: string;
    unitPriceLabel: string;
    discountLabel: string;
    issueDateLabel: string;
    validUntilLabel: string;
    notesLabel: string;
    termsLabel: string;
    description: string;
    unsubscribeReason: string;
    brandName: string;
    meetingsNoWorkspace: string;
    demoName: string;
    aliceEditing: string;
    deliveredLive: string;
    switchLanguage: string;
    languageSelector: string;
    closeProductPicker: string;
    searchProducts: string;
    allPlatformsConnected: string;
    schedulingSetupComplete: string;
    templatePreview: string;
    amount: string;
  };
  crm: {
    files: {
      tab: string;
      dropPrompt: string;
      limits: string;
      empty: string;
      loadFailed: string;
      uploadFailed: string;
      tooLarge: string;
      preview: string;
      download: string;
      delete: string;
      deleteTitle: string;
      deleteBody: string;
      deleteFailed: string;
      unknownUser: string;
      countTitle: string;
    };
    timeline: {
      notePlaceholder: string;
      noteHint: string;
      addNote: string;
      noteFailed: string;
      deleteNote: string;
      loadFailed: string;
      loadMore: string;
      emptyHistory: string;
      filterAria: string;
      filterAll: string;
      filterNotes: string;
      filterActivity: string;
      filterFiles: string;
      filterSales: string;
      filterEmails: string;
      filterMeetings: string;
      someone: string;
      noteBy: string;
      created: string;
      createdByImport: string;
      source: string;
      stageChanged: string;
      updated: string;
      changed: string;
      empty: string;
      fileAdded: string;
      fileDeleted: string;
      quote: string;
      invoice: string;
      meeting: string;
      emailSent: string;
      emailOpened: string;
      emailNotOpened: string;
      emailBounced: string;
      lastActivity: string;
      fieldFirstName: string;
      fieldLastName: string;
      fieldEmail: string;
      fieldPhone: string;
      fieldCompany: string;
      fieldPosition: string;
      fieldStatus: string;
      fieldValue: string;
      fieldSource: string;
      fieldNotes: string;
      fieldTags: string;
    };
    page: {
      errors: {
        loadPipelinesFailed: string;
        loadPipelinesNetwork: string;
        loadListsFailed: string;
        createLeadFailed: string;
        createLeadNetwork: string;
        updateLeadFailed: string;
        changeNotSavedNetwork: string;
        deleteLeadFailed: string;
        deleteLeadNetwork: string;
        createPipelineFailed: string;
        createPipelineNetwork: string;
        updatePipelineFailed: string;
        deletePipelineFailed: string;
        deletePipelineNetwork: string;
        createListFailed: string;
        createListNetwork: string;
        updateListFailed: string;
        deleteListFailed: string;
        deleteListNetwork: string;
      };
      thisPipelineFallback: string;
      confirmDeletePipelineWithLeads: string;
      confirmDeletePipeline: string;
      workspaceFallback: string;
      selectPipelinePlaceholder: string;
      addPipelineAria: string;
      manageListsFull: string;
      manageListsShort: string;
      importButton: string;
      addLeadButton: string;
      noPipelineSelected: string;
      createFirstPipeline: string;
    };
    importModal: {
      fields: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        company: string;
        position: string;
        status: string;
        stage: string;
        value: string;
        source: string;
        notes: string;
        tags: string;
      };
      invalidFileType: string;
      excelNotice: string;
      minRowsError: string;
      noDataRowsError: string;
      readFileError: string;
      importFailed: string;
      networkError: string;
      title: string;
      pipelineLabel: string;
      stepUpload: string;
      stepMap: string;
      stepPreview: string;
      stepDone: string;
      dropZoneTitle: string;
      dropZoneSubtitle: string;
      expectedColumns: string;
      requiredNote: string;
      mapInstructions: string;
      colFileColumn: string;
      colSampleValue: string;
      colMapsTo: string;
      emptyValue: string;
      skipOption: string;
      mapRequiredError: string;
      previewInstructions: string;
      moreRows: string;
      importComplete: string;
      resultCreated: string;
      resultSkipped: string;
      stageCoercedNotice: string;
      errorsHeading: string;
      previewButton: string;
      importingButton: string;
      importButton: string;
    };
    leadListModal: {
      confirmDelete: string;
      title: string;
      createNewList: string;
      formTitleEdit: string;
      nameLabel: string;
      namePlaceholder: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      colorLabel: string;
      emptyState: string;
      leadsCount: string;
    };
    pipelineBoard: {
      confirmDeleteLead: string;
      deletePipelineTitle: string;
      deleteLeadAria: string;
      dropLeadsHere: string;
    };
    leadListView: {
      searchPlaceholder: string;
      filtersButton: string;
      resultsCount: string;
      fieldStatus: string;
      fieldStage: string;
      fieldSource: string;
      fieldTags: string;
      fieldName: string;
      fieldCompany: string;
      fieldEmail: string;
      fieldValue: string;
      fieldCreated: string;
      fieldActions: string;
      emptyFiltered: string;
      emptyState: string;
      actionsAria: string;
    };
    leadModal: {
      purchaseHistory: {
        empty: string;
        colType: string;
        colDocument: string;
        colStatus: string;
        colTotal: string;
        colDate: string;
        typeQuote: string;
        typeInvoice: string;
      };
      status: {
        new: string;
        contacted: string;
        qualified: string;
        proposal: string;
        negotiation: string;
        won: string;
        lost: string;
      };
      aiNoWorkspace: string;
      aiError: string;
      errors: {
        emailInvalid: string;
        phoneInvalid: string;
        firstNameRequired: string;
        firstNameTooLong: string;
        lastNameRequired: string;
        lastNameTooLong: string;
        companyTooLong: string;
        positionTooLong: string;
        valueInvalid: string;
        valueTooLarge: string;
        sourceTooLong: string;
        notesTooLong: string;
      };
      editTitle: string;
      createTitle: string;
      closeAria: string;
      tabDetails: string;
      tabMeetings: string;
      tabHistory: string;
      personalInfoHeading: string;
      firstNameLabel: string;
      lastNameLabel: string;
      emailLabel: string;
      phoneLabel: string;
      companyInfoHeading: string;
      companyLabel: string;
      positionLabel: string;
      pipelineInfoHeading: string;
      statusLabel: string;
      stageLabel: string;
      noPipelineSelected: string;
      selectStagePlaceholder: string;
      dealValueLabel: string;
      sourceLabel: string;
      sourcePlaceholder: string;
      tagsLabel: string;
      tagPlaceholder: string;
      removeTagAria: string;
      leadListsLabel: string;
      summarizeLeadButton: string;
      draftEmailButton: string;
      leadSummaryHeading: string;
      emailDraftHeading: string;
      copyToNotes: string;
      notesLabel: string;
      notesPlaceholder: string;
      notesCharCount: string;
      updateButton: string;
      createButton: string;
    };
    pipelineModal: {
      editTitle: string;
      minStageAlert: string;
      confirmRemoveStage: string;
      confirmRemoveStageWithLeads: string;
      createTitle: string;
      nameLabel: string;
      namePlaceholder: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      colorLabel: string;
      stagesLabel: string;
      addStagePlaceholder: string;
      addStageButton: string;
      stageNameAria: string;
      renamingFrom: string;
      moveUp: string;
      moveDown: string;
      removeStage: string;
      noStages: string;
      updateButton: string;
      createButton: string;
    };
    viewToggle: {
      kanbanAria: string;
      kanbanTitle: string;
      kanbanLabel: string;
      listAria: string;
      listTitle: string;
      listLabel: string;
    };
  };
  dashboard: {
    unknownWorkspace: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    greeting: string;
    greetingNoName: string;
    searchPlaceholder: string;
    quickCapturePlaceholder: string;
    recentlyUpdated: string;
    noRecentActivity: string;
    invoicesOverview: string;
    openFull: string;
    revenue: string;
    pending: string;
    overdue: string;
    totalInvoices: string;
    workspaces: string;
    noWorkspaces: string;
    createWorkspaceModalTitle: string;
    workspaceNamePlaceholder: string;
    workspaceDescriptionPlaceholder: string;
  };
  documentSender: {
    sender: {
      label: string;
      workspaceDetail: string;
      platformTitle: string;
      platformDetail: string;
      you: string;
    };
    history: {
      title: string;
      empty: string;
      loadFailed: string;
      sentTo: string;
      from: string;
      unknownMember: string;
    };
  };
  emailMarketing: {
    tabs: {
      campaigns: string;
      templates: string;
      automations: string;
      settings: string;
    };
    tokenGroups: {
      contact: string;
      property: string;
      deal: string;
      sender: string;
    };
    tokens: {
      first_name: string;
      last_name: string;
      full_name: string;
      name: string;
      email: string;
      phone: string;
      company: string;
      position: string;
      property_title: string;
      property_reference: string;
      property_city: string;
      property_district: string;
      property_type: string;
      property_price: string;
      property_bedrooms: string;
      property_surface: string;
      stage: string;
      status: string;
      source: string;
      value: string;
      pipeline_name: string;
      interest_stage: string;
      mandate_reference: string;
      asking_price: string;
      mandate_end_date: string;
      company_name: string;
      unsubscribe_url: string;
    };
    automationsTab: {
      saveFailed: string;
      toggleFailed: string;
      deleteConfirm: string;
      deleteFailed: string;
      noTrigger: string;
      triggerMovesFrom: string;
      triggerMoves: string;
      invalidTrigger: string;
      noSteps: string;
      oneEmail: string;
      emailsCount: string;
      allSentImmediately: string;
      overMinutes: string;
      overHours: string;
      overDays: string;
      heading: string;
      subtitle: string;
      statAutomations: string;
      statRunning: string;
      statLeadsInSequence: string;
      listHeading: string;
      createAutomation: string;
      loading: string;
      emptyTitle: string;
      emptySubtitle: string;
      activeCount: string;
      completedCount: string;
      pause: string;
      activate: string;
    };
    templatesTab: {
      saveFailed: string;
      deleteConfirm: string;
      deleteFailed: string;
      cloneFailed: string;
      cloneForEditFailed: string;
      heading: string;
      loading: string;
    };
    segmentsTab: {
      saveFailed: string;
      deleteConfirm: string;
      deleteFailed: string;
      heading: string;
      subtitle: string;
      statActiveSegments: string;
      statTotalLeads: string;
      statActiveRules: string;
      listHeading: string;
      createSegment: string;
      loading: string;
      emptyTitle: string;
      emptySubtitle: string;
      active: string;
      inactive: string;
      leadsCount: string;
    };
    providersTab: {
      loading: string;
      emptyTitle: string;
      emptySubtitle: string;
      testSent: string;
      testFailed: string;
      retryFailed: string;
      saveFailed: string;
      deleteConfirm: string;
      deleteFailed: string;
      trackingOn: string;
      trackingNotSetUp: string;
      settingUp: string;
      retry: string;
      setUpNow: string;
      heading: string;
      subtitle: string;
      default: string;
      active: string;
      inactive: string;
      from: string;
      dailyLimit: string;
      configure: string;
      test: string;
      addNew: string;
    };
    statusLabels: {
      draft: string;
      scheduled: string;
      sending: string;
      sent: string;
      paused: string;
      cancelled: string;
      active: string;
    };
    campaignsTab: {
      saveFailed: string;
      sendFailed: string;
      sendNowConfirm: string;
      deleteConfirm: string;
      deleteFailed: string;
      sendConfirm: string;
      heading: string;
      subtitle: string;
      statActive: string;
      statAvgOpenRate: string;
      statTotalSent: string;
      statDraft: string;
      listHeading: string;
      searchPlaceholder: string;
      loading: string;
      emptyTitle: string;
      emptySubtitleSearch: string;
      emptySubtitleDefault: string;
      recipients: string;
      openRateValue: string;
      clickRateValue: string;
      openRateLabel: string;
      clickRateLabel: string;
      send: string;
    };
    page: {
      title: string;
      refresh: string;
      createCampaign: string;
    };
    analyticsTab: {
      totalSent: string;
      delivered: string;
      openRate: string;
      clickRate: string;
      bounceRate: string;
    };
    automationModal: {
      unitMinute: string;
      unitMinutes: string;
      unitHour: string;
      unitHours: string;
      unitDay: string;
      unitDays: string;
      sendsImmediatelyFirst: string;
      sendsImmediatelyAfterPrevious: string;
      sendsAfterFirst: string;
      sendsAfterStep: string;
      nameRequired: string;
      pipelineRequired: string;
      toStageRequired: string;
      stepNameRequired: string;
      stepTemplateRequired: string;
      stepDelayInvalid: string;
      editTitle: string;
      createTitle: string;
      lockedNotice: string;
      basics: string;
      name: string;
      namePlaceholder: string;
      description: string;
      descriptionPlaceholder: string;
      trigger: string;
      triggerSubtitle: string;
      pipeline: string;
      loadingOption: string;
      selectPipeline: string;
      enteringStage: string;
      selectStage: string;
      pickPipelineFirst: string;
      onlyFromStage: string;
      anyStage: string;
      runsWhenFrom: string;
      runsWhen: string;
      steps: string;
      addStep: string;
      stepsSubtitle: string;
      moveUp: string;
      moveDown: string;
      removeStep: string;
      stepName: string;
      stepNamePlaceholder: string;
      templateLabel: string;
      selectTemplate: string;
      delayAfterStage: string;
      delayAfterPrevious: string;
      minutes: string;
      hours: string;
      days: string;
      saveAutomation: string;
      createAutomationButton: string;
    };
    campaignModal: {
      useAsTemplate: string;
      generatedTemplateName: string;
      generatedTemplateFallbackName: string;
      aiErrorFallback: string;
      nameRequired: string;
      subjectRequired: string;
      invalidEmail: string;
      editTitle: string;
      createTitle: string;
      basicInformation: string;
      campaignName: string;
      campaignNamePlaceholder: string;
      description: string;
      descriptionPlaceholder: string;
      campaignType: string;
      typeBroadcast: string;
      typeDrip: string;
      typeTriggered: string;
      typeBehavioral: string;
      typeTransactional: string;
      schedule: string;
      scheduleHint: string;
      emailContent: string;
      subjectLine: string;
      subjectPlaceholder: string;
      suggest: string;
      aiSuggestionsLabel: string;
      campaignCopy: string;
      writeWithAI: string;
      writing: string;
      copyToClipboard: string;
      dismiss: string;
      htmlEmailTemplate: string;
      hideGenerator: string;
      generateWithAI: string;
      chooseTemplateType: string;
      templateWelcome: string;
      templatePromotional: string;
      templateNewsletter: string;
      templateAnnouncement: string;
      templateFollowup: string;
      templateTransactional: string;
      generating: string;
      generateTemplate: string;
      preview: string;
      html: string;
      generatingTemplate: string;
      copyHtml: string;
      regenerate: string;
      template: string;
      selectTemplate: string;
      segment: string;
      allRecipients: string;
      senderInformation: string;
      fromName: string;
      fromNamePlaceholder: string;
      fromEmail: string;
      fromEmailPlaceholder: string;
      replyTo: string;
      replyToPlaceholder: string;
      tags: string;
      addTagPlaceholder: string;
      updateCampaign: string;
      createCampaignButton: string;
    };
    blockEditor: {
      blockHeading: string;
      blockText: string;
      blockImage: string;
      blockButton: string;
      blockTwoColumn: string;
      blockSocial: string;
      blockVideo: string;
      blockQuote: string;
      blockDivider: string;
      blockSpacer: string;
      descHeading: string;
      descText: string;
      descImage: string;
      descButton: string;
      descTwoColumn: string;
      descSocial: string;
      descVideo: string;
      descQuote: string;
      descDivider: string;
      descSpacer: string;
      alignLeft: string;
      alignCenter: string;
      alignRight: string;
      insertVariableLabel: string;
      background: string;
      paddingVLabel: string;
      paddingHLabel: string;
      headingTextLabel: string;
      levelLabel: string;
      h1Large: string;
      h2Medium: string;
      h3Small: string;
      alignLabel: string;
      textColorLabel: string;
      bodyTextLabel: string;
      fontSizeLabel: string;
      imageUrlLabel: string;
      altTextLabel: string;
      widthLabel: string;
      buttonLabelLabel: string;
      urlVariableLabel: string;
      buttonColorLabel: string;
      lineColorLabel: string;
      heightLabel: string;
      leftColumnLabel: string;
      rightColumnLabel: string;
      socialHint: string;
      thumbnailUrlLabel: string;
      videoUrlLabel: string;
      captionLabel: string;
      playButtonColorLabel: string;
      quoteTextLabel: string;
      authorNameLabel: string;
      authorTitleLabel: string;
      avatarUrlLabel: string;
      accentColorLabel: string;
      duplicateTooltip: string;
      moveUp: string;
      moveDown: string;
      deleteTooltip: string;
      undoTooltip: string;
      redoTooltip: string;
      blockCountLabel: string;
      closePreview: string;
      previewLabel: string;
      closeHtml: string;
      viewHtmlLabel: string;
      desktop: string;
      mobile: string;
      blocksPanelHeading: string;
      addBlock: string;
      dragHintLine1: string;
      dragHintLine2: string;
      propertiesPanelHeading: string;
      selectBlockHint: string;
    };
    starterGallery: {
      workspaceRequiredEdit: string;
      editFailed: string;
      workspaceRequiredClone: string;
      clonedToast: string;
      cloneFailed: string;
      yourTemplates: string;
      savedSubtitle: string;
      savedCount: string;
      newTemplate: string;
      preview: string;
      deleteTemplateTooltip: string;
      emptyTitle: string;
      emptySubtitle: string;
      createBlank: string;
      browseDivider: string;
      searchPlaceholder: string;
      browseSubtitle: string;
      noMatches: string;
      industry: string;
      useCase: string;
      subject: string;
      imported: string;
      cloning: string;
      cloneTemplate: string;
      opening: string;
      editInBuilder: string;
      savedTemplateFallback: string;
      previewFallbackDescription: string;
      subjectLineLabel: string;
      whyItWorks: string;
      variablesLabel: string;
    };
    providerModal: {
      sesKeyHint: string;
      sesKeyFormat: string;
      regionUsDefault: string;
      regionEu: string;
      nameRequired: string;
      apiKeyRequired: string;
      fromEmailRequired: string;
      invalidEmail: string;
      smtpLabel: string;
      smtpHost: string;
      smtpHostPlaceholder: string;
      smtpHostRequired: string;
      smtpHostInvalid: string;
      smtpPort: string;
      smtpPort587: string;
      smtpPort465: string;
      smtpPort2525: string;
      smtpPort25: string;
      smtpUser: string;
      smtpUserPlaceholder: string;
      smtpUserHint: string;
      smtpPassword: string;
      smtpPasswordPlaceholder: string;
      smtpPasswordRequired: string;
      smtpTrackingHint: string;
      testSuccess: string;
      testFailed: string;
      testFailedGeneric: string;
      saveFailedGeneric: string;
      editTitle: string;
      createTitle: string;
      basicInformation: string;
      providerName: string;
      providerNamePlaceholder: string;
      providerType: string;
      mailgunRegion: string;
      awsRegion: string;
      selectRegion: string;
      authentication: string;
      apiKey: string;
      apiKeyPlaceholder: string;
      trackingAutoConnected: string;
      usePostmarkToken: string;
      useFullAccessKey: string;
      trackingNotAvailable: string;
      emailSettings: string;
      fromEmail: string;
      fromEmailPlaceholder: string;
      fromName: string;
      fromNamePlaceholder: string;
      replyTo: string;
      replyToPlaceholder: string;
      rateLimits: string;
      dailyLimit: string;
      dailyLimitPlaceholder: string;
      monthlyLimit: string;
      monthlyLimitPlaceholder: string;
      options: string;
      activeOption: string;
      setAsDefault: string;
      testing: string;
      testConfiguration: string;
      updateProvider: string;
      addProvider: string;
    };
    pipelinePicker: {
      sectionTitle: string;
      sectionHint: string;
      pipeline: string;
      anyPipeline: string;
      selectPipeline: string;
      stages: string;
      stagesHint: string;
      audience: string;
      crmPipeline: string;
      pipelineRequired: string;
      segmentCreateFailed: string;
    };
    segmentModal: {
      fieldFirstName: string;
      fieldLastName: string;
      fieldEmail: string;
      fieldPhone: string;
      fieldStatus: string;
      fieldStage: string;
      fieldPipeline: string;
      fieldPipelineName: string;
      fieldDealValue: string;
      fieldCompany: string;
      fieldPosition: string;
      fieldSource: string;
      fieldTags: string;
      fieldCreatedDate: string;
      fieldUpdatedDate: string;
      opEquals: string;
      opNotEquals: string;
      opContains: string;
      opNotContains: string;
      opStartsWith: string;
      opEndsWith: string;
      opGreaterThan: string;
      opLessThan: string;
      opIsEmpty: string;
      opIsNotEmpty: string;
      nameRequired: string;
      criteriaRequired: string;
      editTitle: string;
      createTitle: string;
      basicInformation: string;
      segmentName: string;
      segmentNamePlaceholder: string;
      description: string;
      descriptionPlaceholder: string;
      criteria: string;
      match: string;
      allConditions: string;
      anyCondition: string;
      noConditions: string;
      addFirstCondition: string;
      valuePlaceholder: string;
      addAnotherCondition: string;
      tags: string;
      addTagPlaceholder: string;
      updateSegment: string;
      createSegmentButton: string;
    };
    simpleEditor: {
      subject: string;
      body: string;
      bodyPlaceholder: string;
      bold: string;
      italic: string;
      underline: string;
      link: string;
      linkPrompt: string;
      bulletList: string;
      numberedList: string;
      clearFormatting: string;
      templateFields: string;
      insertField: string;
      unsubscribeToggle: string;
    };
    inlineEditor: {
      hint: string;
      editLink: string;
      editImage: string;
      linkUrl: string;
      imageUrl: string;
      imageAlt: string;
      apply: string;
    };
    templateModal: {
      testSend: string;
      testSendHint: string;
      testSent: string;
      testFailed: string;
      testNeedsContent: string;
      legacyTitle: string;
      legacyBody: string;
      legacyImport: string;
      legacyEditHtml: string;
      legacyImportConfirm: string;
      tabWrite: string;
      bodyRequired: string;
      saveFailed: string;
      tabHtml: string;
      tabPreview: string;
      discard: string;
      settings: string;
      discardConfirm: string;
      saveChanges: string;
      createTemplate: string;
      templateInfo: string;
      name: string;
      namePlaceholder: string;
      subjectLine: string;
      subjectPlaceholder: string;
      type: string;
      typeMarketing: string;
      typeTransactional: string;
      typeAutomation: string;
      description: string;
      descriptionPlaceholder: string;
      variables: string;
      variablePlaceholder: string;
      variablesHint: string;
      tags: string;
      tagPlaceholder: string;
      plainText: string;
      plainTextHint: string;
      plainTextPlaceholder: string;
      requiredFieldsNotice: string;
      htmlVariablesLabel: string;
      htmlPlaceholder: string;
      previewSampleData: string;
      nothingToPreview: string;
    };
  };
  public: {
    invitation: {
      missingToken: string;
      loadFailed: string;
      unexpectedError: string;
      actionFailed: string;
      acceptVerb: string;
      declineVerb: string;
      actionFailedGeneric: string;
      loadingText: string;
      unavailableTitle: string;
      goToDashboard: string;
      welcomeTo: string;
      declinedTitle: string;
      accessGranted: string;
      declinedBody: string;
      takingYouThere: string;
      alreadyAccepted: string;
      alreadyDeclined: string;
      expired: string;
      invitationToWorkspace: string;
      notActive: string;
      youreInvitedTo: string;
      invitedAs: string;
      wrongAccountNotice: string;
      switchAccount: string;
      signInToAccept: string;
      createAccount: string;
      joinWorkspace: string;
      accept: string;
      decline: string;
    };
    offline: {
      heading: string;
      body: string;
      retry: string;
    };
    share: {
      codeBadge: string;
      noLink: string;
      untitled: string;
      noDescription: string;
      tagFallback: string;
      videoTitle: string;
      privateTitle: string;
      privateBody: string;
      notFoundTitle: string;
      notFoundBody: string;
      readOnly: string;
      madeWith: string;
    };
    invoice: {
      loadErrorDefault: string;
      loadErrorCatch: string;
      loadErrorFallback: string;
      paidMessage: string;
      cancelledMessage: string;
      defaultMessage: string;
    };
    quote: {
      loadErrorDefault: string;
      loadErrorCatch: string;
      respondErrorDefault: string;
      respondErrorCatch: string;
      loadErrorFallback: string;
      acceptButton: string;
      declineButton: string;
      acceptedThankYou: string;
      declinedMessage: string;
      statusMessage: string;
    };
    document: {
      invoiceLabel: string;
      quoteLabel: string;
      issuedLabel: string;
      dueLabel: string;
      validUntilLabel: string;
      billedTo: string;
      amountDueHeading: string;
      totalHeading: string;
      paidOf: string;
      descriptionCol: string;
      qtyCol: string;
      unitPriceCol: string;
      discTaxCol: string;
      amountCol: string;
      subtotal: string;
      discount: string;
      tax: string;
      total: string;
      amountPaid: string;
      amountDue: string;
      paidInFull: string;
      paymentHistory: string;
      notes: string;
      terms: string;
      downloadPdf: string;
      sentBy: string;
      notAvailableTitle: string;
    };
  };
  invoices: {
    detail: {
      paymentModal: {
        invalidAmount: string;
        genericFailure: string;
        title: string;
        amountDue: string;
        amount: string;
        date: string;
        method: string;
        reference: string;
        referencePlaceholder: string;
        notes: string;
        recording: string;
        record: string;
      };
      sendModal: {
        subjectTemplate: string;
        defaultMessage: string;
        notAvailable: string;
        recipientRequired: string;
        failedToSend: string;
        genericError: string;
        title: string;
        to: string;
        subject: string;
        message: string;
        sending: string;
        send: string;
      };
      failedToFetch: string;
      genericError: string;
      failedToSave: string;
      toastSaved: string;
      clientNameRequired: string;
      noWorkspaceSelected: string;
      createFailed: string;
      failedToDuplicate: string;
      deleteConfirm: string;
      failedToDeleteInvoice: string;
      failedToDelete: string;
      deletePaymentConfirm: string;
      failedToDeletePayment: string;
      toastPaymentRemoved: string;
      goBack: string;
      toastPaymentRecorded: string;
      toastInvoiceSent: string;
      backAria: string;
      newInvoiceTitle: string;
      invoiceFallback: string;
      fromQuote: string;
      unsavedChanges: string;
      payment: string;
      send: string;
      pdf: string;
      moreOptionsAria: string;
      editInvoice: string;
      duplicateInvoice: string;
      deleteInvoice: string;
      status: string;
      payments: string;
      recordPayment: string;
      noPayments: string;
      paidOfTotal: string;
      colDate: string;
      colMethod: string;
      colReference: string;
      colAmount: string;
      removePaymentAria: string;
      details: string;
      discardConfirm: string;
      discard: string;
      creating: string;
      createInvoice: string;
      saving: string;
      save: string;
    };
    paymentMethod: {
      bankTransfer: string;
      cash: string;
      creditCard: string;
      check: string;
      other: string;
      paypal: string;
    };
    status: {
      overdue: string;
      draft: string;
      sent: string;
      viewed: string;
      partiallyPaid: string;
      paid: string;
      cancelled: string;
      all: string;
    };
    fields: {
      issueDate: string;
      dueDate: string;
      currency: string;
      clientInformation: string;
      clientName: string;
      email: string;
      phone: string;
      company: string;
      address: string;
      lineItems: string;
      notesAndTerms: string;
      notes: string;
      notesPlaceholder: string;
      terms: string;
      termsPlaceholder: string;
      internalNotes: string;
      internalNotesPrivate: string;
      internalNotesPlaceholder: string;
      clientNamePlaceholder: string;
      emailPlaceholder: string;
      phonePlaceholder: string;
      companyPlaceholder: string;
      addressPlaceholder: string;
    };
    newForm: {
      clientNameRequired: string;
      lineItemRequired: string;
      createFailed: string;
      genericError: string;
      backAria: string;
      title: string;
      subtitle: string;
      creating: string;
      createInvoice: string;
      documentSettings: string;
      linkedContact: string;
      removeLinkedAria: string;
      linkCrmContact: string;
      searchContacts: string;
      noContactsFound: string;
    };
    quickPaymentModal: {
      genericFailure: string;
      title: string;
      amount: string;
      method: string;
      date: string;
      recording: string;
      record: string;
    };
    sendModal: {
      subjectTemplate: string;
      failedToSend: string;
      genericError: string;
      title: string;
      to: string;
      toPlaceholder: string;
      subject: string;
      message: string;
      messagePlaceholder: string;
      sending: string;
      send: string;
    };
    actions: {
      menuAria: string;
      copyClientLink: string;
      recordPayment: string;
      sendByEmail: string;
      viewPdf: string;
      duplicate: string;
      delete: string;
    };
    sort: {
      date: string;
      client: string;
      total: string;
      status: string;
      dueDate: string;
    };
    list: {
      failedToFetch: string;
      deleteConfirm: string;
      failedToDelete: string;
      toastDeleted: string;
      failedToDuplicate: string;
      toastDuplicated: string;
      failedToCreateLink: string;
      toastLinkCopied: string;
      title: string;
      subtitle: string;
      fromTemplate: string;
      newInvoice: string;
      tryAgain: string;
      emptyTitle: string;
      emptyFiltered: string;
      emptyGetStarted: string;
      createInvoice: string;
      colNumber: string;
      colClient: string;
      colStatus: string;
      colDueDate: string;
      colTotal: string;
      colPaid: string;
      colActions: string;
      overdueTag: string;
      previous: string;
      next: string;
      toastInvoiceSent: string;
      toastPaymentRecorded: string;
    };
    card: {
      dueAmount: string;
      dueDateText: string;
      paidPercent: string;
      total: string;
      amountDue: string;
    };
  };
  kanban: {
    priorityLow: string;
    priorityMedium: string;
    priorityHigh: string;
    statusTodo: string;
    statusInProgress: string;
    statusDone: string;
    priorityFilterAll: string;
    updateCardError: string;
    deleteCardError: string;
    cardDeletedSuccess: string;
    createCardError: string;
    cardCreatedSuccess: string;
    titleRequiredError: string;
    reorderError: string;
    createProjectError: string;
    projectCreatedSuccess: string;
    updateProjectError: string;
    projectUpdatedSuccess: string;
    deleteProjectConfirm: string;
    deleteProjectError: string;
    projectDeletedSuccess: string;
    noWorkspaceTitle: string;
    noWorkspaceDescription: string;
    workspaceFallbackName: string;
    searchCardsPlaceholder: string;
    adding: string;
    addCard: string;
    addCardModalTitle: string;
    titleFieldLabel: string;
    cardTitlePlaceholder: string;
    descriptionFieldLabel: string;
    descriptionPlaceholder: string;
    priorityFieldLabel: string;
    statusFieldLabel: string;
    dueDateFieldLabel: string;
    tagsFieldLabel: string;
    tagsPlaceholder: string;
    assigneesFieldLabel: string;
    assigneesPlaceholder: string;
    addCardToColumnAria: string;
    noCardsHere: string;
    dragCardsHint: string;
    cardTitlePlaceholderShort: string;
    weekdaySun: string;
    weekdayMon: string;
    weekdayTue: string;
    weekdayWed: string;
    weekdayThu: string;
    weekdayFri: string;
    weekdaySat: string;
    unitMonth: string;
    unitWeek: string;
    unitDay: string;
    previousMonthAria: string;
    today: string;
    nextMonthAria: string;
    moreCardsCount: string;
    weekViewTitle: string;
    dayViewTitle: string;
    weekViewComingSoon: string;
    dayViewComingSoon: string;
    showingCardsWithDueDates: string;
    dragToChangeDueDatesHint: string;
    overdueDays: string;
    dueToday: string;
    dueTomorrow: string;
    dueInDays: string;
    editCardAria: string;
    deleteCardAria: string;
    editCardModalTitle: string;
    saving: string;
    saveChanges: string;
    noCardsFound: string;
    adjustFiltersHint: string;
    createFirstCardHint: string;
    columnTitle: string;
    columnStatus: string;
    columnPriority: string;
    columnDueDate: string;
    columnProject: string;
    moreOptionsAria: string;
    showingCardsOf: string;
    ungroupedLabel: string;
    noProjectLabel: string;
    unknownLabel: string;
    allCardsLabel: string;
    cardColumnHeader: string;
    noDueDateLabel: string;
    timelineTitle: string;
    noGroupingOption: string;
    groupByProjectOption: string;
    groupByStatusOption: string;
    groupByPriorityOption: string;
    colorIndigo: string;
    colorViolet: string;
    colorPink: string;
    colorRose: string;
    colorOrange: string;
    colorYellow: string;
    colorGreen: string;
    colorTeal: string;
    colorSky: string;
    colorSlate: string;
    nameRequiredError: string;
    nameMinLengthError: string;
    nameMaxLengthError: string;
    descriptionMaxLengthError: string;
    saveProjectError: string;
    editProjectTitle: string;
    createProjectTitle: string;
    closeModalAria: string;
    projectNameLabel: string;
    projectNamePlaceholder: string;
    projectDescriptionPlaceholder: string;
    charactersCount: string;
    projectColorLabel: string;
    selectColorAria: string;
    updating: string;
    creating: string;
    updateProjectCta: string;
    createProjectCta: string;
    projectsHeading: string;
    collapseSidebarAria: string;
    expandSidebarAria: string;
    addProject: string;
    fromTemplate: string;
    searchProjectsPlaceholder: string;
    editProjectAria: string;
    deleteProjectAria: string;
    noProjectsFound: string;
    noProjectsYet: string;
    createFirstProjectCta: string;
    projectCountSingular: string;
    projectCountPlural: string;
    viewKanbanLabel: string;
    viewKanbanTitle: string;
    viewListLabel: string;
    viewListTitle: string;
    viewCalendarLabel: string;
    viewCalendarTitle: string;
    viewTimelineLabel: string;
    viewTimelineTitle: string;
  };
  landing: {
    footer: {
      linkPipeline: string;
      linkListings: string;
      linkHowItWorks: string;
      linkAssistant: string;
      linkRolesTeam: string;
      linkCommissions: string;
      linkPricing: string;
      tagline: string;
      productHeading: string;
      copyright: string;
      signIn: string;
      createWorkspace: string;
    };
    aiIntegration: {
      answerPages: string;
      answerLeads: string;
      answerTasks: string;
      answerFinancials: string;
      answerMeetings: string;
      answerProducts: string;
      answerTemplates: string;
      heading: string;
      lead: string;
      tableCaption: string;
      colTool: string;
      colReads: string;
      colAnswers: string;
    };
    bentoGrid: {
      foundationPostgresTerm: string;
      foundationPostgresDetail: string;
      foundationAuthTerm: string;
      foundationAuthDetail: string;
      foundationSecretsTerm: string;
      foundationSecretsDetail: string;
      foundationPermissionsTerm: string;
      foundationPermissionsDetail: string;
      heading: string;
      lead: string;
      crmTitle: string;
      crmBody: string;
      emailTitle: string;
      emailBody: string;
      meetingsTitle: string;
      meetingsBody: string;
      catalogTitle: string;
      catalogBody: string;
      underneathHeading: string;
    };
    demoVideo: {
      watchDemo: string;
      dialogLabel: string;
      recordedFrom: string;
      soundOff: string;
      soundOn: string;
      closeDemo: string;
    };
    evidence: {
      listingsTitle: string;
      listingsBody: string;
      listingsAlt: string;
      commissionsTitle: string;
      commissionsBody: string;
      commissionsAlt: string;
    };
    finalCta: {
      step1: string;
      step2: string;
      step3: string;
      step4: string;
      heading: string;
      lead: string;
      createWorkspace: string;
      signIn: string;
      noSalesCall: string;
    };
    journey: {
      stage1Title: string;
      stage1Body: string;
      stage2Title: string;
      stage2Body: string;
      stage3Title: string;
      stage3Body: string;
      stage4Title: string;
      stage4Body: string;
      heading: string;
      lead: string;
    };
    hero: {
      assuranceFree: string;
      assuranceRoles: string;
      assuranceData: string;
      titleLine1: string;
      titleLine2: string;
      lead: string;
      startFree: string;
      plateAlt: string;
    };
    header: {
      navPipeline: string;
      navHowItWorks: string;
      navAssistant: string;
      navTeam: string;
      navPricing: string;
      sectionsAria: string;
      themeToLight: string;
      themeToDark: string;
      dashboard: string;
      signIn: string;
      startFree: string;
      toggleNav: string;
    };
    pricing: {
      limitUnlimitedMembers: string;
      limitUpToMembers: string;
      limitUnlimitedAiCredits: string;
      limitAiCreditsPerMonth: string;
      limitUnlimitedCrmContacts: string;
      limitCrmContacts: string;
      limitProperties: string;
      limitUnlimitedProperties: string;
      limitActiveMandates: string;
      limitUnlimitedActiveMandates: string;
      limitUnlimitedInvoices: string;
      limitInvoicesPerMonth: string;
      limitCustomEmailVolume: string;
      limitEmailSendsPerMonth: string;
      limitPaymentFee: string;
      waitlistErrorGeneric: string;
      waitlistDoneEnterprise: string;
      waitlistDoneGeneric: string;
      emailPlaceholder: string;
      emailAriaLabel: string;
      notifyEmailButton: string;
      notifyMe: string;
      availableNow: string;
      mostPopular: string;
      customPrice: string;
      forever: string;
      perMonthWholeTeam: string;
      billedYearly: string;
      billedMonthly: string;
      startFree: string;
      talkToUs: string;
      upgradeTo: string;
      calcHeading: string;
      calcBody: string;
      teamSizeLabel: string;
      perSeatToolsLabel: string;
      perMonth: string;
      borsflowPlanLabel: string;
      freeAiIncluded: string;
      perMonthBilledYearly: string;
      yearly: string;
      twoMonthsFree: string;
      monthly: string;
      heading: string;
      lead: string;
      betaStrong: string;
      betaBody: string;
      billingPeriodAria: string;
      footnote: string;
    };
    support: {
      faq1q: string;
      faq1a: string;
      faq2q: string;
      faq2a: string;
      faq3q: string;
      faq3a: string;
      faq4q: string;
      faq4a: string;
      faq5q: string;
      faq5a: string;
      faq6q: string;
      faq6a: string;
      heading: string;
      lead: string;
    };
    team: {
      roleViewer: string;
      roleMember: string;
      roleAdmin: string;
      roleOwner: string;
      capRead: string;
      capCreate: string;
      capEditDelete: string;
      capInvite: string;
      capDeleteWorkspace: string;
      heading: string;
      lead: string;
      tableCaption: string;
      permissionCol: string;
      yes: string;
      no: string;
      invitationsHeading: string;
      invitationsBody: string;
      talkHeading: string;
      talkBody: string;
      workspacesHeading: string;
      workspacesBody: string;
    };
    whyChoose: {
      seam1: string;
      seam2: string;
      seam3: string;
      seam4: string;
      join1: string;
      join2: string;
      join3: string;
      join4: string;
      heading: string;
      lead: string;
      fiveToolsHeading: string;
      oneWorkspaceHeading: string;
    };
  };
  documents: {
    tones: {
      formal: string;
      casual: string;
      persuasive: string;
      concise: string;
    };
    print: {
      video: string;
      file: string;
    };
    blockTypes: {
      text: {
        label: string;
        description: string;
      };
      heading1: {
        label: string;
        description: string;
      };
      heading2: {
        label: string;
        description: string;
      };
      heading3: {
        label: string;
        description: string;
      };
      bullet: {
        label: string;
        description: string;
      };
      numbered: {
        label: string;
        description: string;
      };
      todo: {
        label: string;
        description: string;
      };
      code: {
        label: string;
        description: string;
      };
      quote: {
        label: string;
        description: string;
      };
      divider: {
        label: string;
        description: string;
      };
      callout: {
        label: string;
        description: string;
      };
      toggle: {
        label: string;
        description: string;
      };
      tag: {
        label: string;
        description: string;
      };
      date: {
        label: string;
        description: string;
      };
      link: {
        label: string;
        description: string;
      };
      image: {
        label: string;
        description: string;
      };
      video: {
        label: string;
        description: string;
      };
      file: {
        label: string;
        description: string;
      };
      table: {
        label: string;
        description: string;
      };
      bookmark: {
        label: string;
        description: string;
      };
      equation: {
        label: string;
        description: string;
      };
    };
    categories: {
      basic: string;
      formatting: string;
      media: string;
      advanced: string;
    };
    blocksGroupLabel: string;
    duplicate: string;
    turnInto: string;
    blocks: {
      toggleTitlePlaceholder: string;
      toggleContentPlaceholder: string;
      imageCaptionPlaceholder: string;
      imageUploadLabel: string;
      columnLabel: string;
      tableAddRow: string;
      linkPlaceholder: string;
      bookmarkPlaceholder: string;
      bookmarkNoDescription: string;
      dateRemindMe: string;
      tagDefault: string;
      tagPlaceholder: string;
      videoPlaceholder: string;
      youtubeTitle: string;
      vimeoTitle: string;
      fileUnknownSize: string;
      fileUploadLabel: string;
      equationPlaceholder: string;
    };
    untitled: string;
    outlineErrorFallback: string;
    documentErrorFallback: string;
    toneErrorFallback: string;
    saveErrorFallback: string;
    saveErrorNetwork: string;
    typeCommandPlaceholder: string;
    notFound: string;
    backToDashboard: string;
    workspaceFallback: string;
    viewOnlyBanner: string;
    aiPromptPlaceholder: string;
    aiPromptHint: string;
    writeWithAi: string;
    generatingOutline: string;
    generateOutlineWithAi: string;
    rewriteToneTitle: string;
    addBlockButton: string;
    dismiss: string;
    saving: string;
    unsavedChanges: string;
    viewOnly: string;
    saved: string;
    commentsTitle: string;
    commentsEmpty: string;
    commentPlaceholder: string;
    calculations: {
      summary: string;
      subtotal: string;
      discount: string;
      discountTypeLabel: string;
      discountNone: string;
      discountValueLabel: string;
      tax: string;
      taxRateLabel: string;
      total: string;
      amountPaid: string;
      amountDue: string;
      balance: string;
    };
    filterBar: {
      clearSearch: string;
      clearFilters: string;
      clear: string;
    };
    lineItem: {
      dragToReorder: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      unitPriceLabel: string;
      totalLabel: string;
      remove: string;
    };
    lineItems: {
      heading: string;
      noItems: string;
      itemsCount: string;
      itemCount: string;
      noItemsYet: string;
      addFirst: string;
      addNewAriaLabel: string;
      addItem: string;
      pickFromCatalog: string;
    };
    viewToggle: {
      ariaLabel: string;
      gridView: string;
      tableView: string;
    };
  };
  pages: {
    table: {
      pageActions: string;
      actions: string;
    };
    header: {
      title: string;
      description: string;
    };
    exportShare: {
      members: string;
      export: string;
      publicAccess: string;
    };
    accessModal: {
      shareWithMembers: string;
      applyToChildPages: string;
    };
    sidebar: {
      newPage: string;
      searchPlaceholder: string;
    };
  };
  products: {
    currency: {
      title: string;
      hint: string;
      changed: string;
      saveFailed: string;
    };
    customFields: {
      title: string;
      subtitle: string;
      addField: string;
      manage: string;
      labelLabel: string;
      labelPlaceholder: string;
      typeLabel: string;
      keyLabel: string;
      keyHint: string;
      typeText: string;
      typeNumber: string;
      typeBoolean: string;
      typeDate: string;
      yes: string;
      no: string;
      usage: string;
      moveUp: string;
      moveDown: string;
      deleteNamed: string;
      deleteTitle: string;
      deleteBodyUsed: string;
      deleteBodyUnused: string;
      saveFailed: string;
      emptyTitle: string;
      emptyBody: string;
      importHint: string;
      formEmpty: string;
      builtInGroup: string;
      customGroup: string;
      createFromColumn: string;
      customBadge: string;
      mappingHint: string;
      invalidCell: string;
      invalidSummary: string;
    };
    detail: {
      loadFailed: string;
      saveFailed: string;
      editFallback: string;
      loadingTitle: string;
      subtitle: string;
      saveButton: string;
    };
    nameRequired: string;
    deleteConfirm: string;
    deleteFailed: string;
    workspaceFallback: string;
    backToProductsAria: string;
    newForm: {
      createFailed: string;
      subtitle: string;
      createButton: string;
    };
    newProduct: string;
    sortUpdated: string;
    sortName: string;
    sortPrice: string;
    sortStock: string;
    statusAll: string;
    statusActiveOnly: string;
    statusInactiveOnly: string;
    fetchFailed: string;
    allCategories: string;
    importedSkipped: string;
    imported: string;
    deletedToast: string;
    subtitle: string;
    generateWithAI: string;
    import: string;
    searchPlaceholder: string;
    searchAria: string;
    emptyTitle: string;
    emptyFilteredSubtitle: string;
    emptySubtitle: string;
    createFirst: string;
    showingRange: string;
    active: string;
    inactive: string;
    actionsAria: string;
    fields: {
      price: string;
      taxRate: string;
      sku: string;
      category: string;
      name: string;
      description: string;
      unit: string;
      stockQuantity: string;
    };
    stockLabel: string;
    stockNotTracked: string;
    formFields: {
      generateFailed: string;
      aiAssistantBadge: string;
      aiAssistantHeading: string;
      aiAssistantSubtitle: string;
      hideAI: string;
      useAI: string;
      aiPromptLabel: string;
      aiPromptPlaceholder: string;
      aiCapabilitiesHint: string;
      generateDetails: string;
      aiNotesLabel: string;
      nameLabel: string;
      namePlaceholder: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      skuLabel: string;
      skuPlaceholder: string;
      categoryLabel: string;
      selectCategoryPlaceholder: string;
      addCategory: string;
      newCategoryPlaceholder: string;
      cancelAddCategoryAria: string;
      priceLabel: string;
      unitLabel: string;
      unitPlaceholder: string;
      taxRateLabel: string;
      stockQuantityLabel: string;
      stockQuantityPlaceholder: string;
      activeProductLabel: string;
      activeProductHint: string;
      toggleActiveAria: string;
    };
    importModal: {
      steps: {
        upload: string;
        sheet: string;
        map: string;
        preview: string;
        import: string;
        done: string;
      };
      sheetMissingHeaderNamed: string;
      sheetMissingHeader: string;
      legacyExcelError: string;
      unsupportedFileError: string;
      fileTooLarge: string;
      emptyWorkbook: string;
      readError: string;
      importFailed: string;
      title: string;
      subtitle: string;
      closeAria: string;
      overRowLimit: string;
      reading: string;
      dropPrompt: string;
      supportedFormats: string;
      sheetPrompt: string;
      rowsLabel: string;
      noHeader: string;
      rowsFoundIn: string;
      columnFileColumn: string;
      columnSample: string;
      columnMapsTo: string;
      unnamedColumn: string;
      mapColumnAria: string;
      skipOption: string;
      previewingRows: string;
      importingTitle: string;
      importingBody: string;
      progressCount: string;
      secondsLeft: string;
      minutesLeft: string;
      createdCount: string;
      skippedCount: string;
      stopImport: string;
      stopping: string;
      stopHint: string;
      stoppedSummary: string;
      partialFailure: string;
      doneTitle: string;
      doneSummary: string;
      rowErrorsTitle: string;
      rowErrorPrefix: string;
      previewButton: string;
      importButton: string;
    };
    statusLabel: string;
    actionsLabel: string;
    unitPrefix: string;
  };
  quotes: {
    detail: {
      sendModal: {
        subjectDefault: string;
        messageDefault: string;
        recipientRequired: string;
        failed: string;
        title: string;
        to: string;
        subject: string;
        message: string;
        cancel: string;
        sending: string;
        send: string;
      };
      convertModal: {
        failed: string;
        title: string;
        description: string;
        dueDate: string;
        optional: string;
        cancel: string;
        converting: string;
        convert: string;
      };
      fetchFailed: string;
      saveFailed: string;
      savedToast: string;
      clientNameRequired: string;
      workspaceRequired: string;
      createFailed: string;
      deleteConfirm: string;
      deleteFailed: string;
      duplicateFailed: string;
      goBackButton: string;
    };
    currency: {
      usd: string;
      eur: string;
      gbp: string;
      cad: string;
      aud: string;
      dzd: string;
      mad: string;
      tnd: string;
    };
    newForm: {
      clientNameRequired: string;
      lineItemRequired: string;
      createFailed: string;
      backAria: string;
      title: string;
      subtitle: string;
      creating: string;
      createQuote: string;
      documentSettings: string;
      issueDate: string;
      validUntil: string;
      currency: string;
      clientInformation: string;
      linkedContact: string;
      removeLinkedContactAria: string;
      linkCrmContact: string;
      searchContactsPlaceholder: string;
      noContactsFound: string;
      clientName: string;
      clientNamePlaceholder: string;
      email: string;
      emailPlaceholder: string;
      phone: string;
      phonePlaceholder: string;
      company: string;
      companyPlaceholder: string;
      address: string;
      addressPlaceholder: string;
      lineItems: string;
      notesAndTerms: string;
      notes: string;
      notesPlaceholder: string;
      terms: string;
      termsPlaceholder: string;
      internalNotes: string;
      internalNotesPrivate: string;
      internalNotesPlaceholder: string;
    };
    list: {
      sendModal: {
        subjectDefault: string;
        failed: string;
        title: string;
        to: string;
        toPlaceholder: string;
        subject: string;
        message: string;
        messagePlaceholder: string;
        cancel: string;
        sending: string;
        send: string;
      };
      convertModal: {
        failed: string;
        title: string;
        description: string;
        dueDate: string;
        cancel: string;
        converting: string;
        convert: string;
      };
      actionsAria: string;
      sendByEmail: string;
      viewPdf: string;
      copyClientLink: string;
      convertToInvoice: string;
      duplicate: string;
      delete: string;
      sortDate: string;
      sortClient: string;
      sortTotal: string;
      sortStatus: string;
      fetchFailed: string;
      deleteConfirm: string;
      toastDeleted: string;
      toastDeleteFailed: string;
      toastDuplicated: string;
      toastDuplicateFailed: string;
      toastLinkFailed: string;
      toastLinkCopied: string;
      title: string;
      subtitle: string;
      fromTemplate: string;
      newQuote: string;
      tryAgain: string;
      emptyTitle: string;
      emptyFilteredSubtitle: string;
      emptySubtitle: string;
      createQuote: string;
      tableQuoteNumber: string;
      tableClient: string;
      tableStatus: string;
      tableDate: string;
      tableTotal: string;
      tableActions: string;
      previous: string;
      next: string;
      toastSent: string;
      toastConverted: string;
      cardTotal: string;
    };
    status: {
      all: string;
      draft: string;
      sent: string;
      viewed: string;
      accepted: string;
      rejected: string;
      expired: string;
    };
  };
  settings: {
    profile: {
      nameRequired: string;
      updateSuccess: string;
      updateFailed: string;
      genericError: string;
      heading: string;
      subtitle: string;
      nameLabel: string;
      namePlaceholder: string;
      emailLabel: string;
      emailCannotChange: string;
      saving: string;
      saveChanges: string;
    };
    appearance: {
      updateSuccess: string;
      updateFailed: string;
      heading: string;
      subtitle: string;
      themeLabel: string;
      light: string;
      dark: string;
      system: string;
    };
    security: {
      allFieldsRequired: string;
      passwordMismatch: string;
      passwordTooShort: string;
      updateSuccess: string;
      updateFailed: string;
      genericError: string;
      heading: string;
      subtitle: string;
      currentPasswordLabel: string;
      currentPasswordPlaceholder: string;
      newPasswordLabel: string;
      newPasswordPlaceholder: string;
      newPasswordHint: string;
      confirmPasswordLabel: string;
      confirmPasswordPlaceholder: string;
    };
    integrations: {
      oauthStartFailed: string;
      connectionFailed: string;
      disconnectSuccess: string;
      disconnectFailed: string;
      genericError: string;
    };
    nav: {
      profile: string;
      notifications: string;
      appearance: string;
      security: string;
      integrations: string;
      billing: string;
    };
    pageTitle: string;
    pageSubtitle: string;
    planLimit: {
      titleAiCredits: string;
      titleMembers: string;
      titleEmailSends: string;
      titleInvoices: string;
      closeAria: string;
      titleGeneric: string;
      usedOfLimit: string;
      notNow: string;
      seePlans: string;
      joinWaitlistDiscount: string;
    };
    billing: {
      unlimited: string;
      loadError: string;
      heading: string;
      subtitle: string;
      selectWorkspace: string;
      loadingAria: string;
      currentPlan: string;
      betaBadge: string;
      comparePlans: string;
      membersLabel: string;
      membersDetailPending: string;
      membersDetailOwnerOnly: string;
      aiCreditsLabel: string;
      aiCreditsDetail: string;
      upgradePlan: string;
      paidPlansComingSoon: string;
      paidPlansDescription: string;
      joinWaitlist: string;
    };
    notifications: {
      categoryTeamLabel: string;
      categoryTeamDescription: string;
      categorySalesLabel: string;
      categorySalesDescription: string;
      categoryMeetingsLabel: string;
      categoryMeetingsDescription: string;
      categoryTasksLabel: string;
      categoryTasksDescription: string;
      updateFailed: string;
      loading: string;
      heading: string;
      subtitle: string;
      emailHeading: string;
      emailDescription: string;
      emailSwitchAria: string;
      categoryHeader: string;
      inAppHeader: string;
      emailHeader: string;
      inAppAria: string;
      emailAria: string;
      savingNote: string;
    };
  };
  templates: {
    cloneFailed: string;
    eyebrow: string;
    heading: string;
    description: string;
    openEmailMarketing: string;
    loading: string;
    galleryTitle: string;
    gallerySubtitle: string;
    ai: {
      generate: string;
      contentReady: string;
      applyTemplate: string;
      regenerate: string;
      generating: string;
    };
  };
  workspaces: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    commentsHeading: string;
    noCommentsYet: string;
    beFirstToComment: string;
    reply: string;
    resolve: string;
    addCommentPlaceholder: string;
    fixGrammar: string;
    summarize: string;
    makeShorter: string;
    makeLonger: string;
    aiActionError: string;
    aiLabel: string;
    generateError: string;
    describeGeneratePlaceholder: string;
    generateHint: string;
    generateWithAi: string;
    describeWhatYouWant: string;
    basicBlocksHeader: string;
    heading1Block: string;
    textBlock: string;
    justStartWriting: string;
    bulletListBlock: string;
    mediaHeader: string;
    imageBlock: string;
    workspaceFallbackName: string;
    sharedTab: string;
    privateTab: string;
    membersAriaLabel: string;
    andMoreMembers: string;
    askAi: string;
    share: string;
    aiResultCopied: string;
    createPageError: string;
    createPageGenericError: string;
    notFoundTitle: string;
    backToDashboard: string;
    searchPagesPlaceholder: string;
    noPagesFound: string;
    newPage: string;
    breadcrumb: string;
    pageTitlePlaceholder: string;
    defaultDescription: string;
    subPagesCount: string;
    createFirstPage: string;
  };
  navigation: {
    sidebar: {
      brand: string;
      search: string;
      inbox: string;
      myTasks: string;
      workspace: string;
      settings: string;
      templates: string;
      trash: string;
    };
  };
  ai: {
    chat: {
      heading: string;
      subheading: string;
      placeholder: string;
    };
  };
  shell: {
    untitled: string;
    createPageFailed: string;
    createPageFailedRetry: string;
    workspaceCreated: string;
    invitationDeclined: string;
    joinedWorkspace: string;
    invitationAccepted: string;
    toggleSidebar: string;
    expandSidebar: string;
    collapseSidebar: string;
    invitePeople: string;
    selectWorkspaceFirst: string;
    newPage: string;
    creatingPage: string;
    selectWorkspace: string;
    account: string;
    searchPlaceholder: string;
    noResultsFound: string;
    searchAria: string;
    moreMembersTitle: string;
    toggleDarkMode: string;
    askAI: string;
    goToDashboard: string;
  };
  chat: {
    addReaction: string;
    attachFile: string;
    beFirst: string;
    channelStart: string;
    clearSearch: string;
    composerHint: string;
    copyText: string;
    deleteChannelBody: string;
    deleteChannelNamed: string;
    deleteChannelTitle: string;
    deleteMessage: string;
    deleteMessageBody: string;
    deleteMessageTitle: string;
    editMessage: string;
    edited: string;
    emptyChannel: string;
    fileTooLarge: string;
    filterMembers: string;
    genericError: string;
    jumpToLatest: string;
    liveUnavailable: string;
    loadFailed: string;
    members: string;
    membersOf: string;
    mentionSuggestions: string;
    messageDeleted: string;
    messagePlaceholder: string;
    moreActions: string;
    moreResults: string;
    newChannel: string;
    newMessages: string;
    noMembersMatch: string;
    noPinned: string;
    noResults: string;
    notSent: string;
    onlineCount: string;
    pin: string;
    pinned: string;
    pinnedMessages: string;
    reactWith: string;
    readOnly: string;
    reconnecting: string;
    removeAttachment: string;
    replyCount: string;
    replyInThread: string;
    replyPlaceholder: string;
    resultsCount: string;
    retry: string;
    searchPlaceholder: string;
    searching: string;
    send: string;
    sendFailed: string;
    showChannels: string;
    someone: string;
    thread: string;
    today: string;
    typingMany: string;
    typingOne: string;
    typingTwo: string;
    unknownMember: string;
    unpin: string;
    unreadCount: string;
    yesterday: string;
    you: string;
    createModal: {
      namePlaceholder: string;
      private: string;
      privateHint: string;
      failedError: string;
      title: string;
      nameLabel: string;
      descLabel: string;
      optional: string;
      descPlaceholder: string;
      create: string;
    };
    title: string;
    channels: string;
    addChannel: string;
    addAChannel: string;
    deleteChannel: string;
    selectChannel: string;
    noChannels: string;
    createFirst: string;
  };
  notifications: {
    bell: {
      unreadCount: string;
      title: string;
      all: string;
      unread: string;
      markAllRead: string;
      loading: string;
      caughtUp: string;
      empty: string;
      today: string;
      earlier: string;
      settings: string;
    };
  };
  noWorkspace: {
    invitedTitle: string;
    invitedSubtitle: string;
    emptyTitle: string;
    emptySubtitle: string;
  };
  scheduling: {
    attendee: {
      status: {
        invited: string;
        accepted: string;
        declined: string;
        tentative: string;
        attended: string;
        noShow: string;
      };
      type: {
        external: string;
        internal: string;
        lead: string;
        contact: string;
      };
      removeConfirm: string;
      heading: string;
      add: string;
      emptyTitle: string;
      addFirst: string;
      changeStatusTitle: string;
      removeTitle: string;
    };
    attendeeModal: {
      typeExternal: string;
      typeLead: string;
      typeInternal: string;
      requiredError: string;
      addFailed: string;
      title: string;
      tabCrm: string;
      tabManual: string;
      searchPlaceholder: string;
      noResults: string;
      searchPrompt: string;
      reviewDetails: string;
      nameLabel: string;
      namePlaceholder: string;
      emailLabel: string;
      emailPlaceholder: string;
      phoneLabel: string;
      optional: string;
      phonePlaceholder: string;
      typeLabel: string;
      cancel: string;
      submit: string;
    };
    directConnect: {
      tokenLabelGoogle: string;
      tokenPlaceholderGoogle: string;
      hintGoogle: string;
      tokenLabelCalcom: string;
      tokenPlaceholderCalcom: string;
      hintCalcom: string;
      tokenLabelZoom: string;
      tokenPlaceholderZoom: string;
      hintZoom: string;
      tokenLabelDefault: string;
      tokenPlaceholderDefault: string;
      hintDefault: string;
      requiredError: string;
      connectionFailed: string;
      networkError: string;
      titlePrefix: string;
      subtitle: string;
      accountEmailLabel: string;
      emailPlaceholder: string;
      cancel: string;
      connecting: string;
      connect: string;
    };
    integrationCard: {
      liveUpdatesOn: string;
      liveUpdatesOff: string;
      retrying: string;
      retry: string;
      syncNowTitle: string;
      syncHistoryTitle: string;
      disconnectTitle: string;
      syncFrequencyLabel: string;
      default: string;
      setDefaultTitle: string;
    };
    platform: {
      inPerson: string;
      phone: string;
    };
    meetingCount: string;
    calendar: {
      noMeetingsOnDay: string;
      withLead: string;
      join: string;
      selectDatePrompt: string;
    };
    card: {
      minutesSuffix: string;
      today: string;
      tomorrow: string;
      liveNow: string;
      withLead: string;
      joinMeetingTitle: string;
      optionsTitle: string;
      joinMeeting: string;
      cancel: string;
    };
    status: {
      scheduled: string;
      inProgress: string;
      completed: string;
      cancelled: string;
      noShow: string;
    };
    attendeeCount: string;
    syncHistory: {
      completed: string;
      failed: string;
      running: string;
      pending: string;
      heading: string;
      refreshTitle: string;
      empty: string;
      eventsCount: string;
      created: string;
      updated: string;
      deleted: string;
      skipped: string;
      started: string;
      completedAt: string;
    };
    time: {
      durationMs: string;
      durationSeconds: string;
      justNow: string;
      minutesAgo: string;
      hoursAgo: string;
      daysAgo: string;
      never: string;
    };
    syncProgress: {
      connecting: string;
      fetching: string;
      processing: string;
      saving: string;
      failed: string;
      complete: string;
    };
    syncStatus: {
      synced: string;
      error: string;
      paused: string;
      disabled: string;
      syncing: string;
      lastSynced: string;
      neverSynced: string;
      syncNow: string;
    };
  };
  workspace: {
    createModal: {
      closeModal: string;
      descPlaceholder: string;
    };
    invitation: {
      resendTitle: string;
      cancelTitle: string;
      expired: string;
    };
    inviteModal: {
      closeModal: string;
      roleLabel: string;
      removeAriaLabel: string;
    };
    pendingModal: {
      closeAriaLabel: string;
    };
    list: {
      invitedBadge: string;
      invitedTitle: string;
      invitedBy: string;
      switchWorkspace: string;
      label: string;
      invitePeople: string;
      inviteAriaLabel: string;
      noWorkspaces: string;
      invitations: string;
      newWorkspace: string;
    };
    switcher: {
      switchWorkspace: string;
      loading: string;
      noWorkspaces: string;
      createNew: string;
    };
  };
  onboarding: {
    businessTypeTitle: string;
    businessTypeSubtitle: string;
    agencyTitle: string;
    agencyTagline: string;
    agencyPoint1: string;
    agencyPoint2: string;
    agencyPoint3: string;
    developerTitle: string;
    developerTagline: string;
    developerPoint1: string;
    developerPoint2: string;
    developerPoint3: string;
    permanentNote: string;
    continueCta: string;
    saving: string;
    error: string;
  };
  developerDashboard: {
    title: string;
    periodMonth: string;
    periodQuarter: string;
    periodYear: string;
    periodNounMonth: string;
    periodNounQuarter: string;
    periodNounYear: string;
    newProject: string;
    emptyTitle: string;
    emptyBody: string;
    vsPrevious: string;
    kpiTotalSalesValue: string;
    kpiUnits: string;
    kpiSalesInPeriod: string;
    kpiCollected: string;
    kpiCollectedOf: string;
    kpiNewLeads: string;
    kpiQualifiedLeads: string;
    kpiConversionRate: string;
    kpiAverageDealValue: string;
    kpiPipelineValue: string;
    kpiOutstanding: string;
    kpiCancellationRate: string;
    kpiTargetAchievement: string;
    chartSalesTrend: string;
    chartRevenueVsTarget: string;
    chartSalesByProject: string;
    chartSalesByAgent: string;
    chartLeadFunnel: string;
    chartInventoryStatus: string;
    chartCollectionsForecast: string;
    noAgentData: string;
    noLeadData: string;
    unassigned: string;
    uncalledBalance: string;
    needsAttention: string;
    expiringOptions: string;
    noExpiringOptions: string;
    overdueCalls: string;
    noOverdueCalls: string;
    pendingModifications: string;
    noPendingModifications: string;
    expiresIn: string;
    expired: string;
    daysOverdue: string;
    target: string;
    achieved: string;
    loadFailed: string;
    retry: string;
  };
  developer: {
    navProjects: string;
    navInventory: string;
    navBuyers: string;
    navCollections: string;
    navModifications: string;
    statusAvailable: string;
    statusOptioned: string;
    statusReserved: string;
    statusContractSigned: string;
    statusDeedSigned: string;
    statusDelivered: string;
    inventoryTitle: string;
    inventorySubtitle: string;
    inventoryEmpty: string;
    inventoryTableView: string;
    inventoryBuildingView: string;
    filterAllProjects: string;
    filterAllBuildings: string;
    filterAllStatuses: string;
    filterAllTypes: string;
    filterAllAgents: string;
    filterMinPrice: string;
    filterMaxPrice: string;
    clearFilters: string;
    colUnit: string;
    colDetails: string;
    colPrice: string;
    colBuilding: string;
    colFloor: string;
    colType: string;
    colBedrooms: string;
    colArea: string;
    colOrientation: string;
    colListPrice: string;
    colDiscount: string;
    colFinalPrice: string;
    colOwner: string;
    colAgent: string;
    colReservedAt: string;
    colContractAt: string;
    colPaymentStatus: string;
    unitsCount: string;
    paymentsNone: string;
    paymentsPaid: string;
    paymentsPartial: string;
    paymentsOverdue: string;
    cancelSale: string;
    cancelSaleTitle: string;
    cancelSaleBody: string;
    cancelSaleReason: string;
    cancelSaleReasonPlaceholder: string;
    cancelSaleConfirm: string;
    cancelSaleFailed: string;
    collectionsTitle: string;
    collectionsSubtitle: string;
    collectionsEmpty: string;
    dueThisMonth: string;
    collected: string;
    outstanding: string;
    overdue: string;
    agingTitle: string;
    aging030: string;
    aging3160: string;
    aging60: string;
    colCallNumber: string;
    colProjectUnit: string;
    colBuyer: string;
    colMilestone: string;
    colAmount: string;
    colDueDate: string;
    colStatus: string;
    markPaid: string;
    markPaidFailed: string;
    callStatusDraft: string;
    callStatusIssued: string;
    callStatusSentToBank: string;
    callStatusPaid: string;
    callStatusOverdue: string;
    modificationsTitle: string;
    modificationsSubtitle: string;
    modificationsEmpty: string;
    colReference: string;
    colRequest: string;
    colCategory: string;
    colQuote: string;
    colRequested: string;
    tmaStatusRequested: string;
    tmaStatusFeasibilityApproved: string;
    tmaStatusQuoteSent: string;
    tmaStatusAccepted: string;
    tmaStatusRejected: string;
    tmaStatusCompleted: string;
    launchDate: string;
    salesTargetUnits: string;
    revenueTarget: string;
    salesCompletion: string;
    soldOfTarget: string;
    bedrooms: string;
    discount: string;
    salesAgent: string;
    noAgent: string;
    reservedOn: string;
    contractSignedOn: string;
    loadFailed: string;
  };
  developerCrm: {
    nav: {
      followUps: string;
      siteVisits: string;
      teamActivity: string;
      groupSales: string;
      groupDevelopment: string;
      groupWorkspace: string;
    };
    lead: {
      brief: string;
      owner: string;
      unassigned: string;
      source: string;
      campaign: string;
      project: string;
      noProject: string;
      typology: string;
      typologyPlaceholder: string;
      budget: string;
      budgetMin: string;
      budgetMax: string;
      location: string;
      score: string;
      scoreHint: string;
      lastContact: string;
      never: string;
      nextFollowUp: string;
      none: string;
      myLeads: string;
      allOwners: string;
      overdue: string;
      scoreFactor_contactable: string;
      scoreFactor_budget: string;
      scoreFactor_project: string;
      scoreFactor_source: string;
      scoreFactor_stage: string;
      scoreFactor_recency: string;
    };
    sources: {
      facebook: string;
      instagram: string;
      google_ads: string;
      website: string;
      portal: string;
      broker: string;
      walk_in: string;
      referral: string;
      event: string;
      phone: string;
      whatsapp: string;
      other: string;
    };
    taskTypes: {
      call: string;
      follow_up: string;
      send_price_list: string;
      send_floor_plan: string;
      reservation: string;
      payment_reminder: string;
      contract: string;
      other: string;
    };
    tasks: {
      title: string;
      subtitle: string;
      groupOverdue: string;
      groupToday: string;
      groupUpcoming: string;
      groupDone: string;
      empty: string;
      add: string;
      titleField: string;
      titlePlaceholder: string;
      type: string;
      due: string;
      assignee: string;
      buyer: string;
      pickBuyer: string;
      save: string;
      complete: string;
      reopen: string;
      remove: string;
      scopeMine: string;
      scopeAll: string;
      showDone: string;
      daysLate: string;
      loadFailed: string;
      saveFailed: string;
      widgetTitle: string;
      widgetAllClear: string;
      openAll: string;
      newAddedFor: string;
    };
    visits: {
      title: string;
      subtitle: string;
      tabUpcoming: string;
      tabNeedsOutcome: string;
      tabPast: string;
      empty: string;
      schedule: string;
      project: string;
      unit: string;
      anyUnit: string;
      when: string;
      duration: string;
      host: string;
      notes: string;
      book: string;
      bookFailed: string;
      recordOutcome: string;
      attended: string;
      noShow: string;
      outcome: string;
      outcome_interested: string;
      outcome_needs_follow_up: string;
      outcome_reserved: string;
      outcome_not_interested: string;
      comments: string;
      save: string;
      saveFailed: string;
      statusScheduled: string;
      statusCompleted: string;
      statusNoShow: string;
      statusCancelled: string;
      followUpNote: string;
      loadFailed: string;
    };
    customer: {
      tab: string;
      logCall: string;
      addTask: string;
      scheduleVisit: string;
      contractValue: string;
      paid: string;
      due: string;
      overdue: string;
      units: string;
      noUnits: string;
      relationBuyer: string;
      relationOption: string;
      visits: string;
      noVisits: string;
      tasks: string;
      noTasks: string;
      modifications: string;
      afterSales: string;
      cancellations: string;
      activity: string;
      files: string;
      callsLogged: string;
      loadFailed: string;
      unitOverdueNote: string;
    };
    call: {
      title: string;
      direction: string;
      outbound: string;
      inbound: string;
      answered: string;
      noAnswer: string;
      duration: string;
      note: string;
      followUp: string;
      save: string;
      failed: string;
    };
    team: {
      title: string;
      subtitle: string;
      colAgent: string;
      callsMade: string;
      callsAnswered: string;
      visitsScheduled: string;
      visitsAttended: string;
      followUpsDone: string;
      followUpsOverdue: string;
      leadsAssigned: string;
      dealsCreated: string;
      dealsClosed: string;
      funnelTitle: string;
      funnelLeads: string;
      funnelVisits: string;
      funnelReservations: string;
      funnelContracts: string;
      funnelPaid: string;
      stepConversion: string;
      note: string;
      empty: string;
      loadFailed: string;
    };
  };
  developerSales: {
    nav: {
      reports: string;
      templates: string;
    };
    reserve: {
      searchBuyer: string;
      fee: string;
      agent: string;
      agentMe: string;
      feeReceived: string;
      feeReceivedOn: string;
    };
    stage: {
      title: string;
      reserved: string;
      contract_pending: string;
      contract_signed: string;
      plan_active: string;
      completed: string;
    };
    docs: {
      failed: string;
      deposit: string;
      depositReceived: string;
      depositPending: string;
      editDeposit: string;
      generateReservation: string;
      generateContract: string;
      none: string;
      send: string;
      resend: string;
      void: string;
      sentOk: string;
      acceptedBy: string;
      missingFields: string;
      defaultTemplate: string;
      status_draft: string;
      status_sent: string;
      status_accepted: string;
      status_void: string;
    };
    cancel: {
      refund: string;
      refundHint: string;
      callsRemain: string;
      commissionWithdrawn: string;
      commissionSettled: string;
    };
    collections: {
      reminders: string;
      step_before7: string;
      step_due: string;
      step_late3: string;
      step_late7: string;
      step_late14: string;
      paymentTitle: string;
      paymentDate: string;
      paymentMethod: string;
      paymentReference: string;
      recordPayment: string;
      method_bank_transfer: string;
      method_check: string;
      method_cash: string;
      method_credit_card: string;
      method_other: string;
    };
    project: {
      commission: string;
      commissionHint: string;
    };
    templates: {
      title: string;
      subtitle: string;
      kind_reservation: string;
      kind_contract: string;
      kind_payment_reminder: string;
      scope: string;
      scopeWorkspace: string;
      source_own: string;
      source_workspace: string;
      source_builtin: string;
      name: string;
      subject: string;
      wording: string;
      placeholders: string;
      unknown: string;
      save: string;
      saved: string;
      saveFailed: string;
      restore: string;
      restored: string;
      preview: string;
      previewNote: string;
      loadFailed: string;
    };
    reports: {
      title: string;
      subtitle: string;
      exportCsv: string;
      from: string;
      to: string;
      loadFailed: string;
      empty: string;
      unknownSource: string;
      marketingNote: string;
      spendTitle: string;
      spendHint: string;
      spendMonth: string;
      spendAmount: string;
      spendFailed: string;
      tab_sales: string;
      tab_marketing: string;
      tab_inventory: string;
      tab_financial: string;
      groupBy_source: string;
      groupBy_campaign: string;
      commissionStatus_accrued: string;
      commissionStatus_realized: string;
      commissionStatus_paid: string;
      col_name: string;
      col_units: string;
      col_value: string;
      col_averagePrice: string;
      col_share: string;
      col_month: string;
      col_source: string;
      col_campaign: string;
      col_leads: string;
      col_qualified: string;
      col_visits: string;
      col_reservations: string;
      col_sales: string;
      col_revenue: string;
      col_spend: string;
      col_costPerLead: string;
      col_costPerSale: string;
      col_revenuePerSpend: string;
      col_status: string;
      col_unit: string;
      col_project: string;
      col_type: string;
      col_price: string;
      col_daysOnMarket: string;
      col_called: string;
      col_collected: string;
      col_amount: string;
      sum_unitsSold: string;
      sum_salesValue: string;
      sum_averagePrice: string;
      sum_discountsGiven: string;
      sum_newLeads: string;
      sum_salesFromLeads: string;
      sum_revenue: string;
      sum_spend: string;
      sum_costPerLead: string;
      sum_costPerSale: string;
      sum_medianResponseHours: string;
      sum_respondedWithin24h: string;
      sum_totalUnits: string;
      sum_availableUnits: string;
      sum_soldUnits: string;
      sum_averageSellingPrice: string;
      sum_pricePerSquareMetre: string;
      sum_salesVelocity: string;
      sum_called: string;
      sum_collected: string;
      sum_outstanding: string;
      sum_overdue: string;
      table_byProject: string;
      table_byMonth: string;
      table_byType: string;
      table_byAgent: string;
      table_byCity: string;
      table_bySource: string;
      table_bySourceCampaign: string;
      table_byStatus: string;
      table_bestSellingTypes: string;
      table_slowMoving: string;
      table_collectionsByMonth: string;
      table_commissions: string;
    };
  };
  developerAlerts: {
    nav: string;
    title: string;
    subtitle: string;
    readOnly: string;
    enabled: string;
    save: string;
    saved: string;
    saveFailed: string;
    loadFailed: string;
    lastFired: string;
    neverFired: string;
    param_minutes: string;
    param_days: string;
    param_tolerancePercent: string;
    param_minAvailablePercent: string;
    param_ratePercent: string;
    param_minDeals: string;
    rule_lead_no_response_title: string;
    rule_lead_no_response_desc: string;
    rule_lead_no_followup_title: string;
    rule_lead_no_followup_desc: string;
    rule_reservation_created_title: string;
    rule_reservation_created_desc: string;
    rule_contract_signed_title: string;
    rule_contract_signed_desc: string;
    rule_project_behind_target_title: string;
    rule_project_behind_target_desc: string;
    rule_low_inventory_title: string;
    rule_low_inventory_desc: string;
    rule_high_cancellations_title: string;
    rule_high_cancellations_desc: string;
    access: {
      who: string;
      team: string;
      managers: string;
      uploadAs: string;
      failed: string;
    };
  };
  // <realEstate:type>
  realEstate: {
    nav: {
      properties: string;
      programs: string;
      buyers: string;
      viewings: string;
      mandates: string;
      offers: string;
      services: string;
      commissions: string;
    };
    subjects: {
      Lead: string;
      Interest: string;
      Property: string;
      Mandate: string;
    };
    fields: {
      reference: string;
      title: string;
      propertyType: string;
      propertyStatus: string;
      stage: string;
      pipelineName: string;
      price: string;
      city: string;
      district: string;
      postalCode: string;
      countryCode: string;
      surfaceArea: string;
      rooms: string;
      bedrooms: string;
      bathrooms: string;
      floor: string;
      buildYear: string;
      energyRating: string;
      hasParking: string;
      hasGarden: string;
      daysOnMarket: string;
      listedAt: string;
      vendorEmail: string;
      interestStatus: string;
      buyerFirstName: string;
      buyerLastName: string;
      buyerEmail: string;
      propertyTitle: string;
      propertyCity: string;
      propertyPrice: string;
      lastActivityAt: string;
      mandateType: string;
      mandateStatus: string;
      startDate: string;
      endDate: string;
      daysToExpiry: string;
      askingPrice: string;
      commissionPercent: string;
      signedAt: string;
      vendorFirstName: string;
      vendorLastName: string;
    };
    properties: {
      title: string;
      subtitle: string;
      new: string;
      edit: string;
      searchPlaceholder: string;
      viewGrid: string;
      viewBoard: string;
      openBoard: string;
      empty: {
        title: string;
        body: string;
        filtered: string;
      };
      filters: {
        status: string;
        type: string;
        city: string;
        minPrice: string;
        maxPrice: string;
        minBedrooms: string;
        all: string;
        clear: string;
      };
      status: {
        prospect: string;
        valuation: string;
        mandate: string;
        live: string;
        under_offer: string;
        sold: string;
        withdrawn: string;
        expired: string;
      };
      types: {
        apartment: string;
        house: string;
        land: string;
        commercial: string;
        parking: string;
        building: string;
        other: string;
      };
      transaction: {
        sale: string;
        rent: string;
      };
      form: {
        sectionBasics: string;
        sectionAddress: string;
        sectionDetails: string;
        sectionAmenities: string;
        sectionPeople: string;
        reference: string;
        referencePlaceholder: string;
        title: string;
        description: string;
        type: string;
        transaction: string;
        status: string;
        price: string;
        currency: string;
        addressLine: string;
        addressPublic: string;
        city: string;
        district: string;
        postalCode: string;
        country: string;
        latitude: string;
        longitude: string;
        surface: string;
        landArea: string;
        rooms: string;
        bedrooms: string;
        bathrooms: string;
        floor: string;
        buildYear: string;
        energyRating: string;
        energyNone: string;
        elevator: string;
        parking: string;
        balcony: string;
        terrace: string;
        garden: string;
        pool: string;
        furnished: string;
        vendor: string;
        vendorNone: string;
        owner: string;
        ownerNone: string;
        customFields: string;
        create: string;
        save: string;
        required: string;
      };
      card: {
        daysOnMarket: string;
        noPhoto: string;
        bedrooms: string;
        surface: string;
        vendorUnknown: string;
      };
      detail: {
        back: string;
        delete: string;
        deleteConfirm: string;
        daysOnMarket: string;
        listedOn: string;
        notListed: string;
        vendor: string;
        agent: string;
        tabs: {
          overview: string;
          media: string;
          mandate: string;
          interests: string;
          offers: string;
          viewings: string;
          activity: string;
          matches: string;
        };
        publish: {
          title: string;
          published: string;
          draft: string;
          hint: string;
          publish: string;
          copyLink: string;
          unpublish: string;
          rotate: string;
          rotateConfirm: string;
          copied: string;
          link: string;
          error: string;
        };
      };
      errors: {
        load: string;
        loadOne: string;
        save: string;
        delete: string;
        notFound: string;
      };
    };
    projects: {
      title: string;
      subtitle: string;
      stats: {
        totalUnits: string;
        available: string;
        reserved: string;
        reservedHint: string;
        sold: string;
        sellThrough: string;
        remainingInventory: string;
        stage: string;
        stageHint: string;
      };
      status: {
        study: string;
        commercialization: string;
        construction: string;
        delivery: string;
        completed: string;
      };
      type: {
        residential: string;
        mixed_use: string;
        commercial: string;
        subdivision: string;
        renovation: string;
        other: string;
      };
      fields: {
        projectType: string;
        developerName: string;
        websiteUrl: string;
      };
      tabs: {
        overview: string;
        media: string;
      };
      media: {
        empty: string;
        addVideoLink: string;
        kind: {
          photo: string;
          drone: string;
          '3d_render': string;
          plan: string;
          quarterly_report: string;
          video: string;
          document: string;
        };
      };
    };
    media: {
      title: string;
      upload: string;
      dropHint: string;
      addLink: string;
      linkUrl: string;
      linkKind: string;
      addLinkSubmit: string;
      empty: string;
      reorderHint: string;
      kind: {
        photo: string;
        floorplan: string;
        video: string;
        virtual_tour: string;
      };
      cover: string;
      setCover: string;
      caption: string;
      remove: string;
      removeConfirm: string;
      openLink: string;
      link: string;
      sectionEmpty: string;
      sections: {
        photos: string;
        videos: string;
        floorplans: string;
        virtualTours: string;
      };
      dropzone: {
        title: string;
        hint: string;
      };
      lightbox: {
        title: string;
        open: string;
        previous: string;
        next: string;
        unavailable: string;
      };
      errors: {
        load: string;
        upload: string;
        badType: string;
        tooLarge: string;
        remove: string;
        link: string;
        storage: string;
      };
    };
    mandates: {
      title: string;
      subtitle: string;
      new: string;
      edit: string;
      empty: string;
      emptyForProperty: string;
      queue: {
        expiring: string;
        active: string;
        expired: string;
        all: string;
      };
      queueHint: string;
      type: {
        simple: string;
        exclusive: string;
        semi_exclusive: string;
      };
      status: {
        draft: string;
        active: string;
        expired: string;
        terminated: string;
        completed: string;
      };
      fee: {
        percent: string;
        fixed: string;
      };
      payer: {
        vendor: string;
        buyer: string;
        shared: string;
      };
      form: {
        property: string;
        vendor: string;
        reference: string;
        referencePlaceholder: string;
        type: string;
        status: string;
        startDate: string;
        endDate: string;
        renewalTerms: string;
        askingPrice: string;
        netToVendor: string;
        feeType: string;
        commission: string;
        feeFixed: string;
        feePayer: string;
        owner: string;
        notes: string;
        signedAt: string;
        create: string;
        save: string;
        propertyRequired: string;
        vendorRequired: string;
      };
      expiresIn: string;
      endsToday: string;
      expiredAgo: string;
      noEnd: string;
      renew: string;
      renewTitle: string;
      renewUntil: string;
      terminate: string;
      terminateTitle: string;
      terminateReason: string;
      markExpired: string;
      activate: string;
      delete: string;
      deleteConfirm: string;
      price: {
        title: string;
        reduce: string;
        newPrice: string;
        reason: string;
        empty: string;
        drop: string;
        rise: string;
        save: string;
      };
      errors: {
        load: string;
        save: string;
        delete: string;
        dates: string;
        activeExists: string;
      };
      reportEvery: string;
      reportNone: string;
      vendorLink: string;
      vendorLinkCopied: string;
      previewReport: string;
    };
    interests: {
      title: string;
      new: string;
      empty: string;
      emptyForLead: string;
      attachProperty: string;
      status: {
        active: string;
        won: string;
        lost: string;
        on_hold: string;
      };
      source: {
        manual: string;
        enquiry: string;
        portal: string;
        match: string;
        walk_in: string;
        referral: string;
      };
      form: {
        buyer: string;
        buyerPlaceholder: string;
        property: string;
        stage: string;
        owner: string;
        source: string;
        notes: string;
        create: string;
        save: string;
        buyerRequired: string;
        propertyRequired: string;
      };
      markWon: string;
      markLost: string;
      reopen: string;
      lostReason: string;
      remove: string;
      removeConfirm: string;
      errors: {
        load: string;
        save: string;
        delete: string;
        duplicate: string;
        noPipeline: string;
      };
    };
    offers: {
      title: string;
      subtitle: string;
      new: string;
      empty: string;
      emptyForProperty: string;
      status: {
        pending: string;
        accepted: string;
        rejected: string;
        withdrawn: string;
        expired: string;
      };
      form: {
        buyer: string;
        amount: string;
        expiresAt: string;
        deposit: string;
        financing: string;
        financingNone: string;
        conditions: string;
        addCondition: string;
        conditionNote: string;
        create: string;
        amountRequired: string;
        buyerRequired: string;
      };
      financing: {
        cash: string;
        mortgage: string;
        mixed: string;
      };
      condition: {
        finance: string;
        survey: string;
        chain: string;
        other: string;
      };
      competing: string;
      highest: string;
      accept: {
        action: string;
        title: string;
        body: string;
        competing: string;
        confirm: string;
      };
      reject: {
        action: string;
        title: string;
        confirm: string;
      };
      withdraw: {
        action: string;
        title: string;
        body: string;
        confirm: string;
      };
      decisionReason: {
        another_offer_accepted: string;
        declined: string;
        withdrawn: string;
      };
      share: {
        action: string;
        copied: string;
        rotate: string;
        hint: string;
      };
      validUntil: string;
      vendor: {
        title: string;
        intro: string;
        amount: string;
        conditions: string;
        noConditions: string;
        accept: string;
        decline: string;
        acceptedMsg: string;
        declinedMsg: string;
        closedMsg: string;
        invalid: string;
        failed: string;
      };
      errors: {
        load: string;
        save: string;
        decide: string;
        decided: string;
        unavailable: string;
      };
    };
    viewings: {
      title: string;
      subtitle: string;
      new: string;
      empty: string;
      emptyForProperty: string;
      upcoming: string;
      past: string;
      needsFeedback: string;
      schedule: {
        title: string;
        property: string;
        buyer: string;
        buyerNone: string;
        start: string;
        duration: string;
        notes: string;
        submit: string;
        titleFor: string;
        propertyRequired: string;
        startRequired: string;
      };
      status: {
        scheduled: string;
        in_progress: string;
        completed: string;
        cancelled: string;
        no_show: string;
      };
      feedback: {
        title: string;
        add: string;
        edit: string;
        attended: string;
        interestLevel: string;
        dimensions: {
          price: string;
          condition: string;
          location: string;
          layout: string;
        };
        verdict: {
          negative: string;
          neutral: string;
          positive: string;
        };
        verdictNone: string;
        comments: string;
        save: string;
        recorded: string;
        summary: string;
        none: string;
      };
      errors: {
        load: string;
        save: string;
        feedback: string;
      };
    };
    activity: {
      title: string;
      empty: string;
      propertyCreated: string;
      propertyUpdated: string;
      propertyStatus: string;
      propertyStage: string;
      interestCreated: string;
      interestStage: string;
      interestStatus: string;
      mandateCreated: string;
      mandateStatus: string;
      mandateRenewed: string;
      priceChanged: string;
      offerMade: string;
      offerAccepted: string;
      offerRejected: string;
      offerWithdrawn: string;
      viewingBooked: string;
      viewingFeedback: string;
    };
    pipelines: {
      subject: string;
      subjectHint: string;
      subjectLocked: string;
      interestEmpty: string;
      propertyEmpty: string;
      dropHere: string;
      moveFailed: string;
    };
    briefs: {
      title: string;
      subtitle: string;
      new: string;
      edit: string;
      empty: string;
      matchedNow: string;
      form: {
        name: string;
        namePlaceholder: string;
        priceMin: string;
        priceMax: string;
        surfaceMin: string;
        bedroomsMin: string;
        roomsMin: string;
        types: string;
        cities: string;
        districts: string;
        listHint: string;
        mustHave: string;
        parking: string;
        elevator: string;
        garden: string;
        terrace: string;
        balcony: string;
        notify: string;
        active: string;
        notes: string;
        create: string;
        save: string;
        nameRequired: string;
      };
      delete: string;
      deleteConfirm: string;
      insights: {
        title: string;
        none: string;
        viewings: string;
        averageInterest: string;
        suggestion: string;
        apply: string;
      };
      errors: {
        load: string;
        save: string;
        delete: string;
      };
    };
    matches: {
      title: string;
      subtitle: string;
      empty: string;
      score: string;
      status: {
        new: string;
        notified: string;
        dismissed: string;
        interested: string;
        converted: string;
      };
      reasons: {
        price_fit: string;
        location: string;
        type: string;
        size: string;
        must_haves: string;
      };
      actions: {
        createInterest: string;
        dismiss: string;
      };
      viaBrief: string;
      errors: {
        load: string;
        update: string;
      };
    };
    vendorReport: {
      invalid: string;
      failed: string;
      updated: string;
      askingPrice: string;
      daysOnMarket: string;
      enquiries: string;
      viewings: string;
      offers: string;
      noOffers: string;
      offersSummary: string;
      feedback: string;
      noFeedback: string;
      feedbackIntro: string;
      averageInterest: string;
      pricePosition: string;
      pricePositionBody: string;
    };
    automations: {
      triggerType: string;
      stageChanged: string;
      created: string;
      mandateExpiring: string;
      withinDays: string;
      createdHint: string;
      expiringHint: string;
      anyBoard: string;
    };
    intake: {
      button: string;
      title: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      message: string;
      property: string;
      submit: string;
      created: string;
      existing: string;
      suppressed: string;
      contact: string;
      contactSearchPlaceholder: string;
      orNewContact: string;
      contactRequired: string;
      errors: {
        save: string;
      };
    };
    listing: {
      invalid: string;
      gallery: string;
      enquiryTitle: string;
      sent: string;
      failed: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      message: string;
      send: string;
    };
    commissions: {
      title: string;
      subtitle: string;
      mine: string;
      empty: string;
      basis: string;
      markPaid: string;
      markPaidConfirm: string;
      tabs: {
        forecast: string;
        accrued: string;
        realized: string;
        paid: string;
      };
      status: {
        accrued: string;
        realized: string;
        paid: string;
        cancelled: string;
      };
      earnings: {
        title: string;
        accrued: string;
        realized: string;
        paid: string;
      };
      forecast: {
        hint: string;
        potential: string;
        weighted: string;
        empty: string;
        listings: string;
      };
      roles: {
        listing_agent: string;
        selling_agent: string;
        introducer: string;
        agency: string;
        manager: string;
      };
      shares: {
        title: string;
        role: string;
        member: string;
        percent: string;
        add: string;
        total: string;
        over: string;
        save: string;
        edit: string;
        agency: string;
      };
      errors: {
        load: string;
        save: string;
      };
    };
  };
  // </realEstate:type>
  // <developerGuide:type>
  developerGuide: {
    howItWorks: string;
    showGuide: string;
    hideGuide: string;
    nav: {
      groupOverview: string;
      groupSetup: string;
      groupSell: string;
      groupAfterSale: string;
      groupPerformance: string;
      groupTools: string;
      toggleGroup: string;
    };
    desc: {
      home: string;
      alerts: string;
      projects: string;
      inventory: string;
      templates: string;
      buyers: string;
      siteVisits: string;
      followUps: string;
      collections: string;
      modifications: string;
      commissions: string;
      team: string;
      reports: string;
      pages: string;
      kanban: string;
      chat: string;
      meetings: string;
      emailMarketing: string;
      quotes: string;
      invoices: string;
      properties: string;
      viewings: string;
      mandates: string;
      offers: string;
      services: string;
    };
    pages: {
      dashboard: {
        subtitle: string;
        step1: string;
        step2: string;
        step3: string;
      };
      buyers: {
        subtitle: string;
        step1: string;
        step2: string;
        step3: string;
      };
      projects: {
        step1: string;
        step2: string;
        step3: string;
      };
      project: {
        step1: string;
        step2: string;
        step3: string;
      };
      inventory: {
        step1: string;
        step2: string;
        step3: string;
      };
      templates: {
        step1: string;
        step2: string;
        step3: string;
      };
      siteVisits: {
        step1: string;
        step2: string;
        step3: string;
      };
      followUps: {
        step1: string;
        step2: string;
        step3: string;
      };
      collections: {
        step1: string;
        step2: string;
        step3: string;
      };
      modifications: {
        step1: string;
        step2: string;
        step3: string;
      };
      commissions: {
        step1: string;
        step2: string;
        step3: string;
      };
      team: {
        step1: string;
        step2: string;
        step3: string;
      };
      reports: {
        step1: string;
        step2: string;
        step3: string;
      };
      properties: {
        step1: string;
        step2: string;
        step3: string;
      };
      viewings: {
        step1: string;
        step2: string;
        step3: string;
      };
      mandates: {
        step1: string;
        step2: string;
        step3: string;
      };
      offers: {
        step1: string;
        step2: string;
        step3: string;
      };
      alerts: {
        step1: string;
        step2: string;
        step3: string;
      };
    };
    start: {
      title: string;
      body: string;
      step1: string;
      step1Body: string;
      step2: string;
      step2Body: string;
      step3: string;
      step3Body: string;
      step4: string;
      step4Body: string;
    };
  };
  // </developerGuide:type>
  settingsOffer: {
    heading: string;
    permanent: string;
  };
  leadStatusSync: {
    followsStage: string;
  };
  signupLanguage: {
    label: string;
    hint: string;
  };
  notificationBodies: {
    noResponse: string;
    noFollowUp: string;
    forBuyer: string;
    unit: string;
    behindTarget: string;
    lowStock: string;
    cancellations: string;
  };
  notificationEmailNote: {
    quote_accepted: string;
    quote_expired: string;
    invoice_overdue: string;
    offer_received: string;
    offer_accepted: string;
    mandate_expiring: string;
    property_matched: string;
    document_accepted: string;
    call_overdue: string;
    lead_no_response: string;
    lead_no_followup: string;
    project_behind_target: string;
    low_inventory: string;
    high_cancellations: string;
    meetings_booked: string;
    meetings_rescheduled: string;
    meetings_cancelled: string;
  };
  notificationEmailAction: {
    openWorkspace: string;
    readAndReply: string;
    openChat: string;
    openQuote: string;
    openInvoice: string;
    openOffer: string;
    openMandate: string;
    openProperty: string;
    openMatches: string;
    openBuyer: string;
    openCollections: string;
    openFollowUps: string;
    openInventory: string;
    openProjects: string;
    openReports: string;
    openMeetings: string;
    openBoard: string;
  };
  notificationEmailCategory: {
    team: string;
    sales: string;
    meetings: string;
    tasks: string;
  };
  notificationEmail: {
    greeting: string;
    greetingNoName: string;
    inWorkspace: string;
    footer: string;
    manage: string;
  };
  developerCommissions: {
    accrued: string;
    realized: string;
    paid: string;
    empty: string;
    company: string;
  };
  templateSample: {
    developer: string;
    buyerName: string;
    buyerPhone: string;
    project: string;
    projectAddress: string;
    unitType: string;
    agent: string;
    milestone: string;
  };
  developerActivity: {
    taskCreated: string;
    taskCompleted: string;
    callFromAnswered: string;
    callFromMissed: string;
    callToAnswered: string;
    callToMissed: string;
    visitBooked: string;
    visitBookedUnit: string;
    visitDone: string;
    visitMissed: string;
    documentSent: string;
    documentAccepted: string;
  };
  notificationTitles: {
    notContacted: string;
    unitReserved: string;
    unitUnderContract: string;
    overduePayment: string;
    documentAccepted: string;
    followUpWith: string;
    cardDueSoon: string;
    taskOverdue: string;
    taskDueSoon: string;
    mandateEndsTomorrow: string;
    mandateEnds: string;
    buyerMatches: string;
    buyersMatch: string;
    viewingFeedback: string;
    invoiceOverdue: string;
    quoteExpired: string;
    invoiceViewed: string;
    quoteViewed: string;
    quoteAccepted: string;
    quoteRejected: string;
    meetingStartingSoon: string;
    meetingBooked: string;
    meetingRescheduled: string;
    meetingCancelled: string;
    assigned: string;
    mentionedInComment: string;
    repliedToComment: string;
    mentionedInChannel: string;
    joined: string;
    behindTarget: string;
    lowStock: string;
    highCancellations: string;
  };
  buyerPortal: {
    loading: string;
    errors: {
      load: string;
      sendCode: string;
      invalidCode: string;
      submit: string;
      sign: string;
    };
    restricted: {
      title: string;
      expired: string;
      help: string;
    };
    header: {
      clientSpace: string;
      secure: string;
      lock: string;
      unlock: string;
    };
    unitNumber: string;
    groundFloor: string;
    floor: string;
    hero: {
      welcome: string;
      handover: string;
      progress: string;
      percentDone: string;
    };
    tabs: {
      journal: string;
      unit: string;
      financial: string;
      tma: string;
      documents: string;
    };
    journal: {
      title: string;
      subtitle: string;
      drone: string;
      recent: string;
      photo: string;
      emptyTitle: string;
      emptyBody: string;
    };
    protections: {
      title: string;
      guarantee: string;
      guaranteeHint: string;
      architect: string;
      architectHint: string;
      legal: string;
    };
    unit: {
      title: string;
      subtitle: string;
      typology: string;
      area: string;
      floor: string;
      orientation: string;
      annexes: string;
    };
    snags: {
      title: string;
      subtitle: string;
      count: string;
      general: string;
      trade: string;
    };
    financial: {
      lockedTitle: string;
      lockedBody: string;
      codeSentTo: string;
      sendCode: string;
      totalPrice: string;
      totalCalled: string;
      totalPaid: string;
      remaining: string;
      title: string;
      subtitle: string;
      print: string;
      cols: {
        number: string;
        milestone: string;
        tranche: string;
        amount: string;
        status: string;
        document: string;
      };
      viewReceipt: string;
      soon: string;
      empty: string;
    };
    callStatus: {
      draft: string;
      issued: string;
      sent: string;
      "sent_to_bank": string;
      paid: string;
      overdue: string;
    };
    tma: {
      lockedTitle: string;
      lockedBody: string;
      title: string;
      subtitle: string;
      request: string;
      quoted: string;
      estimating: string;
      readyToSign: string;
      techNote: string;
      reviewSign: string;
      signed: string;
      empty: string;
    };
    unlockWithEmail: string;
    tmaStatus: {
      requested: string;
      "feasibility_approved": string;
      "quote_sent": string;
      accepted: string;
      rejected: string;
      completed: string;
    };
    category: {
      finishes: string;
      electrical: string;
      plumbing: string;
      masonry: string;
      flooring: string;
      other: string;
    };
    documents: {
      title: string;
      body: string;
    };
    otp: {
      title: string;
      requestTitle: string;
      requestBody: string;
      sending: string;
      send: string;
      enter: string;
      testCode: string;
      resend: string;
      verifying: string;
      verify: string;
    };
    request: {
      title: string;
      category: string;
      titleLabel: string;
      titlePlaceholder: string;
      details: string;
      detailsPlaceholder: string;
      reviewTitle: string;
      reviewBody: string;
      submitting: string;
      submit: string;
    };
    cancel: string;
    sign: {
      title: string;
      subject: string;
      category: string;
      techNote: string;
      price: string;
      name: string;
      namePlaceholder: string;
      consent: string;
      signing: string;
      submit: string;
    };
  };
  crmDefaults: {
    pipelines: {
      contacts: string;
      buyerJourney: string;
      ownerMandate: string;
      buyerSales: string;
    };
    stages: {
      new: string;
      contacted: string;
      qualified: string;
      nurturing: string;
      lost: string;
      enquiry: string;
      briefRecorded: string;
      viewingBooked: string;
      viewingDone: string;
      offer: string;
      underContract: string;
      closed: string;
      prospect: string;
      valuationBooked: string;
      valuationDone: string;
      mandateSigned: string;
      live: string;
      underOffer: string;
      sold: string;
      siteVisit: string;
      negotiation: string;
      reserved: string;
      won: string;
    };
  };
  developerProjectList: {
    searchPlaceholder: string;
    allStatuses: string;
    emptyTitle: string;
    emptyBody: string;
    createFirst: string;
    soldReserved: string;
    tbd: string;
    buildings: string;
    open: string;
    created: string;
  };
  developerProjectDialogs: {
    saving: string;
    close: string;
    optTitle: string;
    unitLine: string;
    optHolder: string;
    loadingBuyers: string;
    optDuration: string;
    h24: string;
    h48: string;
    h72: string;
    d7: string;
    optNote: string;
    optSubmit: string;
    optPickBuyer: string;
    optFailed: string;
    resTitle: string;
    resBuyer: string;
    resWhatTitle: string;
    resWhat1: string;
    resWhat2: string;
    resWhat3: string;
    resSubmit: string;
    resSaving: string;
    resPickBuyer: string;
    resFailed: string;
    certTitle: string;
    certTarget: string;
    certDoc: string;
    certDocHint: string;
    certDocPlaceholder: string;
    certAutoTitle: string;
    certAutoBody: string;
    certSubmit: string;
    certSaving: string;
    certFailed: string;
    tmaNewTitle: string;
    tmaBuyer: string;
    tmaHold: string;
    tmaNoBuyer: string;
    tmaCategory: string;
    catElectrical: string;
    catPlumbing: string;
    catPartitions: string;
    catFinishes: string;
    catOther: string;
    tmaSummary: string;
    tmaSummaryHint: string;
    tmaSummaryPlaceholder: string;
    tmaDescription: string;
    tmaDescriptionPlaceholder: string;
    tmaCost: string;
    tmaCostHint: string;
    tmaQuote: string;
    tmaQuoteHint: string;
    tmaSubmit: string;
    tmaFailed: string;
    tmaRequired: string;
    revTitle: string;
    revNote: string;
    revNotePlaceholder: string;
    revCost: string;
    revQuote: string;
    revSigned: string;
    revSignedPlaceholder: string;
    revApprove: string;
    revAccept: string;
    revAcceptConfirm: string;
    revFailed: string;
    lotEditTitle: string;
    lotNewTitle: string;
    lotNumber: string;
    lotNumberHint: string;
    building: string;
    noBuilding: string;
    type: string;
    typeApartment: string;
    typeHouse: string;
    typeParking: string;
    typeBox: string;
    typeCellar: string;
    typeCommercial: string;
    typology: string;
    typStudio: string;
    typT1: string;
    typT2: string;
    typT3: string;
    typT4: string;
    typT5: string;
    typDuplex: string;
    floorLevel: string;
    floorPlaceholder: string;
    orientation: string;
    oriS: string;
    oriSW: string;
    oriSE: string;
    oriW: string;
    oriE: string;
    oriN: string;
    oriNW: string;
    oriNE: string;
    surface: string;
    terrace: string;
    balcony: string;
    garden: string;
    basePrice: string;
    vatRate: string;
    total: string;
    lotRequired: string;
    lotDiscountRange: string;
    lotSubmitNew: string;
    lotSubmitEdit: string;
    lotFailed: string;
  };
  developerProjectPage: {
    notFound: string;
    loadFailed: string;
    back: string;
    addUnit: string;
    deliveryTarget: string;
    guarantee: string;
    statTotal: string;
    statAvailable: string;
    statReserved: string;
    statSold: string;
    tabOverview: string;
    tabMedia: string;
    tabStacking: string;
    tabMilestones: string;
    tabTma: string;
    tabTable: string;
    infoTitle: string;
    fieldReference: string;
    fieldName: string;
    fieldCommercialName: string;
    fieldType: string;
    fieldStatus: string;
    fieldDeveloper: string;
    fieldArchitect: string;
    fieldPermit: string;
    fieldGuarantee: string;
    fieldNotary: string;
    fieldAddress: string;
    fieldCompletion: string;
    fieldWebsite: string;
    fieldMap: string;
    fieldDescription: string;
    filterBuilding: string;
    allBuildings: string;
    legendHasTma: string;
    noUnitsTitle: string;
    noUnitsBody: string;
    unitsCount: string;
    activeTma: string;
    floorGround: string;
    floorBasement: string;
    floorN: string;
    milestonesTitle: string;
    milestonesBody: string;
    stage: string;
    certified: string;
    certify: string;
    callsTitle: string;
    callsBody: string;
    callsCount: string;
    callsEmpty: string;
    colCall: string;
    colUnit: string;
    colDetails: string;
    colPrice: string;
    colBuyer: string;
    colMilestone: string;
    colTranche: string;
    colAmount: string;
    colStatus: string;
    colInvoice: string;
    unassigned: string;
    viewInvoice: string;
    tmaTotal: string;
    tmaPending: string;
    tmaRevenue: string;
    tmaTitle: string;
    tmaBody: string;
    tmaEmpty: string;
    tmaEmptyBody: string;
    colReference: string;
    colCategory: string;
    colTitle: string;
    colCost: string;
    colQuote: string;
    colActions: string;
    review: string;
    tableTitle: string;
    tableCount: string;
    colBuilding: string;
    colType: string;
    colFloor: string;
    colSurface: string;
    colPriceHt: string;
    colPriceTtc: string;
    colBuyerHolder: string;
    mainBuilding: string;
    floorShortGround: string;
    holdFor: string;
    edit: string;
    unitCard: string;
    unitTitle: string;
    close: string;
    currentStatus: string;
    putOnHold: string;
    reserve: string;
    releaseHold: string;
    confirmReserve: string;
    reservedNote: string;
    portalTitle: string;
    portalBadge: string;
    portalBody: string;
    registeredBuyer: string;
    optionHolder: string;
    noPurchaser: string;
    linkCopied: string;
    copyLink: string;
    openPortal: string;
    saleDocs: string;
    specs: string;
    typology: string;
    surface: string;
    floor: string;
    orientation: string;
    floorValue: string;
    pricing: string;
    priceHt: string;
    vat: string;
    priceTtc: string;
    customizations: string;
    requestTma: string;
    noTmaOnLot: string;
    editUnit: string;
    releaseConfirm: string;
    releaseFailed: string;
    released: string;
    portalCopied: string;
    toastSaved: string;
    toastOnHold: string;
    toastReserved: string;
    toastCertified: string;
    toastTmaCreated: string;
    toastTmaUpdated: string;
    unitStatus: {
      available: string;
      optioned: string;
      reserved: string;
      contract_signed: string;
      deed_signed: string;
      delivered: string;
    };
    tmaStatus: {
      requested: string;
      feasibility_approved: string;
      quote_sent: string;
      accepted: string;
      rejected: string;
      completed: string;
    };
    callStatus: {
      draft: string;
      issued: string;
      sent_to_bank: string;
      paid: string;
      overdue: string;
    };
    tmaCategory: {
      electrical: string;
      plumbing: string;
      partitions: string;
      finishes: string;
      other: string;
    };
    programStatus: {
      study: string;
      commercialization: string;
      construction: string;
      delivery: string;
      completed: string;
    };
    projectType: {
      residential: string;
      mixed_use: string;
      commercial: string;
      subdivision: string;
      renovation: string;
      other: string;
    };
  };
  developerAutoTasks: {
    reservationFollowUp: string;
    countersignedCopy: string;
    followUpWith: string;
    callBack: string;
    visitFollowUp: string;
    visitRebook: string;
  };
  crmList: {
    buyer: string;
    property: string;
    vendor: string;
    stage: string;
    status: string;
    price: string;
    updated: string;
    empty: string;
  };
}
const en: Messages = {
  app: {
    name: 'BorsFlow',
    tagline: 'A single workspace for documents, CRM, and billing',
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
    download: 'Download',
    dismiss: 'Dismiss',
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
    error: 'Error',
    success: 'Success',
    required: 'Required',
    optional: 'Optional',
    none: 'None',
    all: 'All',
    noResults: 'No results found',
    comingSoon: 'Coming soon',
    unexpectedError: 'An unexpected error occurred.',
    tryAgain: 'Try again',
    clearFilters: 'Clear filters',
    previous: 'Previous',
    errorRetry: 'Something went wrong. Please try again.',
    or: 'or',
  },
  language: {
    select: 'Select language',
    en: 'English',
    fr: 'French',
    es: 'Spanish',
    de: 'German',
    ar: 'Arabic',
  },
  nav: {
    dashboard: 'Dashboard',
    invoices: 'Invoices',
    quotes: 'Quotes',
    settings: 'Settings',
    logout: 'Log out',
    crm: 'CRM',
    kanban: 'Kanban',
    products: 'Products',
    pages: 'Pages',
    groupGeneral: 'General',
    home: 'Home',
    chat: 'Chat',
    groupBusiness: 'Business',
    meetings: 'Meetings',
    emailMarketing: 'Email Marketing',
  },
  auth: {
    login: 'Log in',
    logout: 'Log out',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    forgotPassword: 'Forgot password?',
    rememberMe: 'Remember me',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    signInWith: 'Sign in with',
    signIn: 'Sign in',
    nameRequired: 'Name is required',
    passwordTooShort: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
    name: 'Name',
    createWorkspace: 'Create workspace',
    loginTitle: 'Welcome back',
    loginSubtitle: 'Log in to your BorsFlow workspace',
    signingIn: 'Signing in…',
    continueWithGoogle: 'Continue with Google',
    createOne: 'Create one',
    emailRequired: 'Email is required',
    passwordRequired: 'Password is required',
    registrationFailed: 'Registration failed. Please try again.',
    checkEmailTitle: 'Check your email',
    checkEmailBody: "We've sent a verification link to {email}.",
    takingYouToSignIn: 'Taking you to sign in…',
    registerTitle: 'Create your workspace',
    registerSubtitle: 'Start your free BorsFlow workspace',
    passwordPlaceholder: 'At least 8 characters',
    passwordHint: 'Use at least 8 characters.',
    confirmPassword: 'Confirm password',
    creatingWorkspace: 'Creating your workspace…',
    signUpWithGoogle: 'Sign up with Google',
    verifyingEmail: 'Verifying your email…',
    noVerificationToken: 'This verification link is invalid or has expired.',
    emailVerifiedSuccess: 'Your email has been verified!',
    verifyEmailFailed: 'We could not verify your email. Please try again.',
    verifying: 'Verifying…',
    verified: 'Verified',
    verificationFailed: 'Verification failed',
    redirectingToDashboard: 'Redirecting to your dashboard…',
    takingYouToInvitation: 'Taking you to your invitation…',
    backToLogin: 'Back to login',
  },
  workspace: {
    createModal: {
      closeModal: 'Close',
      descPlaceholder: 'What is this workspace for?',
    },
    invitation: {
      resendTitle: 'Resend invitation',
      cancelTitle: 'Cancel invitation',
      expired: 'Expired',
    },
    inviteModal: {
      closeModal: 'Close',
      roleLabel: 'Role',
      removeAriaLabel: 'Remove invite',
    },
    pendingModal: {
      closeAriaLabel: 'Close',
    },
    list: {
      invitedBadge: 'Invited',
      invitedTitle: 'You were invited to this workspace',
      invitedBy: 'Invited by {name}',
      switchWorkspace: 'Switch workspace',
      label: 'Workspace',
      invitePeople: 'Invite people',
      inviteAriaLabel: 'Invite people',
      noWorkspaces: 'No workspaces yet',
      invitations: 'Pending invitations',
      newWorkspace: 'New workspace',
    },
    switcher: {
      switchWorkspace: 'Switch workspace',
      loading: 'Loading workspaces…',
      noWorkspaces: 'No workspaces yet',
      createNew: 'Create new workspace',
    },
  },
  scheduling: {
    attendee: {
      status: {
        invited: 'Invited',
        accepted: 'Accepted',
        declined: 'Declined',
        tentative: 'Tentative',
        attended: 'Attended',
        noShow: 'No-show',
      },
      type: {
        external: 'External',
        internal: 'Internal',
        lead: 'Lead',
        contact: 'Contact',
      },
      removeConfirm: 'Remove this attendee from the meeting?',
      heading: 'Attendees',
      add: 'Add attendee',
      emptyTitle: 'No attendees yet',
      addFirst: 'Add your first attendee',
      changeStatusTitle: 'Change attendance status',
      removeTitle: 'Remove attendee',
    },
    attendeeModal: {
      typeExternal: 'External',
      typeLead: 'Lead',
      typeInternal: 'Internal',
      requiredError: 'Name and email are required.',
      addFailed: 'Failed to add attendee.',
      title: 'Add attendee',
      tabCrm: 'From CRM',
      tabManual: 'Manual entry',
      searchPlaceholder: 'Search leads and contacts…',
      noResults: 'No matches for "{query}".',
      searchPrompt: 'Start typing to search leads and contacts.',
      reviewDetails: 'Review the details before adding this attendee.',
      nameLabel: 'Name',
      namePlaceholder: 'Attendee name',
      emailLabel: 'Email',
      emailPlaceholder: 'attendee@example.com',
      phoneLabel: 'Phone',
      optional: 'optional',
      phonePlaceholder: '+1 (555) 000-0000',
      typeLabel: 'Attendee type',
      cancel: 'Cancel',
      submit: 'Add attendee',
    },
    directConnect: {
      tokenLabelGoogle: 'Google Calendar access token',
      tokenPlaceholderGoogle: 'Paste your Google Calendar access token',
      hintGoogle: 'Generate an access token from your Google Cloud project to connect Google Calendar directly.',
      tokenLabelCalcom: 'Cal.com API key',
      tokenPlaceholderCalcom: 'Paste your Cal.com API key',
      hintCalcom: 'Find your API key in Cal.com under Settings → Developer → API Keys.',
      tokenLabelZoom: 'Zoom access token',
      tokenPlaceholderZoom: 'Paste your Zoom access token',
      hintZoom: 'Generate an access token from your Zoom app to connect Zoom directly.',
      tokenLabelDefault: 'Access token',
      tokenPlaceholderDefault: 'Paste your access token',
      hintDefault: 'Paste the access token for this integration.',
      requiredError: 'An access token is required.',
      connectionFailed: 'Connection failed. Please check your token and try again.',
      networkError: 'A network error occurred. Please try again.',
      titlePrefix: 'Connect {platform}',
      subtitle: 'Connect your account directly using an access token.',
      accountEmailLabel: 'Account email',
      emailPlaceholder: 'you@example.com',
      cancel: 'Cancel',
      connecting: 'Connecting…',
      connect: 'Connect',
    },
    integrationCard: {
      liveUpdatesOn: 'Live updates on',
      liveUpdatesOff: 'Live updates off',
      retrying: 'Retrying…',
      retry: 'Retry',
      syncNowTitle: 'Sync now',
      syncHistoryTitle: 'View sync history',
      disconnectTitle: 'Disconnect',
      syncFrequencyLabel: 'Sync frequency',
      default: 'Default',
      setDefaultTitle: 'Set as default',
    },
    platform: {
      inPerson: 'In person',
      phone: 'Phone',
    },
    meetingCount: '{count} meetings',
    calendar: {
      noMeetingsOnDay: 'No meetings scheduled for this day',
      withLead: 'With {name}',
      join: 'Join',
      selectDatePrompt: 'Select a day to see its meetings',
    },
    card: {
      minutesSuffix: '{count} min',
      today: 'Today',
      tomorrow: 'Tomorrow',
      liveNow: 'Live now',
      withLead: 'With {name}',
      joinMeetingTitle: 'Join meeting',
      optionsTitle: 'More options',
      joinMeeting: 'Join meeting',
      cancel: 'Cancel meeting',
    },
    status: {
      scheduled: 'Scheduled',
      inProgress: 'In progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      noShow: 'No-show',
    },
    attendeeCount: '{count} attendees',
    syncHistory: {
      completed: 'Completed',
      failed: 'Failed',
      running: 'Running',
      pending: 'Pending',
      heading: 'Sync history',
      refreshTitle: 'Refresh',
      empty: 'No sync runs yet.',
      eventsCount: '{count} events',
      created: 'Created',
      updated: 'Updated',
      deleted: 'Deleted',
      skipped: 'Skipped',
      started: 'Started {time}',
      completedAt: 'Completed {time}',
    },
    time: {
      durationMs: '{count}ms',
      durationSeconds: '{count}s',
      justNow: 'Just now',
      minutesAgo: '{count}m ago',
      hoursAgo: '{count}h ago',
      daysAgo: '{count}d ago',
      never: 'Never',
    },
    syncProgress: {
      connecting: 'Connecting…',
      fetching: 'Fetching events…',
      processing: 'Processing events…',
      saving: 'Saving changes…',
      failed: 'Sync failed',
      complete: 'Sync complete',
    },
    syncStatus: {
      synced: 'Synced',
      error: 'Sync error',
      paused: 'Paused',
      disabled: 'Disabled',
      syncing: 'Syncing…',
      lastSynced: 'Last synced {time}',
      neverSynced: 'Never synced',
      syncNow: 'Sync now',
    },
  },
  noWorkspace: {
    invitedTitle: "You've been invited",
    invitedSubtitle: "Accept an invitation below to join a workspace, or go back to your dashboard.",
    emptyTitle: 'No workspace yet',
    emptySubtitle: "Your workspace is being set up. Go to your dashboard, or reload the page in a moment.",
  },
  notifications: {
    bell: {
      unreadCount: '{count} unread notifications',
      title: 'Notifications',
      all: 'All',
      unread: 'Unread',
      markAllRead: 'Mark all as read',
      loading: 'Loading notifications…',
      caughtUp: "You're all caught up",
      empty: 'No notifications yet',
      today: 'Today',
      earlier: 'Earlier',
      settings: 'Notification settings',
    },
  },
  chat: {
    addReaction: 'Add reaction',
    attachFile: 'Attach a file',
    beFirst: 'Be the first to send a message!',
    channelStart: 'This is the start of #{name}',
    clearSearch: 'Clear search',
    composerHint: 'Enter to send · Shift+Enter for a new line · @ to mention',
    copyText: 'Copy text',
    deleteChannelBody: 'All of its messages, replies and files will be permanently deleted.',
    deleteChannelNamed: 'Delete #{name}',
    deleteChannelTitle: 'Delete #{name}?',
    deleteMessage: 'Delete message',
    deleteMessageBody: 'Everyone will see "Message deleted" instead.',
    deleteMessageTitle: 'Delete this message?',
    editMessage: 'Edit message',
    edited: '(edited)',
    emptyChannel: 'No messages in #{name} yet',
    fileTooLarge: 'That file is larger than 10 MB.',
    filterMembers: 'Filter members',
    genericError: 'Something went wrong. Please try again.',
    jumpToLatest: 'Jump to latest',
    liveUnavailable: 'Live chat is unavailable. Reload the page to retry.',
    loadFailed: 'Couldn’t load messages.',
    members: 'Members',
    membersOf: 'Members of #{name}',
    mentionSuggestions: 'People to mention',
    messageDeleted: 'Message deleted',
    messagePlaceholder: 'Message #{name}…',
    moreActions: 'More actions',
    moreResults: 'Show more results',
    newChannel: 'New channel',
    newMessages: 'New messages',
    noMembersMatch: 'No members match',
    noPinned: 'No pinned messages yet. Pin one from its ⋯ menu.',
    noResults: 'No messages found',
    notSent: 'Not sent',
    onlineCount: '{count} online',
    pin: 'Pin to channel',
    pinned: 'Pinned',
    pinnedMessages: 'Pinned messages',
    reactWith: 'React with {emoji}',
    readOnly: 'You have view-only access, so you can read but not post.',
    reconnecting: 'Reconnecting… you can send messages again once you’re back online.',
    removeAttachment: 'Remove attachment',
    replyCount: '{count} replies',
    replyInThread: 'Reply in thread',
    replyPlaceholder: 'Reply…',
    resultsCount: '{count} results',
    retry: 'Retry',
    searchPlaceholder: 'Search messages',
    searching: 'Searching…',
    send: 'Send',
    sendFailed: 'Message not sent. Check your connection and try again.',
    showChannels: 'Show channels',
    someone: 'Someone',
    thread: 'Thread',
    today: 'Today',
    typingMany: 'Several people are typing…',
    typingOne: '{name} is typing…',
    typingTwo: '{first} and {second} are typing…',
    unknownMember: 'Unknown member',
    unpin: 'Unpin',
    unreadCount: '{count} unread',
    yesterday: 'Yesterday',
    you: 'You',
    createModal: {
      namePlaceholder: 'e.g. general',
      private: 'Make private',
      privateHint: 'Only the members you choose can see and join it.',
      failedError: 'Failed to create channel. Please try again.',
      title: 'Create channel',
      nameLabel: 'Channel name',
      descLabel: 'Description',
      optional: 'optional',
      descPlaceholder: 'What is this channel about?',
      create: 'Create channel',
    },
    title: 'Chat',
    channels: 'Channels',
    addChannel: 'Add channel',
    addAChannel: 'Add a channel',
    deleteChannel: 'Delete channel',
    selectChannel: 'Select a channel to start chatting',
    noChannels: 'No channels yet',
    createFirst: 'Create your first channel',
  },
  shell: {
    untitled: 'Untitled',
    createPageFailed: 'Failed to create page',
    createPageFailedRetry: 'Failed to create page. Please try again.',
    workspaceCreated: 'Workspace created',
    invitationDeclined: 'Invitation declined',
    joinedWorkspace: 'You joined {workspace}',
    invitationAccepted: 'Invitation accepted',
    toggleSidebar: 'Toggle sidebar',
    expandSidebar: 'Expand sidebar',
    collapseSidebar: 'Collapse sidebar',
    invitePeople: 'Invite people',
    selectWorkspaceFirst: 'Select a workspace first',
    newPage: 'New page',
    creatingPage: 'Creating page…',
    selectWorkspace: 'Select workspace',
    account: 'Account',
    searchPlaceholder: 'Search pages, people, and more…',
    noResultsFound: 'No results found',
    searchAria: 'Search',
    moreMembersTitle: '{count} more members',
    toggleDarkMode: 'Toggle dark mode',
    askAI: 'Ask AI',
    goToDashboard: 'Go to dashboard',
  },
  ai: {
    chat: {
      heading: 'AI Assistant',
      subheading: 'Ask me anything about your workspace',
      placeholder: 'Ask AI anything…',
    },
  },
  navigation: {
    sidebar: {
      brand: 'BorsFlow',
      search: 'Search',
      inbox: 'Inbox',
      myTasks: 'My tasks',
      workspace: 'Workspace',
      settings: 'Settings',
      templates: 'Templates',
      trash: 'Trash',
    },
  },
  workspaces: {
    justNow: 'Just now',
    minutesAgo: '{count}m ago',
    hoursAgo: '{count}h ago',
    daysAgo: '{count}d ago',
    commentsHeading: 'Comments',
    noCommentsYet: 'No comments yet',
    beFirstToComment: 'Be the first to leave a comment.',
    reply: 'Reply',
    resolve: 'Resolve',
    addCommentPlaceholder: 'Add a comment...',
    fixGrammar: 'Fix grammar',
    summarize: 'Summarize',
    makeShorter: 'Make shorter',
    makeLonger: 'Make longer',
    aiActionError: 'AI action failed. Please try again.',
    aiLabel: 'AI',
    generateError: 'Failed to generate content. Please try again.',
    describeGeneratePlaceholder: 'Describe what you want to generate...',
    generateHint: 'Press Enter to generate, Esc to cancel',
    generateWithAi: 'Generate with AI',
    describeWhatYouWant: 'Describe what you want and let AI write it',
    basicBlocksHeader: 'Basic blocks',
    heading1Block: 'Heading 1',
    textBlock: 'Text',
    justStartWriting: 'Just start writing plain text',
    bulletListBlock: 'Bulleted list',
    mediaHeader: 'Media',
    imageBlock: 'Image',
    workspaceFallbackName: 'Workspace',
    sharedTab: 'Shared',
    privateTab: 'Private',
    membersAriaLabel: '{count} members',
    andMoreMembers: 'And {count} more members',
    askAi: 'Ask AI',
    share: 'Share',
    aiResultCopied: 'AI result copied to clipboard',
    createPageError: 'Failed to create page',
    createPageGenericError: 'Something went wrong while creating the page',
    notFoundTitle: 'Workspace not found',
    backToDashboard: 'Back to dashboard',
    searchPagesPlaceholder: 'Search pages...',
    noPagesFound: 'No pages found',
    newPage: 'New page',
    breadcrumb: '{name}',
    pageTitlePlaceholder: 'Untitled page',
    defaultDescription: 'No description yet. Click to add one.',
    subPagesCount: '{count} sub-pages',
    createFirstPage: 'Create your first page',
  },
  templates: {
    cloneFailed: 'Failed to clone template',
    eyebrow: 'Templates',
    heading: 'Start from a template',
    description: 'Browse ready-made templates and launch a new page in seconds.',
    openEmailMarketing: 'Open email marketing',
    loading: 'Loading templates...',
    galleryTitle: 'Template gallery',
    gallerySubtitle: 'Pick a template to get started quickly',
    ai: {
      generate: 'Generate with AI',
      contentReady: 'Content ready',
      applyTemplate: 'Apply template',
      regenerate: 'Regenerate',
      generating: 'Generating...',
    },
  },
  settings: {
    profile: {
      nameRequired: 'Please enter your name',
      updateSuccess: 'Profile updated successfully',
      updateFailed: 'Failed to update profile',
      genericError: 'Something went wrong. Please try again.',
      heading: 'Profile',
      subtitle: 'Update your personal information',
      nameLabel: 'Full name',
      namePlaceholder: 'Enter your full name',
      emailLabel: 'Email address',
      emailCannotChange: 'Your email address cannot be changed',
      saving: 'Saving...',
      saveChanges: 'Save changes',
    },
    appearance: {
      updateSuccess: 'Appearance updated successfully',
      updateFailed: 'Failed to update appearance',
      heading: 'Appearance',
      subtitle: 'Customize how BorsFlow looks on your device',
      themeLabel: 'Theme',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    security: {
      allFieldsRequired: 'Please fill in all fields',
      passwordMismatch: 'New passwords do not match',
      passwordTooShort: 'Password must be at least 8 characters',
      updateSuccess: 'Password changed successfully',
      updateFailed: 'Failed to change password',
      genericError: 'Something went wrong. Please try again.',
      heading: 'Security',
      subtitle: 'Change your password to keep your account secure',
      currentPasswordLabel: 'Current password',
      currentPasswordPlaceholder: 'Enter your current password',
      newPasswordLabel: 'New password',
      newPasswordPlaceholder: 'Enter a new password',
      newPasswordHint: 'Must be at least 8 characters',
      confirmPasswordLabel: 'Confirm new password',
      confirmPasswordPlaceholder: 'Re-enter your new password',
    },
    integrations: {
      oauthStartFailed: 'Failed to start the connection process',
      connectionFailed: 'Connection failed',
      disconnectSuccess: 'Disconnected successfully',
      disconnectFailed: 'Failed to disconnect',
      genericError: 'Something went wrong. Please try again.',
    },
    nav: {
      profile: 'Profile',
      notifications: 'Notifications',
      appearance: 'Appearance',
      security: 'Security',
      integrations: 'Integrations',
      billing: 'Plan & billing',
    },
    pageTitle: 'Settings',
    pageSubtitle: 'Manage your account, workspace, and preferences',
    planLimit: {
      titleAiCredits: 'AI credit limit reached',
      titleMembers: 'Member limit reached',
      titleEmailSends: 'Email sending limit reached',
      titleInvoices: 'Invoice limit reached',
      closeAria: 'Close',
      titleGeneric: 'Plan limit reached',
      usedOfLimit: '{used} of {limit} used',
      notNow: 'Not now',
      seePlans: 'See plans',
      joinWaitlistDiscount: 'Join the waitlist for {percent}% off',
    },
    billing: {
      unlimited: 'Unlimited',
      loadError: 'Failed to load plan details',
      heading: 'Plan & usage',
      subtitle: 'Track your workspace usage and manage your plan',
      selectWorkspace: 'Select a workspace to view its plan and usage',
      loadingAria: 'Loading plan details',
      currentPlan: 'Current plan',
      betaBadge: 'Beta',
      comparePlans: 'Compare plans',
      membersLabel: 'Members',
      membersDetailPending: '{members} members, {pending} pending invitations',
      membersDetailOwnerOnly: 'Just you so far',
      aiCreditsLabel: 'AI credits',
      aiCreditsDetail: 'Resets at the start of each billing period',
      upgradePlan: 'Upgrade plan',
      paidPlansComingSoon: 'Paid plans are coming soon',
      paidPlansDescription: 'Join the waitlist now and lock in {percent}% off when paid plans launch',
      joinWaitlist: 'Join the waitlist',
    },
    notifications: {
      categoryTeamLabel: 'Team',
      categoryTeamDescription: 'Invitations, member changes, and workspace activity',
      categorySalesLabel: 'Sales',
      categorySalesDescription: 'New leads, deal updates, and CRM activity',
      categoryMeetingsLabel: 'Meetings',
      categoryMeetingsDescription: 'Upcoming meetings, reschedules, and cancellations',
      categoryTasksLabel: 'Tasks',
      categoryTasksDescription: 'Task assignments, due dates, and board updates',
      updateFailed: 'Failed to update notification preferences',
      loading: 'Loading notification preferences...',
      heading: 'Notifications',
      subtitle: 'Choose how you want to be notified about activity',
      emailHeading: 'Email notifications',
      emailDescription: 'Turn email notifications on or off entirely',
      emailSwitchAria: 'Toggle all email notifications',
      categoryHeader: 'Category',
      inAppHeader: 'In-app',
      emailHeader: 'Email',
      inAppAria: 'Toggle in-app notifications for {label}',
      emailAria: 'Toggle email notifications for {label}',
      savingNote: 'Changes are saved automatically',
    },
  },
  quotes: {
    detail: {
      sendModal: {
        subjectDefault: 'Quote {number}',
        messageDefault: 'Hi {clientName}, please find your quote attached.',
        recipientRequired: 'Enter a recipient email address.',
        failed: 'Failed to send the quote.',
        title: 'Send Quote',
        to: 'To',
        subject: 'Subject',
        message: 'Message',
        cancel: 'Cancel',
        sending: 'Sending...',
        send: 'Send',
      },
      convertModal: {
        failed: 'Failed to convert the quote to an invoice.',
        title: 'Convert to Invoice',
        description: 'Convert quote {number} for {clientName} into an invoice.',
        dueDate: 'Due date',
        optional: '(optional)',
        cancel: 'Cancel',
        converting: 'Converting...',
        convert: 'Convert',
      },
      fetchFailed: 'Failed to load the quote.',
      saveFailed: 'Failed to save the quote.',
      savedToast: 'Quote saved.',
      clientNameRequired: 'Client name is required.',
      workspaceRequired: 'No workspace selected.',
      createFailed: 'Failed to create the quote.',
      deleteConfirm: 'Delete quote {number}? This cannot be undone.',
      deleteFailed: 'Failed to delete the quote.',
      duplicateFailed: 'Failed to duplicate the quote.',
      goBackButton: 'Go back',
    },
    currency: {
      usd: 'USD',
      eur: 'EUR',
      gbp: 'GBP',
      cad: 'CAD',
      aud: 'AUD',
      dzd: 'DZD',
      mad: 'MAD',
      tnd: 'TND',
    },
    newForm: {
      clientNameRequired: 'Client name is required.',
      lineItemRequired: 'Add at least one line item.',
      createFailed: 'Failed to create the quote.',
      backAria: 'Back to quotes',
      title: 'New Quote',
      subtitle: 'Create a new quote for your client.',
      creating: 'Creating...',
      createQuote: 'Create Quote',
      documentSettings: 'Document Settings',
      issueDate: 'Issue date',
      validUntil: 'Valid until',
      currency: 'Currency',
      clientInformation: 'Client Information',
      linkedContact: 'Linked contact',
      removeLinkedContactAria: 'Remove linked contact',
      linkCrmContact: 'Link a CRM contact',
      searchContactsPlaceholder: 'Search contacts...',
      noContactsFound: 'No contacts found.',
      clientName: 'Client name',
      clientNamePlaceholder: 'Jane Smith',
      email: 'Email',
      emailPlaceholder: 'jane@example.com',
      phone: 'Phone',
      phonePlaceholder: '+1 (555) 123-4567',
      company: 'Company',
      companyPlaceholder: 'Acme Inc.',
      address: 'Address',
      addressPlaceholder: '123 Main St, City, Country',
      lineItems: 'Line Items',
      notesAndTerms: 'Notes & Terms',
      notes: 'Notes',
      notesPlaceholder: 'Thank you for considering us.',
      terms: 'Terms',
      termsPlaceholder: 'This quote is valid for 30 days.',
      internalNotes: 'Internal Notes',
      internalNotesPrivate: 'Only visible to your team',
      internalNotesPlaceholder: 'Private notes about this quote...',
    },
    list: {
      sendModal: {
        subjectDefault: 'Quote {number}',
        failed: 'Failed to send the quote.',
        title: 'Send Quote',
        to: 'To',
        toPlaceholder: 'client@example.com',
        subject: 'Subject',
        message: 'Message',
        messagePlaceholder: 'Add a message to your client...',
        cancel: 'Cancel',
        sending: 'Sending...',
        send: 'Send',
      },
      convertModal: {
        failed: 'Failed to convert the quote to an invoice.',
        title: 'Convert to Invoice',
        description: 'Convert this quote into an invoice.',
        dueDate: 'Due date',
        cancel: 'Cancel',
        converting: 'Converting...',
        convert: 'Convert',
      },
      actionsAria: 'More actions',
      sendByEmail: 'Send by email',
      viewPdf: 'View PDF',
      copyClientLink: 'Copy client link',
      convertToInvoice: 'Convert to invoice',
      duplicate: 'Duplicate',
      delete: 'Delete',
      sortDate: 'Date',
      sortClient: 'Client',
      sortTotal: 'Total',
      sortStatus: 'Status',
      fetchFailed: 'Failed to load quotes.',
      deleteConfirm: 'Delete quote {number}? This cannot be undone.',
      toastDeleted: 'Quote {number} deleted.',
      toastDeleteFailed: 'Failed to delete the quote.',
      toastDuplicated: 'Quote {number} duplicated.',
      toastDuplicateFailed: 'Failed to duplicate the quote.',
      toastLinkFailed: 'Failed to create the client link.',
      toastLinkCopied: 'Link copied to clipboard.',
      title: 'Quotes',
      subtitle: 'Manage and track all your quotes.',
      fromTemplate: 'From Template',
      newQuote: 'New Quote',
      tryAgain: 'Try Again',
      emptyTitle: 'No quotes found',
      emptyFilteredSubtitle: 'Try adjusting your filters or search term.',
      emptySubtitle: 'Get started by creating your first quote.',
      createQuote: 'Create Quote',
      tableQuoteNumber: 'Number',
      tableClient: 'Client',
      tableStatus: 'Status',
      tableDate: 'Date',
      tableTotal: 'Total',
      tableActions: 'Actions',
      previous: 'Previous',
      next: 'Next',
      toastSent: 'Quote sent.',
      toastConverted: 'Quote converted to invoice.',
      cardTotal: 'Total',
    },
    status: {
      all: 'All',
      draft: 'Draft',
      sent: 'Sent',
      viewed: 'Viewed',
      accepted: 'Accepted',
      rejected: 'Rejected',
      expired: 'Expired',
    },
  },
  products: {
    currency: {
      title: 'Workspace currency',
      hint: 'Used for product prices and as the default for new quotes and invoices. Amounts are not converted.',
      changed: 'Currency changed to {currency}',
      saveFailed: 'Couldn’t change the currency.',
    },
    customFields: {
      title: 'Custom fields',
      subtitle: 'Add your own product attributes, like units per box, brand or weight. They appear on every product and in the import mapping.',
      addField: 'Add field',
      manage: 'Manage fields',
      labelLabel: 'Field name',
      labelPlaceholder: 'e.g. Units per box',
      typeLabel: 'Type',
      keyLabel: 'Key',
      keyHint: 'Used to match spreadsheet columns. Can’t be changed later.',
      typeText: 'Text',
      typeNumber: 'Number',
      typeBoolean: 'Yes / No',
      typeDate: 'Date',
      yes: 'Yes',
      no: 'No',
      usage: '{count} products with a value',
      moveUp: 'Move up',
      moveDown: 'Move down',
      deleteNamed: 'Delete {name}',
      deleteTitle: 'Delete the “{name}” field?',
      deleteBodyUsed: 'Its value will be removed from {count} products. This can’t be undone.',
      deleteBodyUnused: 'No products have a value for this field yet.',
      saveFailed: 'Couldn’t save the field. Please try again.',
      emptyTitle: 'No custom fields yet',
      emptyBody: 'Create fields for anything your catalog needs. Existing products simply start with the field empty.',
      importHint: 'Tip: when importing, pick “Create custom field from this column” to add a field without leaving the import.',
      formEmpty: 'Add fields like brand or units per box to track more about each product.',
      builtInGroup: 'Built-in fields',
      customGroup: 'Custom fields',
      createFromColumn: '+ Create custom field from this column…',
      customBadge: 'Custom',
      mappingHint: 'Map each column to a built-in field or one of your custom fields. Columns you don’t need can be skipped.',
      invalidCell: 'Not a valid {type}',
      invalidSummary: '{count} custom-field values don’t match their field type. Those rows will be skipped unless you fix the file or change the field type.',
    },
    detail: {
      loadFailed: 'Failed to load product.',
      saveFailed: 'Failed to save product.',
      editFallback: 'Edit product',
      loadingTitle: 'Loading product…',
      subtitle: 'Update the details for this product or service.',
      saveButton: 'Save changes',
    },
    nameRequired: 'Product name is required.',
    deleteConfirm: 'Delete {name}? This cannot be undone.',
    deleteFailed: 'Failed to delete product.',
    workspaceFallback: 'Products',
    backToProductsAria: 'Back to products',
    newForm: {
      createFailed: 'Failed to create product.',
      subtitle: 'Add a new product or service to your catalog.',
      createButton: 'Create product',
    },
    newProduct: 'New product',
    sortUpdated: 'Last updated',
    sortName: 'Name',
    sortPrice: 'Price',
    sortStock: 'Stock',
    statusAll: 'All statuses',
    statusActiveOnly: 'Active only',
    statusInactiveOnly: 'Inactive only',
    fetchFailed: 'Failed to load products.',
    allCategories: 'All categories',
    importedSkipped: ', {count} skipped',
    imported: 'Imported {count} products',
    deletedToast: '{name} was deleted.',
    subtitle: 'Manage the products and services you quote and invoice.',
    generateWithAI: 'Generate with AI',
    import: 'Import',
    searchPlaceholder: 'Search products…',
    searchAria: 'Search products',
    emptyTitle: 'No products yet',
    emptyFilteredSubtitle: 'No products match your current search or filters.',
    emptySubtitle: 'Add your first product or service to start building quotes and invoices.',
    createFirst: 'Add your first product',
    showingRange: 'Showing {start}–{end} of {total} products',
    active: 'Active',
    inactive: 'Inactive',
    actionsAria: 'Product actions',
    fields: {
      price: 'Price',
      taxRate: 'Tax rate',
      sku: 'SKU',
      category: 'Category',
      name: 'Name',
      description: 'Description',
      unit: 'Unit',
      stockQuantity: 'Stock quantity',
    },
    stockLabel: 'Stock',
    stockNotTracked: 'Not tracked',
    formFields: {
      generateFailed: 'Failed to generate product details.',
      aiAssistantBadge: 'AI assistant',
      aiAssistantHeading: 'Let AI fill in the details',
      aiAssistantSubtitle: 'Describe the product and we’ll suggest a name, description, and pricing.',
      hideAI: 'Hide AI assistant',
      useAI: 'Use AI assistant',
      aiPromptLabel: 'Describe the product',
      aiPromptPlaceholder: 'e.g. A 2-hour logo design consultation for small businesses',
      aiCapabilitiesHint: 'AI can suggest a name, description, category, and suggested price.',
      generateDetails: 'Generate details',
      aiNotesLabel: 'Notes for the AI (optional)',
      nameLabel: 'Name',
      namePlaceholder: 'e.g. Website design package',
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'Briefly describe this product or service',
      skuLabel: 'SKU',
      skuPlaceholder: 'e.g. WEB-001',
      categoryLabel: 'Category',
      selectCategoryPlaceholder: 'Select a category',
      addCategory: 'Add category',
      newCategoryPlaceholder: 'New category name',
      cancelAddCategoryAria: 'Cancel adding category',
      priceLabel: 'Price',
      unitLabel: 'Unit',
      unitPlaceholder: 'e.g. hour, item, project',
      taxRateLabel: 'Tax rate',
      stockQuantityLabel: 'Stock quantity',
      stockQuantityPlaceholder: 'Leave blank if not tracked',
      activeProductLabel: 'Active product',
      activeProductHint: 'Inactive products won’t appear when creating new quotes or invoices.',
      toggleActiveAria: 'Toggle active status',
    },
    importModal: {
      steps: {
        upload: 'Upload',
        sheet: 'Sheet',
        map: 'Map',
        preview: 'Preview',
        import: 'Import',
        done: 'Done',
      },
      sheetMissingHeaderNamed: 'Sheet "{name}" doesn’t have a header row.',
      sheetMissingHeader: 'This sheet doesn’t have a header row.',
      legacyExcelError: 'This file is in an older Excel format that isn’t supported. Please save it as .xlsx and try again.',
      unsupportedFileError: 'Unsupported file type. Please upload a CSV or Excel file.',
      fileTooLarge: 'This file is {size}MB, which exceeds the {max}MB limit.',
      emptyWorkbook: 'This workbook doesn’t contain any data.',
      readError: 'Failed to read the file.',
      importFailed: 'Failed to import products.',
      title: 'Import products',
      subtitle: 'Upload a spreadsheet to add products in bulk.',
      closeAria: 'Close import dialog',
      overRowLimit: 'You have {count} rows, which exceeds the limit of {max} per import.',
      reading: 'Reading file…',
      dropPrompt: 'Drag and drop a file here, or click to browse',
      supportedFormats: 'Supports CSV, XLSX, and XLS files',
      sheetPrompt: '{fileName} contains {count} sheets. Choose one to import.',
      rowsLabel: '{count} rows',
      noHeader: 'No header row',
      rowsFoundIn: 'We found {count} rows in {fileName}. Match each column to a product field.',
      columnFileColumn: 'File column',
      columnSample: 'Sample value',
      columnMapsTo: 'Maps to',
      unnamedColumn: 'Column {index}',
      mapColumnAria: 'Map column {index} to a field',
      skipOption: 'Don’t import',
      previewingRows: 'Previewing the first {count} rows',
      importingTitle: 'Importing products…',
      importingBody: 'Importing {count} products. This may take a moment.',
      progressCount: '{done} of {total} rows processed',
      secondsLeft: 'about {count}s left',
      minutesLeft: 'about {count} min left',
      createdCount: '{count} imported',
      skippedCount: '{count} skipped',
      stopImport: 'Stop import',
      stopping: 'Stopping after this batch…',
      stopHint: 'Products already imported stay in your catalog.',
      stoppedSummary: 'Import stopped: {remaining} rows were not imported.',
      partialFailure: 'The import stopped early: {error}. The rows below were processed before it stopped.',
      doneTitle: 'Import complete',
      doneSummary: '{created} products created, {skipped} skipped',
      rowErrorsTitle: 'Some rows couldn’t be imported',
      rowErrorPrefix: 'Row {row}:',
      previewButton: 'Preview',
      importButton: 'Import {count} products',
    },
    statusLabel: 'Status',
    actionsLabel: 'Actions',
    unitPrefix: '/ {unit}',
  },
  pages: {
    table: {
      pageActions: 'Page actions',
      actions: 'Actions',
    },
    header: {
      title: 'Pages',
      description: 'All the documents and pages in your workspace, in one place.',
    },
    exportShare: {
      members: 'Members',
      export: 'Export',
      publicAccess: 'Public access',
    },
    accessModal: {
      shareWithMembers: 'Share with members',
      applyToChildPages: 'Apply to child pages',
    },
    sidebar: {
      newPage: 'New page',
      searchPlaceholder: 'Search pages…',
    },
  },
  documents: {
    tones: {
      formal: 'Formal',
      casual: 'Casual',
      persuasive: 'Persuasive',
      concise: 'Concise',
    },
    print: {
      video: 'Video',
      file: 'File',
    },
    blockTypes: {
      text: {
        label: 'Text',
        description: 'Start writing with plain text',
      },
      heading1: {
        label: 'Heading 1',
        description: 'Big section heading',
      },
      heading2: {
        label: 'Heading 2',
        description: 'Medium section heading',
      },
      heading3: {
        label: 'Heading 3',
        description: 'Small section heading',
      },
      bullet: {
        label: 'Bulleted list',
        description: 'Create a simple bulleted list',
      },
      numbered: {
        label: 'Numbered list',
        description: 'Create a list with numbering',
      },
      todo: {
        label: 'To-do list',
        description: 'Track tasks with checkboxes',
      },
      code: {
        label: 'Code',
        description: 'Capture a code snippet',
      },
      quote: {
        label: 'Quote',
        description: 'Capture a quote',
      },
      divider: {
        label: 'Divider',
        description: 'Visually divide sections',
      },
      callout: {
        label: 'Callout',
        description: 'Make text stand out',
      },
      toggle: {
        label: 'Toggle list',
        description: 'Hide content behind a collapsible section',
      },
      tag: {
        label: 'Tag',
        description: 'Add a colored label',
      },
      date: {
        label: 'Date',
        description: 'Insert a date or reminder',
      },
      link: {
        label: 'Link',
        description: 'Insert a web link',
      },
      image: {
        label: 'Image',
        description: 'Upload or embed with a link',
      },
      video: {
        label: 'Video',
        description: 'Embed from YouTube, Vimeo, or a direct link',
      },
      file: {
        label: 'File',
        description: 'Upload or attach a file',
      },
      table: {
        label: 'Table',
        description: 'Add a simple table',
      },
      bookmark: {
        label: 'Bookmark',
        description: 'Save a link as a visual bookmark',
      },
      equation: {
        label: 'Equation',
        description: 'Display a math equation',
      },
    },
    categories: {
      basic: 'Basic',
      formatting: 'Formatting',
      media: 'Media',
      advanced: 'Advanced',
    },
    blocksGroupLabel: '{category}',
    duplicate: 'Duplicate',
    turnInto: 'Turn into',
    blocks: {
      toggleTitlePlaceholder: 'Toggle',
      toggleContentPlaceholder: 'Content inside the toggle',
      imageCaptionPlaceholder: 'Add a caption',
      imageUploadLabel: 'Click to upload an image',
      columnLabel: 'Column {number}',
      tableAddRow: 'Add row',
      linkPlaceholder: 'Paste a link',
      bookmarkPlaceholder: 'Paste a link to create a bookmark',
      bookmarkNoDescription: 'No description available',
      dateRemindMe: 'Remind me',
      tagDefault: 'Tag',
      tagPlaceholder: 'Tag name',
      videoPlaceholder: 'Paste a YouTube, Vimeo, or video link',
      youtubeTitle: 'YouTube video player',
      vimeoTitle: 'Vimeo video player',
      fileUnknownSize: 'Unknown size',
      fileUploadLabel: 'Click to upload a file',
      equationPlaceholder: 'Enter a LaTeX equation, e.g. e=mc^2',
    },
    untitled: 'Untitled',
    outlineErrorFallback: 'Failed to generate an outline. Please try again.',
    documentErrorFallback: 'Failed to generate the document. Please try again.',
    toneErrorFallback: 'Failed to rewrite the text. Please try again.',
    saveErrorFallback: 'Failed to save the page. Please try again.',
    saveErrorNetwork: 'A network error occurred while saving. Please check your connection.',
    typeCommandPlaceholder: "Type '/' for commands",
    notFound: 'Page not found',
    backToDashboard: 'Back to dashboard',
    workspaceFallback: 'Workspace',
    viewOnlyBanner: "You're viewing this page in read-only mode",
    aiPromptPlaceholder: 'Describe what you want to write about...',
    aiPromptHint: 'Press Enter to generate, Shift+Enter for a new line',
    writeWithAi: 'Write with AI',
    generatingOutline: 'Generating outline...',
    generateOutlineWithAi: 'Generate outline with AI',
    rewriteToneTitle: 'Rewrite with a different tone',
    addBlockButton: 'Add a block',
    dismiss: 'Dismiss',
    saving: 'Saving...',
    unsavedChanges: 'Unsaved changes',
    viewOnly: 'View only',
    saved: 'Saved',
    commentsTitle: 'Comments',
    commentsEmpty: 'No comments yet',
    commentPlaceholder: 'Add a comment...',
    calculations: {
      summary: 'Summary',
      subtotal: 'Subtotal',
      discount: 'Discount',
      discountTypeLabel: 'Discount type',
      discountNone: 'None',
      discountValueLabel: 'Discount value',
      tax: 'Tax',
      taxRateLabel: 'Tax rate',
      total: 'Total',
      amountPaid: 'Amount paid',
      amountDue: 'Amount due',
      balance: 'Balance',
    },
    filterBar: {
      clearSearch: 'Clear search',
      clearFilters: 'Clear filters',
      clear: 'Clear',
    },
    lineItem: {
      dragToReorder: 'Drag to reorder',
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'Item description',
      unitPriceLabel: 'Unit price',
      totalLabel: 'Total',
      remove: 'Remove item',
    },
    lineItems: {
      heading: 'Line items',
      noItems: 'No items',
      itemsCount: 'items',
      itemCount: 'item',
      noItemsYet: 'No items yet',
      addFirst: 'Add your first item to get started',
      addNewAriaLabel: 'Add a new line item',
      addItem: 'Add item',
      pickFromCatalog: 'Pick from catalog',
    },
    viewToggle: {
      ariaLabel: 'Switch view',
      gridView: 'Grid view',
      tableView: 'Table view',
    },
  },
  landing: {
    footer: {
      linkPipeline: 'Pipeline',
      linkListings: 'Listings',
      linkHowItWorks: 'How it works',
      linkAssistant: 'AI assistant',
      linkRolesTeam: 'Roles & team',
      linkCommissions: 'Commissions',
      linkPricing: 'Pricing',
      tagline: 'The CRM for estate agencies: listings, owners, buyers, viewings, offers and commissions in one workspace.',
      productHeading: 'Product',
      copyright: '© {year} BorsFlow. All rights reserved.',
      signIn: 'Sign in',
      createWorkspace: 'Create your workspace',
    },
    aiIntegration: {
      answerPages: 'Finds the exact page or doc you meant and reads it back to you.',
      answerLeads: 'Pulls up a buyer, their interests and their full history on request.',
      answerTasks: 'Lists what is open, overdue or assigned to you across every board.',
      answerFinancials: 'Reports quote and invoice status, totals and what is outstanding.',
      answerMeetings: 'Tells you what is booked next and who is on the call.',
      answerProducts: 'Looks up services, fees and prices from your catalog.',
      answerTemplates: 'Finds the right template so you are never starting from blank.',
      heading: 'An assistant that already knows your workspace',
      lead: 'Ask it a question instead of hunting through five screens. It reads your real data and answers in plain language.',
      tableCaption: 'Assistant tools, the records they read, and what they can answer',
      colTool: 'Tool',
      colReads: 'Reads',
      colAnswers: 'Answers',
    },
    bentoGrid: {
      foundationPostgresTerm: 'Postgres database',
      foundationPostgresDetail: 'Your data lives in a real relational database, not a spreadsheet pretending to be one.',
      foundationAuthTerm: 'Authentication',
      foundationAuthDetail: 'Secure sign-in for every member, with sessions handled for you.',
      foundationSecretsTerm: 'Encrypted secrets',
      foundationSecretsDetail: 'API keys and credentials are encrypted at rest, never shown in plain text.',
      foundationPermissionsTerm: 'Role-based permissions',
      foundationPermissionsDetail: 'Every action is checked against the role of the person taking it.',
      heading: 'One workspace, from mandate to completion',
      lead: 'Listings, buyers, viewings and offers share the same data instead of living in five tools.',
      crmTitle: 'Owners & buyers',
      crmBody: 'Win mandates on one board and move buyers from enquiry to offer on another, with your whole team looking at the same status.',
      emailTitle: 'Email & templates',
      emailBody: 'Send on-brand emails from reusable templates, and let AI draft the first pass for you.',
      meetingsTitle: 'Scheduling',
      meetingsBody: 'Book meetings, sync calendars and keep everyone looking at the same time slot.',
      catalogTitle: 'Listings',
      catalogBody: 'Every property with its photos, price history and days on market, ready to publish and to match against what buyers want.',
      underneathHeading: 'What it runs on',
    },
    demoVideo: {
      watchDemo: 'Watch the demo',
      dialogLabel: 'BorsFlow product demo video',
      recordedFrom: 'Recorded straight from the live product, no slides.',
      soundOff: 'Sound off',
      soundOn: 'Sound on',
      closeDemo: 'Close demo',
    },
    evidence: {
      listingsTitle: 'Every listing, with everything that happened on it',
      listingsBody: 'Photos, the mandate, each viewing with the buyer’s feedback and every offer sit on one record. Accept an offer and the competing ones are declined for you.',
      listingsAlt: 'BorsFlow listing page for a Dublin terrace, open on its offers tab with three competing offers',
      commissionsTitle: 'Commission worked out the moment an offer is accepted',
      commissionsBody: 'The fee comes from the mandate, is split between listing agent, selling agent and agency, and moves from accrued to realized to paid as the sale completes.',
      commissionsAlt: 'BorsFlow commissions view listing accrued fees, each split between the agency, the listing agent and the selling agent',
    },
    finalCta: {
      step1: 'Create your workspace',
      step2: 'Invite your team',
      step3: 'Add your listings and contacts',
      step4: 'Publish your first listing',
      heading: 'Run your whole agency from one tab',
      lead: 'No credit card, no setup call. Create a workspace and see your first buyer board in minutes.',
      createWorkspace: 'Create your workspace',
      signIn: 'Sign in',
      noSalesCall: 'Free to start. No sales call required.',
    },
    journey: {
      stage1Title: 'Capture the enquiry',
      stage1Body: 'Enquiries from your website land as buyers, tied to the property they asked about.',
      stage2Title: 'Match and show',
      stage2Body: 'New listings are matched to buyers’ search briefs, and viewings are booked with structured feedback.',
      stage3Title: 'Take the offer',
      stage3Body: 'Record competing offers on one property; accepting one rejects the rest and reserves the listing.',
      stage4Title: 'Close and get paid',
      stage4Body: 'The commission is split between listing agent, selling agent and agency, and realized when the sale completes.',
      heading: 'From first enquiry to completed sale',
      lead: 'Four stages, one record. A buyer, a property and an offer stay connected, and nothing is re-entered between tools.',
    },
    hero: {
      assuranceFree: 'Free to start',
      assuranceRoles: 'Role-based access for every teammate',
      assuranceData: 'Your data stays in your workspace',
      titleLine1: 'The CRM built',
      titleLine2: 'for estate agencies',
      lead: 'Listings, owners, buyers, viewings, offers and commissions in one workspace, so your agents stop copying data between five different tools.',
      startFree: 'Start free',
      plateAlt: 'BorsFlow board showing buyers moving from enquiry to offer',
    },
    header: {
      navPipeline: 'Pipeline',
      navHowItWorks: 'How it works',
      navAssistant: 'AI assistant',
      navTeam: 'Team',
      navPricing: 'Pricing',
      sectionsAria: 'Page sections',
      themeToLight: 'Switch to light mode',
      themeToDark: 'Switch to dark mode',
      dashboard: 'Dashboard',
      signIn: 'Sign in',
      startFree: 'Start free',
      toggleNav: 'Toggle navigation menu',
    },
    pricing: {
      limitUnlimitedMembers: 'Unlimited team members',
      limitUpToMembers: 'Up to {count} team members',
      limitUnlimitedAiCredits: 'Unlimited AI credits',
      limitAiCreditsPerMonth: '{count} AI credits / month',
      limitUnlimitedCrmContacts: 'Unlimited contacts',
      limitCrmContacts: '{count} contacts',
      limitProperties: '{count} properties in play',
      limitUnlimitedProperties: 'Unlimited properties',
      limitActiveMandates: '{count} active mandates',
      limitUnlimitedActiveMandates: 'Unlimited active mandates',
      limitUnlimitedInvoices: 'Unlimited invoices',
      limitInvoicesPerMonth: '{count} invoices / month',
      limitCustomEmailVolume: 'Custom email volume',
      limitEmailSendsPerMonth: '{count} email sends / month',
      limitPaymentFee: '{percent}% payment processing fee',
      waitlistErrorGeneric: 'Something went wrong. Please try again.',
      waitlistDoneEnterprise: 'Thanks! Our team will reach out to talk Enterprise.',
      waitlistDoneGeneric: 'You’re on the list for {plan}. We’ll email you the moment it’s live.',
      emailPlaceholder: 'you@company.com',
      emailAriaLabel: 'Email address',
      notifyEmailButton: 'Notify {email}',
      notifyMe: 'Notify me',
      availableNow: 'Available now',
      mostPopular: 'Most popular',
      customPrice: 'Custom',
      forever: 'forever',
      perMonthWholeTeam: 'per month, whole team',
      billedYearly: 'Billed yearly',
      billedMonthly: 'Billed monthly',
      startFree: 'Start free',
      talkToUs: 'Talk to us',
      upgradeTo: 'Upgrade to {plan}',
      calcHeading: 'What a per-seat stack actually costs you',
      calcBody: 'Most tools charge per seat on top of a base fee. At ${price} per tool per seat, the bill climbs with every hire. BorsFlow doesn’t.',
      teamSizeLabel: 'Team size',
      perSeatToolsLabel: 'Five per-seat tools',
      perMonth: 'per month',
      borsflowPlanLabel: 'BorsFlow {plan}',
      freeAiIncluded: 'free, AI included',
      perMonthBilledYearly: 'per month, billed yearly',
      yearly: 'Yearly',
      twoMonthsFree: 'Two months free',
      monthly: 'Monthly',
      heading: 'Simple pricing that scales with your team',
      lead: 'Start free. Upgrade when you need more listings, more agents, or more room to send.',
      betaStrong: 'Founding member pricing:',
      betaBody: 'lock in {percent}% off for as long as you stay subscribed, while we’re in beta.',
      billingPeriodAria: 'Billing period',
      footnote: 'Prices shown in USD. Cancel anytime. No setup fees, no hidden charges.',
    },
    support: {
      faq1q: 'Is there really a free plan?',
      faq1a: 'Yes. You can run listings, buyers, viewings and offers and invite your agents on the free plan, with no credit card and no trial countdown.',
      faq2q: 'Can I import my existing contacts and listings?',
      faq2a: 'Yes, you can bring in your contacts from a CSV in a few clicks, and add listings one by one or in bulk when you set up your workspace.',
      faq3q: 'How does the AI assistant access my data?',
      faq3a: 'It reads directly from your workspace, scoped to your permissions, and only answers with what you’re allowed to see.',
      faq4q: 'What happens if I go over my plan’s limits?',
      faq4a: 'Plans limit how many contacts, listings and active mandates you hold at once. We will tell you before you hit a limit, and a sold or withdrawn listing frees its place straight away.',
      faq5q: 'Can I control what each teammate can see or edit?',
      faq5a: 'Yes, every workspace has four roles, from read-only viewers to owners, so access matches responsibility.',
      faq6q: 'Is my data secure?',
      faq6a: 'Your data is encrypted in transit and at rest, and it stays in your workspace, never shared across accounts.',
      heading: 'Questions, answered',
      lead: 'Everything you need to know before you bring your team in.',
    },
    team: {
      roleViewer: 'Viewer',
      roleMember: 'Member',
      roleAdmin: 'Admin',
      roleOwner: 'Owner',
      capRead: 'View records and documents',
      capCreate: 'Create new records',
      capEditDelete: 'Edit and delete their own records',
      capInvite: 'Invite and manage teammates',
      capDeleteWorkspace: 'Delete the workspace',
      heading: 'Permissions that match how your team actually works',
      lead: 'Four roles, one matrix. Give people exactly the access their job needs, no more and no less.',
      tableCaption: 'Permission matrix by role',
      permissionCol: 'Permission',
      yes: 'Yes',
      no: 'No',
      invitationsHeading: 'Invite in seconds',
      invitationsBody: 'Send an email invite and a new teammate is working in the right role before their coffee gets cold.',
      talkHeading: 'Comments that stay with the work',
      talkBody: 'Leave feedback right on a record or document, so context never gets lost in a side channel.',
      workspacesHeading: 'As many workspaces as you need',
      workspacesBody: 'Separate clients, departments or brands into their own workspace, each with its own team and data.',
    },
    whyChoose: {
      seam1: 'Listings live in one tool, buyers in another, so every enquiry gets re-typed at least twice.',
      seam2: 'Nobody can say what the pipeline is worth in commission without opening three different dashboards.',
      seam3: 'Each tool bills per seat, so adding one teammate means five new invoices.',
      seam4: 'Permissions are set per tool, so a leaver’s access has to be revoked five separate times.',
      join1: 'One record per buyer and property, from first enquiry through to completion.',
      join2: 'One dashboard shows listings, viewings, offers and commissions together.',
      join3: 'One bill per workspace, whatever mix of tools your team actually uses.',
      join4: 'One role per person, enforced everywhere at once.',
      heading: 'Five tools stitched together, or one that was built whole',
      lead: 'Every seam between separate tools is a place data goes stale or falls out of sync. BorsFlow has none.',
      fiveToolsHeading: 'Five separate tools',
      oneWorkspaceHeading: 'One BorsFlow workspace',
    },
  },
  kanban: {
    priorityLow: 'Low',
    priorityMedium: 'Medium',
    priorityHigh: 'High',
    statusTodo: 'To do',
    statusInProgress: 'In progress',
    statusDone: 'Done',
    priorityFilterAll: 'All priorities',
    updateCardError: 'Failed to update card',
    deleteCardError: 'Failed to delete card',
    cardDeletedSuccess: 'Card deleted',
    createCardError: 'Failed to create card',
    cardCreatedSuccess: 'Card created',
    titleRequiredError: 'Title is required',
    reorderError: 'Failed to reorder cards',
    createProjectError: 'Failed to create project',
    projectCreatedSuccess: 'Project created',
    updateProjectError: 'Failed to update project',
    projectUpdatedSuccess: 'Project updated',
    deleteProjectConfirm: 'Delete this project? This cannot be undone.',
    deleteProjectError: 'Failed to delete project',
    projectDeletedSuccess: 'Project deleted',
    noWorkspaceTitle: 'No workspace selected',
    noWorkspaceDescription: 'Select or create a workspace to start using the kanban board.',
    workspaceFallbackName: 'Workspace',
    searchCardsPlaceholder: 'Search cards...',
    adding: 'Adding...',
    addCard: 'Add card',
    addCardModalTitle: 'Add a new card',
    titleFieldLabel: 'Title',
    cardTitlePlaceholder: 'Enter a card title',
    descriptionFieldLabel: 'Description',
    descriptionPlaceholder: 'Add a description (optional)',
    priorityFieldLabel: 'Priority',
    statusFieldLabel: 'Status',
    dueDateFieldLabel: 'Due date',
    tagsFieldLabel: 'Tags',
    tagsPlaceholder: 'Add tags separated by commas',
    assigneesFieldLabel: 'Assignees',
    assigneesPlaceholder: 'Add assignees separated by commas',
    addCardToColumnAria: 'Add card to {column}',
    noCardsHere: 'No cards here',
    dragCardsHint: 'Drag cards into this column to add them',
    cardTitlePlaceholderShort: 'Card title',
    weekdaySun: 'Sun',
    weekdayMon: 'Mon',
    weekdayTue: 'Tue',
    weekdayWed: 'Wed',
    weekdayThu: 'Thu',
    weekdayFri: 'Fri',
    weekdaySat: 'Sat',
    unitMonth: 'Month',
    unitWeek: 'Week',
    unitDay: 'Day',
    previousMonthAria: 'Previous month',
    today: 'Today',
    nextMonthAria: 'Next month',
    moreCardsCount: '+{count} more',
    weekViewTitle: 'Week view',
    dayViewTitle: 'Day view',
    weekViewComingSoon: 'Week view is coming soon',
    dayViewComingSoon: 'Day view is coming soon',
    showingCardsWithDueDates: 'Showing {count} cards with due dates',
    dragToChangeDueDatesHint: 'Drag a card to a new date to change its due date',
    overdueDays: '{days}d overdue',
    dueToday: 'Due today',
    dueTomorrow: 'Due tomorrow',
    dueInDays: 'Due in {days}d',
    editCardAria: 'Edit card',
    deleteCardAria: 'Delete card',
    editCardModalTitle: 'Edit card',
    saving: 'Saving...',
    saveChanges: 'Save changes',
    noCardsFound: 'No cards found',
    adjustFiltersHint: 'Try adjusting your filters to see more cards.',
    createFirstCardHint: 'Create your first card to get started.',
    columnTitle: 'Title',
    columnStatus: 'Status',
    columnPriority: 'Priority',
    columnDueDate: 'Due date',
    columnProject: 'Project',
    moreOptionsAria: 'More options',
    showingCardsOf: 'Showing {shown} of {total} cards',
    ungroupedLabel: 'Ungrouped',
    noProjectLabel: 'No project',
    unknownLabel: 'Unknown',
    allCardsLabel: 'All cards',
    cardColumnHeader: 'Card',
    noDueDateLabel: 'No due date',
    timelineTitle: 'Timeline',
    noGroupingOption: 'No grouping',
    groupByProjectOption: 'Group by project',
    groupByStatusOption: 'Group by status',
    groupByPriorityOption: 'Group by priority',
    colorIndigo: 'Indigo',
    colorViolet: 'Violet',
    colorPink: 'Pink',
    colorRose: 'Rose',
    colorOrange: 'Orange',
    colorYellow: 'Yellow',
    colorGreen: 'Green',
    colorTeal: 'Teal',
    colorSky: 'Sky',
    colorSlate: 'Slate',
    nameRequiredError: 'Name is required',
    nameMinLengthError: 'Name must be at least 2 characters',
    nameMaxLengthError: 'Name must be 50 characters or fewer',
    descriptionMaxLengthError: 'Description must be 200 characters or fewer',
    saveProjectError: 'Failed to save project',
    editProjectTitle: 'Edit project',
    createProjectTitle: 'Create project',
    closeModalAria: 'Close',
    projectNameLabel: 'Project name',
    projectNamePlaceholder: 'Enter a project name',
    projectDescriptionPlaceholder: 'Add a description (optional)',
    charactersCount: '{count} characters',
    projectColorLabel: 'Color',
    selectColorAria: 'Select {color}',
    updating: 'Updating...',
    creating: 'Creating...',
    updateProjectCta: 'Update project',
    createProjectCta: 'Create project',
    projectsHeading: 'Projects',
    collapseSidebarAria: 'Collapse sidebar',
    expandSidebarAria: 'Expand sidebar',
    addProject: 'Add project',
    fromTemplate: 'From template',
    searchProjectsPlaceholder: 'Search projects...',
    editProjectAria: 'Edit project',
    deleteProjectAria: 'Delete project',
    noProjectsFound: 'No projects found',
    noProjectsYet: 'No projects yet',
    createFirstProjectCta: 'Create your first project',
    projectCountSingular: '{count} project',
    projectCountPlural: '{count} projects',
    viewKanbanLabel: 'Board',
    viewKanbanTitle: 'Kanban view',
    viewListLabel: 'List',
    viewListTitle: 'List view',
    viewCalendarLabel: 'Calendar',
    viewCalendarTitle: 'Calendar view',
    viewTimelineLabel: 'Timeline',
    viewTimelineTitle: 'Timeline view',
  },
  invoices: {
    detail: {
      paymentModal: {
        invalidAmount: 'Enter a valid payment amount.',
        genericFailure: 'Something went wrong while recording the payment.',
        title: 'Record Payment',
        amountDue: 'Amount due',
        amount: 'Amount',
        date: 'Date',
        method: 'Method',
        reference: 'Reference',
        referencePlaceholder: 'Check number, transaction ID, etc.',
        notes: 'Notes',
        recording: 'Recording...',
        record: 'Record Payment',
      },
      sendModal: {
        subjectTemplate: 'Invoice {number}',
        defaultMessage: 'Please find your invoice {number} attached. The amount due is {amount}, payable by {dueDate}.',
        notAvailable: 'N/A',
        recipientRequired: 'Enter a recipient email address.',
        failedToSend: 'Failed to send the invoice.',
        genericError: 'Something went wrong while sending the invoice.',
        title: 'Send Invoice',
        to: 'To',
        subject: 'Subject',
        message: 'Message',
        sending: 'Sending...',
        send: 'Send',
      },
      failedToFetch: 'Failed to load the invoice.',
      genericError: 'Something went wrong. Please try again.',
      failedToSave: 'Failed to save the invoice.',
      toastSaved: 'Invoice saved.',
      clientNameRequired: 'Client name is required.',
      noWorkspaceSelected: 'No workspace selected.',
      createFailed: 'Failed to create the invoice.',
      failedToDuplicate: 'Failed to duplicate the invoice.',
      deleteConfirm: 'Delete invoice {number}? This cannot be undone.',
      failedToDeleteInvoice: 'Failed to delete the invoice.',
      failedToDelete: 'Failed to delete the invoice.',
      deletePaymentConfirm: 'Remove this payment? This cannot be undone.',
      failedToDeletePayment: 'Failed to remove the payment.',
      toastPaymentRemoved: 'Payment removed.',
      goBack: 'Go back',
      toastPaymentRecorded: 'Payment recorded.',
      toastInvoiceSent: 'Invoice sent.',
      backAria: 'Back to invoices',
      newInvoiceTitle: 'New Invoice',
      invoiceFallback: 'Invoice',
      fromQuote: 'From quote {number}',
      unsavedChanges: 'You have unsaved changes.',
      payment: 'Payment',
      send: 'Send',
      pdf: 'PDF',
      moreOptionsAria: 'More options',
      editInvoice: 'Edit invoice',
      duplicateInvoice: 'Duplicate invoice',
      deleteInvoice: 'Delete invoice',
      status: 'Status',
      payments: 'Payments',
      recordPayment: 'Record payment',
      noPayments: 'No payments recorded yet.',
      paidOfTotal: '{paid} of {total} paid',
      colDate: 'Date',
      colMethod: 'Method',
      colReference: 'Reference',
      colAmount: 'Amount',
      removePaymentAria: 'Remove payment',
      details: 'Details',
      discardConfirm: 'Discard unsaved changes?',
      discard: 'Discard',
      creating: 'Creating...',
      createInvoice: 'Create Invoice',
      saving: 'Saving...',
      save: 'Save',
    },
    paymentMethod: {
      bankTransfer: 'Bank Transfer',
      cash: 'Cash',
      creditCard: 'Credit Card',
      check: 'Check',
      other: 'Other',
      paypal: 'PayPal',
    },
    status: {
      overdue: 'Overdue',
      draft: 'Draft',
      sent: 'Sent',
      viewed: 'Viewed',
      partiallyPaid: 'Partially Paid',
      paid: 'Paid',
      cancelled: 'Cancelled',
      all: 'All',
    },
    fields: {
      issueDate: 'Issue date',
      dueDate: 'Due date',
      currency: 'Currency',
      clientInformation: 'Client Information',
      clientName: 'Client name',
      email: 'Email',
      phone: 'Phone',
      company: 'Company',
      address: 'Address',
      lineItems: 'Line Items',
      notesAndTerms: 'Notes & Terms',
      notes: 'Notes',
      notesPlaceholder: 'Thank you for your business.',
      terms: 'Terms',
      termsPlaceholder: 'Payment is due within 30 days.',
      internalNotes: 'Internal Notes',
      internalNotesPrivate: 'Only visible to your team',
      internalNotesPlaceholder: 'Private notes about this invoice...',
      clientNamePlaceholder: 'Jane Smith',
      emailPlaceholder: 'jane@example.com',
      phonePlaceholder: '+1 (555) 123-4567',
      companyPlaceholder: 'Acme Inc.',
      addressPlaceholder: '123 Main St, City, Country',
    },
    newForm: {
      clientNameRequired: 'Client name is required.',
      lineItemRequired: 'Add at least one line item.',
      createFailed: 'Failed to create the invoice.',
      genericError: 'Something went wrong. Please try again.',
      backAria: 'Back to invoices',
      title: 'New Invoice',
      subtitle: 'Create a new invoice for your client.',
      creating: 'Creating...',
      createInvoice: 'Create Invoice',
      documentSettings: 'Document Settings',
      linkedContact: 'Linked contact',
      removeLinkedAria: 'Remove linked contact',
      linkCrmContact: 'Link a CRM contact',
      searchContacts: 'Search contacts...',
      noContactsFound: 'No contacts found.',
    },
    quickPaymentModal: {
      genericFailure: 'Something went wrong while recording the payment.',
      title: 'Record Payment',
      amount: 'Amount',
      method: 'Method',
      date: 'Date',
      recording: 'Recording...',
      record: 'Record Payment',
    },
    sendModal: {
      subjectTemplate: 'Invoice {number}',
      failedToSend: 'Failed to send the invoice.',
      genericError: 'Something went wrong while sending the invoice.',
      title: 'Send Invoice',
      to: 'To',
      toPlaceholder: 'client@example.com',
      subject: 'Subject',
      message: 'Message',
      messagePlaceholder: 'Add a message to your client...',
      sending: 'Sending...',
      send: 'Send',
    },
    actions: {
      menuAria: 'More actions',
      copyClientLink: 'Copy client link',
      recordPayment: 'Record payment',
      sendByEmail: 'Send by email',
      viewPdf: 'View PDF',
      duplicate: 'Duplicate',
      delete: 'Delete',
    },
    sort: {
      date: 'Date',
      client: 'Client',
      total: 'Total',
      status: 'Status',
      dueDate: 'Due date',
    },
    list: {
      failedToFetch: 'Failed to load invoices.',
      deleteConfirm: 'Delete invoice {number}? This cannot be undone.',
      failedToDelete: 'Failed to delete the invoice.',
      toastDeleted: 'Invoice {number} deleted.',
      failedToDuplicate: 'Failed to duplicate the invoice.',
      toastDuplicated: 'Invoice {number} duplicated.',
      failedToCreateLink: 'Failed to create the client link.',
      toastLinkCopied: 'Link copied to clipboard.',
      title: 'Invoices',
      subtitle: 'Manage and track all your invoices.',
      fromTemplate: 'From Template',
      newInvoice: 'New Invoice',
      tryAgain: 'Try Again',
      emptyTitle: 'No invoices found',
      emptyFiltered: 'Try adjusting your filters or search term.',
      emptyGetStarted: 'Get started by creating your first invoice.',
      createInvoice: 'Create Invoice',
      colNumber: 'Number',
      colClient: 'Client',
      colStatus: 'Status',
      colDueDate: 'Due Date',
      colTotal: 'Total',
      colPaid: 'Paid',
      colActions: 'Actions',
      overdueTag: 'Overdue',
      previous: 'Previous',
      next: 'Next',
      toastInvoiceSent: 'Invoice sent.',
      toastPaymentRecorded: 'Payment recorded.',
    },
    card: {
      dueAmount: 'Due: {amount}',
      dueDateText: 'Due {date}',
      paidPercent: '{percent}% paid',
      total: 'Total',
      amountDue: 'Amount due',
    },
  },
  public: {
    invitation: {
      missingToken: 'This invitation link is missing or invalid',
      loadFailed: 'Failed to load this invitation',
      unexpectedError: 'An unexpected error occurred',
      actionFailed: 'Failed to {action} the invitation',
      acceptVerb: 'accept',
      declineVerb: 'decline',
      actionFailedGeneric: 'Something went wrong. Please try again.',
      loadingText: 'Loading invitation...',
      unavailableTitle: 'Invitation unavailable',
      goToDashboard: 'Go to dashboard',
      welcomeTo: 'Welcome to {workspace}',
      declinedTitle: 'Invitation declined',
      accessGranted: 'You now have access to this workspace',
      declinedBody: "You've declined the invitation to join {workspace}",
      takingYouThere: 'Taking you there...',
      alreadyAccepted: 'This invitation has already been accepted',
      alreadyDeclined: 'This invitation has already been declined',
      expired: 'This invitation has expired',
      invitationToWorkspace: 'Invitation to {workspace}',
      notActive: 'This invitation is no longer active',
      youreInvitedTo: "You're invited to join {workspace}",
      invitedAs: 'Invited by {inviter} as {role}',
      wrongAccountNotice: "You're signed in as {email}, but this invitation was sent to {invitedEmail}",
      switchAccount: 'Switch account',
      signInToAccept: 'Sign in to accept',
      createAccount: 'Create an account',
      joinWorkspace: 'Join {workspace}',
      accept: 'Accept',
      decline: 'Decline',
    },
    offline: {
      heading: "You're offline",
      body: 'Check your internet connection and try again.',
      retry: 'Retry',
    },
    share: {
      codeBadge: 'Code',
      noLink: 'No link available',
      untitled: 'Untitled',
      noDescription: 'No description',
      tagFallback: 'Shared content',
      videoTitle: 'Shared video',
      privateTitle: 'This page is private',
      privateBody: 'The owner has made this content private.',
      notFoundTitle: 'Page not found',
      notFoundBody: "This shared page doesn't exist or may have been removed.",
      readOnly: 'Read-only',
      madeWith: 'Made with BorsFlow',
    },
    invoice: {
      loadErrorDefault: 'Failed to load this invoice',
      loadErrorCatch: 'Something went wrong while loading this invoice',
      loadErrorFallback: 'This invoice could not be found',
      paidMessage: 'This invoice has been paid in full. Thank you!',
      cancelledMessage: 'This invoice has been cancelled',
      defaultMessage: 'Please review the invoice details below',
    },
    quote: {
      loadErrorDefault: 'Failed to load this quote',
      loadErrorCatch: 'Something went wrong while loading this quote',
      respondErrorDefault: 'Failed to submit your response',
      respondErrorCatch: 'Something went wrong while submitting your response',
      loadErrorFallback: 'This quote could not be found',
      acceptButton: 'Accept quote',
      declineButton: 'Decline quote',
      acceptedThankYou: 'Thank you! You have accepted this quote.',
      declinedMessage: 'You have declined this quote',
      statusMessage: 'This quote is currently {status}',
    },
    document: {
      invoiceLabel: 'Invoice',
      quoteLabel: 'Quote',
      issuedLabel: 'Issued',
      dueLabel: 'Due',
      validUntilLabel: 'Valid until',
      billedTo: 'Billed to',
      amountDueHeading: 'Amount due',
      totalHeading: 'Total',
      paidOf: '{paid} paid of {total}',
      descriptionCol: 'Description',
      qtyCol: 'Qty',
      unitPriceCol: 'Unit price',
      discTaxCol: 'Disc./Tax',
      amountCol: 'Amount',
      subtotal: 'Subtotal',
      discount: 'Discount',
      tax: 'Tax',
      total: 'Total',
      amountPaid: 'Amount paid',
      amountDue: 'Amount due',
      paidInFull: 'Paid in full',
      paymentHistory: 'Payment history',
      notes: 'Notes',
      terms: 'Terms',
      downloadPdf: 'Download PDF',
      sentBy: 'Sent by {name}',
      notAvailableTitle: 'This document is not available',
    },
  },
  documentSender: {
    sender: {
      label: 'Send from',
      workspaceDetail: 'Your connected email address',
      platformTitle: '{name} via BorsFlow',
      platformDetail: "Sent from BorsFlow's address; replies go to your email",
      you: 'You',
    },
    history: {
      title: 'Sent history',
      empty: 'Not sent yet.',
      loadFailed: "Couldn't load the send history.",
      sentTo: 'sent it to',
      from: 'From:',
      unknownMember: 'A former member',
    },
  },
  emailMarketing: {
    tabs: {
      campaigns: 'Campaigns',
      templates: 'Templates',
      automations: 'Automations',
      settings: 'Settings',
    },
    tokenGroups: {
      contact: 'Contact',
      property: 'Property',
      deal: 'Deal',
      sender: 'Your agency',
    },
    tokens: {
      first_name: 'First name',
      last_name: 'Last name',
      full_name: 'Full name',
      name: 'Name',
      email: 'Email address',
      phone: 'Phone',
      company: 'Company',
      position: 'Job title',
      property_title: 'Property title',
      property_reference: 'Reference',
      property_city: 'City',
      property_district: 'District',
      property_type: 'Property type',
      property_price: 'Price',
      property_bedrooms: 'Bedrooms',
      property_surface: 'Surface area',
      stage: 'Stage',
      status: 'Status',
      source: 'Source',
      value: 'Deal amount',
      pipeline_name: 'Pipeline',
      interest_stage: 'Interest stage',
      mandate_reference: 'Mandate reference',
      asking_price: 'Asking price',
      mandate_end_date: 'Mandate end date',
      company_name: 'Agency name',
      unsubscribe_url: 'Unsubscribe link',
    },
    automationsTab: {
      saveFailed: 'Failed to save automation',
      toggleFailed: 'Failed to update automation status',
      deleteConfirm: 'Delete this automation? This cannot be undone.',
      deleteFailed: 'Failed to delete automation',
      noTrigger: 'No trigger set',
      triggerMovesFrom: 'Moves from {fromStage} to {toStage}',
      triggerMoves: 'Moves to {toStage}',
      invalidTrigger: 'Invalid trigger',
      noSteps: 'No email steps yet',
      oneEmail: '1 email',
      emailsCount: '{count} emails',
      allSentImmediately: '{label}, sent immediately',
      overMinutes: '{label} over {minutes} min',
      overHours: '{label} over {hours}h',
      overDays: '{label} over {days}d',
      heading: 'Automations',
      subtitle: 'Send automatic email sequences when leads move through your pipeline.',
      statAutomations: 'Automations',
      statRunning: 'Running',
      statLeadsInSequence: 'Leads in sequence',
      listHeading: 'Automations ({count})',
      createAutomation: 'Create automation',
      loading: 'Loading automations...',
      emptyTitle: 'No automations yet',
      emptySubtitle: 'Create your first automation to send emails automatically as leads move through your pipeline.',
      activeCount: '{count} active',
      completedCount: '{count} completed',
      pause: 'Pause',
      activate: 'Activate',
    },
    templatesTab: {
      saveFailed: 'Failed to save template',
      deleteConfirm: 'Delete this template? This cannot be undone.',
      deleteFailed: 'Failed to delete template',
      cloneFailed: 'Failed to duplicate template',
      cloneForEditFailed: 'Failed to duplicate template for editing',
      heading: 'Templates',
      loading: 'Loading templates...',
    },
    segmentsTab: {
      saveFailed: 'Failed to save segment',
      deleteConfirm: 'Delete this segment? This cannot be undone.',
      deleteFailed: 'Failed to delete segment',
      heading: 'Segments',
      subtitle: 'Group leads by shared traits so you can target the right people with every campaign.',
      statActiveSegments: 'Active segments',
      statTotalLeads: 'Total leads',
      statActiveRules: 'Active rules',
      listHeading: 'Segments ({count})',
      createSegment: 'Create segment',
      loading: 'Loading segments...',
      emptyTitle: 'No segments yet',
      emptySubtitle: 'Create a segment to group leads by shared traits like stage, tags, or source.',
      active: 'Active',
      inactive: 'Inactive',
      leadsCount: '{count} leads',
    },
    providersTab: {
      loading: 'Loading providers…',
      emptyTitle: 'No email provider connected',
      emptySubtitle: 'Connect Resend, SendGrid, Mailgun, Postmark, Amazon SES or Brevo to start sending campaigns.',
      testSent: 'Test email sent to {email}',
      testFailed: 'Test failed: {error}',
      retryFailed: 'Couldn\'t set up tracking',
      saveFailed: 'Failed to save provider',
      deleteConfirm: 'Delete this provider? This cannot be undone.',
      deleteFailed: 'Failed to delete provider',
      trackingOn: 'Open and click tracking on',
      trackingNotSetUp: 'Tracking not set up',
      settingUp: 'Setting up...',
      retry: 'Retry',
      setUpNow: 'Set up now',
      heading: 'Email providers',
      subtitle: 'Connect the email service you send campaigns through and manage sending limits.',
      default: 'Default',
      active: 'Active',
      inactive: 'Inactive',
      from: 'From {email}',
      dailyLimit: '{count} / day',
      configure: 'Configure',
      test: 'Test',
      addNew: 'Add provider',
    },
    statusLabels: {
      draft: 'Draft',
      scheduled: 'Scheduled',
      sending: 'Sending',
      sent: 'Sent',
      paused: 'Paused',
      cancelled: 'Cancelled',
      active: 'Active',
    },
    campaignsTab: {
      saveFailed: 'Couldn\'t save the campaign',
      sendFailed: 'Couldn\'t send the campaign',
      sendNowConfirm: 'This campaign is scheduled for {date}. Send it now instead?',
      deleteConfirm: 'Delete this campaign? This cannot be undone.',
      deleteFailed: 'Failed to delete campaign',
      sendConfirm: 'Send this campaign now? Emails will go out immediately to all recipients.',
      heading: 'Campaigns',
      subtitle: 'Create, schedule, and track email campaigns sent to your leads and customers.',
      statActive: 'Active',
      statAvgOpenRate: 'Avg. open rate',
      statTotalSent: 'Total sent',
      statDraft: 'Drafts',
      listHeading: 'Campaigns ({count})',
      searchPlaceholder: 'Search campaigns...',
      loading: 'Loading campaigns...',
      emptyTitle: 'No campaigns yet',
      emptySubtitleSearch: 'No campaigns match your search.',
      emptySubtitleDefault: 'Create your first campaign to start reaching your leads and customers.',
      recipients: '{count} recipients',
      openRateValue: '{rate}% open rate',
      clickRateValue: '{rate}% click rate',
      openRateLabel: 'Open rate',
      clickRateLabel: 'Click rate',
      send: 'Send',
    },
    page: {
      title: 'Email Marketing',
      refresh: 'Refresh',
      createCampaign: 'Create campaign',
    },
    analyticsTab: {
      totalSent: 'Total sent',
      delivered: 'Delivered',
      openRate: 'Open rate',
      clickRate: 'Click rate',
      bounceRate: 'Bounce rate',
    },
    automationModal: {
      unitMinute: 'minute',
      unitMinutes: 'minutes',
      unitHour: 'hour',
      unitHours: 'hours',
      unitDay: 'day',
      unitDays: 'days',
      sendsImmediatelyFirst: 'Sends immediately when the automation triggers',
      sendsImmediatelyAfterPrevious: 'Sends immediately after the previous step',
      sendsAfterFirst: 'Sends {value} {unit} after the automation triggers',
      sendsAfterStep: 'Sends {value} {unit} after step {step}',
      nameRequired: 'Name is required',
      pipelineRequired: 'Pipeline is required',
      toStageRequired: 'Destination stage is required',
      stepNameRequired: 'Each step needs a name',
      stepTemplateRequired: 'Each step needs a template',
      stepDelayInvalid: 'Step delay must be a valid number',
      editTitle: 'Edit automation',
      createTitle: 'Create automation',
      lockedNotice: 'This automation is active. Pause it to make changes to the trigger or steps.',
      basics: 'Basics',
      name: 'Name',
      namePlaceholder: 'e.g. Welcome sequence',
      description: 'Description',
      descriptionPlaceholder: 'What does this automation do?',
      trigger: 'Trigger',
      triggerSubtitle: 'Choose what starts this automation.',
      pipeline: 'Pipeline',
      loadingOption: 'Loading...',
      selectPipeline: 'Select a pipeline',
      enteringStage: 'When a lead enters stage',
      selectStage: 'Select a stage',
      pickPipelineFirst: 'Pick a pipeline first',
      onlyFromStage: 'Only when moving from a specific stage',
      anyStage: 'From any stage',
      runsWhenFrom: 'Runs when a lead moves from {fromStage} to {toStage}',
      runsWhen: 'Runs when a lead enters {toStage}',
      steps: 'Email steps',
      addStep: 'Add step',
      stepsSubtitle: 'Build the sequence of emails sent during this automation.',
      moveUp: 'Move up',
      moveDown: 'Move down',
      removeStep: 'Remove step',
      stepName: 'Step name',
      stepNamePlaceholder: 'e.g. Day 1 welcome email',
      templateLabel: 'Template',
      selectTemplate: 'Select a template',
      delayAfterStage: 'Delay after trigger',
      delayAfterPrevious: 'Delay after previous step',
      minutes: 'Minutes',
      hours: 'Hours',
      days: 'Days',
      saveAutomation: 'Save automation',
      createAutomationButton: 'Create automation',
    },
    campaignModal: {
      useAsTemplate: 'Save and use as template',
      generatedTemplateName: '{campaign} — generated',
      generatedTemplateFallbackName: 'Generated template',
      aiErrorFallback: 'Something went wrong generating content. Please try again.',
      nameRequired: 'Campaign name is required',
      subjectRequired: 'Subject line is required',
      invalidEmail: 'Enter a valid email address',
      editTitle: 'Edit campaign',
      createTitle: 'Create campaign',
      basicInformation: 'Basic information',
      campaignName: 'Campaign name',
      campaignNamePlaceholder: 'e.g. Spring sale announcement',
      description: 'Description',
      descriptionPlaceholder: 'What is this campaign about?',
      campaignType: 'Campaign type',
      typeBroadcast: 'Broadcast',
      typeDrip: 'Drip',
      typeTriggered: 'Triggered',
      typeBehavioral: 'Behavioral',
      typeTransactional: 'Transactional',
      schedule: 'Schedule',
      scheduleHint: 'Leave blank to save as a draft and send manually later.',
      emailContent: 'Email content',
      subjectLine: 'Subject line',
      subjectPlaceholder: 'e.g. Your 20% discount is here',
      suggest: 'Suggest',
      aiSuggestionsLabel: 'AI suggestions',
      campaignCopy: 'Campaign copy',
      writeWithAI: 'Write with AI',
      writing: 'Writing...',
      copyToClipboard: 'Copy to clipboard',
      dismiss: 'Dismiss',
      htmlEmailTemplate: 'HTML email template',
      hideGenerator: 'Hide generator',
      generateWithAI: 'Generate with AI',
      chooseTemplateType: 'Choose a template type',
      templateWelcome: 'Welcome',
      templatePromotional: 'Promotional',
      templateNewsletter: 'Newsletter',
      templateAnnouncement: 'Announcement',
      templateFollowup: 'Follow-up',
      templateTransactional: 'Transactional',
      generating: 'Generating...',
      generateTemplate: 'Generate template',
      preview: 'Preview',
      html: 'HTML',
      generatingTemplate: 'Generating your template...',
      copyHtml: 'Copy HTML',
      regenerate: 'Regenerate',
      template: 'Template',
      selectTemplate: 'Select a template',
      segment: 'Segment',
      allRecipients: 'All recipients',
      senderInformation: 'Sender information',
      fromName: 'From name',
      fromNamePlaceholder: 'e.g. BorsFlow Team',
      fromEmail: 'From email',
      fromEmailPlaceholder: 'e.g. hello@yourcompany.com',
      replyTo: 'Reply-to',
      replyToPlaceholder: 'e.g. support@yourcompany.com',
      tags: 'Tags',
      addTagPlaceholder: 'Add a tag and press Enter',
      updateCampaign: 'Update campaign',
      createCampaignButton: 'Create campaign',
    },
    blockEditor: {
      blockHeading: 'Heading',
      blockText: 'Text',
      blockImage: 'Image',
      blockButton: 'Button',
      blockTwoColumn: 'Two columns',
      blockSocial: 'Social links',
      blockVideo: 'Video',
      blockQuote: 'Quote',
      blockDivider: 'Divider',
      blockSpacer: 'Spacer',
      descHeading: 'A large headline for your email',
      descText: 'A paragraph of body copy',
      descImage: 'A single image with optional link',
      descButton: 'A call-to-action button',
      descTwoColumn: 'Two side-by-side content columns',
      descSocial: 'Links to your social profiles',
      descVideo: 'A video thumbnail that links out to play',
      descQuote: 'A testimonial or pull quote',
      descDivider: 'A horizontal line to separate sections',
      descSpacer: 'Empty vertical space',
      alignLeft: 'Left',
      alignCenter: 'Center',
      alignRight: 'Right',
      insertVariableLabel: 'Insert variable',
      background: 'Background',
      paddingVLabel: 'Vertical padding',
      paddingHLabel: 'Horizontal padding',
      headingTextLabel: 'Heading text',
      levelLabel: 'Size',
      h1Large: 'Large (H1)',
      h2Medium: 'Medium (H2)',
      h3Small: 'Small (H3)',
      alignLabel: 'Alignment',
      textColorLabel: 'Text color',
      bodyTextLabel: 'Body text',
      fontSizeLabel: 'Font size',
      imageUrlLabel: 'Image URL',
      altTextLabel: 'Alt text',
      widthLabel: 'Width',
      buttonLabelLabel: 'Button label',
      urlVariableLabel: 'Link URL',
      buttonColorLabel: 'Button color',
      lineColorLabel: 'Line color',
      heightLabel: 'Height',
      leftColumnLabel: 'Left column',
      rightColumnLabel: 'Right column',
      socialHint: 'Add links to the social platforms you want to show.',
      thumbnailUrlLabel: 'Thumbnail URL',
      videoUrlLabel: 'Video URL',
      captionLabel: 'Caption',
      playButtonColorLabel: 'Play button color',
      quoteTextLabel: 'Quote text',
      authorNameLabel: 'Author name',
      authorTitleLabel: 'Author title',
      avatarUrlLabel: 'Avatar URL',
      accentColorLabel: 'Accent color',
      duplicateTooltip: 'Duplicate block',
      moveUp: 'Move up',
      moveDown: 'Move down',
      deleteTooltip: 'Delete block',
      undoTooltip: 'Undo',
      redoTooltip: 'Redo',
      blockCountLabel: '{count} blocks',
      closePreview: 'Close preview',
      previewLabel: 'Preview',
      closeHtml: 'Close HTML view',
      viewHtmlLabel: 'View HTML',
      desktop: 'Desktop',
      mobile: 'Mobile',
      blocksPanelHeading: 'Add blocks',
      addBlock: 'Add block',
      dragHintLine1: 'Drag blocks here',
      dragHintLine2: 'or click to add them to your email',
      propertiesPanelHeading: 'Properties',
      selectBlockHint: 'Select a block to edit its properties',
    },
    starterGallery: {
      workspaceRequiredEdit: 'Select a workspace before editing a template',
      editFailed: 'Failed to open template for editing',
      workspaceRequiredClone: 'Select a workspace before cloning a template',
      clonedToast: '"{name}" added to your templates',
      cloneFailed: 'Failed to clone template',
      yourTemplates: 'Your templates',
      savedSubtitle: 'Templates you have saved or cloned for your workspace.',
      savedCount: '{count} saved',
      newTemplate: 'New template',
      preview: 'Preview',
      deleteTemplateTooltip: 'Delete template',
      emptyTitle: 'No saved templates yet',
      emptySubtitle: 'Start from a blank template or clone one from the gallery below.',
      createBlank: 'Create blank template',
      browseDivider: 'Model templates',
      searchPlaceholder: 'Search starter templates...',
      browseSubtitle: 'Import a model into your templates, then edit it before using it in a campaign.',
      noMatches: 'No templates match your search',
      industry: 'Industry',
      useCase: 'Use case',
      subject: 'Subject',
      imported: 'Imported',
      cloning: 'Importing...',
      cloneTemplate: 'Import',
      opening: 'Opening...',
      editInBuilder: 'Edit in builder',
      savedTemplateFallback: 'Untitled template',
      previewFallbackDescription: 'No preview available for this template.',
      subjectLineLabel: 'Subject line',
      whyItWorks: 'Why it works',
      variablesLabel: 'Variables',
    },
    providerModal: {
      sesKeyHint: 'Enter it as ACCESS_KEY_ID:SECRET_ACCESS_KEY',
      sesKeyFormat: 'Amazon SES needs ACCESS_KEY_ID:SECRET_ACCESS_KEY (with a colon)',
      regionUsDefault: 'US (default)',
      regionEu: 'EU',
      nameRequired: 'Name is required',
      apiKeyRequired: 'API key is required',
      fromEmailRequired: 'From email is required',
      invalidEmail: 'Enter a valid email address',
      smtpLabel: 'Your own mail server (SMTP)',
      smtpHost: 'Server address',
      smtpHostPlaceholder: 'smtp.example.com',
      smtpHostRequired: 'Enter the SMTP server address.',
      smtpHostInvalid: 'Enter the full server address, such as smtp.example.com.',
      smtpPort: 'Port',
      smtpPort587: '587 — STARTTLS (recommended)',
      smtpPort465: '465 — SSL/TLS',
      smtpPort2525: '2525 — STARTTLS',
      smtpPort25: '25 — unencrypted relay',
      smtpUser: 'Username',
      smtpUserPlaceholder: 'Usually your full email address',
      smtpUserHint: 'Leave empty if your server accepts mail without a login.',
      smtpPassword: 'Password',
      smtpPasswordPlaceholder: 'Mailbox or app password',
      smtpPasswordRequired: 'Enter the mailbox password.',
      smtpTrackingHint: 'An SMTP server reports nothing after it accepts a message, so a bounce is only recorded when the server rejects the address outright.',
      testSuccess: 'Test email sent successfully',
      testFailed: 'Test failed: {error}',
      testFailedGeneric: 'Test failed. Check your settings and try again.',
      saveFailedGeneric: 'Failed to save provider. Please try again.',
      editTitle: 'Edit provider',
      createTitle: 'Add provider',
      basicInformation: 'Basic information',
      providerName: 'Provider name',
      providerNamePlaceholder: 'e.g. Primary SendGrid account',
      providerType: 'Provider type',
      mailgunRegion: 'Mailgun region',
      awsRegion: 'AWS region',
      selectRegion: 'Select a region',
      authentication: 'Authentication',
      apiKey: 'API key',
      apiKeyPlaceholder: 'Paste your API key',
      trackingAutoConnected: '{provider} tracking connects automatically',
      usePostmarkToken: 'Use your Postmark server token',
      useFullAccessKey: 'Use a full access API key, not a restricted key',
      trackingNotAvailable: 'Open and click tracking is not available for {provider}',
      emailSettings: 'Email settings',
      fromEmail: 'From email',
      fromEmailPlaceholder: 'e.g. hello@yourcompany.com',
      fromName: 'From name',
      fromNamePlaceholder: 'e.g. BorsFlow Team',
      replyTo: 'Reply-to',
      replyToPlaceholder: 'e.g. support@yourcompany.com',
      rateLimits: 'Rate limits',
      dailyLimit: 'Daily limit',
      dailyLimitPlaceholder: 'e.g. 1000',
      monthlyLimit: 'Monthly limit',
      monthlyLimitPlaceholder: 'e.g. 30000',
      options: 'Options',
      activeOption: 'Active',
      setAsDefault: 'Set as default provider',
      testing: 'Testing...',
      testConfiguration: 'Test configuration',
      updateProvider: 'Update provider',
      addProvider: 'Add provider',
    },
    pipelinePicker: {
      sectionTitle: 'CRM pipeline',
      sectionHint: 'Limit this segment to leads in one pipeline, and optionally to some of its stages.',
      pipeline: 'Pipeline',
      anyPipeline: 'Any pipeline',
      selectPipeline: 'Select a pipeline',
      stages: 'Stages',
      stagesHint: 'Leave all unselected to include every stage.',
      audience: 'Audience',
      crmPipeline: 'CRM pipeline',
      pipelineRequired: 'Choose a pipeline',
      segmentCreateFailed: 'Could not create the pipeline audience',
    },
    segmentModal: {
      fieldFirstName: 'First name',
      fieldLastName: 'Last name',
      fieldEmail: 'Email',
      fieldPhone: 'Phone',
      fieldStatus: 'Status',
      fieldStage: 'Stage',
      fieldPipeline: 'Pipeline',
      fieldPipelineName: 'Pipeline name',
      fieldDealValue: 'Deal value',
      fieldCompany: 'Company',
      fieldPosition: 'Position',
      fieldSource: 'Source',
      fieldTags: 'Tags',
      fieldCreatedDate: 'Created date',
      fieldUpdatedDate: 'Updated date',
      opEquals: 'Equals',
      opNotEquals: 'Does not equal',
      opContains: 'Contains',
      opNotContains: 'Does not contain',
      opStartsWith: 'Starts with',
      opEndsWith: 'Ends with',
      opGreaterThan: 'Greater than',
      opLessThan: 'Less than',
      opIsEmpty: 'Is empty',
      opIsNotEmpty: 'Is not empty',
      nameRequired: 'Name is required',
      criteriaRequired: 'Choose a pipeline or add at least one condition',
      editTitle: 'Edit segment',
      createTitle: 'Create segment',
      basicInformation: 'Basic information',
      segmentName: 'Segment name',
      segmentNamePlaceholder: 'e.g. Active leads in negotiation',
      description: 'Description',
      descriptionPlaceholder: 'What is this segment for?',
      criteria: 'Conditions',
      match: 'Match',
      allConditions: 'All conditions',
      anyCondition: 'Any condition',
      noConditions: 'No conditions added yet',
      addFirstCondition: 'Add first condition',
      valuePlaceholder: 'Value',
      addAnotherCondition: 'Add another condition',
      tags: 'Tags',
      addTagPlaceholder: 'Add a tag and press Enter',
      updateSegment: 'Update segment',
      createSegmentButton: 'Create segment',
    },
    simpleEditor: {
      subject: 'Subject',
      body: 'Email body',
      bodyPlaceholder: 'Hi {{first_name}},\n\nWrite your message here…',
      bold: 'Bold',
      italic: 'Italic',
      underline: 'Underline',
      link: 'Link',
      linkPrompt: 'Link URL',
      bulletList: 'Bulleted list',
      numberedList: 'Numbered list',
      clearFormatting: 'Clear formatting',
      templateFields: 'This template',
      insertField: 'Insert field',
      unsubscribeToggle: 'Add an unsubscribe link at the bottom',
    },
    inlineEditor: {
      hint: 'Click any text to edit it. Click a button, link or image to change it.',
      editLink: 'Edit link',
      editImage: 'Edit image',
      linkUrl: 'Link URL',
      imageUrl: 'Image URL',
      imageAlt: 'Image description (alt text)',
      apply: 'Apply',
    },
    templateModal: {
      testSend: 'Send me a test',
      testSendHint: 'Sends this draft to your own address, with sample details filled in.',
      testSent: 'Test sent to {email}. It may take a minute to arrive.',
      testFailed: 'The test email could not be sent.',
      testNeedsContent: 'Add a subject and a body before sending a test.',
      legacyTitle: 'Built with the old designer',
      legacyBody: 'This template was made with the block designer, which has been replaced by a single editor. Bringing it across keeps the text, links and lists, and drops the block layout — or you can keep it exactly as it is and edit its HTML.',
      legacyImport: 'Open in the editor',
      legacyEditHtml: 'Edit the HTML',
      legacyImportConfirm: 'This keeps the text, links and lists and simplifies the layout. Nothing is saved until you save, so you can close without keeping it. Continue?',
      tabWrite: 'Write',
      bodyRequired: 'Write something in the email before saving',
      saveFailed: 'Failed to save template',
      tabHtml: 'HTML',
      tabPreview: 'Preview',
      discard: 'Discard',
      settings: 'Settings',
      discardConfirm: 'You have unsaved changes. Discard them?',
      saveChanges: 'Save changes',
      createTemplate: 'Create template',
      templateInfo: 'Template info',
      name: 'Name',
      namePlaceholder: 'e.g. Welcome email',
      subjectLine: 'Subject line',
      subjectPlaceholder: 'e.g. Welcome to BorsFlow!',
      type: 'Type',
      typeMarketing: 'Marketing',
      typeTransactional: 'Transactional',
      typeAutomation: 'Automation',
      description: 'Description',
      descriptionPlaceholder: 'What is this template used for?',
      variables: 'Variables',
      variablePlaceholder: 'Variable name',
      variablesHint: 'Use variables like {example} in your content to personalize each email.',
      tags: 'Tags',
      tagPlaceholder: 'Add a tag and press Enter',
      plainText: 'Plain text version',
      plainTextHint: 'Shown to recipients whose email client cannot display HTML.',
      plainTextPlaceholder: 'Enter a plain text version of this email...',
      requiredFieldsNotice: 'Fill in all required fields before saving.',
      htmlVariablesLabel: 'Available variables',
      htmlPlaceholder: 'Enter your HTML email markup...',
      previewSampleData: 'Preview with sample details',
      nothingToPreview: 'Nothing to preview yet',
    },
  },
  dashboard: {
    unknownWorkspace: 'Unknown workspace',
    justNow: 'Just now',
    minutesAgo: '{mins}m ago',
    hoursAgo: '{hours}h ago',
    daysAgo: '{days}d ago',
    greeting: 'Welcome back, {name}',
    greetingNoName: 'Welcome back',
    searchPlaceholder: 'Search…',
    quickCapturePlaceholder: 'Jot something down…',
    recentlyUpdated: 'Recently updated',
    noRecentActivity: 'No recent activity',
    invoicesOverview: 'Invoices overview',
    openFull: 'Open full view',
    revenue: 'Revenue',
    pending: 'Pending',
    overdue: 'Overdue',
    totalInvoices: 'Total invoices',
    workspaces: 'Workspaces',
    noWorkspaces: 'No workspaces yet',
    createWorkspaceModalTitle: 'Create a workspace',
    workspaceNamePlaceholder: 'Workspace name',
    workspaceDescriptionPlaceholder: 'What is this workspace for? (optional)',
  },
  crm: {
    files: {
      tab: 'Files',
      dropPrompt: 'Drop files here or click to add',
      limits: 'PDF, images, Office documents, CSV, ZIP · up to 10 MB each',
      empty: 'No files yet. Attach proposals, contracts or anything about this prospect.',
      loadFailed: 'Couldn’t load files.',
      uploadFailed: 'Upload failed.',
      tooLarge: 'This file is larger than 10 MB.',
      preview: 'Preview',
      download: 'Download',
      delete: 'Delete file',
      deleteTitle: 'Delete “{name}”?',
      deleteBody: 'The file is removed for everyone. This can’t be undone.',
      deleteFailed: 'Couldn’t delete the file.',
      unknownUser: 'Unknown',
      countTitle: '{count} files attached',
    },
    timeline: {
      notePlaceholder: 'Add a note about a call, a meeting, next steps…',
      noteHint: 'Ctrl+Enter to save · notes are kept in the history',
      addNote: 'Add note',
      noteFailed: 'Couldn’t save the note.',
      deleteNote: 'Delete note',
      loadFailed: 'Couldn’t load the history.',
      loadMore: 'Load older activity',
      emptyHistory: 'Nothing here yet. Notes, changes, files, quotes, meetings and emails will appear as they happen.',
      filterAria: 'Filter history',
      filterAll: 'All',
      filterNotes: 'Notes',
      filterActivity: 'Changes',
      filterFiles: 'Files',
      filterSales: 'Quotes & invoices',
      filterEmails: 'Emails',
      filterMeetings: 'Meetings',
      someone: 'Someone',
      noteBy: 'Note by {name}',
      created: 'Added by {name}',
      createdByImport: 'Added by spreadsheet import',
      source: 'Source: {source}',
      stageChanged: 'Moved from “{from}” to “{to}”',
      updated: '{name} updated details',
      changed: 'changed',
      empty: '(empty)',
      fileAdded: '{name} added a file',
      fileDeleted: '{name} deleted a file',
      quote: 'Quote {number}',
      invoice: 'Invoice {number}',
      meeting: 'Meeting: {title}',
      emailSent: 'Email sent: “{subject}”',
      emailOpened: 'Opened {date}',
      emailNotOpened: 'Not opened yet',
      emailBounced: 'Bounced: not delivered',
      lastActivity: 'Last activity',
      fieldFirstName: 'First name',
      fieldLastName: 'Last name',
      fieldEmail: 'Email',
      fieldPhone: 'Phone',
      fieldCompany: 'Company',
      fieldPosition: 'Position',
      fieldStatus: 'Status',
      fieldValue: 'Value',
      fieldSource: 'Source',
      fieldNotes: 'Notes',
      fieldTags: 'Tags',
    },
    page: {
      errors: {
        loadPipelinesFailed: 'Failed to load pipelines.',
        loadPipelinesNetwork: 'Could not load pipelines. Check your connection and try again.',
        loadListsFailed: 'Failed to load lead lists.',
        createLeadFailed: 'Failed to create lead.',
        createLeadNetwork: 'Could not create the lead. Check your connection and try again.',
        updateLeadFailed: 'Failed to update lead.',
        changeNotSavedNetwork: 'Your change was not saved. Check your connection and try again.',
        deleteLeadFailed: 'Failed to delete lead.',
        deleteLeadNetwork: 'Could not delete the lead. Check your connection and try again.',
        createPipelineFailed: 'Failed to create pipeline.',
        createPipelineNetwork: 'Could not create the pipeline. Check your connection and try again.',
        updatePipelineFailed: 'Failed to update pipeline.',
        deletePipelineFailed: 'Failed to delete pipeline.',
        deletePipelineNetwork: 'Could not delete the pipeline. Check your connection and try again.',
        createListFailed: 'Failed to create lead list.',
        createListNetwork: 'Could not create the lead list. Check your connection and try again.',
        updateListFailed: 'Failed to update lead list.',
        deleteListFailed: 'Failed to delete lead list.',
        deleteListNetwork: 'Could not delete the lead list. Check your connection and try again.',
      },
      thisPipelineFallback: 'this pipeline',
      confirmDeletePipelineWithLeads: 'Delete "{name}"? It has {count} lead(s), which will also be deleted. This cannot be undone.',
      confirmDeletePipeline: 'Delete "{name}"? This cannot be undone.',
      workspaceFallback: 'Workspace',
      selectPipelinePlaceholder: 'Select a pipeline',
      addPipelineAria: 'Add pipeline',
      manageListsFull: 'Manage lead lists',
      manageListsShort: 'Lists',
      importButton: 'Import',
      addLeadButton: 'Add lead',
      noPipelineSelected: 'No pipeline selected yet.',
      createFirstPipeline: 'Create your first pipeline',
    },
    importModal: {
      fields: {
        firstName: 'First name',
        lastName: 'Last name',
        email: 'Email',
        phone: 'Phone',
        company: 'Company',
        position: 'Position',
        status: 'Status',
        stage: 'Stage',
        value: 'Value',
        source: 'Source',
        notes: 'Notes',
        tags: 'Tags',
      },
      invalidFileType: 'Please upload a CSV or Excel file.',
      excelNotice: 'Excel files are converted to CSV before importing. Formatting and formulas are not preserved.',
      minRowsError: 'The file must contain at least one data row in addition to the header.',
      noDataRowsError: 'No data rows were found in this file.',
      readFileError: 'Could not read the file. Please check the format and try again.',
      importFailed: 'Import failed.',
      networkError: 'A network error occurred. Please try again.',
      title: 'Import leads',
      pipelineLabel: 'Importing into:',
      stepUpload: 'Upload',
      stepMap: 'Map columns',
      stepPreview: 'Preview',
      stepDone: 'Done',
      dropZoneTitle: 'Drag and drop a CSV or Excel file here',
      dropZoneSubtitle: 'or click to browse',
      expectedColumns: 'Expected columns:',
      requiredNote: '* First and last name are required.',
      mapInstructions: 'Match each column from {fileName} ({count} rows) to a lead field.',
      colFileColumn: 'File column',
      colSampleValue: 'Sample value',
      colMapsTo: 'Maps to',
      emptyValue: '(empty)',
      skipOption: "Don't import",
      mapRequiredError: 'First name and last name must be mapped before continuing.',
      previewInstructions: 'Showing {shown} of {total} rows. Review the data before importing.',
      moreRows: '+{count} more rows',
      importComplete: 'Import complete',
      resultCreated: '{count} lead(s) created',
      resultSkipped: '{count} row(s) skipped',
      stageCoercedNotice: '{count} lead(s) had a stage that didn\'t match "{pipelineName}" and were assigned to "{firstStage}".',
      errorsHeading: 'Rows with errors:',
      previewButton: 'Preview',
      importingButton: 'Importing…',
      importButton: 'Import {count} leads',
    },
    leadListModal: {
      confirmDelete: 'Delete this list? Leads in it will not be deleted. This cannot be undone.',
      title: 'Lead lists',
      createNewList: 'Create new list',
      formTitleEdit: 'Edit list',
      nameLabel: 'Name',
      namePlaceholder: 'e.g. Trade show leads',
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'What is this list for? (optional)',
      colorLabel: 'Color',
      emptyState: 'You haven\'t created any lead lists yet.',
      leadsCount: '{count} lead(s)',
    },
    pipelineBoard: {
      confirmDeleteLead: 'Delete {firstName} {lastName}? This cannot be undone.',
      deletePipelineTitle: 'Delete pipeline',
      deleteLeadAria: 'Delete {firstName} {lastName}',
      dropLeadsHere: 'Drop leads here',
    },
    leadListView: {
      searchPlaceholder: 'Search leads…',
      filtersButton: 'Filters',
      resultsCount: 'Showing {shown} of {total} leads',
      fieldStatus: 'Status',
      fieldStage: 'Stage',
      fieldSource: 'Source',
      fieldTags: 'Tags',
      fieldName: 'Name',
      fieldCompany: 'Company',
      fieldEmail: 'Email',
      fieldValue: 'Value',
      fieldCreated: 'Created',
      fieldActions: 'Actions',
      emptyFiltered: 'No leads match your filters.',
      emptyState: 'No leads yet. Add your first lead to get started.',
      actionsAria: 'Lead actions',
    },
    leadModal: {
      purchaseHistory: {
        empty: 'This lead has no quotes or invoices yet.',
        colType: 'Type',
        colDocument: 'Document',
        colStatus: 'Status',
        colTotal: 'Total',
        colDate: 'Date',
        typeQuote: 'Quote',
        typeInvoice: 'Invoice',
      },
      status: {
        new: 'New',
        contacted: 'Contacted',
        qualified: 'Qualified',
        proposal: 'Proposal',
        negotiation: 'Negotiation',
        won: 'Won',
        lost: 'Lost',
      },
      aiNoWorkspace: 'Select a workspace to use the AI assistant.',
      aiError: 'The AI assistant could not complete this request. Please try again.',
      errors: {
        emailInvalid: 'Enter a valid email address.',
        phoneInvalid: 'Enter a valid phone number.',
        firstNameRequired: 'First name is required.',
        firstNameTooLong: 'First name is too long.',
        lastNameRequired: 'Last name is required.',
        lastNameTooLong: 'Last name is too long.',
        companyTooLong: 'Company name is too long.',
        positionTooLong: 'Position is too long.',
        valueInvalid: 'Enter a valid deal value.',
        valueTooLarge: 'Deal value is too large.',
        sourceTooLong: 'Source is too long.',
        notesTooLong: 'Notes are too long.',
      },
      editTitle: 'Edit lead',
      createTitle: 'New lead',
      closeAria: 'Close',
      tabDetails: 'Details',
      tabMeetings: 'Meetings',
      tabHistory: 'Purchases',
      personalInfoHeading: 'Contact',
      firstNameLabel: 'First name',
      lastNameLabel: 'Last name',
      emailLabel: 'Email',
      phoneLabel: 'Phone',
      companyInfoHeading: 'Company (optional)',
      companyLabel: 'Company',
      positionLabel: 'Position',
      pipelineInfoHeading: 'Progress',
      statusLabel: 'Status',
      stageLabel: 'Stage',
      noPipelineSelected: 'Select a pipeline first',
      selectStagePlaceholder: 'Select a stage',
      dealValueLabel: 'Amount',
      sourceLabel: 'Source',
      sourcePlaceholder: 'e.g. Referral, website',
      tagsLabel: 'Tags',
      tagPlaceholder: 'Tag, then Enter',
      removeTagAria: 'Remove tag {tag}',
      leadListsLabel: 'Lists',
      summarizeLeadButton: 'Summary',
      draftEmailButton: 'Follow-up email',
      leadSummaryHeading: 'Summary',
      emailDraftHeading: 'Draft email',
      copyToNotes: 'Add to notes',
      notesLabel: 'Notes',
      notesPlaceholder: 'Add any notes about this lead…',
      notesCharCount: '{count}/2000 characters',
      updateButton: 'Save',
      createButton: 'Create lead',
    },
    pipelineModal: {
      editTitle: 'Edit pipeline',
      minStageAlert: 'A pipeline needs at least one stage.',
      confirmRemoveStage: 'Remove the stage "{stage}"? Leads in it will move to "{target}".',
      confirmRemoveStageWithLeads: 'Remove the stage "{stage}"? It has {count} lead(s), which will move to "{target}".',
      createTitle: 'New pipeline',
      nameLabel: 'Name',
      namePlaceholder: 'e.g. Sales pipeline',
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'What is this pipeline for? (optional)',
      colorLabel: 'Color',
      stagesLabel: 'Stages',
      addStagePlaceholder: 'New stage name',
      addStageButton: 'Add stage',
      stageNameAria: 'Stage {number} name',
      renamingFrom: 'Renamed from "{from}"',
      moveUp: 'Move up',
      moveDown: 'Move down',
      removeStage: 'Remove stage',
      noStages: 'No stages yet. Add one to get started.',
      updateButton: 'Save changes',
      createButton: 'Create pipeline',
    },
    viewToggle: {
      kanbanAria: 'Switch to kanban view',
      kanbanTitle: 'Kanban view',
      kanbanLabel: 'Board',
      listAria: 'Switch to list view',
      listTitle: 'List view',
      listLabel: 'List',
    },
  },
  misc: {
    actionSend: 'Send',
    moreOptions: 'More options',
    statusLabel: 'Status',
    statusDraft: 'Draft',
    statusSent: 'Sent',
    statusViewed: 'Viewed',
    statusAccepted: 'Accepted',
    statusRejected: 'Rejected',
    statusExpired: 'Expired',
    saveChanges: 'Save Changes',
    sendQuote: 'Send Quote',
    downloadPdf: 'Download PDF',
    convertToInvoice: 'Convert to Invoice',
    duplicateQuote: 'Duplicate Quote',
    deleteQuote: 'Delete Quote',
    updating: 'Updating...',
    updatePassword: 'Update Password',
    integrations: 'Integrations',
    integrationsDesc: 'Connect external services to your workspace',
    loadingIntegrations: 'Loading integrations…',
    calendar: 'Calendar',
    videoConferencing: 'Video Conferencing',
    disconnect: 'Disconnect',
    watchVideo: 'Watch video',
    unsubscribe: 'Unsubscribe',
    videoThumbnail: 'Video thumbnail',
    emailPreview: 'Email preview',
    searchMeetings: 'Search meetings…',
    listView: 'List view',
    calendarView: 'Calendar view',
    refresh: 'Refresh',
    syncFromCalcom: 'Sync from Cal.com',
    phoneNumber: 'Phone Number',
    locationLabel: 'Location',
    meetingAgendaPlaceholder: 'Agenda or notes for this meeting…',
    crmContact: 'CRM contact',
    searchCrmContacts: 'Search CRM contacts…',
    firstNameRequired: 'First name *',
    lastName: 'Last name',
    emailLabel: 'Email',
    companyLabel: 'Company',
    phoneLabel: 'Phone',
    estimatedTotal: 'Estimated total:',
    customTemplate: 'Custom Template',
    searchTemplates: 'Search templates…',
    yourCompany: 'Your Company',
    companyAddress: 'City, State 12345',
    itemDescription: 'Item Description',
    rateLabel: 'Rate',
    amountLabel: 'Amount',
    subtotalLabel: 'Subtotal',
    totalLabel: 'Total',
    billedTo: 'Billed to',
    detailsLabel: 'Details',
    unitPriceLabel: 'Unit price',
    discountLabel: 'Discount',
    issueDateLabel: 'Issue Date',
    validUntilLabel: 'Valid Until',
    notesLabel: 'Notes',
    termsLabel: 'Terms',
    description: 'Description',
    unsubscribeReason: 'You are receiving this email because you signed up or were added to our list.',
    brandName: 'BorsFlow',
    meetingsNoWorkspace: 'Please select a workspace from the sidebar.',
    demoName: 'Avery Cole',
    aliceEditing: 'Alice is editing',
    deliveredLive: 'Delivered live but not saved to history',
    switchLanguage: 'Switch language',
    languageSelector: 'Language selector',
    closeProductPicker: 'Close product picker',
    searchProducts: 'Search by product name, SKU, or description',
    allPlatformsConnected: 'All platforms connected!',
    schedulingSetupComplete: 'Your scheduling is fully set up.',
    templatePreview: 'Template preview',
    amount: 'Amount',
  },
  onboarding: {
    businessTypeTitle: 'What kind of business are you running?',
    businessTypeSubtitle: 'We will set up your workspace around how you actually sell.',
    agencyTitle: 'Real Estate Agency',
    agencyTagline: 'You list and sell existing properties.',
    agencyPoint1: 'Listings, mandates and viewings',
    agencyPoint2: 'Buyer offers and negotiation',
    agencyPoint3: 'Commission tracking and splits',
    developerTitle: 'Real Estate Developer',
    developerTagline: 'You build and sell new developments.',
    developerPoint1: 'Projects, buildings and unit inventory',
    developerPoint2: 'Reservations, contracts and calls for funds',
    developerPoint3: 'Buyer modifications and construction progress',
    permanentNote: 'This choice sets up your dashboard and cannot be changed later.',
    continueCta: 'Continue',
    saving: 'Setting up your workspace…',
    error: 'We could not save your choice. Please try again.',
  },
  developerDashboard: {
    title: 'Business overview',
    periodMonth: 'This month',
    periodQuarter: 'This quarter',
    periodYear: 'This year',
    periodNounMonth: 'month',
    periodNounQuarter: 'quarter',
    periodNounYear: 'year',
    newProject: 'New project',
    emptyTitle: 'No projects yet',
    emptyBody: 'Create your first development to start tracking sales, inventory and collections.',
    vsPrevious: 'vs previous {period}',
    kpiTotalSalesValue: 'Total sales value',
    kpiUnits: 'Units sold / reserved / available',
    kpiSalesInPeriod: 'Sales this {period}',
    kpiCollected: 'Revenue collected',
    kpiCollectedOf: 'of {called} called',
    kpiNewLeads: 'New leads',
    kpiQualifiedLeads: 'Qualified leads',
    kpiConversionRate: 'Conversion rate',
    kpiAverageDealValue: 'Average deal value',
    kpiPipelineValue: 'Pipeline value',
    kpiOutstanding: 'Outstanding payments',
    kpiCancellationRate: 'Cancellation rate',
    kpiTargetAchievement: 'Target achievement',
    chartSalesTrend: 'Sales trend',
    chartRevenueVsTarget: 'Revenue vs target',
    chartSalesByProject: 'Sales by project',
    chartSalesByAgent: 'Sales by agent',
    chartLeadFunnel: 'Lead funnel',
    chartInventoryStatus: 'Inventory status',
    chartCollectionsForecast: 'Collections forecast',
    noAgentData: 'No sales are attributed to an agent yet.',
    noLeadData: 'No leads on the buyer sales board yet.',
    unassigned: 'Unassigned',
    uncalledBalance: 'Not yet called',
    needsAttention: 'Needs attention',
    expiringOptions: 'Options expiring soon',
    noExpiringOptions: 'No options expiring in the next 72 hours.',
    overdueCalls: 'Overdue calls for funds',
    noOverdueCalls: 'No overdue payments.',
    pendingModifications: 'Modifications awaiting you',
    noPendingModifications: 'No modification requests waiting.',
    expiresIn: 'Expires in {time}',
    expired: 'Expired',
    daysOverdue: '{days} days overdue',
    target: 'Target',
    achieved: 'Achieved',
    loadFailed: 'We could not load your dashboard.',
    retry: 'Try again',
  },
  developer: {
    navProjects: 'Projects',
    navInventory: "Units",
    navBuyers: 'Buyers',
    navCollections: 'Collections',
    navModifications: 'Modifications',
    statusAvailable: 'Available',
    statusOptioned: 'On hold',
    statusReserved: 'Reserved',
    statusContractSigned: 'Contracted',
    statusDeedSigned: 'Sold',
    statusDelivered: 'Delivered',
    inventoryTitle: "All your units",
    inventorySubtitle: "Every apartment, parking space and shop in your developments, with its price and status.",
    inventoryEmpty: 'No units match these filters.',
    inventoryTableView: 'Table',
    inventoryBuildingView: 'Building',
    filterAllProjects: 'All projects',
    filterAllBuildings: 'All buildings',
    filterAllStatuses: 'All statuses',
    filterAllTypes: 'All types',
    filterAllAgents: 'All agents',
    filterMinPrice: 'Min price',
    filterMaxPrice: 'Max price',
    clearFilters: 'Clear filters',
    colUnit: "Unit",
    colDetails: "Details",
    colPrice: "Price",
    colBuilding: 'Building',
    colFloor: 'Floor',
    colType: 'Type',
    colBedrooms: 'Beds',
    colArea: 'Area',
    colOrientation: 'Orientation',
    colListPrice: 'List price',
    colDiscount: 'Discount',
    colFinalPrice: 'Final price',
    colOwner: "Buyer",
    colAgent: 'Agent',
    colReservedAt: 'Reserved',
    colContractAt: 'Contract',
    colPaymentStatus: 'Payments',
    unitsCount: '{count} units',
    paymentsNone: 'No calls yet',
    paymentsPaid: 'Fully paid',
    paymentsPartial: '{paid} of {total}',
    paymentsOverdue: 'Overdue',
    cancelSale: 'Cancel sale',
    cancelSaleTitle: 'Cancel this sale',
    cancelSaleBody: 'Unit {unit} goes back on sale. The cancellation is kept on record.',
    cancelSaleReason: 'Reason',
    cancelSaleReasonPlaceholder: 'Financing refused, buyer withdrew…',
    cancelSaleConfirm: 'Cancel the sale',
    cancelSaleFailed: 'We could not cancel this sale.',
    collectionsTitle: 'Collections',
    collectionsSubtitle: 'Calls for funds across your developments.',
    collectionsEmpty: 'No calls for funds yet. They are created when you certify a construction milestone.',
    dueThisMonth: 'Due this month',
    collected: 'Collected',
    outstanding: 'Outstanding',
    overdue: 'Overdue',
    agingTitle: 'Overdue by age',
    aging030: '0-30 days',
    aging3160: '31-60 days',
    aging60: '60+ days',
    colCallNumber: 'Call',
    colProjectUnit: 'Project / unit',
    colBuyer: 'Buyer',
    colMilestone: 'Milestone',
    colAmount: 'Amount',
    colDueDate: 'Due',
    colStatus: 'Status',
    markPaid: 'Mark paid',
    markPaidFailed: 'We could not mark this call as paid.',
    callStatusDraft: 'Draft',
    callStatusIssued: 'Issued',
    callStatusSentToBank: 'Sent to bank',
    callStatusPaid: 'Paid',
    callStatusOverdue: 'Overdue',
    modificationsTitle: 'Buyer modifications',
    modificationsSubtitle: 'Change requests from your buyers.',
    modificationsEmpty: 'No modification requests yet.',
    colReference: 'Reference',
    colRequest: 'Request',
    colCategory: 'Category',
    colQuote: 'Quote',
    colRequested: 'Requested',
    tmaStatusRequested: 'Requested',
    tmaStatusFeasibilityApproved: 'Feasibility approved',
    tmaStatusQuoteSent: 'Quote sent',
    tmaStatusAccepted: 'Accepted',
    tmaStatusRejected: 'Rejected',
    tmaStatusCompleted: 'Completed',
    launchDate: 'Launch date',
    salesTargetUnits: 'Unit sales target',
    revenueTarget: 'Revenue target',
    salesCompletion: '{percent}% sold',
    soldOfTarget: '{sold} of {target}',
    bedrooms: 'Bedrooms',
    discount: 'Discount',
    salesAgent: 'Sales agent',
    noAgent: 'No agent',
    reservedOn: 'Reserved on',
    contractSignedOn: 'Contract signed on',
    loadFailed: 'We could not load this data.',
  },
  developerCrm: {
    nav: {
      followUps: 'Follow-ups',
      siteVisits: 'Site visits',
      teamActivity: 'Team activity',
      groupSales: 'Sales',
      groupDevelopment: 'Development',
      groupWorkspace: 'Workspace',
    },
    lead: {
      brief: 'Buyer',
      owner: 'Owner',
      unassigned: 'Unassigned',
      source: 'Source',
      campaign: 'Campaign',
      project: 'Project',
      noProject: 'No project',
      typology: 'Unit type',
      typologyPlaceholder: 'e.g. T3',
      budget: 'Budget',
      budgetMin: 'From',
      budgetMax: 'To',
      location: 'Location',
      score: 'Score',
      scoreHint: 'Calculated from contact details, budget, project, source, stage and recent contact.',
      lastContact: 'Last contact',
      never: 'Never',
      nextFollowUp: 'Next follow-up',
      none: 'None',
      myLeads: 'My leads',
      allOwners: 'All owners',
      overdue: 'Overdue',
      scoreFactor_contactable: 'Contact details',
      scoreFactor_budget: 'Budget',
      scoreFactor_project: 'Project and unit type',
      scoreFactor_source: 'Source',
      scoreFactor_stage: 'Stage',
      scoreFactor_recency: 'Recent contact',
    },
    sources: {
      facebook: 'Facebook',
      instagram: 'Instagram',
      google_ads: 'Google Ads',
      website: 'Website',
      portal: 'Property portal',
      broker: 'Broker',
      walk_in: 'Walk-in',
      referral: 'Referral',
      event: 'Event',
      phone: 'Phone',
      whatsapp: 'WhatsApp',
      other: 'Other',
    },
    taskTypes: {
      call: 'Call',
      follow_up: 'Follow up',
      send_price_list: 'Send price list',
      send_floor_plan: 'Send floor plan',
      reservation: 'Reservation',
      payment_reminder: 'Payment reminder',
      contract: 'Contract',
      other: 'Other',
    },
    tasks: {
      title: 'My follow-ups',
      subtitle: 'Never let a buyer go quiet.',
      groupOverdue: 'Overdue',
      groupToday: 'Due today',
      groupUpcoming: 'Upcoming',
      groupDone: 'Done',
      empty: 'Nothing to follow up. Add a follow-up from a buyer, or here.',
      add: 'Add follow-up',
      titleField: 'What needs doing',
      titlePlaceholder: 'Call about the T3 on level 2…',
      type: 'Type',
      due: 'Due',
      assignee: 'Assigned to',
      buyer: 'Buyer',
      pickBuyer: 'Choose a buyer',
      save: 'Save',
      complete: 'Mark done',
      reopen: 'Reopen',
      remove: 'Delete',
      scopeMine: 'Mine',
      scopeAll: 'Everyone',
      showDone: 'Show done',
      daysLate: '{days} days late',
      loadFailed: 'We could not load your follow-ups.',
      saveFailed: 'We could not save that follow-up.',
      widgetTitle: 'Follow-ups',
      widgetAllClear: 'You are all caught up.',
      openAll: 'Open all',
      newAddedFor: 'Follow-up added',
    },
    visits: {
      title: 'Site visits',
      subtitle: 'Show buyers the project, then record how it went.',
      tabUpcoming: 'Upcoming',
      tabNeedsOutcome: 'Needs outcome',
      tabPast: 'Past',
      empty: 'No site visits here.',
      schedule: 'Schedule a visit',
      project: 'Project',
      unit: 'Unit (optional)',
      anyUnit: 'Whole project',
      when: 'Date and time',
      duration: 'Minutes',
      host: 'Host',
      notes: 'Notes',
      book: 'Book visit',
      bookFailed: 'We could not book that visit.',
      recordOutcome: 'Record outcome',
      attended: 'They came',
      noShow: 'No-show',
      outcome: 'How did it go?',
      outcome_interested: 'Interested',
      outcome_needs_follow_up: 'Needs follow-up',
      outcome_reserved: 'Reserved a unit',
      outcome_not_interested: 'Not interested',
      comments: 'Comments',
      save: 'Save outcome',
      saveFailed: 'We could not save the outcome.',
      statusScheduled: 'Scheduled',
      statusCompleted: 'Done',
      statusNoShow: 'No-show',
      statusCancelled: 'Cancelled',
      followUpNote: 'A follow-up is created for tomorrow.',
      loadFailed: 'We could not load the visits.',
    },
    customer: {
      tab: 'Customer',
      logCall: 'Log call',
      addTask: 'Add follow-up',
      scheduleVisit: 'Schedule visit',
      contractValue: 'Contract value',
      paid: 'Paid',
      due: 'Still due',
      overdue: 'Overdue',
      units: 'Units',
      noUnits: 'No unit held or bought yet.',
      relationBuyer: 'Buyer',
      relationOption: 'On hold',
      visits: 'Site visits',
      noVisits: 'No site visits yet.',
      tasks: 'Follow-ups',
      noTasks: 'No follow-ups.',
      modifications: 'Modification requests',
      afterSales: 'After-sales issues',
      cancellations: 'Cancelled deals',
      activity: 'Contact history',
      files: 'Documents',
      callsLogged: '{count} calls logged',
      loadFailed: 'We could not load this customer.',
      unitOverdueNote: '{amount} overdue',
    },
    call: {
      title: 'Log a call',
      direction: 'Direction',
      outbound: 'I called them',
      inbound: 'They called me',
      answered: 'Answered',
      noAnswer: 'No answer',
      duration: 'Minutes (optional)',
      note: 'What was said',
      followUp: 'Call back on',
      save: 'Log call',
      failed: 'We could not log that call.',
    },
    team: {
      title: 'Team activity',
      subtitle: 'What each salesperson did, so you can tell too few leads from too little follow-up.',
      colAgent: 'Salesperson',
      callsMade: 'Calls',
      callsAnswered: 'Answered',
      visitsScheduled: 'Visits booked',
      visitsAttended: 'Visits done',
      followUpsDone: 'Follow-ups done',
      followUpsOverdue: 'Overdue now',
      leadsAssigned: 'New leads',
      dealsCreated: 'Reservations',
      dealsClosed: 'Contracts',
      funnelTitle: 'From lead to payment',
      funnelLeads: 'New leads',
      funnelVisits: 'Visits done',
      funnelReservations: 'Reservations',
      funnelContracts: 'Contracts signed',
      funnelPaid: 'Payments received',
      stepConversion: '{percent}% of previous step',
      note: 'Calls are the ones people logged. Emails and WhatsApp are not counted yet.',
      empty: 'No team members to show.',
      loadFailed: 'We could not load team activity.',
    },
  },
  developerSales: {
    nav: {
      reports: 'Reports',
      templates: 'Templates',
    },
    reserve: {
      searchBuyer: 'Search buyers by name or email',
      fee: 'Reservation deposit',
      agent: 'Sales agent',
      agentMe: 'Me',
      feeReceived: 'Deposit already received',
      feeReceivedOn: 'Received on',
    },
    stage: {
      title: 'Sale progress',
      reserved: 'Reserved',
      contract_pending: 'Contract pending',
      contract_signed: 'Contract signed',
      plan_active: 'Payment plan active',
      completed: 'Completed',
    },
    docs: {
      failed: 'That did not work. Please try again.',
      deposit: 'Reservation deposit',
      depositReceived: 'Received {date}',
      depositPending: 'Not received yet',
      editDeposit: 'Edit deposit',
      generateReservation: 'Generate reservation form',
      generateContract: 'Generate contract',
      none: 'No documents yet.',
      send: 'Send to buyer',
      resend: 'Send again',
      void: 'Void',
      sentOk: 'Sent to the buyer.',
      acceptedBy: 'Accepted by {name} on {date}',
      missingFields: 'Some details are missing and show as blank lines: {fields}',
      defaultTemplate: 'Using the built-in draft wording. Replace it in Templates before sending.',
      status_draft: 'Draft',
      status_sent: 'Sent',
      status_accepted: 'Accepted',
      status_void: 'Void',
    },
    cancel: {
      refund: 'Deposit refunded',
      refundHint: 'Recorded for your files. No money is moved by this.',
      callsRemain: '{count} calls for funds remain and were not changed. Review them in Collections.',
      commissionWithdrawn: 'The unit’s commission was withdrawn.',
      commissionSettled: 'A commission on this unit is already earned or paid and was left as it is.',
    },
    collections: {
      reminders: 'Reminders',
      step_before7: '7 days before',
      step_due: 'Due day',
      step_late3: '3 days late',
      step_late7: '7 days late',
      step_late14: '14 days late',
      paymentTitle: 'Record payment',
      paymentDate: 'Date received',
      paymentMethod: 'Method',
      paymentReference: 'Reference',
      recordPayment: 'Record payment',
      method_bank_transfer: 'Bank transfer',
      method_check: 'Cheque',
      method_cash: 'Cash',
      method_credit_card: 'Card',
      method_other: 'Other',
    },
    project: {
      commission: 'Sales commission (%)',
      commissionHint: 'Taken on the price excluding VAT when a contract is signed.',
    },
    templates: {
      title: 'Document templates',
      subtitle: 'The wording of your reservation forms, contracts and payment reminders. Details in double braces are filled in for each sale.',
      kind_reservation: 'Reservation form',
      kind_contract: 'Sales contract',
      kind_payment_reminder: 'Payment reminder',
      scope: 'Applies to',
      scopeWorkspace: 'All projects',
      source_own: 'Saved for this selection',
      source_workspace: 'Using the all-projects wording',
      source_builtin: 'Using the built-in draft. Save your own to replace it.',
      name: 'Name',
      subject: 'Email subject',
      wording: 'Wording',
      placeholders: 'Insert a detail',
      unknown: 'These placeholders do not exist: {fields}',
      save: 'Save template',
      saved: 'Template saved',
      saveFailed: 'We could not save the template.',
      restore: 'Remove and use the default',
      restored: 'Template removed',
      preview: 'Preview with sample details',
      previewNote: 'Sample details only. Real documents use the sale’s own figures.',
      loadFailed: 'We could not load the templates.',
    },
    reports: {
      title: 'Reports',
      subtitle: 'Sales, marketing, stock and money, for any period.',
      exportCsv: 'Export CSV',
      from: 'From',
      to: 'To',
      loadFailed: 'We could not build this report.',
      empty: 'Nothing in this period.',
      unknownSource: 'Unknown',
      marketingNote: 'Follows the leads created in the period to wherever they have got to. Spend is entered by hand below.',
      spendTitle: 'Marketing spend',
      spendHint: 'Enter what you spent on a channel each month to see cost per lead and return.',
      spendMonth: 'Month',
      spendAmount: 'Amount spent',
      spendFailed: 'We could not save that.',
      tab_sales: 'Sales',
      tab_marketing: 'Marketing',
      tab_inventory: "Units",
      tab_financial: 'Financial',
      groupBy_source: 'By source',
      groupBy_campaign: 'By campaign',
      commissionStatus_accrued: 'Accrued',
      commissionStatus_realized: 'Earned',
      commissionStatus_paid: 'Paid',
      col_name: 'Name',
      col_units: 'Units',
      col_value: 'Value',
      col_averagePrice: 'Average price',
      col_share: 'Share',
      col_month: 'Month',
      col_source: 'Source',
      col_campaign: 'Campaign',
      col_leads: 'Leads',
      col_qualified: 'Qualified',
      col_visits: 'Visits',
      col_reservations: 'Reservations',
      col_sales: 'Sales',
      col_revenue: 'Revenue',
      col_spend: 'Spend',
      col_costPerLead: 'Cost per lead',
      col_costPerSale: 'Cost per sale',
      col_revenuePerSpend: 'Revenue per 1 spent',
      col_status: 'Status',
      col_unit: 'Unit',
      col_project: 'Project',
      col_type: 'Type',
      col_price: 'Price',
      col_daysOnMarket: 'Days on market',
      col_called: 'Called',
      col_collected: 'Collected',
      col_amount: 'Amount',
      sum_unitsSold: 'Units sold',
      sum_salesValue: 'Sales value',
      sum_averagePrice: 'Average price',
      sum_discountsGiven: 'Discounts given',
      sum_newLeads: 'New leads',
      sum_salesFromLeads: 'Sales from these leads',
      sum_revenue: 'Revenue',
      sum_spend: 'Marketing spend',
      sum_costPerLead: 'Cost per lead',
      sum_costPerSale: 'Cost per sale',
      sum_medianResponseHours: 'Median response (hours)',
      sum_respondedWithin24h: 'Answered within 24h',
      sum_totalUnits: 'Total units',
      sum_availableUnits: 'Available units',
      sum_soldUnits: 'Sold units',
      sum_averageSellingPrice: 'Average selling price',
      sum_pricePerSquareMetre: 'Price per m²',
      sum_salesVelocity: 'Units sold per month (last 3 months)',
      sum_called: 'Called for funds',
      sum_collected: 'Collected',
      sum_outstanding: 'Outstanding now',
      sum_overdue: 'Overdue now',
      table_byProject: 'By project',
      table_byMonth: 'By month',
      table_byType: 'By unit type',
      table_byAgent: 'By salesperson',
      table_byCity: 'By city',
      table_bySource: 'By source',
      table_bySourceCampaign: 'By source and campaign',
      table_byStatus: 'Units by status',
      table_bestSellingTypes: 'Best-selling unit types',
      table_slowMoving: 'Slow-moving units (90+ days)',
      table_collectionsByMonth: 'Collections by month',
      table_commissions: 'Commissions on unit sales',
    },
  },
  developerAlerts: {
    nav: 'Alerts',
    title: 'Alerts',
    subtitle: 'Automatic alerts that tell the right people when a buyer is waiting, a sale needs attention, or a project is off track.',
    readOnly: 'Only owners and admins can change alerts.',
    enabled: 'On',
    save: 'Save',
    saved: 'Alert saved',
    saveFailed: 'We could not save that alert.',
    loadFailed: 'We could not load the alerts.',
    lastFired: 'Last raised {date}',
    neverFired: 'Never raised yet',
    param_minutes: 'Minutes without contact',
    param_days: 'Days without contact',
    param_tolerancePercent: 'Tolerance (% behind plan)',
    param_minAvailablePercent: 'Alert at or below (% of units available)',
    param_ratePercent: 'Cancellation rate (%)',
    param_minDeals: 'Minimum deals (last 90 days)',
    rule_lead_no_response_title: 'New buyer not contacted',
    rule_lead_no_response_desc: 'Tells the owner and the admins when a new buyer has had no call, visit or follow-up logged within the time below.',
    rule_lead_no_followup_title: 'No follow-up planned',
    rule_lead_no_followup_desc: 'When an open buyer has nothing booked and no contact for this long, a follow-up is created for their owner.',
    rule_reservation_created_title: 'Unit reserved',
    rule_reservation_created_desc: 'Tells the admins whenever a unit is reserved.',
    rule_contract_signed_title: 'Contract signed',
    rule_contract_signed_desc: 'Tells the admins whenever a unit goes under contract.',
    rule_project_behind_target_title: 'Project behind its sales target',
    rule_project_behind_target_desc: 'Compares units sold with a straight line from launch to delivery, once a quarter of that time has passed. Needs a launch date, a delivery date and a unit target. Raised at most once a week.',
    rule_low_inventory_title: 'Stock running low',
    rule_low_inventory_desc: 'Tells the admins when a project in sales has this share of its units or less still available. Raised at most once a month.',
    rule_high_cancellations_title: 'High cancellation rate',
    rule_high_cancellations_desc: 'Tells the admins when cancellations are at least this share of the deals in the last 90 days, once there are enough deals to mean something. Raised at most once a month.',
    access: {
      who: 'Who can see this',
      team: 'Whole team',
      managers: 'Managers only',
      uploadAs: 'New files visible to',
      failed: 'We could not change who can see that.',
    },
  },
  // <realEstate:value>
  realEstate: {
    nav: {
      properties: 'Properties',
      programs: 'Projects',
      buyers: 'Buyers',
      viewings: 'Viewings',
      mandates: 'Mandates',
      offers: 'Offers',
      services: 'Services & fees',
      commissions: 'Commissions',
    },
    subjects: {
      Lead: 'Enquiries',
      Interest: 'Buyer interests',
      Property: 'Properties',
      Mandate: 'Mandates',
    },
    fields: {
      reference: 'Reference',
      title: 'Title',
      propertyType: 'Property type',
      propertyStatus: 'Property status',
      stage: 'Stage',
      pipelineName: 'Board name',
      price: 'Asking price',
      city: 'City',
      district: 'District',
      postalCode: 'Postal code',
      countryCode: 'Country',
      surfaceArea: 'Surface (m²)',
      rooms: 'Rooms',
      bedrooms: 'Bedrooms',
      bathrooms: 'Bathrooms',
      floor: 'Floor',
      buildYear: 'Year built',
      energyRating: 'Energy rating',
      hasParking: 'Has parking',
      hasGarden: 'Has garden',
      daysOnMarket: 'Days on market',
      listedAt: 'Listed on',
      vendorEmail: 'Vendor email',
      interestStatus: 'Interest status',
      buyerFirstName: 'Buyer first name',
      buyerLastName: 'Buyer last name',
      buyerEmail: 'Buyer email',
      propertyTitle: 'Property title',
      propertyCity: 'Property city',
      propertyPrice: 'Property price',
      lastActivityAt: 'Last activity',
      mandateType: 'Mandate type',
      mandateStatus: 'Mandate status',
      startDate: 'Start date',
      endDate: 'End date',
      daysToExpiry: 'Days to expiry',
      askingPrice: 'Asking price',
      commissionPercent: 'Commission (%)',
      signedAt: 'Signed on',
      vendorFirstName: 'Vendor first name',
      vendorLastName: 'Vendor last name',
    },
    properties: {
      title: 'Properties',
      subtitle: 'Your listings and the owners you are courting.',
      new: 'New property',
      edit: 'Edit property',
      searchPlaceholder: 'Search by title, reference, city…',
      viewGrid: 'Grid',
      viewBoard: 'Owner board',
      openBoard: 'Open the owner board',
      empty: {
        title: 'No properties yet',
        body: 'Add your first property to start tracking owners, mandates, buyers and offers.',
        filtered: 'No property matches these filters.',
      },
      filters: {
        status: 'Status',
        type: 'Type',
        city: 'City',
        minPrice: 'Min price',
        maxPrice: 'Max price',
        minBedrooms: 'Min bedrooms',
        all: 'All',
        clear: 'Clear filters',
      },
      status: {
        prospect: 'Prospect',
        valuation: 'Valuation',
        mandate: 'Mandate',
        live: 'Live',
        under_offer: 'Under offer',
        sold: 'Sold',
        withdrawn: 'Withdrawn',
        expired: 'Expired',
      },
      types: {
        apartment: 'Apartment',
        house: 'House',
        land: 'Land',
        commercial: 'Commercial',
        parking: 'Parking',
        building: 'Building',
        other: 'Other',
      },
      transaction: {
        sale: 'For sale',
        rent: 'For rent',
      },
      form: {
        sectionBasics: 'Basics',
        sectionAddress: 'Address',
        sectionDetails: 'Details',
        sectionAmenities: 'Amenities',
        sectionPeople: 'People',
        reference: 'Reference',
        referencePlaceholder: 'Generated if left empty',
        title: 'Title',
        description: 'Description',
        type: 'Type',
        transaction: 'Transaction',
        status: 'Status',
        price: 'Asking price',
        currency: 'Currency',
        addressLine: 'Street address',
        addressPublic: 'Show the street address on public pages',
        city: 'City',
        district: 'District',
        postalCode: 'Postal code',
        country: 'Country code',
        latitude: 'Latitude',
        longitude: 'Longitude',
        surface: 'Surface (m²)',
        landArea: 'Land (m²)',
        rooms: 'Rooms',
        bedrooms: 'Bedrooms',
        bathrooms: 'Bathrooms',
        floor: 'Floor',
        buildYear: 'Year built',
        energyRating: 'Energy rating',
        energyNone: 'Not rated',
        elevator: 'Elevator',
        parking: 'Parking',
        balcony: 'Balcony',
        terrace: 'Terrace',
        garden: 'Garden',
        pool: 'Pool',
        furnished: 'Furnished',
        vendor: 'Vendor',
        vendorNone: 'Not recorded yet',
        owner: 'Listing agent',
        ownerNone: 'Unassigned',
        customFields: 'Custom fields',
        create: 'Create property',
        save: 'Save changes',
        required: 'Title and city are required',
      },
      card: {
        daysOnMarket: '{count} days on market',
        noPhoto: 'No photo',
        bedrooms: '{count} bd',
        surface: '{count} m²',
        vendorUnknown: 'Vendor not recorded',
      },
      detail: {
        back: 'All properties',
        delete: 'Delete property',
        deleteConfirm: 'Delete "{title}"? Its mandates, interests, offers and photos are deleted with it.',
        daysOnMarket: 'Days on market',
        listedOn: 'Listed on {date}',
        notListed: 'Not listed yet',
        vendor: 'Vendor',
        agent: 'Listing agent',
        tabs: {
          overview: 'Overview',
          media: 'Media',
          mandate: 'Mandate',
          interests: 'Buyers',
          offers: 'Offers',
          viewings: 'Viewings',
          activity: 'Activity',
          matches: 'Matches',
        },
        publish: {
          title: 'Public listing',
          published: 'Published',
          draft: 'Not published',
          hint: 'Publishing turns on the public listing page. An unpublished property shows nothing, even to someone with the link.',
          publish: 'Publish and copy link',
          copyLink: 'Copy listing link',
          unpublish: 'Unpublish',
          rotate: 'Replace link',
          rotateConfirm: 'Replace the listing link? The old link will stop working.',
          copied: 'Listing link copied.',
          link: 'Listing link',
          error: 'Could not update the listing.',
        },
      },
      errors: {
        load: 'Could not load properties',
        loadOne: 'Could not load this property',
        save: 'Could not save the property',
        delete: 'Could not delete the property',
        notFound: 'Property not found',
      },
    },
    projects: {
      title: 'Projects',
      subtitle: 'Developments and the units inside them.',
      stats: {
        totalUnits: "Total units",
        available: 'Available',
        reserved: 'Reserved',
        reservedHint: 'Held or reserved',
        sold: 'Sold',
        sellThrough: 'Sell-through',
        remainingInventory: '{value} still available',
        stage: 'Stage',
        stageHint: '{percent}% through the project lifecycle',
      },
      status: {
        study: 'Study',
        commercialization: 'Commercialization',
        construction: 'Construction',
        delivery: 'Delivery',
        completed: 'Completed',
      },
      type: {
        residential: 'Residential',
        mixed_use: 'Mixed use',
        commercial: 'Commercial',
        subdivision: 'Subdivision',
        renovation: 'Renovation',
        other: 'Other',
      },
      fields: {
        projectType: 'Project type',
        developerName: 'Developer / promoter',
        websiteUrl: 'Project website',
      },
      tabs: {
        overview: 'Overview',
        media: 'Media',
      },
      media: {
        empty: 'No media yet. A development sells on its renders.',
        addVideoLink: 'Add a video link (YouTube or Vimeo)',
        kind: {
          photo: 'Photos',
          drone: 'Drone shots',
          '3d_render': 'Renders',
          plan: 'Plans',
          quarterly_report: 'Quarterly reports',
          video: 'Videos',
          document: 'Brochures and documents',
        },
      },
    },
    media: {
      title: 'Photos and media',
      upload: 'Upload photos',
      dropHint: 'Drop images here, or click to choose. JPEG, PNG or WebP.',
      addLink: 'Add a video or virtual tour',
      linkUrl: 'Link (https://…)',
      linkKind: 'Type',
      addLinkSubmit: 'Add link',
      empty: 'No media yet. A listing without photos does not sell.',
      reorderHint: 'Drag to reorder. The first photo is the cover unless you choose another.',
      kind: {
        photo: 'Photo',
        floorplan: 'Floor plan',
        video: 'Video',
        virtual_tour: 'Virtual tour',
      },
      cover: 'Cover',
      setCover: 'Make cover',
      caption: 'Caption',
      remove: 'Remove',
      removeConfirm: 'Remove this item?',
      openLink: 'Open link',
      link: 'Link',
      sectionEmpty: 'Nothing here yet.',
      sections: {
        photos: 'Photos',
        videos: 'Videos',
        floorplans: 'Floor plans',
        virtualTours: 'Virtual tours',
      },
      dropzone: {
        title: 'Drop files here, or click to choose',
        hint: 'Up to {size} MB per file.',
      },
      lightbox: {
        title: 'Media viewer',
        open: 'Open preview',
        previous: 'Previous',
        next: 'Next',
        unavailable: 'This item cannot be previewed here.',
      },
      errors: {
        load: 'Could not load media',
        upload: 'Upload failed',
        badType: 'Only JPEG, PNG and WebP images can be uploaded',
        tooLarge: 'That file is larger than {size} MB',
        remove: 'Could not remove this item',
        link: 'Enter a valid https link',
        storage: 'File uploads are not configured',
      },
    },
    mandates: {
      title: 'Mandates',
      subtitle: 'The authority to sell, and when it runs out.',
      new: 'New mandate',
      edit: 'Edit mandate',
      empty: 'No mandates here.',
      emptyForProperty: 'No mandate on this property yet.',
      queue: {
        expiring: 'Expiring soon',
        active: 'Active',
        expired: 'Expired',
        all: 'All',
      },
      queueHint: 'Mandates ending within {days} days: call the vendor to renew, or let them lapse.',
      type: {
        simple: 'Simple',
        exclusive: 'Exclusive',
        semi_exclusive: 'Semi-exclusive',
      },
      status: {
        draft: 'Draft',
        active: 'Active',
        expired: 'Expired',
        terminated: 'Terminated',
        completed: 'Completed',
      },
      fee: {
        percent: 'Percentage',
        fixed: 'Fixed fee',
      },
      payer: {
        vendor: 'Vendor',
        buyer: 'Buyer',
        shared: 'Shared',
      },
      form: {
        property: 'Property',
        vendor: 'Vendor',
        reference: 'Reference',
        referencePlaceholder: 'Generated if left empty',
        type: 'Mandate type',
        status: 'Status',
        startDate: 'Start date',
        endDate: 'End date',
        renewalTerms: 'Renewal terms',
        askingPrice: 'Agreed asking price',
        netToVendor: 'Net to vendor',
        feeType: 'Fee type',
        commission: 'Commission (%)',
        feeFixed: 'Fixed fee',
        feePayer: 'Fee paid by',
        owner: 'Listing agent',
        notes: 'Notes',
        signedAt: 'Signed on',
        create: 'Create mandate',
        save: 'Save changes',
        propertyRequired: 'Pick a property',
        vendorRequired: 'Pick the vendor',
      },
      expiresIn: 'Ends in {days} days',
      endsToday: 'Ends today',
      expiredAgo: 'Expired {days} days ago',
      noEnd: 'No end date',
      renew: 'Renew',
      renewTitle: 'Renew mandate',
      renewUntil: 'New end date',
      terminate: 'Terminate',
      terminateTitle: 'Terminate mandate',
      terminateReason: 'Reason',
      markExpired: 'Mark expired and de-list',
      activate: 'Activate',
      delete: 'Delete mandate',
      deleteConfirm: 'Delete mandate {reference}?',
      price: {
        title: 'Price history',
        reduce: 'Record a price change',
        newPrice: 'New asking price',
        reason: 'Reason',
        empty: 'No price changes yet.',
        drop: 'Reduced by {percent}%',
        rise: 'Raised by {percent}%',
        save: 'Save price change',
      },
      errors: {
        load: 'Could not load mandates',
        save: 'Could not save the mandate',
        delete: 'Could not delete the mandate',
        dates: 'The end date must be after the start date',
        activeExists: 'This property already has an active mandate',
      },
      reportEvery: 'Send the vendor a report every (days)',
      reportNone: 'No scheduled report',
      vendorLink: 'Vendor report link',
      vendorLinkCopied: 'Link copied',
      previewReport: 'Preview the report',
    },
    interests: {
      title: 'Buyer interests',
      new: 'Add a buyer',
      empty: 'No buyer is attached to this property yet.',
      emptyForLead: 'This contact is not attached to any property yet.',
      attachProperty: 'Attach to a property',
      status: {
        active: 'Active',
        won: 'Won',
        lost: 'Lost',
        on_hold: 'On hold',
      },
      source: {
        manual: 'Added by hand',
        enquiry: 'Website enquiry',
        portal: 'Portal',
        match: 'New-listing match',
        walk_in: 'Walk-in',
        referral: 'Referral',
      },
      form: {
        buyer: 'Buyer',
        buyerPlaceholder: 'Search a contact…',
        property: 'Property',
        stage: 'Stage',
        owner: 'Selling agent',
        source: 'Source',
        notes: 'Notes',
        create: 'Add interest',
        save: 'Save changes',
        buyerRequired: 'Pick a buyer',
        propertyRequired: 'Pick a property',
      },
      markWon: 'Mark won',
      markLost: 'Mark lost',
      reopen: 'Reopen',
      lostReason: 'Why was it lost?',
      remove: 'Remove',
      removeConfirm: 'Remove this buyer from the property?',
      errors: {
        load: 'Could not load interests',
        save: 'Could not save the interest',
        delete: 'Could not remove the interest',
        duplicate: 'This buyer is already attached to this property',
        noPipeline: 'There is no buyer board in this workspace',
      },
    },
    offers: {
      title: 'Offers',
      subtitle: 'Buyer offers, and the competition between them.',
      new: 'Record an offer',
      empty: 'No offers here.',
      emptyForProperty: 'No offers on this property yet.',
      status: {
        pending: 'Pending',
        accepted: 'Accepted',
        rejected: 'Rejected',
        withdrawn: 'Withdrawn',
        expired: 'Expired',
      },
      form: {
        buyer: 'Buyer',
        amount: 'Offer amount',
        expiresAt: 'Valid until',
        deposit: 'Deposit',
        financing: 'Financing',
        financingNone: 'Not specified',
        conditions: 'Conditions',
        addCondition: 'Add a condition',
        conditionNote: 'Details',
        create: 'Record offer',
        amountRequired: 'Enter the offer amount',
        buyerRequired: 'Pick a buyer attached to this property',
      },
      financing: {
        cash: 'Cash',
        mortgage: 'Mortgage',
        mixed: 'Mixed',
      },
      condition: {
        finance: 'Finance',
        survey: 'Survey',
        chain: 'Chain',
        other: 'Other',
      },
      competing: '{count} competing offers',
      highest: 'Highest',
      accept: {
        action: 'Accept',
        title: 'Accept this offer?',
        body: 'The property will be marked under offer and the buyer moved on.',
        competing: 'These {count} competing offers will be rejected at the same time:',
        confirm: 'Accept offer',
      },
      reject: {
        action: 'Reject',
        title: 'Reject this offer?',
        confirm: 'Reject offer',
      },
      withdraw: {
        action: 'Withdraw',
        title: 'Withdraw this offer?',
        body: 'If this offer had been accepted, the property goes back on the market.',
        confirm: 'Withdraw offer',
      },
      decisionReason: {
        another_offer_accepted: 'Another offer was accepted',
        declined: 'Declined',
        withdrawn: 'Withdrawn by the buyer',
      },
      share: {
        action: 'Vendor link',
        copied: 'Link copied',
        rotate: 'Create a new link',
        hint: 'The vendor can accept or decline from this link, no account needed.',
      },
      validUntil: 'Valid until {date}',
      vendor: {
        title: 'Offer on {property}',
        intro: 'An offer has been made on your property.',
        amount: 'Offer',
        conditions: 'Conditions',
        noConditions: 'No conditions',
        accept: 'Accept this offer',
        decline: 'Decline',
        acceptedMsg: 'You accepted this offer. Your agent will be in touch.',
        declinedMsg: 'You declined this offer.',
        closedMsg: 'This offer has already been decided.',
        invalid: 'This link is no longer valid',
        failed: 'Something went wrong. Please try again.',
      },
      errors: {
        load: 'Could not load offers',
        save: 'Could not save the offer',
        decide: 'Could not update the offer',
        decided: 'This offer has already been decided',
        unavailable: 'This property is no longer available',
      },
    },
    viewings: {
      title: 'Viewings',
      subtitle: 'Visits, and what buyers made of them.',
      new: 'Book a viewing',
      empty: 'No viewings here.',
      emptyForProperty: 'No viewings on this property yet.',
      upcoming: 'Upcoming',
      past: 'Past',
      needsFeedback: 'Feedback needed',
      schedule: {
        title: 'Book a viewing',
        property: 'Property',
        buyer: 'Buyer',
        buyerNone: 'No buyer yet',
        start: 'Date and time',
        duration: 'Duration (minutes)',
        notes: 'Notes',
        submit: 'Book viewing',
        titleFor: 'Viewing: {property}',
        propertyRequired: 'Pick a property',
        startRequired: 'Pick a date and time',
      },
      status: {
        scheduled: 'Scheduled',
        in_progress: 'In progress',
        completed: 'Completed',
        cancelled: 'Cancelled',
        no_show: 'No show',
      },
      feedback: {
        title: 'Viewing feedback',
        add: 'Record feedback',
        edit: 'Edit feedback',
        attended: 'The buyer attended',
        interestLevel: 'Interest level',
        dimensions: {
          price: 'Price',
          condition: 'Condition',
          location: 'Location',
          layout: 'Layout',
        },
        verdict: {
          negative: 'Negative',
          neutral: 'Neutral',
          positive: 'Positive',
        },
        verdictNone: 'No view',
        comments: 'Comments',
        save: 'Save feedback',
        recorded: 'Feedback recorded',
        summary: 'Interest {level}/5',
        none: 'No feedback yet',
      },
      errors: {
        load: 'Could not load viewings',
        save: 'Could not book the viewing',
        feedback: 'Could not save the feedback',
      },
    },
    activity: {
      title: 'Activity',
      empty: 'Nothing has happened yet.',
      propertyCreated: '{title} was added',
      propertyUpdated: '{title} was updated',
      propertyStatus: '{title} moved from {from} to {to}',
      propertyStage: '{title} moved from "{from}" to "{to}"',
      interestCreated: '{buyer} is now interested in {property}',
      interestStage: '{buyer} moved from "{from}" to "{to}" on {property}',
      interestStatus: '{buyer}: {property} is now {status}',
      mandateCreated: 'Mandate {reference} created for {property}',
      mandateStatus: 'Mandate {reference} is now {status}',
      mandateRenewed: 'Mandate {reference} renewed until {date}',
      priceChanged: 'Price of {property} changed from {from} to {to}',
      offerMade: '{buyer} offered {amount} on {property}',
      offerAccepted: 'Offer of {amount} by {buyer} accepted on {property}',
      offerRejected: 'Offer of {amount} by {buyer} rejected on {property}',
      offerWithdrawn: 'Offer of {amount} by {buyer} withdrawn on {property}',
      viewingBooked: 'Viewing booked: {property}',
      viewingFeedback: 'Feedback on {property}: interest {level}/5',
    },
    pipelines: {
      subject: 'This board holds',
      subjectHint: 'Decides what a card on this board is.',
      subjectLocked: 'The subject cannot change once the board has cards.',
      interestEmpty: 'No buyer interests yet. Attach a buyer to a property to see it here.',
      propertyEmpty: 'No properties here.',
      dropHere: 'Drop cards here',
      moveFailed: 'Could not move the card',
    },
    briefs: {
      title: 'Search briefs',
      subtitle: 'What this buyer is looking for. New listings are checked against it.',
      new: 'New search brief',
      edit: 'Edit search brief',
      empty: 'No search brief yet. Record what this buyer wants and new listings will find them.',
      matchedNow: '{count} properties already on the market fit this brief.',
      form: {
        name: 'Name',
        namePlaceholder: 'e.g. Family home in Cascais',
        priceMin: 'Minimum price',
        priceMax: 'Maximum price',
        surfaceMin: 'Minimum surface (m²)',
        bedroomsMin: 'Minimum bedrooms',
        roomsMin: 'Minimum rooms',
        types: 'Property types',
        cities: 'Cities',
        districts: 'Districts',
        listHint: 'Separate with commas. Leave empty for any.',
        mustHave: 'Must have',
        parking: 'Parking',
        elevator: 'Elevator',
        garden: 'Garden',
        terrace: 'Terrace',
        balcony: 'Balcony',
        notify: 'Email this buyer about matches',
        active: 'Active',
        notes: 'Notes',
        create: 'Save brief',
        save: 'Save changes',
        nameRequired: 'Give the brief a name',
      },
      delete: 'Delete brief',
      deleteConfirm: 'Delete "{name}"? Its matches are deleted with it.',
      insights: {
        title: 'What their viewings say',
        none: 'No viewing feedback yet.',
        viewings: '{count} viewings with feedback',
        averageInterest: 'Average interest {level}/5',
        suggestion: 'They called the price too high on a property at {price}. Consider a ceiling below that.',
        apply: 'Set maximum to {price}',
      },
      errors: {
        load: 'Could not load search briefs',
        save: 'Could not save the search brief',
        delete: 'Could not delete the search brief',
      },
    },
    matches: {
      title: 'Matching buyers',
      subtitle: 'Buyers whose search brief fits this property.',
      empty: 'No buyer matches yet.',
      score: '{score}% fit',
      status: {
        new: 'New',
        notified: 'Buyer told',
        dismissed: 'Dismissed',
        interested: 'Interested',
        converted: 'Attached',
      },
      reasons: {
        price_fit: 'Price',
        location: 'Location',
        type: 'Type',
        size: 'Size',
        must_haves: 'Must-haves',
      },
      actions: {
        createInterest: 'Attach as buyer',
        dismiss: 'Dismiss',
      },
      viaBrief: 'Brief: {name}',
      errors: {
        load: 'Could not load matches',
        update: 'Could not update the match',
      },
    },
    vendorReport: {
      invalid: 'This link is no longer valid',
      failed: 'This report could not be loaded',
      updated: 'Updated {date}',
      askingPrice: 'Asking price',
      daysOnMarket: 'Days on the market',
      enquiries: 'Enquiries',
      viewings: 'Viewings',
      offers: 'Offers',
      noOffers: 'No offers yet.',
      offersSummary: '{count} offers received, the highest {highest}.',
      feedback: 'What viewers said',
      noFeedback: 'No feedback has been recorded yet.',
      feedbackIntro: 'From {count} viewings',
      averageInterest: 'average interest {level}/5',
      pricePosition: 'Where your price sits',
      pricePositionBody: 'Per square metre, your property is priced above {percentile}% of the {count} comparable properties we are selling.',
    },
    automations: {
      triggerType: 'Start when',
      stageChanged: 'A card enters a stage',
      created: 'Something is created',
      mandateExpiring: 'A mandate is about to expire',
      withinDays: 'Days before the end date',
      createdHint: 'Starts when a contact, interest or property is created on the chosen board.',
      expiringHint: 'Starts once for each mandate that is within this many days of its end date.',
      anyBoard: 'Any board of this kind',
    },
    intake: {
      button: 'Log an enquiry',
      title: 'Log an enquiry',
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email',
      phone: 'Phone',
      message: 'What they asked',
      property: 'Property they asked about',
      submit: 'Record enquiry',
      created: 'Enquiry recorded as a new contact.',
      existing: 'Enquiry added to the existing contact.',
      suppressed: 'This address has unsubscribed, so no automated emails will be sent to it.',
      contact: 'Contact',
      contactSearchPlaceholder: 'Search an existing contact…',
      orNewContact: 'Or enter someone new',
      contactRequired: 'An email address or a phone number is required',
      errors: {
        save: 'Could not record the enquiry',
      },
    },
    listing: {
      invalid: 'This listing is no longer available.',
      gallery: 'Photo gallery',
      enquiryTitle: 'Ask about this property',
      sent: 'Thank you. The agency has your message and will be in touch shortly.',
      failed: 'We could not send your message. Please try again.',
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email',
      phone: 'Phone',
      message: 'Your message',
      send: 'Send enquiry',
    },
    commissions: {
      title: 'Commissions',
      subtitle: 'What the agency earns on sales, and each member\'s share.',
      mine: 'Only my shares',
      empty: 'No commissions here yet. One is recorded when an offer is accepted.',
      basis: 'Sale price',
      markPaid: 'Mark as paid',
      markPaidConfirm: 'Mark this commission as paid? This cannot be undone.',
      tabs: {
        forecast: 'Forecast',
        accrued: 'Accrued',
        realized: 'Earned',
        paid: 'Paid',
      },
      status: {
        accrued: 'Accrued',
        realized: 'Earned',
        paid: 'Paid',
        cancelled: 'Cancelled',
      },
      earnings: {
        title: 'Earnings',
        accrued: 'Accrued (offer accepted)',
        realized: 'Earned (sale closed)',
        paid: 'Paid out',
      },
      forecast: {
        hint: 'A planning figure: the fee on each active listing at its asking price, weighted by how far it has progressed. Nothing here is owed yet.',
        potential: 'If everything sells',
        weighted: 'Weighted forecast',
        empty: 'No active mandates on the market to forecast.',
        listings: '{count} listings',
      },
      roles: {
        listing_agent: 'Listing agent',
        selling_agent: 'Selling agent',
        introducer: 'Introducer',
        agency: 'Agency',
        manager: 'Manager',
      },
      shares: {
        title: 'Commission shares',
        role: 'Role',
        member: 'Member',
        percent: 'Share (%)',
        add: 'Add a share',
        total: 'Total: {total}%',
        over: 'The shares add up to {total}%, which is more than 100%.',
        save: 'Save shares',
        edit: 'Edit shares',
        agency: 'Agency',
      },
      errors: {
        load: 'Could not load commissions.',
        save: 'Could not save this change.',
      },
    },
  },
  // </realEstate:value>
  // <developerGuide:value>
  developerGuide: {
    howItWorks: 'How this page works',
    showGuide: 'Show how this page works',
    hideGuide: 'Hide',
    nav: {
      groupOverview: 'Overview',
      groupSetup: '1 · Set up projects',
      groupSell: '2 · Sell',
      groupAfterSale: '3 · After the sale',
      groupPerformance: '4 · Performance',
      groupTools: 'Tools',
      toggleGroup: 'Show or hide this section',
    },
    desc: {
      home: 'Your summary: sales, money in and what needs attention today.',
      alerts: 'Automatic warnings when a buyer is waiting or a project is off track.',
      projects: 'Your developments: create a project, set targets, add photos and plans.',
      inventory: 'Every unit across your projects, with status and price.',
      templates: 'The wording of reservation forms, contracts and payment reminders.',
      buyers: 'Your buyer pipeline, from first enquiry to signed contract.',
      siteVisits: 'Book visits to a project and record how they went.',
      followUps: 'Your to-do list of calls and messages, by due date.',
      collections: 'Calls for funds sent to buyers, and what is still unpaid.',
      modifications: 'Changes buyers ask for on their unit: review and approve them.',
      commissions: 'What each salesperson earns on the sales they closed.',
      team: 'What each salesperson did over the period.',
      reports: 'Sales, marketing, stock and money figures, exportable to CSV.',
      pages: 'Notes and documents for your team.',
      kanban: 'A simple task board for internal work.',
      chat: 'Message your team.',
      meetings: 'Schedule meetings and keep their notes.',
      emailMarketing: 'Send newsletters and launch announcements to buyers.',
      quotes: 'Prepare quotes for services you sell.',
      invoices: 'Create and track invoices.',
      properties: 'Your listings and the owners you are courting.',
      viewings: 'Visits to your listings, and what buyers made of them.',
      mandates: 'Your authority to sell each property, and when it runs out.',
      offers: 'Offers from buyers, and how they compare.',
      services: 'The services and fees you sell.',
    },
    pages: {
      dashboard: {
        subtitle: 'How your sales and projects are doing, at a glance.',
        step1: 'Choose the period at the top: month, quarter or year.',
        step2: 'Check the figures: units sold, revenue and money collected against your targets.',
        step3: 'Open a project from Projects to see its own figures in detail.',
      },
      buyers: {
        subtitle: 'Everyone interested in buying, and where each one is in the sale.',
        step1: 'Add a buyer with "Add lead", or import a list. New enquiries from your website arrive here too.',
        step2: 'Open a buyer to record their budget, the project they want and every call or email.',
        step3: 'Update their stage as they progress, from first contact to reservation and contract. Switch between List and Kanban at the top.',
      },
      projects: {
        step1: 'Create a project with "New project": its name, address and delivery date.',
        step2: 'Open it to add units, photos, plans and construction milestones.',
        step3: 'Set sales targets so the dashboard can tell you if you are on track.',
      },
      project: {
        step1: 'Add the units for sale, or edit their price and status.',
        step2: 'Reserve a unit for a buyer, then generate the reservation and contract from your templates.',
        step3: 'Certify each construction milestone to send the matching call for funds to buyers.',
      },
      inventory: {
        step1: 'See every unit in one place, across all your projects.',
        step2: 'Filter by project, status or type to find what is still available.',
        step3: 'Switch to the building view to see units floor by floor, and click one to edit it.',
      },
      templates: {
        step1: 'Pick a document: reservation form, sale contract or payment reminder.',
        step2: 'Edit its wording. Details in double braces, such as the buyer\'s name or the unit price, are filled in for each sale.',
        step3: 'Save. Every new document generated from a project uses the latest version.',
      },
      siteVisits: {
        step1: 'Book a visit for a buyer on a project, with a date and a salesperson.',
        step2: 'After the visit, record the outcome: interested, needs follow-up, reserved a unit, or not interested.',
        step3: 'Interested buyers automatically get a follow-up task for the next day, so nobody is forgotten.',
      },
      followUps: {
        step1: 'Your calls, emails and reminders, grouped by due date: overdue, today and later.',
        step2: 'Add a task from here or from a buyer\'s page.',
        step3: 'Tick a task when it is done. Overdue tasks also show on the dashboard.',
      },
      collections: {
        step1: 'Calls for funds are created when you certify a construction milestone on a project.',
        step2: 'Track each call: sent, due, overdue or paid. The ageing chart shows how late payments are.',
        step3: 'Mark a call as paid when the money arrives.',
      },
      modifications: {
        step1: 'Buyers ask for changes to their unit (layout, finishes) from their buyer portal or through you.',
        step2: 'Open a request to review it and give it a price.',
        step3: 'Once the buyer signs it, mark it as accepted: the price is added to the unit\'s total.',
      },
      commissions: {
        step1: 'A commission is created for each unit sold.',
        step2: "Follow each commission through the tabs: accrued when the contract is signed, earned at the notarial deed, then paid.",
        step3: 'Open a commission to see how it is shared between salespeople.',
      },
      team: {
        step1: 'Choose a period and compare your salespeople.',
        step2: 'See leads received, calls, visits and sales for each person.',
        step3: 'Use the funnel to tell too few leads apart from too little follow-up.',
      },
      reports: {
        step1: 'Choose a period and a project, or all projects.',
        step2: 'Read the tables: sales, marketing spend per lead, stock and money collected.',
        step3: 'Export any table to CSV to share it or open it in a spreadsheet.',
      },
      properties: {
        step1: "Add a property with \"New property\": its address, type, price and the owner selling it.",
        step2: "A property moves from prospect to valuation, then to a signed mandate and on to the market. The owner board shows that progress column by column.",
        step3: "Open a property to see everything attached to it: its mandate, the buyers interested, the viewings booked and the offers received.",
      },
      viewings: {
        step1: "Book a viewing with \"Book a viewing\": the property, the buyer, the date and how long it will take.",
        step2: "The three tabs are upcoming visits, past ones, and the ones still waiting for feedback.",
        step3: "Record what the buyer thought afterwards. That feedback reaches the property and the owner, and is what you report back to the vendor.",
      },
      mandates: {
        step1: "A mandate is your authority to sell one property: record it with \"New mandate\", with its type, its fee and the date it runs out.",
        step2: "Simple, semi-exclusive or exclusive decides whether another agency, or the owner, may sell it too.",
        step3: "The tabs put what is expiring first. Renew before the end date, or the listing comes off the market.",
      },
      offers: {
        step1: "Record an offer with \"Record an offer\": the buyer, the amount, the deposit, how they are financing it and until when it stands.",
        step2: "Conditions — finance, survey, a chain — are part of the offer. The highest price is not always the safest one.",
        step3: "Accepting one puts the property under offer and rejects the others, so take it to the vendor before you accept.",
      },
      alerts: {
        step1: 'Each card is one rule, such as "a new lead has had no answer for 30 minutes".',
        step2: 'Switch a rule on or off, and adjust its delay or threshold.',
        step3: "Alerts go to the buyer's salesperson and to the admins. Only owners and admins can change the rules.",
      },
    },
    start: {
      title: 'Get started in four steps',
      body: 'Follow the sidebar from top to bottom: set up a project, then sell it.',
      step1: 'Create your first project',
      step1Body: 'Name, address and delivery date.',
      step2: 'Add its units',
      step2Body: 'Type, floor, surface and price for each unit.',
      step3: 'Check your document templates',
      step3Body: 'Reservation and contract wording.',
      step4: 'Add your buyers',
      step4Body: 'Enter them by hand or import a list.',
    },
  },
  // </developerGuide:value>
  settingsOffer: {
    heading: "Your offer",
    permanent: "Chosen when you signed up. It sets your dashboard and menus, and cannot be changed.",
  },
  leadStatusSync: {
    followsStage: "Follows the stage",
  },
  signupLanguage: {
    label: "Language",
    hint: "The app, and the emails and notifications we send you, will be in this language. You can change it later.",
  },
  notificationBodies: {
    noResponse: "A new buyer arrived over {minutes} minutes ago and nobody has logged a call, a visit or a follow-up.",
    noFollowUp: "Nothing has been booked with this buyer for {days} days, so a follow-up was added for you.",
    forBuyer: "For {buyer}.",
    unit: "Unit {unit}",
    behindTarget: "{sold} of {target} units sold; the plan expected about {expected} by now.",
    lowStock: "Only {available} of {total} units are still available.",
    cancellations: "{cancelled} of {deals} deals in the last {days} days were cancelled.",
  },
  notificationEmailNote: {
    quote_accepted: "You can turn an accepted quote into an invoice from the quote itself.",
    quote_expired: "Need to keep it on the table? Duplicate it and send a fresh one with a new expiry date.",
    invoice_overdue: "Resending the invoice from its page emails the client the same document with its payment link.",
    offer_received: "Compare it with any competing offers before you take it to the vendor.",
    offer_accepted: "The property is now under offer and competing offers were rejected.",
    mandate_expiring: "Call the vendor to renew, or let it lapse and the listing comes off the market.",
    property_matched: "Buyers with a matching search brief are waiting to hear about it.",
    document_accepted: "The accepted copy, with the acceptance record, is on the buyer's file.",
    call_overdue: "The buyer has been sent an automatic reminder.",
    lead_no_response: "New buyers are most likely to be won by whoever answers first.",
    lead_no_followup: "A follow-up has been added for you so this buyer does not go quiet.",
    project_behind_target: "Sales are behind a straight line from launch to delivery. You can change this alert under Alerts.",
    low_inventory: "You can change this alert under Alerts.",
    high_cancellations: "You can change this alert under Alerts.",
    meetings_booked: "It is on your BorsFlow calendar.",
    meetings_rescheduled: "Your BorsFlow calendar already shows the new time.",
    meetings_cancelled: "Nothing to do — it is off your calendar.",
  },
  notificationEmailAction: {
    openWorkspace: "Open workspace",
    readAndReply: "Read and reply",
    openChat: "Open chat",
    openQuote: "Open quote",
    openInvoice: "Open invoice",
    openOffer: "Open offer",
    openMandate: "Open mandate",
    openProperty: "Open property",
    openMatches: "Open matches",
    openBuyer: "Open buyer",
    openCollections: "Open collections",
    openFollowUps: "Open follow-ups",
    openInventory: "Open inventory",
    openProjects: "Open projects",
    openReports: "Open reports",
    openMeetings: "Open meetings",
    openBoard: "Open board",
  },
  notificationEmailCategory: {
    team: "Team",
    sales: "Sales & billing",
    meetings: "Meetings",
    tasks: "Tasks",
  },
  notificationEmail: {
    greeting: "Hi {name},",
    greetingNoName: "Hi,",
    inWorkspace: "In {workspace}",
    footer: "Sent to {email} because {category} notifications are on for your BorsFlow account.",
    manage: "Change what you're emailed",
  },
  developerCommissions: {
    accrued: "Accrued (contract signed)",
    realized: "Earned (deed signed)",
    paid: "Paid out",
    empty: "No commissions yet. One is recorded when a unit's sales contract is signed, if its project has a commission rate.",
    company: "Company",
  },
  templateSample: {
    developer: "Acme Developments",
    buyerName: "Jordan Rivera",
    buyerPhone: "+1 555 0100",
    project: "Parkside Gardens",
    projectAddress: "12 Park Avenue, Springfield",
    unitType: "apartment",
    agent: "Sam Lee",
    milestone: "Foundations complete",
  },
  developerActivity: {
    taskCreated: "Follow-up added for {buyer}: {title}",
    taskCompleted: "Follow-up done for {buyer}: {title}",
    callFromAnswered: "Call from {buyer}: answered",
    callFromMissed: "Call from {buyer}: no answer",
    callToAnswered: "Call to {buyer}: answered",
    callToMissed: "Call to {buyer}: no answer",
    visitBooked: "Site visit booked: {project}",
    visitBookedUnit: "Site visit booked: {project} · {unit}",
    visitDone: "Site visit done at {project}: {outcome}",
    visitMissed: "{buyer} did not attend the site visit at {project}",
    documentSent: "{kind} {number} sent to {buyer}",
    documentAccepted: "{kind} {number} accepted by {name}",
  },
  notificationTitles: {
    notContacted: "{name} has not been contacted",
    unitReserved: "Unit {unit} reserved in {project}",
    unitUnderContract: "Unit {unit} under contract in {project}",
    overduePayment: "Overdue payment: unit {unit}",
    documentAccepted: "{number} accepted by {name}",
    followUpWith: "Follow up with {name}",
    cardDueSoon: "Due soon: \"{title}\"",
    taskOverdue: "Overdue: {task}",
    taskDueSoon: "Due soon: {task}",
    mandateEndsTomorrow: "Mandate {reference} on {property} ends tomorrow",
    mandateEnds: "Mandate {reference} on {property} ends in {days} days",
    buyerMatches: "1 buyer matches {property}",
    buyersMatch: "{count} buyers match {property}",
    viewingFeedback: "Viewing feedback on {property}",
    invoiceOverdue: "Invoice {number} for {client} is overdue",
    quoteExpired: "Quote {number} for {client} expired",
    invoiceViewed: "{client} viewed invoice {number}",
    quoteViewed: "{client} viewed quote {number}",
    quoteAccepted: "{client} accepted quote {number}",
    quoteRejected: "{client} rejected quote {number}",
    meetingStartingSoon: "Starting soon: {title}",
    meetingBooked: "Meeting booked: {title}",
    meetingRescheduled: "Meeting rescheduled: {title}",
    meetingCancelled: "Meeting cancelled: {title}",
    assigned: "You were assigned to \"{title}\"",
    mentionedInComment: "{name} mentioned you in a comment",
    repliedToComment: "{name} replied to your comment",
    mentionedInChannel: "{name} mentioned you in #{channel}",
    joined: "{name} joined {workspace}",
    behindTarget: "{project} is behind its sales target",
    lowStock: "{project} is running low on stock",
    highCancellations: "{project} has a high cancellation rate",
  },
  buyerPortal: {
    loading: "Opening your client space…",
    errors: {
      load: "Could not load your client space",
      sendCode: "Could not send the verification code",
      invalidCode: "Invalid code",
      submit: "Could not send your request",
      sign: "Could not sign the addendum",
    },
    restricted: {
      title: "Access restricted",
      expired: "This link is no longer valid or has expired.",
      help: "Check the link in the email from your developer, or contact your sales advisor.",
    },
    header: {
      clientSpace: "Client space",
      secure: "Financial space unlocked",
      lock: "Lock",
      unlock: "Unlock the financial space",
    },
    unitNumber: "Lot {number}",
    groundFloor: "Ground floor",
    floor: "Floor {floor}",
    hero: {
      welcome: "Welcome, {name}",
      handover: "Planned handover",
      progress: "Construction progress",
      percentDone: "{percent}% complete",
    },
    tabs: {
      journal: "Site journal",
      unit: "My unit",
      financial: "Calls for funds",
      tma: "Modifications",
      documents: "Documents",
    },
    journal: {
      title: "Construction timeline and site updates",
      subtitle: "Regular progress updates from the site team.",
      drone: "Aerial drone tour",
      recent: "Recent update",
      photo: "Site progress photo",
      emptyTitle: "New photos are on their way",
      emptyBody: "The site team will publish the next photos and drone flyover shortly.",
    },
    protections: {
      title: "Your legal protections",
      guarantee: "Completion guarantee",
      guaranteeHint: "Completion secured by a guarantor",
      architect: "Supervising architect",
      architectHint: "Certifies each construction stage",
      legal: "Legal framework",
    },
    unit: {
      title: "Unit details and annexes",
      subtitle: "Technical details for lot {number}.",
      typology: "Typology",
      area: "Living area",
      floor: "Floor",
      orientation: "Orientation",
      annexes: "Linked lots (parking, cellar)",
    },
    snags: {
      title: "Post-handover warranty and snags",
      subtitle: "Defects reported after handover and how their repair is going.",
      count: "{open} open / {total} total",
      general: "General",
      trade: "Trade:",
    },
    financial: {
      lockedTitle: "Protected financial information",
      lockedBody: "To see your calls for funds, receipts and bank letters, confirm your identity with a 6-digit code.",
      codeSentTo: "The code will be sent to:",
      sendCode: "Send a verification code",
      totalPrice: "Agreed price (incl. tax)",
      totalCalled: "Total called",
      totalPaid: "Total paid",
      remaining: "Remaining balance",
      title: "Calls for funds",
      subtitle: "Your payment schedule, following the certified construction stages.",
      print: "Print statement",
      cols: {
        number: "Notice",
        milestone: "Stage",
        tranche: "Share",
        amount: "Amount due",
        status: "Status",
        document: "Document",
      },
      viewReceipt: "View receipt",
      soon: "Available soon",
      empty: "No calls for funds issued yet.",
    },
    callStatus: {
      draft: "Draft",
      issued: "To pay",
      sent: "To pay",
      "sent_to_bank": "Sent to your bank",
      paid: "Paid",
      overdue: "Overdue",
    },
    tma: {
      lockedTitle: "Protected modifications",
      lockedBody: "Confirm your identity with an email code to see your modification requests, follow quotes and sign addenda.",
      title: "Modifications to your unit",
      subtitle: "Personalise finishes and layout with your developer.",
      request: "Request a modification",
      quoted: "Quote:",
      estimating: "Being estimated",
      readyToSign: "Quote ready for your signature",
      techNote: "Technical note: \"{note}\"",
      reviewSign: "Review and sign the addendum",
      signed: "Addendum signed electronically",
      empty: "No modification requests for this unit yet.",
    },
    unlockWithEmail: "Unlock with an email code",
    tmaStatus: {
      requested: "Requested",
      "feasibility_approved": "Feasible",
      "quote_sent": "Quote sent",
      accepted: "Accepted",
      rejected: "Declined",
      completed: "Done",
    },
    category: {
      finishes: "Finishes and paint",
      electrical: "Electrical and sockets",
      plumbing: "Plumbing and sanitary",
      masonry: "Partitions and layout",
      flooring: "Flooring and tiling",
      other: "Other",
    },
    documents: {
      title: "Your documents",
      body: "Confirm your identity with an email code to read and accept the documents your developer sent you.",
    },
    otp: {
      title: "Confirm your identity",
      requestTitle: "Receive a one-time code",
      requestBody: "We will send a 6-digit code to your address:",
      sending: "Sending…",
      send: "Send the code",
      enter: "Enter the 6-digit code sent to:",
      testCode: "Test code: {code}",
      resend: "Resend",
      verifying: "Checking…",
      verify: "Verify and unlock",
    },
    request: {
      title: "Request a modification",
      category: "Category",
      titleLabel: "What would you like? *",
      titlePlaceholder: "e.g. An extra socket on the kitchen island",
      details: "Details and location *",
      detailsPlaceholder: "Describe the change, the room and the dimensions…",
      reviewTitle: "Technical review",
      reviewBody: "Your request goes to the site manager and the supervising architect. Once it is confirmed feasible, a quote will appear here for your signature.",
      submitting: "Sending…",
      submit: "Send the request",
    },
    cancel: "Cancel",
    sign: {
      title: "Sign the modification addendum",
      subject: "Subject:",
      category: "Category:",
      techNote: "Technical note:",
      price: "Addendum price (incl. tax):",
      name: "Your full legal name (electronic signature) *",
      namePlaceholder: "First and last name",
      consent: "I accept this quote. I authorise the developer to carry out these works on lot {number} and to add this amount to my purchase contract.",
      signing: "Signing…",
      submit: "Accept and sign",
    },
  },
  crmDefaults: {
    pipelines: {
      contacts: "Contacts",
      buyerJourney: "Buyer journey",
      ownerMandate: "Owner / mandate",
      buyerSales: "Buyer sales",
    },
    stages: {
      new: "New",
      contacted: "Contacted",
      qualified: "Qualified",
      nurturing: "Nurturing",
      lost: "Lost",
      enquiry: "Enquiry",
      briefRecorded: "Brief recorded",
      viewingBooked: "Viewing booked",
      viewingDone: "Viewing done",
      offer: "Offer",
      underContract: "Under contract",
      closed: "Closed",
      prospect: "Prospect",
      valuationBooked: "Valuation booked",
      valuationDone: "Valuation done",
      mandateSigned: "Mandate signed",
      live: "Live",
      underOffer: "Under offer",
      sold: "Sold",
      siteVisit: "Site visit",
      negotiation: "Negotiation",
      reserved: "Reserved",
      won: "Won",
    },
  },
  developerProjectList: {
    searchPlaceholder: "Search by name, reference or city…",
    allStatuses: "All statuses",
    emptyTitle: "No projects yet",
    emptyBody: "Create your first development to add its units and start selling.",
    createFirst: "Create a project",
    soldReserved: "{percent}% sold or reserved",
    tbd: "To be set",
    buildings: "{count} building(s)",
    open: "Open project",
    created: "Project created.",
  },
  developerProjectDialogs: {
    saving: "Saving…",
    close: "Close",
    optTitle: "Put unit {unit} on hold",
    unitLine: "Unit {unit}",
    optHolder: "On hold for *",
    loadingBuyers: "Loading buyers…",
    optDuration: "Hold duration",
    h24: "24 hours",
    h48: "48 hours (usual)",
    h72: "72 hours (over a weekend)",
    d7: "7 days",
    optNote: "While the hold lasts, nobody else can reserve or sell this unit.",
    optSubmit: "Put on hold",
    optPickBuyer: "Choose who the unit is held for.",
    optFailed: "Could not put the unit on hold.",
    resTitle: "Reserve unit {unit}",
    resBuyer: "Buyer *",
    resWhatTitle: "What reserving does:",
    resWhat1: "The unit becomes Reserved.",
    resWhat2: "The deposit and the cooling-off period start.",
    resWhat3: "The unit is included in the next calls for funds.",
    resSubmit: "Confirm reservation",
    resSaving: "Reserving…",
    resPickBuyer: "Choose a buyer.",
    resFailed: "Could not reserve the unit.",
    certTitle: "Certify milestone: {title}",
    certTarget: "Cumulative target: {percent}%",
    certDoc: "Architect's certificate (reference or link)",
    certDocHint: "e.g. Attestation_Architecte_Fondations.pdf",
    certDocPlaceholder: "https://… or certificate number",
    certAutoTitle: "Send the calls for funds now",
    certAutoBody: "Creates the stage invoice for every buyer of this project and updates what each one still owes.",
    certSubmit: "Certify and send",
    certSaving: "Certifying…",
    certFailed: "Could not certify the milestone.",
    tmaNewTitle: "New modification request – unit {unit}",
    tmaBuyer: "Buyer: {name}",
    tmaHold: "On hold for: {name}",
    tmaNoBuyer: "No buyer yet",
    tmaCategory: "Type of work *",
    catElectrical: "Electrical (extra sockets, switches, EV charger)",
    catPlumbing: "Plumbing (extra water point, shower, sink)",
    catPartitions: "Partitions (moving a wall, sliding doors)",
    catFinishes: "Finishes (flooring, premium tiles)",
    catOther: "Other work",
    tmaSummary: "Request title *",
    tmaSummaryHint: "e.g. Add 2 sockets in the living room",
    tmaSummaryPlaceholder: "e.g. Move the kitchen water point",
    tmaDescription: "Details *",
    tmaDescriptionPlaceholder: "Measurements, position on the plan, materials…",
    tmaCost: "Estimated internal cost",
    tmaCostHint: "Subcontractor cost, before tax",
    tmaQuote: "Price for the buyer",
    tmaQuoteHint: "Billed to the buyer, incl. tax",
    tmaSubmit: "Create request",
    tmaFailed: "Could not create the request.",
    tmaRequired: "Enter a title and the details.",
    revTitle: "Review modification {ref}",
    revNote: "Technical review (site manager)",
    revNotePlaceholder: "Is it still possible at this stage? Structural impact, pipe routes…",
    revCost: "Contractor cost (before tax)",
    revQuote: "Price for the buyer (incl. tax)",
    revSigned: "Signed addendum (reference)",
    revSignedPlaceholder: "e.g. Avenant_TMA_Lot_A302.pdf",
    revApprove: "Approve and send quote",
    revAccept: "Mark addendum signed",
    revAcceptConfirm: "Mark this addendum as signed? Its price is added to the unit's total.",
    revFailed: "Could not update the request.",
    lotEditTitle: "Edit unit {unit}",
    lotNewTitle: "Add a unit",
    lotNumber: "Unit number *",
    lotNumberHint: "e.g. A201, P-12",
    building: "Building",
    noBuilding: "None",
    type: "Type",
    typeApartment: "Apartment",
    typeHouse: "House / villa",
    typeParking: "Parking space",
    typeBox: "Garage / box",
    typeCellar: "Cellar",
    typeCommercial: "Commercial space",
    typology: "Typology",
    typStudio: "Studio",
    typT1: "T1 / F1 (1 room)",
    typT2: "T2 / F2 (1 bedroom)",
    typT3: "T3 / F3 (2 bedrooms)",
    typT4: "T4 / F4 (3 bedrooms)",
    typT5: "T5 / F5 (4+ bedrooms)",
    typDuplex: "Duplex",
    floorLevel: "Floor",
    floorPlaceholder: "0 = ground floor",
    orientation: "Orientation",
    oriS: "South",
    oriSW: "South-west",
    oriSE: "South-east",
    oriW: "West",
    oriE: "East",
    oriN: "North",
    oriNW: "North-west",
    oriNE: "North-east",
    surface: "Living area (m²)",
    terrace: "Terrace (m²)",
    balcony: "Balcony (m²)",
    garden: "Garden (m²)",
    basePrice: "Price before tax *",
    vatRate: "VAT rate (%)",
    total: "Total incl. VAT",
    lotRequired: "Enter a unit number and a price.",
    lotDiscountRange: "The discount must be between zero and the price.",
    lotSubmitNew: "Create unit",
    lotSubmitEdit: "Save unit",
    lotFailed: "Could not save the unit.",
  },
  developerProjectPage: {
    notFound: "Project not found.",
    loadFailed: "Could not load the project.",
    back: "Back to projects",
    addUnit: "Add unit",
    deliveryTarget: "Delivery: {date}",
    guarantee: "Completion guarantee: {bank}",
    statTotal: "Total",
    statAvailable: "Available",
    statReserved: "Reserved",
    statSold: "Sold",
    tabOverview: "Overview",
    tabMedia: "Media",
    tabStacking: "Stacking plan",
    tabMilestones: "Milestones & calls for funds",
    tabTma: "Buyer modifications ({count})",
    tabTable: "All units",
    infoTitle: "Project information",
    fieldReference: "Reference",
    fieldName: "Name",
    fieldCommercialName: "Commercial name",
    fieldType: "Project type",
    fieldStatus: "Status",
    fieldDeveloper: "Developer",
    fieldArchitect: "Architect",
    fieldPermit: "Building permit",
    fieldGuarantee: "Completion guarantee",
    fieldNotary: "Notary",
    fieldAddress: "Address",
    fieldCompletion: "Completion date",
    fieldWebsite: "Project website",
    fieldMap: "Map location",
    fieldDescription: "Description",
    filterBuilding: "Building",
    allBuildings: "All buildings ({count} units)",
    legendHasTma: "Has a modification",
    noUnitsTitle: "No units here yet",
    noUnitsBody: "Use “Add unit” to add the units of this project.",
    unitsCount: "{count} unit(s)",
    activeTma: "Has an open modification request",
    floorGround: "Ground floor",
    floorBasement: "Basement {n}",
    floorN: "Floor {n}",
    milestonesTitle: "Construction milestones",
    milestonesBody: "Stages certified by the supervising architect. Certifying one sends the matching call for funds to every buyer.",
    stage: "Stage {n}",
    certified: "Certified {date}",
    certify: "Certify stage",
    callsTitle: "Calls for funds",
    callsBody: "Payment requests sent to buyers as construction progresses.",
    callsCount: "{count} calls",
    callsEmpty: "No calls for funds yet. Certify a construction milestone to send the first ones.",
    colCall: "Call",
    colUnit: "Unit",
    colDetails: "Details",
    colPrice: "Price",
    colBuyer: "Buyer",
    colMilestone: "Milestone",
    colTranche: "Share",
    colAmount: "Amount",
    colStatus: "Status",
    colInvoice: "Invoice",
    unassigned: "No buyer",
    viewInvoice: "View invoice",
    tmaTotal: "Modification requests",
    tmaPending: "Awaiting review or quote",
    tmaRevenue: "Signed modifications",
    tmaTitle: "Buyer modifications",
    tmaBody: "Layout and finish changes buyers ask for during construction. A signed addendum adds its price to the unit.",
    tmaEmpty: "No modification requests yet",
    tmaEmptyBody: "Open a sold unit in the stacking plan and choose “Request modification”.",
    colReference: "Reference",
    colCategory: "Category",
    colTitle: "Title",
    colCost: "Internal cost",
    colQuote: "Price quote",
    colActions: "Actions",
    review: "Review",
    tableTitle: "All units",
    tableCount: "{count} units",
    colBuilding: "Building",
    colType: "Type",
    colFloor: "Floor",
    colSurface: "Area",
    colPriceHt: "Price before tax",
    colPriceTtc: "Price incl. VAT",
    colBuyerHolder: "Buyer / on hold for",
    mainBuilding: "Main",
    floorShortGround: "GF",
    holdFor: "On hold: {name}",
    edit: "Edit",
    unitCard: "Unit",
    unitTitle: "Unit {number}",
    close: "Close",
    currentStatus: "Status",
    putOnHold: "Put on hold (48h)",
    reserve: "Reserve",
    releaseHold: "Release hold",
    confirmReserve: "Confirm reservation",
    reservedNote: "This unit is reserved. Future calls for funds apply to it.",
    portalTitle: "Buyer portal",
    portalBadge: "Code-protected",
    portalBody: "Buyers follow construction progress and photos here. Invoices, calls for funds and modification signatures are protected by a 6-digit code sent to the buyer.",
    registeredBuyer: "Buyer",
    optionHolder: "On hold for",
    noPurchaser: "No buyer yet. You can preview the link or send it to a prospect.",
    linkCopied: "Copied",
    copyLink: "Copy link",
    openPortal: "Open portal",
    saleDocs: "Sale & documents",
    specs: "Specifications",
    typology: "Typology",
    surface: "Living area",
    floor: "Floor",
    orientation: "Orientation",
    floorValue: "Floor {n}",
    pricing: "Price",
    priceHt: "Price before tax",
    vat: "VAT ({rate}%)",
    priceTtc: "Total incl. VAT",
    customizations: "Modifications",
    requestTma: "Request modification",
    noTmaOnLot: "No modification requests on this unit.",
    editUnit: "Edit unit",
    releaseConfirm: "Release this hold and make the unit available again?",
    releaseFailed: "Could not release the hold.",
    released: "Hold released. The unit is available again.",
    portalCopied: "Buyer portal link copied.",
    toastSaved: "Unit saved.",
    toastOnHold: "Unit put on hold.",
    toastReserved: "Unit reserved.",
    toastCertified: "Milestone certified. {count} call(s) for funds sent.",
    toastTmaCreated: "Modification request {ref} created.",
    toastTmaUpdated: "Modification request {ref} updated.",
    unitStatus: {
      available: "Available",
      optioned: "On hold",
      reserved: "Reserved",
      contract_signed: "Contract signed",
      deed_signed: "Deed signed",
      delivered: "Delivered",
    },
    tmaStatus: {
      requested: "Requested",
      feasibility_approved: "Feasible, awaiting quote",
      quote_sent: "Quote sent",
      accepted: "Addendum signed",
      rejected: "Rejected",
      completed: "Done on site",
    },
    callStatus: {
      draft: "Draft",
      issued: "Issued",
      sent_to_bank: "Sent to bank",
      paid: "Paid",
      overdue: "Overdue",
    },
    tmaCategory: {
      electrical: "Electrical",
      plumbing: "Plumbing",
      partitions: "Partitions",
      finishes: "Finishes",
      other: "Other",
    },
    programStatus: {
      study: "Study",
      commercialization: "On sale",
      construction: "Under construction",
      delivery: "Delivery",
      completed: "Completed",
    },
    projectType: {
      residential: "Residential",
      mixed_use: "Mixed use",
      commercial: "Commercial",
      subdivision: "Subdivision",
      renovation: "Renovation",
      other: "Other",
    },
  },
  developerAutoTasks: {
    reservationFollowUp: "Follow up on the reservation of {unit}",
    countersignedCopy: "Send the countersigned copy of {number}",
    followUpWith: "Follow up with {name}",
    callBack: "Call {name} back",
    visitFollowUp: "Follow up after the site visit ({name})",
    visitRebook: "Rebook the missed site visit ({name})",
  },
  crmList: {
    buyer: "Buyer",
    property: "Property",
    vendor: "Owner",
    stage: "Stage",
    status: "Status",
    price: "Price",
    updated: "Last activity",
    empty: "Nothing in this pipeline yet.",
  },
};

export default en;
