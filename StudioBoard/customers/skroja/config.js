window.APP_CONFIG = {
  customerId: 'skroja',
  customerName: 'Skröja',
  pageTitle: 'Skröja Anslagstavla',
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
    logo: 'customers/skroja/skroja-logo.png',
    logoAlt: 'Skröja Lerverkstad',
    woodBackground: 'assets/wood.jpg',
    corkBackground: 'assets/cork.jpg',
    footerLogo: 'assets/Lynoit_logo_plate_rusty_2.png',
    footerAlt: 'Lynoit Tech'
  },

  azure: {
    accountName: 'skroja',
    containerName: 'activities',
    sasToken: 'sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2028-01-01T18:27:36Z&st=2026-04-04T09:12:36Z&spr=https&sig=rjDd4VzH1nXMrw%2B6jUMUl3xALkh%2BD7D%2FJkgrcJtr4Zc%3D'
  },

  data: {
    membersFile: 'Skroja_members.csv',
    activitiesFile: 'Skroja_activities.csv',
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
      { day: 'Onsdag', label: 'Skröja', offsetY: -22, rotationDeg: -2.2 }
    ]
  },

  calendar: {
    title: 'Detta händer på Skröja:'
  },

  phoneNote: {
    title: 'Telefonnummer:',
    lines: [
      { label: 'Camilla', value: '0709-719091' },
      { label: 'Christina', value: '0723-201585' }
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
      kalenderevent: ['lerverkstan', 'camilla', 'cristina']
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
