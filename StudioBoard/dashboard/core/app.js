"use strict";

const config = window.APP_CONFIG || {};
const modules = config.modules || {};
const azureConfig = config.azure || {};
const dataConfig = config.data || {};
const activityConfig = config.activities || {};
const weeklyConfig = config.weeklySchedule || {};
const calendarConfig = config.calendar || {};
const displayConfig = config.display || {};
const brandingConfig = config.branding || {};
const phoneConfig = config.phoneNote || {};
const qrConfig = config.qr || {};

function moduleEnabled(name, defaultValue = true) {
  return modules[name] === undefined ? defaultValue : Boolean(modules[name]);
}

function parseClockMinutes(value, fallback) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return h * 60 + m;
}

function setModuleVisible(selector, visible) {
  const el = document.querySelector(selector);
  if (el) el.style.display = visible ? '' : 'none';
}

function applyCustomerConfig() {
  document.title = config.pageTitle || `${config.customerName || 'Dashboard'} Anslagstavla`;

  document.documentElement.classList.toggle(
    'hide-colored-bands',
    !Boolean(activityConfig.showColoredBands)
  );

  // Resolve all configured asset paths relative to index.html, not core/styles.css.
  // This is important on GitHub Pages where CSS url() paths otherwise resolve
  // relative to the stylesheet directory.
  const resolveAssetUrl = (path) => path ? new URL(path, window.SYSTEM_BASE_URL || document.baseURI).href : '';

  if (brandingConfig.woodBackground) {
    const woodUrl = resolveAssetUrl(brandingConfig.woodBackground);
    document.documentElement.style.setProperty('--wood-image', `url("${woodUrl}")`);
  }
  if (brandingConfig.corkBackground) {
    const corkUrl = resolveAssetUrl(brandingConfig.corkBackground);
    document.documentElement.style.setProperty('--cork-image', `url("${corkUrl}")`);
  }

  const logo = document.getElementById('customer-logo');
  if (logo) {
    logo.src = resolveAssetUrl(brandingConfig.logo);
    logo.alt = brandingConfig.logoAlt || config.customerName || '';
  }

  const footerLogo = document.getElementById('footer-logo');
  if (footerLogo) {
    footerLogo.src = resolveAssetUrl(brandingConfig.footerLogo);
    footerLogo.alt = brandingConfig.footerAlt || '';
  }

  const dashboardHeading = document.getElementById('dashboard-heading');
  if (dashboardHeading) dashboardHeading.textContent = activityConfig.title || 'Anslagstavla';

  const weeklyHeading = document.getElementById('weekly-schedule-heading');
  if (weeklyHeading) weeklyHeading.textContent = weeklyConfig.title || 'Veckoschema';

  const calendarHeading = document.getElementById('calendar-heading');
  if (calendarHeading) calendarHeading.textContent = calendarConfig.title || 'Kalender';

  const qrTitle = document.getElementById('qr-title');
  if (qrTitle) qrTitle.textContent = qrConfig.title || 'Scanna för att starta';

  const fullscreenButton = document.getElementById('fullscreen-btn');
  if (fullscreenButton) fullscreenButton.textContent = config.fullscreenButtonText || 'Helskärm';

  const phoneTitle = document.getElementById('phone-note-title');
  if (phoneTitle) phoneTitle.textContent = phoneConfig.title || '';
  const phoneRows = document.getElementById('phone-note-rows');
  if (phoneRows) {
    phoneRows.innerHTML = '';
    (phoneConfig.lines || []).forEach(line => {
      const row = document.createElement('div');
      row.className = 'kiosk-contact-row';
      const left = document.createElement('span');
      const right = document.createElement('span');
      if (typeof line === 'string') {
        left.textContent = line;
        right.textContent = '';
      } else {
        left.textContent = line.label || '';
        right.textContent = line.value || '';
      }
      row.append(left, right);
      phoneRows.appendChild(row);
    });
  }

  setModuleVisible('.dashboard-section', moduleEnabled('activities'));
  setModuleVisible('.weekly-schedule-section', moduleEnabled('weeklySchedule'));
  setModuleVisible('.calendar-section', moduleEnabled('calendar'));
  setModuleVisible('.kiosk-contact-note', moduleEnabled('phoneNote'));
  setModuleVisible('.qr-note', moduleEnabled('qrCode'));
  setModuleVisible('.kiosk-clock', moduleEnabled('clock'));
  setModuleVisible('.footer', moduleEnabled('footer'));
}

