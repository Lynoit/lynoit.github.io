window.APP_CONFIG = {
  customerId: 'customer-id',
  customerName: 'Kundnamn',
  pageTitle: 'Kundnamn Anslagstavla',
  fullscreenButtonText: 'Helskärm',

  modules: {
    activities: true,
    weeklySchedule: true,
    calendar: true,
    phoneNote: false,
    qrCode: true,
    clock: true,
    footer: true
  },

  branding: {
    logo: 'customers/customer-id/logo.png',
    logoAlt: 'Kundnamn',
    woodBackground: 'assets/wood.jpg',
    corkBackground: 'assets/cork.jpg',
    footerLogo: 'assets/Lynoit_logo_plate_rusty_2.png',
    footerAlt: 'Lynoit Tech'
  },

  azure: {
    accountName: 'AZURE_ACCOUNT',
    containerName: 'activities',
    sasToken: 'PASTA_IN_SAS_TOKEN'
  },

  data: {
    membersFile: 'members.csv',
    calendarActivityName: 'Kalenderevent',
    hiddenActivities: ['Checka in']
  },

  activities: {
    title: 'Anslagstavla',
    featuredUser: 'Lerverkstan',
    maxItemsPerUser: 4,
    showColoredBands: false
  },

  weeklySchedule: {
    title: 'Veckoschema',
    blockedDays: []
  },

  calendar: {
    title: 'Detta händer:'
  },

  phoneNote: {
    title: 'Telefonnummer:',
    lines: []
  },

  qr: {
    title: 'Scanna för att starta',
    url: 'https://example.com/'
  },

  display: {
    pollIntervalMs: 15000,
    nightModeEnabled: true,
    nightStart: '22:30',
    nightEnd: '07:30',
    reloadEnabled: true,
    reloadTime: '06:00'
  }
};
