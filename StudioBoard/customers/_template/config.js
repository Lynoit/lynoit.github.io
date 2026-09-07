window.APP_CONFIG = {
  customerId: 'customer-id',
  customerName: 'Customer name',
  pageTitle: 'Customer Dashboard',
  fullscreenButtonText: 'Helskärm',
  modules: { activities:true, weeklySchedule:true, calendar:true, phoneNote:false, qrCode:true, clock:true, footer:true },
  branding: {
    logo: 'customers/customer-id/logo.png', logoAlt:'Customer',
    woodBackground:'assets/wood.jpg', corkBackground:'assets/cork.jpg',
    footerLogo:'assets/Lynoit_logo_plate_rusty_2.png', footerAlt:'Lynoit Tech'
  },
  azure: { accountName:'', containerName:'activities', sasToken:'' },
  data: { membersFile:'members.csv', activitiesFile:'activities.csv', calendarActivityName:'Kalenderevent', hiddenActivities:['Checka in'] },
  activities: { title:'Anslagstavla', featuredUser:'', maxItemsPerUser:4, showColoredBands:false },
  weeklySchedule: { title:'Veckoschema', blockedDays:[] },
  calendar: { title:'Detta händer:' },
  phoneNote: { title:'Telefonnummer:', lines:[] },
  qr: { title:'Scanna för att starta', url:'', appPath:'activity/' },
  display: { pollIntervalMs:15000, nightModeEnabled:true, nightStart:'22:30', nightEnd:'07:30', reloadEnabled:true, reloadTime:'06:00' },
  activityApp: {
    pageTitle:'Aktivitet', noteTitle:'Aktivitet', sourceName:'ActivityApp', fallbackColor:'blue', sessionTimeoutMs:3600000,
    restrictedActivities:{}, modules:{customActivity:true, photos:true, sessionTotal:true}
  },
  adminApp: {
    pageTitle:'Admin', title:'Admin', pollIntervalMs:5000, excludedUsers:[], hiddenActivities:[], exportFilePrefix:'aktivitet-och-narvaro',
    pricing:{ceramicPerKg:140, guestCeramicPerKg:160, adultGuest:400, childGuest:200},
    modules:{export:true,stats:true,chart:true,overview:true,billing:true,membersManager:true,activitiesManager:true}
  }
};