applyCustomerConfig();

/* =========================================================
 * Veckoschema från Skroja_members.csv
 * ========================================================= */
const weeklyScheduleGrid = document.getElementById('weekly-schedule-grid');
const membersCsvFileName = dataConfig.membersFile || 'Skroja_members.csv';

function normalizeText(value) {
  return String(value || '').trim();
}

function parseSemicolonCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(line => line.trim() !== '');

  if (!lines.length) return [];

  const headers = lines[0]
    .split(';')
    .map(header => normalizeText(header).toLowerCase());

  return lines.slice(1).map(line => {
    const values = line.split(';');
    const record = {};
    headers.forEach((header, index) => {
      record[header] = normalizeText(values[index]);
    });
    return record;
  });
}

function getScheduleDayIndex(dayName) {
  const normalized = normalizeText(dayName).toLowerCase();
  const dayMap = {
    'måndag': 0,
    'mandag': 0,
    'tisdag': 1,
    'onsdag': 2,
    'torsdag': 3,
    'fredag': 4,
    'lördag': 5,
    'lordag': 5,
    'söndag': 6,
    'sondag': 6
  };
  return dayMap[normalized];
}

function getScheduleTimeRow(timeName) {
  const normalized = normalizeText(timeName).toLowerCase();
  if (normalized === 'förmiddag' || normalized === 'formiddag') return 2;
  if (normalized === 'eftermiddag') return 3;
  return null;
}

function createWeeklyMemberTag(name) {
  const tag = document.createElement('span');
  tag.className = 'weekly-member';
  tag.textContent = name;
  return tag;
}

function renderWeeklySchedule(members) {
  if (!weeklyScheduleGrid || !moduleEnabled('weeklySchedule')) return;
  weeklyScheduleGrid.innerHTML = '';

  const dayLabels = ['Mån','Tis','Ons','Tor','Fre','Lör','Sön','Alltid'];
  dayLabels.forEach((label, index) => {
    const header = document.createElement('div');
    header.className = 'weekly-day-header';
    header.textContent = label;
    header.style.gridColumn = String(index + 2);
    header.style.gridRow = '1';
    weeklyScheduleGrid.appendChild(header);
  });

  const slots = new Map();

  for (let row = 2; row <= 3; row++) {
    for (let col = 1; col <= 7; col++) {
      const slot = document.createElement('div');
      slot.className = 'weekly-slot';
      slot.style.gridColumn = String(col + 1);
      slot.style.gridRow = String(row);
      weeklyScheduleGrid.appendChild(slot);
      slots.set(`${row}-${col}`, slot);
    }
  }

  const alwaysSlot = document.createElement('div');
  alwaysSlot.className = 'weekly-always-slot';
  weeklyScheduleGrid.appendChild(alwaysSlot);

  const blockedDayIndexes = new Set();
  (weeklyConfig.blockedDays || []).forEach(blocked => {
    const dayIndex = getScheduleDayIndex(blocked.day);
    if (dayIndex === undefined) return;
    blockedDayIndexes.add(dayIndex);

    const note = document.createElement('div');
    note.className = 'weekly-blocked-note';
    note.textContent = blocked.label || '';
    note.style.gridColumn = String(dayIndex + 2);
    note.style.gridRow = '2 / span 2';
    const offsetY = Number(blocked.offsetY || 0);
    const rotation = Number(blocked.rotationDeg ?? -2.2);
    note.style.transform = `translateY(${offsetY}px) rotate(${rotation}deg)`;
    weeklyScheduleGrid.appendChild(note);
  });

  let placedCount = 0;

  members.forEach(member => {
    const name = normalizeText(member.namn);
    const level = normalizeText(member.medlemsniva).toLowerCase();
    if (!name) return;

    if (level === 'alltid') {
      alwaysSlot.appendChild(createWeeklyMemberTag(name));
      placedCount++;
      return;
    }

    if (level !== 'ofta') return;

    const dayIndex = getScheduleDayIndex(member.dag);
    const row = getScheduleTimeRow(member.tid);
    if (dayIndex === undefined || row === null) return;

    if (blockedDayIndexes.has(dayIndex)) return;

    const targetSlot = slots.get(`${row}-${dayIndex + 1}`);
    if (!targetSlot) return;

    targetSlot.appendChild(createWeeklyMemberTag(name));
    placedCount++;
  });

  if (!placedCount) {
    const empty = document.createElement('div');
    empty.className = 'weekly-schedule-empty';
    empty.style.gridColumn = '1 / -1';
    empty.style.gridRow = '2 / span 2';
    empty.textContent = 'Inga schemalagda medlemmar hittades.';
    weeklyScheduleGrid.appendChild(empty);
  }

}

