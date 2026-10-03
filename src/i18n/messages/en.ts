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
      aiAssistantLabel: string;
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
  emailMarketing: {
    tabs: {
      campaigns: string;
      templates: string;
      segments: string;
      automations: string;
      analytics: string;
      providers: string;
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
      campaignTableHeading: string;
      colCampaign: string;
      colSent: string;
      colOpens: string;
      colClicks: string;
      colBounces: string;
      heading: string;
      subtitle: string;
      totalSent: string;
      delivered: string;
      uniqueOpens: string;
      totalClicks: string;
      openRate: string;
      opensFromSent: string;
      clickRate: string;
      clicksFromOpens: string;
      bounceRate: string;
      bouncesFromSent: string;
      chartHeading: string;
      chartPlaceholder: string;
      topCampaigns: string;
      noCampaigns: string;
      openRateValue: string;
      sentCount: string;
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
    templateModal: {
      saveFailed: string;
      tabDesign: string;
      tabHtml: string;
      tabPreview: string;
      editTitle: string;
      newTitle: string;
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
      previewReadOnly: string;
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
      linkDocuments: string;
      linkHowItWorks: string;
      linkAssistant: string;
      linkRolesTeam: string;
      linkQuotesInvoices: string;
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
      editorTitle: string;
      editorBody: string;
      editorAlt: string;
      financialsTitle: string;
      financialsBody: string;
      financialsAlt: string;
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
    invitedSubtitle: 'Accept an invitation below to join a workspace, or create your own.',
    emptyTitle: 'No workspace yet',
    emptySubtitle: 'Create a workspace to start organizing your documents, CRM, and billing in one place.',
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
      linkDocuments: 'Documents',
      linkHowItWorks: 'How it works',
      linkAssistant: 'AI assistant',
      linkRolesTeam: 'Roles & team',
      linkQuotesInvoices: 'Quotes & invoices',
      linkPricing: 'Pricing',
      tagline: 'The CRM, documents, scheduling and invoicing your team actually needs, in one workspace.',
      productHeading: 'Product',
      copyright: '© {year} BorsFlow. All rights reserved.',
      signIn: 'Sign in',
      createWorkspace: 'Create your workspace',
    },
    aiIntegration: {
      answerPages: 'Finds the exact page or doc you meant and reads it back to you.',
      answerLeads: 'Pulls up a lead, its stage and its full history on request.',
      answerTasks: 'Lists what is open, overdue or assigned to you across every board.',
      answerFinancials: 'Reports quote and invoice status, totals and what is outstanding.',
      answerMeetings: 'Tells you what is booked next and who is on the call.',
      answerProducts: 'Looks up products, prices and stock from your catalog.',
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
      heading: 'One workspace, every pipeline',
      lead: 'CRM, documents, scheduling and billing, built to share the same data instead of fighting over it.',
      crmTitle: 'CRM & pipeline',
      crmBody: 'Track leads from first contact to closed deal, with a kanban board your whole team can see and move.',
      emailTitle: 'Email & templates',
      emailBody: 'Send on-brand emails from reusable templates, and let AI draft the first pass for you.',
      meetingsTitle: 'Scheduling',
      meetingsBody: 'Book meetings, sync calendars and keep everyone looking at the same time slot.',
      catalogTitle: 'Products & catalog',
      catalogBody: 'Keep products, prices and stock in one place, ready to drop straight into a quote.',
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
      editorTitle: 'Documents that write themselves around your data',
      editorBody: 'Build pages and docs that pull live fields from your CRM and catalog, so they never fall out of sync with reality.',
      editorAlt: 'BorsFlow document editor showing a page built from live workspace data',
      financialsTitle: 'Quotes and invoices in the same place as the deal',
      financialsBody: 'Turn a quote into an invoice in one click, track what is paid and what is overdue, without leaving the workspace.',
      financialsAlt: 'BorsFlow invoices view showing quote-to-invoice conversion and payment status',
    },
    finalCta: {
      step1: 'Create your workspace',
      step2: 'Invite your team',
      step3: 'Import your contacts and products',
      step4: 'Send your first quote',
      heading: 'Run your whole business from one tab',
      lead: 'No credit card, no setup call. Create a workspace and see your first pipeline in minutes.',
      createWorkspace: 'Create your workspace',
      signIn: 'Sign in',
      noSalesCall: 'Free to start. No sales call required.',
    },
    journey: {
      stage1Title: 'Capture the lead',
      stage1Body: 'Bring a contact in from anywhere and drop it straight onto your pipeline board.',
      stage2Title: 'Work the deal',
      stage2Body: 'Move it through stages, log activity and keep every teammate looking at the same status.',
      stage3Title: 'Send the paperwork',
      stage3Body: 'Turn the deal into a quote, then an invoice, without re-typing a single line.',
      stage4Title: 'Get paid and keep going',
      stage4Body: 'Track payment status and roll straight into the next meeting or renewal.',
      heading: 'From first contact to paid invoice',
      lead: 'Four stages, one record. Nothing gets re-entered, and nothing falls through the cracks between tools.',
    },
    hero: {
      assuranceFree: 'Free to start',
      assuranceRoles: 'Role-based access for every teammate',
      assuranceData: 'Your data stays in your workspace',
      titleLine1: 'The business toolkit',
      titleLine2: 'your team won’t outgrow',
      lead: 'CRM, documents, scheduling and invoicing in one workspace, so your team stops copying data between five different tabs.',
      startFree: 'Start free',
      plateAlt: 'BorsFlow CRM pipeline board showing leads moving through stages',
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
      limitUnlimitedCrmContacts: 'Unlimited CRM contacts',
      limitCrmContacts: '{count} CRM contacts',
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
      lead: 'Start free. Upgrade when you need more seats, more AI credits, or more room to send.',
      betaStrong: 'Founding member pricing:',
      betaBody: 'lock in {percent}% off for as long as you stay subscribed, while we’re in beta.',
      billingPeriodAria: 'Billing period',
      footnote: 'Prices shown in USD. Cancel anytime. No setup fees, no hidden charges.',
    },
    support: {
      faq1q: 'Is there really a free plan?',
      faq1a: 'Yes. You can run a full pipeline, send invoices and invite teammates on the free plan with no credit card and no trial countdown.',
      faq2q: 'Can I import my existing contacts and products?',
      faq2a: 'Yes, you can bring in your contacts and product catalog from a CSV in a few clicks when you set up your workspace.',
      faq3q: 'How does the AI assistant access my data?',
      faq3a: 'It reads directly from your workspace, scoped to your permissions, and only answers with what you’re allowed to see.',
      faq4q: 'What happens if I go over my plan’s limits?',
      faq4a: 'We’ll let you know before you hit a hard limit, and you can upgrade in a click whenever you’re ready.',
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
      seam1: 'Contacts live in one tool, invoices in another, so every deal gets re-typed at least twice.',
      seam2: 'Nobody can say what a deal is actually worth without opening three different dashboards.',
      seam3: 'Each tool bills per seat, so adding one teammate means five new invoices.',
      seam4: 'Permissions are set per tool, so a leaver’s access has to be revoked five separate times.',
      join1: 'One record per lead, from first contact through to paid invoice.',
      join2: 'One dashboard shows pipeline, documents, meetings and revenue together.',
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
  emailMarketing: {
    tabs: {
      campaigns: 'Campaigns',
      templates: 'Templates',
      segments: 'Segments',
      automations: 'Automations',
      analytics: 'Analytics',
      providers: 'Providers',
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
      campaignTableHeading: 'Campaign performance',
      colCampaign: 'Campaign',
      colSent: 'Sent',
      colOpens: 'Opens',
      colClicks: 'Clicks',
      colBounces: 'Bounces',
      heading: 'Analytics',
      subtitle: 'See how your campaigns are performing across opens, clicks, and bounces.',
      totalSent: 'Total sent',
      delivered: 'Delivered',
      uniqueOpens: 'Unique opens',
      totalClicks: 'Total clicks',
      openRate: 'Open rate',
      opensFromSent: '{opens} of {sent} sent',
      clickRate: 'Click rate',
      clicksFromOpens: '{clicks} of {opens} opens',
      bounceRate: 'Bounce rate',
      bouncesFromSent: '{bounces} of {sent} sent',
      chartHeading: 'Performance over time',
      chartPlaceholder: 'Chart data will appear here once you have campaign activity.',
      topCampaigns: 'Top performing campaigns',
      noCampaigns: 'No campaign data yet',
      openRateValue: '{rate}% open rate',
      sentCount: '{count} sent',
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
      browseDivider: 'Browse starter templates',
      searchPlaceholder: 'Search starter templates...',
      browseSubtitle: 'Ready-made templates you can clone and customize for your campaigns.',
      noMatches: 'No templates match your search',
      industry: 'Industry',
      useCase: 'Use case',
      subject: 'Subject',
      imported: 'Imported',
      cloning: 'Cloning...',
      cloneTemplate: 'Clone template',
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
      criteriaRequired: 'At least one condition is required',
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
    templateModal: {
      saveFailed: 'Failed to save template',
      tabDesign: 'Design',
      tabHtml: 'HTML',
      tabPreview: 'Preview',
      editTitle: 'Edit template',
      newTitle: 'New template',
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
      previewReadOnly: 'This preview is read-only',
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
      tabHistory: 'Purchase history',
      personalInfoHeading: 'Personal information',
      firstNameLabel: 'First name',
      lastNameLabel: 'Last name',
      emailLabel: 'Email',
      phoneLabel: 'Phone',
      companyInfoHeading: 'Company information',
      companyLabel: 'Company',
      positionLabel: 'Position',
      pipelineInfoHeading: 'Pipeline',
      statusLabel: 'Status',
      stageLabel: 'Stage',
      noPipelineSelected: 'Select a pipeline first',
      selectStagePlaceholder: 'Select a stage',
      dealValueLabel: 'Deal value',
      sourceLabel: 'Source',
      sourcePlaceholder: 'e.g. Referral, website, trade show',
      tagsLabel: 'Tags',
      tagPlaceholder: 'Add a tag and press Enter',
      removeTagAria: 'Remove tag {tag}',
      leadListsLabel: 'Lead lists',
      aiAssistantLabel: 'AI assistant',
      summarizeLeadButton: 'Summarize lead',
      draftEmailButton: 'Draft follow-up email',
      leadSummaryHeading: 'Lead summary',
      emailDraftHeading: 'Email draft',
      copyToNotes: 'Copy to notes',
      notesLabel: 'Notes',
      notesPlaceholder: 'Add any notes about this lead…',
      notesCharCount: '{count}/2000 characters',
      updateButton: 'Save changes',
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
};

export default en;
