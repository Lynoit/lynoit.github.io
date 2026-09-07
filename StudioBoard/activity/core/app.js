"use strict";
const config = window.APP_CONFIG || {};
const azureConfig = config.azure || {};
const dataConfig = config.data || {};
const activityAppConfig = config.activityApp || {};
const activityModules = activityAppConfig.modules || {};

document.title = activityAppConfig.pageTitle || `${config.customerName || 'Kund'} Aktivitet`;
const appNote = document.getElementById('app-note');
if (appNote) appNote.textContent = activityAppConfig.noteTitle || document.title;

function activityModuleEnabled(name, defaultValue = true) {
  return activityModules[name] === undefined ? defaultValue : Boolean(activityModules[name]);
}

let members = [];

  const membersConfig = { blobName: dataConfig.membersFile || 'members.csv', fallbackColor: activityAppConfig.fallbackColor || 'blue' };

  async function loadMembersFromCsv(){
    const response = await fetch(getAzureBlobUrl(membersConfig.blobName), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Kunde inte läsa medlemsfilen (${response.status}).`);
    }

    const text = await response.text();
    const lines = text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      throw new Error('Medlemsfilen är tom.');
    }

    const rows = lines.map(line => line.split(';').map(value => value.trim()));
    const firstRow = rows[0].map(value => value.toLowerCase());
    const hasHeader = firstRow.includes('name') || firstRow.includes('namn');
    const dataRows = hasHeader ? rows.slice(1) : rows;

    members = dataRows
      .filter(row => row[0])
      .map((row, index) => ({
        name: row[0],
        color: row[1] || ['blue', 'green', 'yellow', 'coral'][index % 4] || membersConfig.fallbackColor
      }));

    if (!members.length) {
      throw new Error('Inga giltiga medlemmar hittades i medlemsfilen.');
    }
  }

  let activityOptions = [];

  const activitiesConfig = { blobName: dataConfig.activitiesFile || 'activities.csv', fallbackColor: activityAppConfig.fallbackColor || 'blue' };

  const restrictedActivities = activityAppConfig.restrictedActivities || {};

function canMemberSeeActivity(memberName, activityName){
  const activityKey = normalizeActivityName(activityName);
  const allowedMembers = restrictedActivities[activityKey];

  // Ingen begränsning för aktiviteten
  if (!allowedMembers) return true;

  const memberKey = String(memberName || '').trim().toLocaleLowerCase('sv-SE');
  return allowedMembers.includes(memberKey);
}  

  function parseCsvBoolean(value){
    return ['1', 'true', 'ja', 'yes', 'x'].includes(String(value || '').trim().toLowerCase());
  }

  async function loadActivitiesFromCsv(){
    const response = await fetch(getAzureBlobUrl(activitiesConfig.blobName), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Kunde inte läsa aktivitetsfilen (${response.status}).`);
    }

    const text = await response.text();
    const lines = text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      throw new Error('Aktivitetsfilen är tom.');
    }

    const rows = lines.map(line => line.split(';').map(value => value.trim()));
    const firstRow = rows[0].map(value => value.toLowerCase());
    const hasHeader = firstRow.includes('name') || firstRow.includes('namn') || firstRow.includes('aktivitet');
    const dataRows = hasHeader ? rows.slice(1) : rows;

    activityOptions = dataRows
      .filter(row => row[0])
      .map((row, index) => ({
        name: row[0],
        color: row[1] || ['blue', 'green', 'yellow', 'coral'][index % 4] || activitiesConfig.fallbackColor,
        noPhoto: parseCsvBoolean(row[2]),
        requiresWeight: parseCsvBoolean(row[3]),
        countInSession: parseCsvBoolean(row[4])
      }));

    if (!activityOptions.length) {
      throw new Error('Inga giltiga aktiviteter hittades i aktivitetsfilen.');
    }
  }

  function normalizeActivityName(value){
    return String(value || '').trim().toLocaleLowerCase('sv-SE');
  }

  function getActivityConfig(activityName){
    const normalized = normalizeActivityName(activityName);
    return activityOptions.find(activity => normalizeActivityName(activity.name) === normalized) || null;
  }

  function currentActivityConfig(){
    return state.activityConfig || getActivityConfig(state.activity);
  }

  function getAzureBlobUrl(blobName){
    const { accountName, containerName, sasToken } = azureConfig;
    const query = sasToken.replace(/^\?/, '');
    return `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobName)}?${query}&v=${Date.now()}`;
  }

  const state = { member:'', activity:'', activityConfig:null, weightKg:null, eventDate:'', eventDescription:'', photoFile:null, photoDataUrl:'', timestampIso:'' };
  const SESSION_TIMEOUT_MS = Number(activityAppConfig.sessionTimeoutMs || 60 * 60 * 1000);
  const SESSION_TOTALS_KEY = activityAppConfig.storageKeys?.sessionTotals || `${config.customerId || 'customer'}ClaySessionTotals`;
  const LAST_ACTIVITY_KEY = activityAppConfig.storageKeys?.lastActivity || `${config.customerId || 'customer'}ClayLastActivity`;
  const LAST_MEMBER_KEY = activityAppConfig.storageKeys?.lastMember || `${config.customerId || 'customer'}LastMember`;
  const sessionTotals = loadSessionTotals();
  let inactivityTimer = null;

  const steps = {
    user: document.getElementById('step-user'),
    activity: document.getElementById('step-activity'),
    weight: document.getElementById('step-weight'),
    calendarEvent: document.getElementById('step-calendar-event'),
    photo: document.getElementById('step-photo'),
    summary: document.getElementById('step-summary'),
    result: document.getElementById('step-result')
  };

  const userButtons = document.getElementById('user-buttons');
  const activityButtons = document.getElementById('activity-buttons');
  const customActivityInput = document.getElementById('custom-activity');
  const ceramicWeightInput = document.getElementById('ceramic-weight');
  const eventDateInput = document.getElementById('event-date');
  const eventDescriptionInput = document.getElementById('event-description');
  const cameraInput = document.getElementById('camera-input');
  const previewWrap = document.getElementById('preview-wrap');
  const sessionTotalBox = document.getElementById('session-total');
  const sessionTotalValue = document.getElementById('session-total-value');
  if (!activityModuleEnabled('customActivity', true)) { const block = customActivityInput?.closest('.textblock'); if (block) block.hidden = true; }

  function loadSessionTotals(){
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_TOTALS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveSessionTotals(){
    sessionStorage.setItem(SESSION_TOTALS_KEY, JSON.stringify(sessionTotals));
  }

  function clearSessionTotals(){
    Object.keys(sessionTotals).forEach(member => delete sessionTotals[member]);
    sessionStorage.removeItem(SESSION_TOTALS_KEY);
    updateSessionTotalDisplay();
  }

  function getLastActivity(){
    return Number(sessionStorage.getItem(LAST_ACTIVITY_KEY) || 0);
  }

  function sessionHasExpired(){
    const lastActivity = getLastActivity();
    return lastActivity > 0 && Date.now() - lastActivity >= SESSION_TIMEOUT_MS;
  }

  function expireSession(){
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
    clearSessionTotals();
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
    resetState();
  }

  function scheduleSessionTimeout(){
    clearTimeout(inactivityTimer);
    const lastActivity = getLastActivity();
    if (!lastActivity) return;

    const remaining = SESSION_TIMEOUT_MS - (Date.now() - lastActivity);
    if (remaining <= 0) {
      expireSession();
      return;
    }

    inactivityTimer = setTimeout(expireSession, remaining);
  }

  function registerUserActivity(){
    if (sessionHasExpired()) {
      expireSession();
    }
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    scheduleSessionTimeout();
  }

  function checkSessionTimeout(){
    if (sessionHasExpired()) {
      expireSession();
    } else {
      scheduleSessionTimeout();
    }
  }

  function formatKg(value){
    return `${value.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kg`;
  }

  function updateSessionTotalDisplay(){
    if (!activityModuleEnabled('sessionTotal', true) || !state.member) {
      sessionTotalBox.hidden = true;
      return;
    }
    const total = Number(sessionTotals[state.member] || 0);
    sessionTotalValue.textContent = formatKg(total);
    sessionTotalBox.hidden = false;
  }

  function showStep(name){
    Object.values(steps).forEach(step => step.classList.remove('active'));
    steps[name].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function shouldSkipPhoto(activityName) {
    return !activityModuleEnabled('photos', true) || Boolean((state.activityConfig && normalizeActivityName(state.activityConfig.name) === normalizeActivityName(activityName)
      ? state.activityConfig
      : getActivityConfig(activityName))?.noPhoto);
  }

  function isCalendarEvent(){
    return normalizeActivityName(state.activity) === normalizeActivityName(dataConfig.calendarActivityName || 'Kalenderevent');
  }

  function goToNextStepAfterActivity() {
    if (isCalendarEvent() && (!state.eventDate || !state.eventDescription)) {
      showStep('calendarEvent');
      return;
    }

    if (currentActivityConfig()?.requiresWeight && state.weightKg === null) {
      showStep('weight');
      ceramicWeightInput.focus();
      return;
    }

    // Rensa eventuell tidigare bild om aktiviteten inte ska ha bild
    if (shouldSkipPhoto(state.activity)) {
      state.photoFile = null;
      state.photoDataUrl = '';
      updateSummary();
      showStep('summary');
    } else {
      showStep('photo');
    }
  }

function renderActivityButtons(){
  activityButtons.innerHTML = '';

  activityOptions
    .filter(activity => canMemberSeeActivity(state.member, activity.name))
    .forEach(activity => {
      const button = document.createElement('button');
      button.className = `btn ${activity.color}`;
      button.textContent = activity.name;

      button.addEventListener('click', () => {
        state.activity = activity.name;
        state.activityConfig = activity;
        state.weightKg = null;
        state.eventDate = '';
        state.eventDescription = '';

        ceramicWeightInput.value = '';
        eventDateInput.value = '';
        eventDescriptionInput.value = '';
        customActivityInput.value = '';

        goToNextStepAfterActivity();
      });

      activityButtons.appendChild(button);
    });
}

function getLastMember(){
  try {
    return localStorage.getItem(LAST_MEMBER_KEY) || '';
  } catch {
    return '';
  }
}

function saveLastMember(memberName){
  try {
    localStorage.setItem(LAST_MEMBER_KEY, memberName);
  } catch {
    // Appen ska fortsätta fungera även om localStorage inte är tillgängligt.
  }
}

function selectMember(member){
  state.member = member.name;
  saveLastMember(member.name);

  // Uppdatera aktiviteterna beroende på vald användare
  renderActivityButtons();

  updateSessionTotalDisplay();
  showStep('activity');
}

function renderButtons(){
  userButtons.innerHTML = '';
  activityButtons.innerHTML = '';

  const lastMemberName = getLastMember();
  const lastMember = members.find(member =>
    member.name.localeCompare(lastMemberName, 'sv-SE', { sensitivity: 'base' }) === 0
  );

  if (lastMember) {
    const lastUserWrap = document.createElement('div');
    lastUserWrap.className = 'last-user-wrap';

    const lastUserButton = document.createElement('button');
    lastUserButton.className = 'last-user-btn';
    lastUserButton.innerHTML = `<span>Senast använd</span>${lastMember.name}`;
    lastUserButton.addEventListener('click', () => selectMember(lastMember));

    lastUserWrap.appendChild(lastUserButton);
    userButtons.appendChild(lastUserWrap);

    const separator = document.createElement('div');
    separator.className = 'user-list-separator';
    separator.textContent = 'Övriga medlemmar';
    userButtons.appendChild(separator);
  }

  members
    .filter(member => !lastMember || member.name !== lastMember.name)
    .forEach(member => {
      const button = document.createElement('button');
      button.className = `btn ${member.color}`;
      button.textContent = member.name;
      button.addEventListener('click', () => selectMember(member));
      userButtons.appendChild(button);
    });
}

  function setResult(title, message, submessage=''){
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-message').textContent = message;
    document.getElementById('result-submessage').textContent = submessage;
    showStep('result');
  }

  function resetState(){
    state.member = '';
    state.activity = '';
    state.activityConfig = null;
    state.weightKg = null;
    state.eventDate = '';
    state.eventDescription = '';
    state.photoFile = null;
    state.photoDataUrl = '';
    state.timestampIso = '';
    customActivityInput.value = '';
    ceramicWeightInput.value = '';
    eventDateInput.value = '';
    eventDescriptionInput.value = '';
    cameraInput.value = '';
    previewWrap.innerHTML = '<span>Ingen bild vald</span>';
    showStep('user');
  }

  function timestampBase(){
    const d = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function formatSwedish(isoString){
    return new Date(isoString).toLocaleString('sv-SE', {
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
  }

function updateSummary(){
  state.timestampIso = new Date().toISOString();

  const config = currentActivityConfig();
  const hasImage = Boolean(state.photoFile);

  document.getElementById('summary-user').textContent = state.member;
  document.getElementById('summary-activity').textContent = state.activity;

  // Vikt
  const weightRow = document.getElementById('summary-weight-row');
  const hasWeight = Boolean(config?.requiresWeight) && state.weightKg !== null;

  weightRow.hidden = !hasWeight;

  document.getElementById('summary-weight').textContent =
    hasWeight
      ? `${String(state.weightKg).replace('.', ',')} kg`
      : '';

  // Kalenderevent
  const eventDateRow =
    document.getElementById('summary-event-date-row');

  const eventDescriptionRow =
    document.getElementById('summary-event-description-row');

  const hasEventDetails =
    isCalendarEvent() &&
    Boolean(state.eventDate);

  eventDateRow.hidden = !hasEventDetails;
  eventDescriptionRow.hidden = !hasEventDetails;

  document.getElementById('summary-event-date').textContent =
    hasEventDetails
      ? state.eventDate
      : '';

  document.getElementById('summary-event-description').textContent =
    hasEventDetails
      ? state.eventDescription
      : '';

  // Tid
  document.getElementById('summary-time').textContent =
    formatSwedish(state.timestampIso);

  // Bild
  const imageRow =
    document.getElementById('summary-image-row');

  const activityAllowsPhoto =
    !shouldSkipPhoto(state.activity);

  imageRow.hidden = !activityAllowsPhoto;
  previewWrap.hidden = !activityAllowsPhoto;

  if (activityAllowsPhoto) {
    document.getElementById('summary-image-text').textContent =
      hasImage
        ? 'Bild vald'
        : 'Ingen bild';

    previewWrap.innerHTML =
      hasImage && state.photoDataUrl
        ? `<img src="${state.photoDataUrl}" alt="Förhandsvisning" />`
        : '<span>Ingen bild vald</span>';
  } else {
    document.getElementById('summary-image-text').textContent = '';
    previewWrap.innerHTML = '';
  }
}

  async function uploadToAzure(){
    const { accountName, containerName, sasToken } = azureConfig;
    if (!accountName || !containerName || !sasToken || sasToken.includes('PASTA_IN')) {
      throw new Error('Azure-inställningar saknas. Lägg in en giltig SAS-token i filen först.');
    }

    const query = sasToken.replace(/^\?/, '');
    const baseUrl = `https://${accountName}.blob.core.windows.net/${containerName}`;
    const baseName = timestampBase();
    const jsonName = `${baseName}.json`;
    const jpgName = `${baseName}.jpg`;

    const payload = {
      timestamp: state.timestampIso,
      member: state.member,
      activity: state.activity,
      weightKg: currentActivityConfig()?.requiresWeight ? state.weightKg : null,
      eventDate: isCalendarEvent() ? state.eventDate : null,
      eventDescription: isCalendarEvent() ? state.eventDescription : null,
      hasImage: Boolean(state.photoFile),
      imageFileName: state.photoFile ? jpgName : null,
      jsonFileName: jsonName,
      source: activityAppConfig.sourceName || 'ActivityApp'
    };

    const jsonResponse = await fetch(`${baseUrl}/${encodeURIComponent(jsonName)}?${query}`, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'x-ms-version': '2023-11-03',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload, null, 2)
    });

    if (!jsonResponse.ok) {
      const text = await jsonResponse.text().catch(() => '');
      throw new Error(`Kunde inte ladda upp JSON (${jsonResponse.status}). ${text}`);
    }

    if (state.photoFile) {
      const imageResponse = await fetch(`${baseUrl}/${encodeURIComponent(jpgName)}?${query}`, {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'x-ms-version': '2023-11-03',
          'Content-Type': state.photoFile.type || 'image/jpeg'
        },
        body: state.photoFile
      });

      if (!imageResponse.ok) {
        const text = await imageResponse.text().catch(() => '');
        throw new Error(`Kunde inte ladda upp bild (${imageResponse.status}). ${text}`);
      }
    }

    return { jsonName, jpgName: state.photoFile ? jpgName : null };
  }

  document.getElementById('activity-continue').addEventListener('click', () => {
    const manualText = customActivityInput.value.trim();
    if (manualText) {
      state.activity = manualText;
      state.activityConfig = null;
      state.weightKg = null;
      state.eventDate = '';
      state.eventDescription = '';
      ceramicWeightInput.value = '';
      eventDateInput.value = '';
      eventDescriptionInput.value = '';
    }

    if (!state.activity) {
      alert('Välj eller skriv en aktivitet först.');
      return;
    }

    goToNextStepAfterActivity();
  });

  document.getElementById('activity-back').addEventListener('click', () => showStep('user'));

  document.getElementById('weight-continue').addEventListener('click', () => {
    const normalized = ceramicWeightInput.value.trim().replace(',', '.');
    const weight = Number(normalized);

    if (!Number.isFinite(weight) || weight <= 0) {
      alert('Ange en giltig vikt som är större än 0 kg.');
      ceramicWeightInput.focus();
      return;
    }

    state.weightKg = Math.round(weight * 100) / 100;
    goToNextStepAfterActivity();
  });

  document.getElementById('weight-back').addEventListener('click', () => {
    state.weightKg = null;
    showStep('activity');
  });

  document.getElementById('calendar-event-continue').addEventListener('click', () => {
    const eventDate = eventDateInput.value;
    const eventDescription = eventDescriptionInput.value.trim();

    if (!eventDate) {
      alert('Välj ett datum för eventet.');
      eventDateInput.focus();
      return;
    }

    if (!eventDescription) {
      alert('Skriv en beskrivning av eventet.');
      eventDescriptionInput.focus();
      return;
    }

    state.eventDate = eventDate;
    state.eventDescription = eventDescription;
    goToNextStepAfterActivity();
  });

  document.getElementById('calendar-event-back').addEventListener('click', () => {
    state.eventDate = '';
    state.eventDescription = '';
    showStep('activity');
  });

  document.getElementById('photo-back').addEventListener('click', () => {
    if (isCalendarEvent()) {
      showStep('calendarEvent');
    } else if (currentActivityConfig()?.requiresWeight) {
      showStep('weight');
    } else {
      showStep('activity');
    }
  });
  document.getElementById('photo-yes').addEventListener('click', () => cameraInput.click());

  document.getElementById('photo-no').addEventListener('click', () => {
    state.photoFile = null;
    state.photoDataUrl = '';
    updateSummary();
    showStep('summary');
  });

  cameraInput.addEventListener('change', event => {
    const [file] = event.target.files || [];
    if (!file) {
      updateSummary();
      showStep('summary');
      return;
    }

    state.photoFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      state.photoDataUrl = reader.result;
      updateSummary();
      showStep('summary');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('send-no').addEventListener('click', resetState);

  document.getElementById('send-yes').addEventListener('click', async () => {
    try {
      setResult('Skickar...', 'Uppladdning pågår.', 'Lämna sidan öppen tills uppladdningen är klar.');
      const result = await uploadToAzure();

      let sessionMessage = '';
      if (currentActivityConfig()?.countInSession && state.weightKg !== null) {
        const currentTotal = Number(sessionTotals[state.member] || 0);
        sessionTotals[state.member] = Math.round((currentTotal + state.weightKg) * 100) / 100;
        saveSessionTotals();
        updateSessionTotalDisplay();
        sessionMessage = ` Totalt uttaget denna session: ${formatKg(sessionTotals[state.member])}.`;
      }

      setResult(
        'Klart',
        `Registreringen skickades till anslagstavlan.${result.jpgName ? ' Bilden följde med.' : ''}${sessionMessage}`,
        `JSON: ${result.jsonName}${result.jpgName ? ` | Bild: ${result.jpgName}` : ''}`
      );
    } catch (error) {
      console.error(error);
      setResult('Det gick inte', error.message || 'Något gick fel vid uppladdning.');
    }
  });

  document.getElementById('start-over').addEventListener('click', resetState);

  ['pointerdown', 'keydown', 'input', 'change'].forEach(eventName => {
    document.addEventListener(eventName, registerUserActivity, { passive: true });
  });
  window.addEventListener('focus', checkSessionTimeout);
  window.addEventListener('pageshow', checkSessionTimeout);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkSessionTimeout();
  });

  checkSessionTimeout();

  Promise.all([loadMembersFromCsv(), loadActivitiesFromCsv()])
    .then(renderButtons)
    .catch(error => {
      console.error(error);
      userButtons.innerHTML = '<div class="prompt-card"><p>Kunde inte läsa medlems- eller aktivitetsfilen från Azure. Kontrollera kundens config och att filerna finns i rätt container.</p></div>';
      activityButtons.innerHTML = '';
    });