async function loadWeeklySchedule() {
  if (!weeklyScheduleGrid) return;

  try {
    const query = azureConfig.sasToken.replace(/^\?/, '');
    const membersCsvUrl = `${getBlobBaseUrl()}/${encodeURIComponent(membersCsvFileName)}?${query}&_=${Date.now()}`;
    const response = await fetch(membersCsvUrl, { cache:'no-store' });
    if (!response.ok) {
      throw new Error(`Kunde inte läsa ${membersCsvFileName} från Azure (${response.status})`);
    }

    const csvText = await response.text();
    const members = parseSemicolonCsv(csvText);

    renderWeeklySchedule(members);
    updateDashboardUsersFromMembers(members);

    /*
     * Om medlemslistan har ändrats måste även Anslagstavlan byggas om,
     * även om aktivitets-JSON-filerna är oförändrade.
     */
    if (hasLoadedOnce) {
      await loadActivities(true);
    }
  } catch (error) {
    console.error(error);
    if (!moduleEnabled('weeklySchedule')) return;
    weeklyScheduleGrid.innerHTML = '';
    const message = document.createElement('div');
    message.className = 'weekly-schedule-error';
    message.style.gridColumn = '1 / -1';
    message.style.gridRow = '1 / -1';
    message.textContent = `Veckoschemat kunde inte läsa ${membersCsvFileName}`;
    weeklyScheduleGrid.appendChild(message);
  }
}

const kioskClock =
  document.getElementById('kiosk-clock');

const kioskClockTime =
  document.getElementById('kiosk-clock-time');

const kioskClockDate =
  document.getElementById('kiosk-clock-date');


function updateKioskClock() {

  const now = new Date();

  kioskClockTime.textContent =
    now.toLocaleTimeString(
      'sv-SE',
      {
        hour:'2-digit',
        minute:'2-digit'
      }
    );


  const weekday =
    new Intl.DateTimeFormat(
      'sv-SE',
      { weekday:'short' }
    )
      .format(now)
      .replace('.', '')
      .toUpperCase();


  const day =
    now.getDate();


  const month =
    new Intl.DateTimeFormat(
      'sv-SE',
      { month:'short' }
    )
      .format(now)
      .replace('.', '')
      .toUpperCase();


  kioskClockDate.textContent =
    `${weekday} ${day} ${month}`;
}


/* Uppdatera direkt */

updateKioskClock();


/*
 * Uppdatera var 10:e sekund.
 *
 * Klockan visar bara minuter, men detta gör att
 * minutbytet sker tillräckligt nära korrekt tid.
 */

setInterval(
  updateKioskClock,
  10000
);
    
/*
 * =========================================================
 * Raspberry Pi detection + screen rotation
 * =========================================================
 */

function isRaspberryPi() {
  const params =
    new URLSearchParams(window.location.search);

  if (params.get('raspberrypi') === '1') {
    return true;
  }

  const userAgent =
    (navigator.userAgent || '').toLowerCase();

  const platform =
    (navigator.platform || '').toLowerCase();

  const isLinux =
    userAgent.includes('linux') ||
    platform.includes('linux');

  const isArm =
    userAgent.includes('arm') ||
    userAgent.includes('aarch64') ||
    platform.includes('arm') ||
    platform.includes('aarch64');

  return isLinux && isArm;
}

