window.APP_CONFIG = {
  customerId: 'demo',
  customerName: 'Demo',
  pageTitle: 'Demo Anslagstavla',
  fullscreenButtonText: 'Helskärm',

  modules: {
    activities: true,
    weeklySchedule: true,
    calendar: true,
    phoneNote: true,
    qrCode: true,
    clock: true,
    footer: true
  },

  branding: {
    logo: 'customers/demo/demo-logo.png',
    logoAlt: 'Demo Lerverkstad',
    woodBackground: 'assets/wood.jpg',
    corkBackground: 'assets/cork.jpg',
    footerLogo: 'assets/Lynoit_logo_plate_rusty_2.png',
    footerAlt: 'Lynoit Tech'
  },

  azure: {
    accountName: 'studioboard',
    containerName: 'studioboard',
    customerPath: 'demo',
    sasToken: 'sp=rcwdl&st=2026-09-07T14:30:45Z&se=2029-05-31T22:45:45Z&spr=https&sv=2026-02-06&sr=c&sig=FhQ5b0kRIqxE19ynQewfXhIUgq2CXrVOZ3PRu%2Bd3zDQ%3D'
  },

  data: {
    membersFile: 'members.csv',
    activitiesFile: 'activities.csv',
    calendarActivityName: 'Kalenderevent',
    hiddenActivities: [
      'Checka in',
      'Hämta ut keramik',
      'Medföljande gäst vuxen',
      'Medföljande gäst barn'
    ]
  },

  activities: {
    title: 'Anslagstavla',
    featuredUser: 'Lerverkstan',
    maxItemsPerUser: 4,
    showColoredBands: false
  },

  weeklySchedule: {
    title: 'Veckoschema',
    blockedDays: [
      { day: 'Onsdag', label: 'Demo', offsetY: -22, rotationDeg: -2.2 }
    ]
  },

  calendar: {
    title: 'Detta händer på Demo:'
  },

  phoneNote: {
    title: 'Telefonnummer:',
    lines: [
      { label: 'Ånke', value: '0709-719091' },
      { label: 'Kålle', value: '0723-201585' }
    ]
  },

  qr: {
    title: 'Scanna för att starta',
    url: '',
    appPath: 'activity/'
  },

  display: {
    pollIntervalMs: 15000,
    nightModeEnabled: true,
    nightStart: '22:30',
    nightEnd: '07:30',
    reloadEnabled: true,
    reloadTime: '06:00'
  },

  activityApp: {
    pageTitle: 'Skroja Aktivitet',
    noteTitle: 'Skroja Aktivitet',
    sourceName: 'SkrojaAktivitet',
    fallbackColor: 'blue',
    sessionTimeoutMs: 3600000,
    storageKeys: {
      sessionTotals: 'skrojaClaySessionTotals',
      lastActivity: 'skrojaClayLastActivity',
      lastMember: 'skrojaLastMember'
    },
    restrictedActivities: {
      kalenderevent: ['sophie', 'thomas']
    },
    modules: {
      customActivity: true,
      photos: true,
      sessionTotal: true
    }
  },

  adminApp: {
    pageTitle: 'Skroja Admin',
    title: 'Skroja Admin',
    pollIntervalMs: 5000,
    excludedUsers: ['Lerverkstan'],
    hiddenActivities: [],
    exportFilePrefix: 'aktivitet-och-narvaro',
    pricing: {
      ceramicPerKg: 140,
      guestCeramicPerKg: 160,
      adultGuest: 400,
      childGuest: 200
    },
    modules: {
      export: true,
      stats: true,
      chart: true,
      overview: true,
      billing: true,
      membersManager: true,
      activitiesManager: true
    }
  }
};