function configureDisplayForHardware() {
  const raspberryPi = isRaspberryPi();

  if (raspberryPi) {
    document.documentElement.classList.add(
      'raspberry-pi'
    );

    console.log(
      'Raspberry Pi/ARM Linux detected – dashboard rotated 90°.'
    );
  } else {
    document.documentElement.classList.remove(
      'raspberry-pi'
    );

    console.log(
      'Non-Raspberry Pi device – normal dashboard orientation.'
    );
  }
}

configureDisplayForHardware();    
    
    /*
     * Anslagstavlans användare laddas dynamiskt från Skroja_members.csv.
     * Lerverkstan finns som fallback tills CSV-filen har hunnit laddas.
     */
    let users = [
      { name: activityConfig.featuredUser || 'Lerverkstan', laneClass: 'lane-blue', featured: true }
    ];

    function laneClassFromMemberColor(color) {
      const normalized = normalizeText(color).toLowerCase();

      const colorMap = {
        blue: 'lane-blue',
        green: 'lane-green',
        coral: 'lane-peach',
        peach: 'lane-peach',
        yellow: 'lane-yellow'
      };

      return colorMap[normalized] || 'lane-green';
    }

    function updateDashboardUsersFromMembers(members) {
      const seen = new Set();
      const dynamicUsers = [];

      members.forEach(member => {
        const name = normalizeText(member.namn);
        if (!name) return;

        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);

        dynamicUsers.push({
          name,
          laneClass: laneClassFromMemberColor(member.color),
          featured: key === normalizeText(activityConfig.featuredUser || 'Lerverkstan').toLowerCase()
        });
      });

      /* Säkerställ att Lerverkstan alltid finns även om CSV-raden saknas. */
      const featuredKey = normalizeText(activityConfig.featuredUser || 'Lerverkstan').toLowerCase();
      if (featuredKey && !seen.has(featuredKey)) {
        dynamicUsers.unshift({
          name: activityConfig.featuredUser || 'Lerverkstan',
          laneClass: 'lane-blue',
          featured: true
        });
      }

      users = dynamicUsers;
    }

const hiddenActivities = dataConfig.hiddenActivities || [];
    const activityAppUrl = qrConfig.url || (qrConfig.appPath ? (() => { const u = new URL(qrConfig.appPath, window.SYSTEM_BASE_URL || document.baseURI); u.searchParams.set('customer', config.customerId || window.CUSTOMER_ID || 'skroja'); return u.href; })() : '');
    const pollIntervalMs = Number(displayConfig.pollIntervalMs || 15000);
    const rowsContainer = document.getElementById('rows');
    const pollStatus = document.getElementById('poll-status');

const calendarPanel = document.getElementById('calendar-panel');
const calendarGrid = document.getElementById('calendar-grid');
    const calendarSection = document.getElementById('calendar-section');
    
    const nightScreen = document.getElementById('night-screen');
    let pollTimer = null;
let membersPollTimer = null;

let lastSeenFileSignature = null;
let hasLoadedOnce = false;

    function buildQrCode() {
      const qrWrap = document.getElementById('qrcode');
      if (!qrWrap || !moduleEnabled('qrCode') || !activityAppUrl) return;
      const encodedUrl = encodeURIComponent(activityAppUrl);
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodedUrl}`;
      qrWrap.innerHTML = `<img src="${qrImageUrl}" alt="QR-kod till aktivitetshanteraren" referrerpolicy="no-referrer">`;
    }

    function formatTime(isoString) {
      if (!isoString) return '-';
      return new Date(isoString).toLocaleString('sv-SE', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    function getBlobBaseUrl() {
      return `https://${azureConfig.accountName}.blob.core.windows.net/${azureConfig.containerName}`;
    }

async function listJsonBlobs() {
  const { accountName, containerName, sasToken } = azureConfig;
  if (!accountName || !containerName || !sasToken || sasToken.includes('PASTA_IN')) {
    throw new Error('Azure-inställningar saknas. Lägg in en giltig SAS-token i dashboardfilen.');
  }

  const query = sasToken.replace(/^\?/, '');
  const url = `https://${accountName}.blob.core.windows.net/${containerName}?restype=container&comp=list&include=metadata&${query}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Kunde inte läsa från Azure (${response.status}).`);

  const xml = await response.text();
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const blobNodes = Array.from(doc.querySelectorAll('Blob'));

  return blobNodes
    .map(blob => {
      const name = blob.querySelector('Name')?.textContent || '';
      const lastModified = blob.querySelector('Properties > Last-Modified')?.textContent || '';
      return { name, lastModified };
    })
    .filter(blob => blob.name.endsWith('.json'));
}

    async function readJsonRecord(fileName) {
      const query = azureConfig.sasToken.replace(/^\?/, '');
      const url = `${getBlobBaseUrl()}/${encodeURIComponent(fileName)}?${query}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Kunde inte läsa ${fileName}`);
      return response.json();
    }

function isNightMode() {
  if (!displayConfig.nightModeEnabled && displayConfig.nightModeEnabled !== undefined) return false;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = parseClockMinutes(displayConfig.nightStart || '22:30', 22 * 60 + 30);
  const end = parseClockMinutes(displayConfig.nightEnd || '07:30', 7 * 60 + 30);
  if (start === end) return false;
  return start > end
    ? (minutes >= start || minutes < end)
    : (minutes >= start && minutes < end);
}

function updateNightMode() {
  const night = isNightMode();
  nightScreen.style.display = night ? 'block' : 'none';
}

async function safeLoadActivities() {
  if (isNightMode()) {
    updateNightMode();
    return;
  }

  updateNightMode();

  try {
    await loadActivities();
  } catch (error) {
    console.error(error);
    if (pollStatus) pollStatus.textContent = '';
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);

  pollTimer = setInterval(() => {
    safeLoadActivities();
  }, pollIntervalMs);
}

function startMembersPolling() {
  if (membersPollTimer) clearInterval(membersPollTimer);

  membersPollTimer = setInterval(() => {
    loadWeeklySchedule();
  }, pollIntervalMs);
}
    

async function loadActivities(force = false) {
  if (pollStatus) pollStatus.textContent = '';

  const files = await listJsonBlobs();

  const sortedFiles = files
    .slice()
    .sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    .reverse();

  /*
   * Signaturen innehåller ALLA JSON-filer.
   *
   * Därmed märker dashboarden:
   * - ny aktivitet
   * - borttagen aktivitet
   * - ändrad aktivitet
   * - nytt/borttaget kalenderevent
   */
  const fileSignature = sortedFiles
    .map(file =>
      `${file.name}:${file.lastModified}`
    )
    .join('|');

  if (
    !force &&
    hasLoadedOnce &&
    fileSignature === lastSeenFileSignature
  ) {
    return;
  }

  lastSeenFileSignature = fileSignature;
  hasLoadedOnce = true;

  /*
   * Läs alla JSON-poster.
   *
   * Det behövs för kalendern eftersom ett framtida event
   * kan ha skapats för länge sedan.
   */
  const allFiles =
    sortedFiles.map(file => file.name);

  const records = await Promise.all(
    allFiles.map(readJsonRecord)
  );

  /*
   * --------------------------------
   * KALENDER
   * --------------------------------
   */

  const calendarEvents = records
    .filter(record =>
      record &&
      record.activity === (dataConfig.calendarActivityName || 'Kalenderevent') &&
      record.eventDate
    );

  renderCalendar(calendarEvents);

  /*
   * --------------------------------
   * VANLIGA AKTIVITETER
   * --------------------------------
   */

  const cutoff =
    Date.now() -
    (14 * 24 * 60 * 60 * 1000);

  const byUser = Object.fromEntries(
    users.map(user => [user.name, []])
  );

  records
    .filter(record =>
      record &&
      record.member &&
      record.timestamp
    )

    .filter(record => {
      const ts =
        new Date(record.timestamp).getTime();

      return (
        Number.isFinite(ts) &&
        ts >= cutoff
      );
    })

    /*
     * Kalenderevent ska INTE visas
     * som vanliga aktivitetskort.
     */
    .filter(record =>
      record.activity !== (dataConfig.calendarActivityName || 'Kalenderevent')
    )

    .filter(record =>
      !hiddenActivities.includes(
        record.activity
      )
    )

    .sort(
      (a, b) =>
        new Date(b.timestamp) -
        new Date(a.timestamp)
    )

    .forEach(record => {
      if (!byUser[record.member]) return;

      if (
        record.member === (activityConfig.featuredUser || 'Lerverkstan') ||
        byUser[record.member].length < Number(activityConfig.maxItemsPerUser || 4)
      ) {
        byUser[record.member].push(record);
      }
    });

  renderRows(byUser);

  if (pollStatus) {
    pollStatus.textContent = '';
  }
}

function renderCalendar(events) {
  if (!calendarPanel || !calendarGrid || !moduleEnabled('calendar')) return;

  const validEvents = events
    .filter(event =>
      event &&
      event.activity === 'Kalenderevent' &&
      event.eventDate
    )
    .sort((a, b) =>
      a.eventDate.localeCompare(b.eventDate)
    );

  const today = new Date();

  // Måndag i nuvarande vecka
  const calendarStart = new Date(today);

  const daysSinceMonday =
    (today.getDay() + 6) % 7;

  calendarStart.setDate(
    today.getDate() - daysSinceMonday
  );

  calendarStart.setHours(0, 0, 0, 0);

  calendarGrid.innerHTML = '';

  /*
   * 6 veckor
   */
  for (let week = 0; week < 6; week++) {

    /*
     * -----------------------------------------
     * Bestäm vilken månad som "vinner" veckan
     * -----------------------------------------
     */

    const monthCounts = new Map();

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {

      const date = new Date(calendarStart);

      date.setDate(
        calendarStart.getDate() +
        week * 7 +
        dayIndex
      );

      const key =
        `${date.getFullYear()}-${date.getMonth()}`;

      if (!monthCounts.has(key)) {
        monthCounts.set(key, {
          count:0,
          date:new Date(date)
        });
      }

      monthCounts.get(key).count++;
    }

    const winningMonth =
      [...monthCounts.values()]
        .sort((a, b) =>
          b.count - a.count
        )[0];

    /*
     * Månad till vänster
     */

    const monthLabel =
      document.createElement('div');

    monthLabel.className =
      'calendar-month-label';

    const monthName =
      new Intl.DateTimeFormat(
        'sv-SE',
        { month:'short' }
      )
        .format(winningMonth.date)
        .replace('.', '');

    monthLabel.textContent =
      monthName;

    calendarGrid.appendChild(
      monthLabel
    );


    /*
     * -----------------------------------------
     * Veckans 7 dagar
     * -----------------------------------------
     */

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {

      const i =
        week * 7 + dayIndex;

      const currentDate =
        new Date(calendarStart);

      currentDate.setDate(
        calendarStart.getDate() + i
      );

      const year =
        currentDate.getFullYear();

      const month =
        currentDate.getMonth();

      const day =
        currentDate.getDate();

      const dateString = [
        year,
        String(month + 1).padStart(2, '0'),
        String(day).padStart(2, '0')
      ].join('-');


      const dayElement =
        document.createElement('div');

      dayElement.className =
        'calendar-day';


      /*
       * Idag
       */

      const isToday =
        year === today.getFullYear() &&
        month === today.getMonth() &&
        day === today.getDate();

      if (isToday) {
        dayElement.classList.add('today');
      }


      /*
       * Datum
       */

      const dateElement =
        document.createElement('div');

      dateElement.className =
        'calendar-date';

      dateElement.textContent =
        day;

      dayElement.appendChild(
        dateElement
      );


      /*
       * Event
       */

      const todaysEvents =
        validEvents.filter(event =>
          event.eventDate === dateString
        );

      todaysEvents.forEach(event => {

        const eventElement =
          document.createElement('div');

        eventElement.className =
          'calendar-event';

        eventElement.textContent =
          event.eventDescription ||
          'Kalenderevent';

        dayElement.appendChild(
          eventElement
        );
      });

      calendarGrid.appendChild(
        dayElement
      );
    }
  }
}
    
    function renderRows(byUser) {
      if (!moduleEnabled('activities')) return;
      const query = azureConfig.sasToken.replace(/^\?/, '');
      const baseUrl = getBlobBaseUrl();
      rowsContainer.innerHTML = '';

      users.forEach(user => {
        const activities = byUser[user.name] || [];
        if (!activities.length) return;

const row = document.createElement('section');
row.className = user.featured ? 'user-row featured-row' : 'user-row';

const nameTag = document.createElement('div');
nameTag.className = user.featured ? 'name featured-name' : 'name';
        nameTag.textContent = user.name;

const lane = document.createElement('div');
lane.className = user.featured
  ? `lane ${user.laneClass} featured-lane`
  : `lane ${user.laneClass}`;

const visibleActivities = user.name === (activityConfig.featuredUser || 'Lerverkstan')
  ? activities
  : activities.slice(0, Number(activityConfig.maxItemsPerUser || 4));

visibleActivities.forEach(activity => {
  const card = document.createElement('article');
  card.className = 'card';
  const imageHtml = activity.hasImage && activity.imageFileName
    ? `<img class="thumb" src="${baseUrl}/${encodeURIComponent(activity.imageFileName)}?${query}" alt="Bild för ${activity.activity}">`
    : '';
  card.innerHTML = `
    <div class="title2">${activity.activity || 'Okänd aktivitet'}</div>
    <div class="meta">${formatTime(activity.timestamp)}</div>
    ${imageHtml}
  `;
  lane.appendChild(card);
});

        row.appendChild(nameTag);
        row.appendChild(lane);
        rowsContainer.appendChild(row);
      });
    }

function updateFullscreenCardVisibility() {
  const fullscreenCard = document.querySelector('.pin-note');
  const clock = document.getElementById('kiosk-clock');
  const contactNote = document.getElementById('kiosk-contact-note');

  const isFullscreen =
    Boolean(document.fullscreenElement) ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    isRaspberryPi();

  if (fullscreenCard) {
    fullscreenCard.style.display =
      isFullscreen ? 'none' : '';
  }

  if (clock) {
    clock.style.display =
      isFullscreen ? 'block' : 'none';
  }

  if (contactNote) {
    contactNote.style.display =
      isFullscreen ? 'block' : 'none';
  }
}

document.addEventListener(
  'fullscreenchange',
  updateFullscreenCardVisibility
);

window.addEventListener(
  'load',
  updateFullscreenCardVisibility
);


document.getElementById('fullscreen-btn').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }

    updateFullscreenCardVisibility();
  } catch (error) {
    console.error(error);
    if (pollStatus) pollStatus.textContent = '';
  }
});

buildQrCode();
loadWeeklySchedule();
updateNightMode();

if (!isNightMode()) {
  safeLoadActivities();
} else {
  renderRows({});
}

function scheduleDailyCodeReload() {
  if (displayConfig.reloadEnabled === false) return;

  function scheduleNextReload() {
    const now = new Date();
    const reloadMinutes = parseClockMinutes(displayConfig.reloadTime || '06:00', 6 * 60);
    const reloadHour = Math.floor(reloadMinutes / 60);
    const reloadMinute = reloadMinutes % 60;
    const nextReload = new Date(now);
    nextReload.setHours(reloadHour, reloadMinute, 0, 0);

    if (now >= nextReload) nextReload.setDate(nextReload.getDate() + 1);
    const delay = nextReload.getTime() - now.getTime();

    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('_refresh', Date.now());
      window.location.replace(url.toString());
    }, delay);
  }

  scheduleNextReload();
}

function setupKioskMouseCursor() {
  let mouseHideTimer = null;

  function showMouseCursor() {
    document.body.style.cursor = 'default';

    if (mouseHideTimer) {
      clearTimeout(mouseHideTimer);
    }

    mouseHideTimer = setTimeout(() => {
      document.body.style.cursor = 'none';
    }, 3000);
  }

  document.addEventListener('mousemove', showMouseCursor);
  document.addEventListener('mousedown', showMouseCursor);
  document.addEventListener('wheel', showMouseCursor);

  showMouseCursor();
}

setupKioskMouseCursor();
scheduleDailyCodeReload();
startPolling();
startMembersPolling();
