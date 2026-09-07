"use strict";
const config = window.APP_CONFIG || {};
const azureConfig = config.azure || {};
const dataConfig = config.data || {};
const adminConfig = config.adminApp || {};
const adminModules = adminConfig.modules || {};

document.title = adminConfig.pageTitle || `${config.customerName || 'Kund'} Admin`;
const adminTitleEl = document.getElementById('admin-title');
if (adminTitleEl) adminTitleEl.textContent = adminConfig.title || document.title;

function adminModuleEnabled(name, defaultValue = true) {
  return adminModules[name] === undefined ? defaultValue : Boolean(adminModules[name]);
}
function hideAdmin(selector, visible) {
  const el = document.querySelector(selector);
  if (el) el.style.display = visible ? '' : 'none';
}

const hiddenActivities = adminConfig.hiddenActivities || [];
    const pollIntervalMs = Number(adminConfig.pollIntervalMs || 5000);
    const excludedRightSideUsers = adminConfig.excludedUsers || [];

const state = {
  rawRecords: [],
  members: [],
  activities: [],
  users: [],
  rightSideUsers: [],
  selectedUser: 'Alla',
  period: 'year',
  overview: 'month',
  ceramicStartDate: '',
  ceramicEndDate: '',
  ceramicPricePerKg: Number(adminConfig.pricing?.ceramicPerKg ?? 140),
  guestCeramicPricePerKg: Number(adminConfig.pricing?.guestCeramicPerKg ?? 160),
  adultGuestPrice: Number(adminConfig.pricing?.adultGuest ?? 400),
  childGuestPrice: Number(adminConfig.pricing?.childGuest ?? 200),
  summaryChart: null,
  lastLoadedAt: null
};

    const membersCsvFile = dataConfig.membersFile || 'members.csv';
    const memberColorPalette = {
      blue: '#5b8cff',
      green: '#7bc96f',
      yellow: '#f5b971',
      coral: '#ff8a65'
    };
    const memberColorLabels = {
      blue: 'Blå',
      green: 'Grön',
      yellow: 'Gul',
      coral: 'Korall/orange'
    };
    const activitiesCsvFile = dataConfig.activitiesFile || 'activities.csv';

    const membersHelp = document.querySelector('.members-help');
    if (membersHelp) membersHelp.innerHTML = `Medlemsuppgifter läses direkt från <strong>${membersCsvFile}</strong> i Azure-containern <strong>${azureConfig.containerName || ''}</strong>. Här kan du ändra namn, färg, medlemsnivå, veckodag och tid. Klicka på <strong>Uppdatera</strong> för att skriva ändringarna direkt till filen.`;
    const activitiesHelp = document.querySelector('.activities-help');
    if (activitiesHelp) activitiesHelp.innerHTML = `Aktiviteterna läses direkt från <strong>${activitiesCsvFile}</strong> i Azure-containern <strong>${azureConfig.containerName || ''}</strong>. Här kan du ändra knapptext, färg och vilka steg aktiviteten ska använda. Klicka på <strong>Uppdatera</strong> för att skriva ändringarna direkt till filen.`;

    const pricingInputs = {
      ceramicPricePerKg: state.ceramicPricePerKg,
      guestCeramicPricePerKg: state.guestCeramicPricePerKg,
      adultGuestPrice: state.adultGuestPrice,
      childGuestPrice: state.childGuestPrice
    };
    Object.entries(pricingInputs).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });

    hideAdmin('#exportExcelBtn', adminModuleEnabled('export', true));
    hideAdmin('.stats-grid', adminModuleEnabled('stats', true));
    hideAdmin('.charts-grid', adminModuleEnabled('chart', true));
    hideAdmin('.overview-card:not(.ceramic-card):not(.members-card):not(.activities-card)', adminModuleEnabled('overview', true));
    hideAdmin('.ceramic-card', adminModuleEnabled('billing', true));
    hideAdmin('.members-card', adminModuleEnabled('membersManager', true));
    hideAdmin('.activities-card', adminModuleEnabled('activitiesManager', true));


    function getUserColor(name, alpha = 1) {
      const colorName = state.members.find(member => member.name === name)?.color;
      const hex = memberColorPalette[colorName] || '#7fd1b9';
      if (alpha === 1) return hex;
      const bigint = parseInt(hex.slice(1), 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function formatDateTime(isoString) {
      if (!isoString) return '-';
      return new Date(isoString).toLocaleString('sv-SE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    function formatDateOnly(date) {
      return date.toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }

    function startOfDay(date) {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      return d;
    }

    function isCheckin(record) {
      return (record.activity || '').trim().toLowerCase() === 'checka in'
          || (record.activity || '').trim().toLowerCase() === 'checkade in'
          || (record.activity || '').trim().toLowerCase() === 'check-in';
    }


    const memberLevels = ['Alltid', 'Ofta'];
    const memberDays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
    const memberTimes = ['Förmiddag', 'Eftermiddag'];

    function normalizeMemberChoice(value, allowedValues) {
      const text = String(value || '').trim();
      if (!text) return '';
      return allowedValues.find(item => item.toLocaleLowerCase('sv-SE') === text.toLocaleLowerCase('sv-SE')) || '';
    }

    function parseMembersCsv(csvText) {
      const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
      if (!lines.length) return [];

      const headers = lines[0].split(';').map(value => value.trim().toLowerCase());
      const nameIndex = headers.indexOf('namn');
      const colorIndex = headers.indexOf('color');
      const levelIndex = headers.findIndex(header => header === 'medlemsniva' || header === 'medlemsnivå');
      const dayIndex = headers.indexOf('dag');
      const timeIndex = headers.indexOf('tid');

      if (nameIndex < 0 || colorIndex < 0) {
        throw new Error('Medlemsfilen måste minst ha kolumnerna namn;color.');
      }

      const allowedColors = new Set(Object.keys(memberColorPalette));
      const seen = new Set();
      const members = [];

      lines.slice(1).forEach(line => {
        const cols = line.split(';').map(value => value.trim());
        const name = cols[nameIndex] || '';
        const color = (cols[colorIndex] || '').toLowerCase();
        if (!name || seen.has(name)) return;
        seen.add(name);
        members.push({
          name,
          color: allowedColors.has(color) ? color : 'blue',
          memberLevel: levelIndex >= 0 ? normalizeMemberChoice(cols[levelIndex], memberLevels) : '',
          day: dayIndex >= 0 ? normalizeMemberChoice(cols[dayIndex], memberDays) : '',
          time: timeIndex >= 0 ? normalizeMemberChoice(cols[timeIndex], memberTimes) : ''
        });
      });

      return members;
    }

    function serializeMembersCsv() {
      const rows = ['namn;color;medlemsniva;dag;tid'];
      state.members.forEach(member => {
        const safeName = String(member.name || '').replace(/[;\r\n]/g, ' ').trim();
        if (safeName) {
          rows.push([
            safeName,
            member.color || 'blue',
            member.memberLevel || '',
            member.day || '',
            member.time || ''
          ].join(';'));
        }
      });
      return rows.join('\n') + '\n';
    }

    function refreshConfiguredMembers() {
      state.users = state.members.map(member => member.name);
      state.rightSideUsers = state.users.filter(user => !excludedRightSideUsers.includes(user));

      if (state.selectedUser !== 'Alla' && !state.rightSideUsers.includes(state.selectedUser)) {
        state.selectedUser = 'Alla';
      }

      populateUserSelect();
    }

    function getAzureBlobUrl(blobName) {
      const query = azureConfig.sasToken.replace(/^\?/, '');
      return `${getBlobBaseUrl()}/${encodeURIComponent(blobName)}?${query}`;
    }

    async function loadMembers() {
      const response = await fetch(`${getAzureBlobUrl(membersCsvFile)}&v=${Date.now()}`, { cache: 'no-store' });

      if (response.status === 404) {
        state.members = [];
        refreshConfiguredMembers();
        renderMemberManager();
        setMembersStatus(`${membersCsvFile} finns inte ännu i Azure. Lägg till medlemmar här och klicka på Uppdatera.`, true);
        return;
      }

      if (!response.ok) {
        throw new Error(`Kunde inte läsa ${membersCsvFile} från Azure (${response.status}).`);
      }

      const csvText = await response.text();
      state.members = parseMembersCsv(csvText);
      refreshConfiguredMembers();
      renderMemberManager();
      const hasMissingDetails = state.members.some(member => !member.memberLevel || !member.day || !member.time);
      setMembersStatus(
        hasMissingDetails
          ? `${state.members.length} medlemmar lästa från Azure. `
          : `${state.members.length} medlemmar lästa från Azure.`
      );
    }

    function setMembersStatus(message, isError = false) {
      const el = document.getElementById('membersStatus');
      if (!el) return;
      el.textContent = message;
      el.classList.toggle('error', isError);
    }

    function createMemberSelect(values, currentValue, ariaLabel, onChange, allowEmpty = true) {
      const select = document.createElement('select');
      select.setAttribute('aria-label', ariaLabel);

      if (allowEmpty) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '— Välj —';
        select.appendChild(emptyOption);
      }

      values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });

      select.value = currentValue || '';
      select.addEventListener('change', () => onChange(select.value));
      return select;
    }

    function renderMemberManager() {
      const list = document.getElementById('membersList');
      if (!list) return;
      list.innerHTML = '';

      state.members.forEach((member, index) => {
        const row = document.createElement('div');
        row.className = 'member-edit-row';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = member.name;
        nameInput.setAttribute('aria-label', `Namn för ${member.name}`);
        nameInput.addEventListener('change', () => {
          const oldName = member.name;
          const newName = nameInput.value.trim();
          if (!newName) {
            nameInput.value = oldName;
            setMembersStatus('Namnet får inte vara tomt.', true);
            return;
          }
          if (state.members.some((item, itemIndex) => itemIndex !== index && item.name === newName)) {
            nameInput.value = oldName;
            setMembersStatus('Det finns redan en medlem med det namnet.', true);
            return;
          }
          member.name = newName;
          refreshConfiguredMembers();
          renderDashboard();
          setMembersStatus('Ändringen används på sidan. Uppdatera för att behålla den.');
        });

        const colorSelect = document.createElement('select');
        colorSelect.setAttribute('aria-label', `Färg för ${member.name}`);
        Object.entries(memberColorLabels).forEach(([value, label]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          colorSelect.appendChild(option);
        });
        colorSelect.value = member.color;
        colorSelect.addEventListener('change', () => {
          member.color = colorSelect.value;
          renderDashboard();
          setMembersStatus('Färgen används på sidan. Uppdatera för att behålla den.');
        });

        const levelSelect = createMemberSelect(
          memberLevels,
          member.memberLevel,
          `Medlemsnivå för ${member.name}`,
          value => {
            member.memberLevel = value;
            setMembersStatus('Medlemsnivån är ändrad. Uppdatera för att behålla den.');
          }
        );

        const daySelect = createMemberSelect(
          memberDays,
          member.day,
          `Dag för ${member.name}`,
          value => {
            member.day = value;
            setMembersStatus('Dagen är ändrad. Uppdatera för att behålla den.');
          }
        );

        const timeSelect = createMemberSelect(
          memberTimes,
          member.time,
          `Tid för ${member.name}`,
          value => {
            member.time = value;
            setMembersStatus('Tiden är ändrad. Uppdatera för att behålla den.');
          }
        );

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'member-delete-btn';
        deleteButton.textContent = 'Ta bort';
        deleteButton.addEventListener('click', () => {
          if (!confirm(`Ta bort medlemmen "${member.name}" från medlemslistan?`)) return;
          state.members.splice(index, 1);
          refreshConfiguredMembers();
          renderMemberManager();
          renderDashboard();
          setMembersStatus('Medlemmen är borttagen på sidan. Uppdatera för att behålla ändringen.');
        });

        row.append(nameInput, colorSelect, levelSelect, daySelect, timeSelect, deleteButton);
        list.appendChild(row);
      });

      if (!state.members.length) {
        list.innerHTML = '<div class="status-line">Inga medlemmar definierade.</div>';
      }
    }

    function addMember() {
      const nameInput = document.getElementById('newMemberName');
      const colorSelect = document.getElementById('newMemberColor');
      const memberLevelSelect = document.getElementById('newMemberLevel');
      const daySelect = document.getElementById('newMemberDay');
      const timeSelect = document.getElementById('newMemberTime');
      const name = nameInput.value.trim();
      if (!name) {
        setMembersStatus('Skriv ett namn för den nya medlemmen.', true);
        return;
      }
      if (state.members.some(member => member.name === name)) {
        setMembersStatus('Medlemmen finns redan.', true);
        return;
      }

      state.members.push({
        name,
        color: colorSelect.value,
        memberLevel: memberLevelSelect.value,
        day: daySelect.value,
        time: timeSelect.value
      });
      nameInput.value = '';
      refreshConfiguredMembers();
      renderMemberManager();
      renderDashboard();
      setMembersStatus('Medlemmen är tillagd på sidan. Uppdatera för att behålla ändringen.');
    }

    async function saveMembersToAzure() {
      const button = document.getElementById('saveMembersCsvBtn');
      const originalText = button?.textContent || 'Uppdatera';

      if (button) {
        button.disabled = true;
        button.textContent = 'Sparar...';
      }

      setMembersStatus('Sparar medlemslistan till Azure...');

      try {
        const csvText = serializeMembersCsv();
        const response = await fetch(getAzureBlobUrl(membersCsvFile), {
          method: 'PUT',
          headers: {
            'x-ms-blob-type': 'BlockBlob',
            'Content-Type': 'text/csv; charset=utf-8',
            'Cache-Control': 'no-cache'
          },
          body: csvText
        });

        if (!response.ok) {
          throw new Error(`Kunde inte spara ${membersCsvFile} till Azure (${response.status}).`);
        }

        setMembersStatus(`${membersCsvFile} sparades till Azure.`);
        await loadMembers();
      } catch (error) {
        console.error(error);
        setMembersStatus(error.message || 'Kunde inte spara medlemslistan till Azure.', true);
        alert(error.message || 'Kunde inte spara medlemslistan till Azure.');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    }

    function normalizeYesNo(value) {
      return String(value || '').trim().toLowerCase() === 'ja' ? 'ja' : 'nej';
    }

    function parseActivitiesCsv(csvText) {
      const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
      if (!lines.length) return [];

      const headers = lines[0].split(';').map(value => value.trim().toLowerCase());
      const activityIndex = headers.indexOf('aktivitet');
      const colorIndex = headers.indexOf('color');
      const noPhotoIndex = headers.indexOf('nophoto');
      const requiresWeightIndex = headers.indexOf('requiresweight');
      const countInSessionIndex = headers.indexOf('countinsession');

      if ([activityIndex, colorIndex, noPhotoIndex, requiresWeightIndex, countInSessionIndex].some(index => index < 0)) {
        throw new Error('Aktivitetsfilen måste ha kolumnerna aktivitet;color;noPhoto;requiresWeight;countInSession.');
      }

      const allowedColors = new Set(Object.keys(memberColorPalette));
      const seen = new Set();
      const activities = [];

      lines.slice(1).forEach(line => {
        const cols = line.split(';').map(value => value.trim());
        const name = cols[activityIndex] || '';
        if (!name || seen.has(name)) return;
        seen.add(name);
        const color = (cols[colorIndex] || '').toLowerCase();
        activities.push({
          activity: name,
          color: allowedColors.has(color) ? color : 'blue',
          noPhoto: normalizeYesNo(cols[noPhotoIndex]),
          requiresWeight: normalizeYesNo(cols[requiresWeightIndex]),
          countInSession: normalizeYesNo(cols[countInSessionIndex])
        });
      });

      return activities;
    }

    function serializeActivitiesCsv() {
      const rows = ['aktivitet;color;noPhoto;requiresWeight;countInSession'];
      state.activities.forEach(item => {
        const safeName = String(item.activity || '').replace(/[;\r\n]/g, ' ').trim();
        if (safeName) {
          rows.push(`${safeName};${item.color};${item.noPhoto};${item.requiresWeight};${item.countInSession}`);
        }
      });
      return rows.join('\n') + '\n';
    }

    async function loadConfiguredActivities() {
      const response = await fetch(`${getAzureBlobUrl(activitiesCsvFile)}&v=${Date.now()}`, { cache: 'no-store' });

      if (response.status === 404) {
        state.activities = [];
        renderActivityManager();
        setActivitiesStatus(`${activitiesCsvFile} hittades inte i Azure. Ladda upp filen till containern activities.`, true);
        return;
      }

      if (!response.ok) {
        throw new Error(`Kunde inte läsa ${activitiesCsvFile} från Azure (${response.status}).`);
      }

      state.activities = parseActivitiesCsv(await response.text());
      renderActivityManager();
      setActivitiesStatus(`${state.activities.length} aktiviteter lästa från Azure.`);
    }

    function setActivitiesStatus(message, isError = false) {
      const el = document.getElementById('activitiesStatus');
      if (!el) return;
      el.textContent = message;
      el.classList.toggle('error', isError);
    }

    function createYesNoSelect(value, ariaLabel, onChange) {
      const select = document.createElement('select');
      select.setAttribute('aria-label', ariaLabel);
      [['nej', 'Nej'], ['ja', 'Ja']].forEach(([optionValue, label]) => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = label;
        select.appendChild(option);
      });
      select.value = value;
      select.addEventListener('change', () => onChange(select.value));
      return select;
    }

    function renderActivityManager() {
      const list = document.getElementById('activitiesList');
      if (!list) return;
      list.innerHTML = '';

      state.activities.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'activity-edit-row';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = item.activity;
        nameInput.setAttribute('aria-label', `Aktivitetsnamn för ${item.activity}`);
        nameInput.addEventListener('change', () => {
          const oldName = item.activity;
          const newName = nameInput.value.trim();
          if (!newName) {
            nameInput.value = oldName;
            setActivitiesStatus('Aktivitetsnamnet får inte vara tomt.', true);
            return;
          }
          if (state.activities.some((other, otherIndex) => otherIndex !== index && other.activity === newName)) {
            nameInput.value = oldName;
            setActivitiesStatus('Det finns redan en aktivitet med det namnet.', true);
            return;
          }
          item.activity = newName;
          setActivitiesStatus('Ändringen används i aktivitetslistan. Uppdatera för att behålla den.');
        });

        const colorSelect = document.createElement('select');
        colorSelect.setAttribute('aria-label', `Färg för ${item.activity}`);
        Object.entries(memberColorLabels).forEach(([value, label]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          colorSelect.appendChild(option);
        });
        colorSelect.value = item.color;
        colorSelect.addEventListener('change', () => {
          item.color = colorSelect.value;
          setActivitiesStatus('Färgen är ändrad. Uppdatera för att behålla den.');
        });

        const noPhotoSelect = createYesNoSelect(item.noPhoto, `Ingen bild för ${item.activity}`, value => {
          item.noPhoto = value;
          setActivitiesStatus('Inställningen är ändrad. Uppdatera för att behålla den.');
        });
        const requiresWeightSelect = createYesNoSelect(item.requiresWeight, `Kräver vikt för ${item.activity}`, value => {
          item.requiresWeight = value;
          setActivitiesStatus('Inställningen är ändrad. Uppdatera för att behålla den.');
        });
        const countInSessionSelect = createYesNoSelect(item.countInSession, `Sessionssumma för ${item.activity}`, value => {
          item.countInSession = value;
          setActivitiesStatus('Inställningen är ändrad. Uppdatera för att behålla den.');
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'activity-delete-btn';
        deleteButton.textContent = 'Ta bort';
        deleteButton.addEventListener('click', () => {
          if (!confirm(`Ta bort aktiviteten "${item.activity}" från aktivitetslistan?`)) return;
          state.activities.splice(index, 1);
          renderActivityManager();
          setActivitiesStatus('Aktiviteten är borttagen på sidan. Uppdatera för att behålla ändringen.');
        });

        row.append(nameInput, colorSelect, noPhotoSelect, requiresWeightSelect, countInSessionSelect, deleteButton);
        list.appendChild(row);
      });

      if (!state.activities.length) {
        list.innerHTML = '<div class="status-line">Inga aktiviteter definierade.</div>';
      }
    }

    function addActivity() {
      const nameInput = document.getElementById('newActivityName');
      const name = nameInput.value.trim();
      if (!name) {
        setActivitiesStatus('Skriv ett namn för den nya aktiviteten.', true);
        return;
      }
      if (state.activities.some(item => item.activity === name)) {
        setActivitiesStatus('Aktiviteten finns redan.', true);
        return;
      }

      state.activities.push({
        activity: name,
        color: document.getElementById('newActivityColor').value,
        noPhoto: document.getElementById('newActivityNoPhoto').value,
        requiresWeight: document.getElementById('newActivityRequiresWeight').value,
        countInSession: document.getElementById('newActivityCountInSession').value
      });
      nameInput.value = '';
      renderActivityManager();
      setActivitiesStatus('Aktiviteten är tillagd på sidan. Uppdatera för att behålla ändringen.');
    }

    async function saveActivitiesToAzure() {
      const button = document.getElementById('saveActivitiesCsvBtn');
      const originalText = button?.textContent || 'Uppdatera';

      if (button) {
        button.disabled = true;
        button.textContent = 'Sparar...';
      }

      setActivitiesStatus('Sparar aktivitetslistan till Azure...');

      try {
        const csvText = serializeActivitiesCsv();
        const response = await fetch(getAzureBlobUrl(activitiesCsvFile), {
          method: 'PUT',
          headers: {
            'x-ms-blob-type': 'BlockBlob',
            'Content-Type': 'text/csv; charset=utf-8',
            'Cache-Control': 'no-cache'
          },
          body: csvText
        });

        if (!response.ok) {
          throw new Error(`Kunde inte spara ${activitiesCsvFile} till Azure (${response.status}).`);
        }

        setActivitiesStatus(`${activitiesCsvFile} sparades till Azure.`);
        await loadConfiguredActivities();
      } catch (error) {
        console.error(error);
        setActivitiesStatus(error.message || 'Kunde inte spara aktivitetslistan till Azure.', true);
        alert(error.message || 'Kunde inte spara aktivitetslistan till Azure.');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    }

    function toDateInputValue(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function setDefaultCeramicPeriod() {
      const today = new Date();
      const previousMonth15 = new Date(today.getFullYear(), today.getMonth() - 1, 15);
      state.ceramicStartDate = toDateInputValue(previousMonth15);
      state.ceramicEndDate = toDateInputValue(today);

      document.getElementById('ceramicStartDate').value = state.ceramicStartDate;
      document.getElementById('ceramicEndDate').value = state.ceramicEndDate;
    }

    function isCeramicPickup(record) {
      return (record.activity || '').trim().toLowerCase() === 'hämta ut keramik';
    }

    function getRecordsForCeramicPeriod() {
      if (!state.ceramicStartDate || !state.ceramicEndDate) return [];

      const start = new Date(`${state.ceramicStartDate}T00:00:00`);
      const end = new Date(`${state.ceramicEndDate}T23:59:59.999`);

      return state.rawRecords.filter(record => {
        const timestamp = new Date(record.timestamp);
        return timestamp >= start && timestamp <= end;
      });
    }

    function getCeramicRecordsForPeriod() {
      return getRecordsForCeramicPeriod().filter(isCeramicPickup);
    }

    function isGuestCeramicPickup(record) {
      return (record.activity || '').trim().toLowerCase() === 'hämta ut keramik gäst';
    }

    function isGuestAdult(record) {
      return (record.activity || '').trim().toLowerCase() === 'medföljande gäst vuxen';
    }

    function isGuestChild(record) {
      return (record.activity || '').trim().toLowerCase() === 'medföljande gäst barn';
    }

    function getCeramicWeightForAllUsers() {
      return getCeramicRecordsForPeriod()
        .reduce((sum, record) => sum + (Number(record.weightKg) || 0), 0);
    }

    function getCeramicWeightForSelectedUser() {
      return getCeramicRecordsForPeriod()
        .filter(record => state.selectedUser === 'Alla' || record.member === state.selectedUser)
        .reduce((sum, record) => sum + (Number(record.weightKg) || 0), 0);
    }

    function formatCeramicWeight(totalKg) {
      return new Intl.NumberFormat('sv-SE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(totalKg);
    }

    function formatCurrency(amount) {
      return new Intl.NumberFormat('sv-SE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount) + ' kr';
    }

    function updateCeramicStat() {
      const selectedKg = getCeramicWeightForSelectedUser();

      // Översta kortet visar fortfarande totalsumman för aktuell användare/urval.
      document.getElementById('statCeramicTopLabel').textContent = 'Uthämtad keramik';
      document.getElementById('statCeramicWeightAll').textContent = `${formatCeramicWeight(selectedKg)} kg`;

      // Det nedre keramikkortet visar keramikvikt och gästaktiviteter per vald medlem.
      const list = document.getElementById('ceramicMemberList');
      list.innerHTML = '';

      const usersToShow = state.selectedUser === 'Alla'
        ? state.rightSideUsers
        : [state.selectedUser];

      const periodRecords = getRecordsForCeramicPeriod();

      usersToShow.forEach(user => {
        const userRecords = periodRecords.filter(record => record.member === user);
        const totalKg = userRecords
          .filter(isCeramicPickup)
          .reduce((sum, record) => sum + (Number(record.weightKg) || 0), 0);
        const guestCeramicKg = userRecords
          .filter(isGuestCeramicPickup)
          .reduce((sum, record) => sum + (Number(record.weightKg) || 0), 0);
        const adultGuests = userRecords.filter(isGuestAdult).length;
        const childGuests = userRecords.filter(isGuestChild).length;
        const invoiceTotal =
          totalKg * state.ceramicPricePerKg +
          guestCeramicKg * state.guestCeramicPricePerKg +
          adultGuests * state.adultGuestPrice +
          childGuests * state.childGuestPrice;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="ceramic-member-name">${user}</td>
          <td class="ceramic-number">${formatCeramicWeight(totalKg)} kg</td>
          <td class="ceramic-number">${formatCeramicWeight(guestCeramicKg)} kg</td>
          <td class="ceramic-number">${adultGuests}</td>
          <td class="ceramic-number">${childGuests}</td>
          <td class="ceramic-number">${formatCurrency(invoiceTotal)}</td>
        `;
        list.appendChild(row);
      });

      if (!usersToShow.length) {
        list.innerHTML = '<tr><td colspan="6" class="status-line">Inga valda medlemmar.</td></tr>';
      }
    }

    function getBlobBaseUrl() {
      return `https://${azureConfig.accountName}.blob.core.windows.net/${azureConfig.containerName}`;
    }

function getStatsForExport(records) {
  const rightSideRecords = records.filter(r => state.rightSideUsers.includes(r.member));
  const checkins = getCheckinRecords(rightSideRecords);
  const uniqueUsers = new Set(rightSideRecords.map(r => r.member)).size;
  const presenceDays = new Set(
    checkins.map(r => `${r.member}__${formatDateOnly(startOfDay(new Date(r.timestamp)))}`)
  ).size;

  return [
    { Nyckeltal: 'Totala aktiviteter', Varde: rightSideRecords.length },
    { Nyckeltal: 'Check-ins', Varde: checkins.length },
    { Nyckeltal: 'Unika användare', Varde: uniqueUsers },
    { Nyckeltal: 'Närvarodagar', Varde: presenceDays },
    { Nyckeltal: 'Vald period', Varde: state.period },
    { Nyckeltal: 'Vald användare', Varde: state.selectedUser },
    { Nyckeltal: 'Vald översikt', Varde: state.overview }
  ];
}

function getSummaryRowsForExport(records) {
  const chartData = buildSummaryChartData(records);
  return chartData.labels.map((label, index) => ({
    Etikett: label,
    Varde: chartData.datasets[0]?.data?.[index] ?? 0,
    Serie: chartData.datasets[0]?.label ?? ''
  }));
}

function getMonthOverviewRowsForExport(records) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const userForCalendar = state.selectedUser === 'Alla' ? 'Alla' : state.selectedUser;
  const counts = countCheckinsForUserByDay(records, userForCalendar);

  const rows = [];
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month, day);
    const key = formatDateOnly(date);
    rows.push({
      Datum: key,
      Anvandare: userForCalendar,
      Checkins: counts[key] || 0
    });
  }

  return rows;
}

function getYearOverviewRowsForExport(records) {
  const now = new Date();
  const year = now.getFullYear();
  const userForCalendar = state.selectedUser === 'Alla' ? 'Alla' : state.selectedUser;
  const counts = countCheckinsForUserByDay(records, userForCalendar);

  const rows = [];

  for (let month = 0; month < 12; month++) {
    const lastDay = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, month, day);
      const key = formatDateOnly(date);

      rows.push({
        Datum: key,
        Manad: new Date(year, month, 1).toLocaleDateString('sv-SE', { month: 'long' }),
        Anvandare: userForCalendar,
        Checkins: counts[key] || 0
      });
    }
  }

  return rows;
}

function autoFitColumns(worksheet, rows) {
  if (!rows || !rows.length) return;

  const keys = Object.keys(rows[0]);
  const colWidths = keys.map(key => ({
    wch: Math.max(
      key.length,
      ...rows.map(row => String(row[key] ?? '').length)
    ) + 2
  }));

  worksheet['!cols'] = colWidths;
}

function exportToExcel() {
  if (!state.rawRecords || !state.rawRecords.length) {
    alert('Det finns ingen data att exportera.');
    return;
  }

  const workbook = XLSX.utils.book_new();

  const allRows = state.rawRecords.map(record => ({
    Timestamp: formatDateTime(record.timestamp),
    TimestampISO: record.timestamp,
    Anvandare: record.member,
    Aktivitet: record.activity
  }));

  const filteredRecords = getFilteredRecords();

  const logRows = filteredRecords.map(record => ({
    Timestamp: formatDateTime(record.timestamp),
    TimestampISO: record.timestamp,
    Anvandare: record.member,
    Aktivitet: record.activity
  }));

  const statsRows = getStatsForExport(filteredRecords);
  const summaryRows = getSummaryRowsForExport(filteredRecords);

  const overviewRows =
    state.overview === 'month'
      ? getMonthOverviewRowsForExport(filteredRecords)
      : getYearOverviewRowsForExport(filteredRecords);

  const sheets = [
    { name: 'All data', rows: allRows },
    { name: 'Aktivitetslogg', rows: logRows },
    { name: 'Statistik', rows: statsRows },
    { name: 'Diagramdata', rows: summaryRows },
    { name: state.overview === 'month' ? 'Manadsoversikt' : 'Arsoversikt', rows: overviewRows }
  ];

  sheets.forEach(sheet => {
    const rows = sheet.rows.length ? sheet.rows : [{ Info: 'Ingen data' }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    autoFitColumns(worksheet, rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  const now = new Date();
  const fileStamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const fileName = `${adminConfig.exportFilePrefix || 'aktivitet-och-narvaro'}-${fileStamp}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}

    async function listJsonBlobs() {
      const { accountName, containerName, sasToken } = azureConfig;
      if (!accountName || !containerName || !sasToken || sasToken.includes('PASTA_IN')) {
        throw new Error('Azure-inställningar saknas. Lägg in en giltig SAS-token.');
      }

      const query = sasToken.replace(/^\?/, '');
      const url = `https://${accountName}.blob.core.windows.net/${containerName}?restype=container&comp=list&include=metadata&${query}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Kunde inte läsa från Azure (${response.status}).`);

      const xml = await response.text();
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const blobNodes = Array.from(doc.querySelectorAll('Blob'));

      return blobNodes
        .map(blob => ({
          name: blob.querySelector('Name')?.textContent || '',
          lastModified: blob.querySelector('Properties > Last-Modified')?.textContent || ''
        }))
        .filter(blob => blob.name.endsWith('.json'));
    }

    async function readJsonRecord(fileName) {
      const query = azureConfig.sasToken.replace(/^\?/, '');
      const url = `${getBlobBaseUrl()}/${encodeURIComponent(fileName)}?${query}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Kunde inte läsa ${fileName}`);
      return response.json();
    }

    async function loadActivities() {
      const files = await listJsonBlobs();
      const sortedFiles = files
        .slice()
        .sort((a, b) => {
          const ta = new Date(a.lastModified).getTime() || 0;
          const tb = new Date(b.lastModified).getTime() || 0;
          return tb - ta;
        });

      const recentFiles = sortedFiles.slice(0, 500).map(file => file.name);
      const records = await Promise.all(recentFiles.map(readJsonRecord));

      const cleaned = records
        .map((r, index) => ({
          ...r,
          blobFileName: recentFiles[index]
        }))
        .filter(r => r && r.member && r.timestamp)
        .filter(r => !hiddenActivities.includes(r.activity))
        .map(r => ({
          timestamp: r.timestamp,
          member: r.member,
          activity: r.activity || 'Okänd aktivitet',
          weightKg: Number(r.weightKg) || 0,
          eventDescription: r.eventDescription || '',
          blobFileName: r.blobFileName
        }))
        .filter(r => !Number.isNaN(new Date(r.timestamp).getTime()))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

state.rawRecords = cleaned;
state.lastLoadedAt = new Date();

      refreshConfiguredMembers();
      renderDashboard();
      setStatus('● Online');
    }

function populateUserSelect() {
  const select = document.getElementById('userSelect');
  const previous = state.selectedUser;
  select.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'Alla';
  allOption.textContent = 'Alla';
  select.appendChild(allOption);

  state.rightSideUsers.forEach(user => {
    const opt = document.createElement('option');
    opt.value = user;
    opt.textContent = user;
    select.appendChild(opt);
  });

  if ([...select.options].some(o => o.value === previous)) {
    select.value = previous;
  } else {
    select.value = 'Alla';
    state.selectedUser = 'Alla';
  }
}

    function getPeriodRange() {
      const now = new Date();
      const end = new Date(now);
      const start = new Date(now);

      if (state.period === '7d') {
        start.setDate(start.getDate() - 6);
        return { start: startOfDay(start), end };
      }

      if (state.period === '30d') {
        start.setDate(start.getDate() - 29);
        return { start: startOfDay(start), end };
      }

      if (state.period === 'month') {
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end
        };
      }

      return {
        start: new Date(now.getFullYear(), 0, 1),
        end
      };
    }

function getFilteredRecords() {
  const { start, end } = getPeriodRange();
  return state.rawRecords.filter(record => {
    const ts = new Date(record.timestamp);
    if (ts < start || ts > end) return false;

    if (state.selectedUser !== 'Alla' && record.member !== state.selectedUser) {
      return false;
    }

    return true;
  });
}

    function getCheckinRecords(records) {
      return records.filter(isCheckin);
    }

function buildSummaryChartData(records) {
  const checkins = getCheckinRecords(records).filter(
    record => state.rightSideUsers.includes(record.member)
  );

  if (state.selectedUser === 'Alla') {
    const daysPerUser = {};
    state.rightSideUsers.forEach(user => { daysPerUser[user] = new Set(); });

    checkins.forEach(record => {
      const dayKey = formatDateOnly(startOfDay(new Date(record.timestamp)));
      if (!daysPerUser[record.member]) daysPerUser[record.member] = new Set();
      daysPerUser[record.member].add(dayKey);
    });

    return {
      title: 'Närvarodagar per användare',
      labels: state.rightSideUsers,
      datasets: [{
        label: 'Närvarodagar',
        data: state.rightSideUsers.map(user => daysPerUser[user]?.size || 0),
        backgroundColor: state.rightSideUsers.map(user => getUserColor(user, 0.8)),
        borderColor: state.rightSideUsers.map(user => getUserColor(user, 1)),
        borderWidth: 1,
        borderRadius: 6
      }]
    };
  }

  const dailyCount = {};
  checkins
    .filter(record => record.member === state.selectedUser)
    .forEach(record => {
      const dayKey = formatDateOnly(startOfDay(new Date(record.timestamp)));
      dailyCount[dayKey] = (dailyCount[dayKey] || 0) + 1;
    });

  const labels = Object.keys(dailyCount).sort();
  return {
    title: `Check-ins för ${state.selectedUser}`,
    labels,
    datasets: [{
      label: 'Check-ins',
      data: labels.map(label => dailyCount[label]),
      backgroundColor: getUserColor(state.selectedUser, 0.8),
      borderColor: getUserColor(state.selectedUser, 1),
      borderWidth: 1,
      borderRadius: 6
    }]
  };
}

    async function deleteActivity(record, button) {
      if (!record.blobFileName) {
        alert('Aktiviteten saknar filreferens och kan därför inte tas bort.');
        return;
      }

      const confirmed = confirm(
        `Vill du permanent ta bort "${record.activity}" för ${record.member}\n` +
        `${formatDateTime(record.timestamp)}?\n\nDetta går inte att ångra.`
      );

      if (!confirmed) return;

      const originalText = button?.textContent || 'Ta bort';
      if (button) {
        button.disabled = true;
        button.textContent = 'Tar bort...';
      }

      try {
        const query = azureConfig.sasToken.replace(/^\?/, '');
        const url = `${getBlobBaseUrl()}/${encodeURIComponent(record.blobFileName)}?${query}`;

        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'x-ms-delete-snapshots': 'include'
          }
        });

        if (!response.ok) {
          throw new Error(`Kunde inte ta bort aktiviteten (${response.status}).`);
        }

        setStatus('Aktiviteten togs bort. Uppdaterar data...');
        await loadActivities();
      } catch (error) {
        console.error(error);
        setStatus(error.message || 'Kunde inte ta bort aktiviteten.', true);
        alert(error.message || 'Kunde inte ta bort aktiviteten.');
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    }

    function renderLogTable(records) {
      const tbody = document.getElementById('logTableBody');
      const logMeta = document.getElementById('logMeta');
      tbody.innerHTML = '';

      const topRecords = records.slice(0, 250);
      logMeta.textContent = `${topRecords.length} visade / ${records.length} träffar`;

      if (!topRecords.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="color:var(--muted);">Ingen data för valt urval.</td>`;
        tbody.appendChild(tr);
        return;
      }

      topRecords.forEach(record => {
        const tr = document.createElement('tr');
        const activityName = (record.activity || '').trim();
        const activityKey = activityName.toLowerCase();
        const activityText =
          activityKey === 'hämta ut keramik'
            ? `Hämtat ut keramik: ${Number(record.weightKg) || 0} kg`
            : activityKey === 'hämta ut keramik gäst'
              ? `Hämtat ut keramik gäst: ${Number(record.weightKg) || 0} kg`
              : activityKey === 'kalenderevent' && (record.eventDescription || '').trim()
              ? `Kalenderevent: ${(record.eventDescription || '').trim()}`
              : record.activity;

        tr.innerHTML = `
          <td>${formatDateTime(record.timestamp)}</td>
          <td><span class="user-pill">${record.member}</span></td>
          <td>${activityText}</td>
          <td><button class="delete-activity-btn" type="button">Ta bort</button></td>
        `;

        const deleteButton = tr.querySelector('.delete-activity-btn');
        deleteButton.addEventListener('click', () => deleteActivity(record, deleteButton));

        tbody.appendChild(tr);
      });
    }

function updateStats(records) {
  const rightSideRecords = records.filter(r => state.rightSideUsers.includes(r.member));
  const checkins = getCheckinRecords(rightSideRecords);
  const uniqueUsers = new Set(rightSideRecords.map(r => r.member)).size;
  const presenceDays = new Set(
    checkins.map(r => `${r.member}__${formatDateOnly(startOfDay(new Date(r.timestamp)))}`)
  ).size;

  document.getElementById('statActivities').textContent = rightSideRecords.length;
  document.getElementById('statCheckins').textContent = checkins.length;
  document.getElementById('statUsers').textContent = uniqueUsers;
  document.getElementById('statPresenceDays').textContent = presenceDays;
}

    function destroyCharts() {
      if (state.summaryChart) state.summaryChart.destroy();
    }

    function renderCharts(records) {
      destroyCharts();

      const summaryData = buildSummaryChartData(records);
      document.getElementById('barChartTitle').textContent = summaryData.title;

      state.summaryChart = new Chart(document.getElementById('summaryChart'), {
        type: 'bar',
        data: {
          labels: summaryData.labels,
          datasets: summaryData.datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: {
              labels: { color: '#dfe7ff' }
            }
          },
          scales: {
            x: {
              ticks: { color: '#c6d2ef' },
              grid: { color: 'rgba(255,255,255,.05)' }
            },
            y: {
              beginAtZero: true,
              ticks: { color: '#c6d2ef', precision: 0 },
              grid: { color: 'rgba(255,255,255,.08)' }
            }
          }
        }
      });
    }

function countCheckinsForUserByDay(records, user) {
  const result = {};
  const checkins = getCheckinRecords(records).filter(r => {
    if (!state.rightSideUsers.includes(r.member)) return false;
    if (user !== 'Alla' && r.member !== user) return false;
    return true;
  });

  checkins.forEach(record => {
    const date = new Date(record.timestamp);
    const key = formatDateOnly(startOfDay(date));
    result[key] = (result[key] || 0) + 1;
  });

  return result;
}

function getCheckinUsersByDay(records, user) {
  const result = {};
  const checkins = getCheckinRecords(records).filter(r => {
    if (!state.rightSideUsers.includes(r.member)) return false;
    if (user !== 'Alla' && r.member !== user) return false;
    return true;
  });

  checkins.forEach(record => {
    const key = formatDateOnly(startOfDay(new Date(record.timestamp)));
    if (!result[key]) result[key] = new Set();
    result[key].add(record.member);
  });

  return Object.fromEntries(
    Object.entries(result).map(([key, members]) => [
      key,
      [...members].sort((a, b) => a.localeCompare(b, 'sv'))
    ])
  );
}

    function getIntensityColor(count, maxCount) {
      if (!count) return '#18223a';
      const ratio = maxCount <= 0 ? 0 : count / maxCount;
      if (ratio < 0.25) return '#244b7a';
      if (ratio < 0.5) return '#2d6aa7';
      if (ratio < 0.75) return '#3d8fd9';
      return '#6dc0ff';
    }

    function renderMonthOverview(records) {
      const container = document.getElementById('overviewBody');
      const title = document.getElementById('overviewTitle');
      container.innerHTML = '';
      title.textContent = 'Närvaro';

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startWeekday = (firstDay.getDay() + 6) % 7;

      const userForCalendar = state.selectedUser === 'Alla' ? 'Alla' : state.selectedUser;
      const counts = countCheckinsForUserByDay(records, userForCalendar);
      const checkinUsers = getCheckinUsersByDay(records, userForCalendar);
      const maxCount = Math.max(0, ...Object.values(counts));

      const calendar = document.createElement('div');
      calendar.className = 'calendar-grid';

      const caption = document.createElement('div');
      caption.style.marginBottom = '8px';
      caption.style.color = '#dce6ff';
      caption.style.fontWeight = '600';
      caption.textContent = `${userForCalendar} — ${now.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}`;
      calendar.appendChild(caption);

      const header = document.createElement('div');
      header.className = 'calendar-header';
      ['Mån','Tis','Ons','Tor','Fre','Lör','Sön'].forEach(day => {
        const el = document.createElement('div');
        el.className = 'weekday';
        el.textContent = day;
        header.appendChild(el);
      });
      calendar.appendChild(header);

      const days = document.createElement('div');
      days.className = 'calendar-days';

      for (let i = 0; i < startWeekday; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell empty';
        days.appendChild(empty);
      }

      for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        const key = formatDateOnly(date);
        const count = counts[key] || 0;
        const users = checkinUsers[key] || [];

        const cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.style.background = getIntensityColor(count, maxCount);
        cell.title = count > 0
          ? `${key}: ${count} check-ins — ${users.join(', ')}`
          : `${key}: 0 check-ins`;
        cell.innerHTML = `
          <div class="day-top">
            <span class="day-number">${day}</span>
            <span class="day-count">${count > 0 ? count : ''}</span>
          </div>
          <div style="font-size:.76rem;color:#dce6ff;">${count ? 'check-ins' : ''}</div>
        `;
        days.appendChild(cell);
      }

      calendar.appendChild(days);

      const legend = document.createElement('div');
      legend.className = 'legend';
      legend.innerHTML = `
        <span>Färg = antal check-ins</span>
        <div class="legend-scale">
          <span>Låg</span>
          <span class="legend-box" style="background:#244b7a;"></span>
          <span class="legend-box" style="background:#2d6aa7;"></span>
          <span class="legend-box" style="background:#3d8fd9;"></span>
          <span class="legend-box" style="background:#6dc0ff;"></span>
          <span>Hög</span>
        </div>
      `;
      calendar.appendChild(legend);

      container.appendChild(calendar);
    }

    function renderYearOverview(records) {
      const container = document.getElementById('overviewBody');
      const title = document.getElementById('overviewTitle');
      container.innerHTML = '';
      title.textContent = 'Närvaro';

      const now = new Date();
      const year = now.getFullYear();
      const userForCalendar = state.selectedUser === 'Alla' ? 'Alla' : state.selectedUser;
      const counts = countCheckinsForUserByDay(records, userForCalendar);
      const checkinUsers = getCheckinUsersByDay(records, userForCalendar);
      const maxCount = Math.max(0, ...Object.values(counts));

      const titleEl = document.createElement('div');
      titleEl.style.marginBottom = '10px';
      titleEl.style.color = '#dce6ff';
      titleEl.style.fontWeight = '600';
      titleEl.textContent = `${userForCalendar} — ${year}`;
      container.appendChild(titleEl);

      const grid = document.createElement('div');
      grid.className = 'year-grid';

      for (let month = 0; month < 12; month++) {
        const box = document.createElement('div');
        box.className = 'month-box';

        const monthTitle = document.createElement('div');
        monthTitle.className = 'month-title';
        monthTitle.textContent = new Date(year, month, 1).toLocaleDateString('sv-SE', { month: 'long' });
        box.appendChild(monthTitle);

        const mini = document.createElement('div');
        mini.className = 'mini-days';

        const lastDay = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= 31; day++) {
          const cell = document.createElement('div');
          cell.className = 'mini-cell';

          if (day <= lastDay) {
            const key = formatDateOnly(new Date(year, month, day));
            const count = counts[key] || 0;
            const users = checkinUsers[key] || [];
            cell.style.background = getIntensityColor(count, maxCount);
            cell.title = count > 0
              ? `${key}: ${count} check-ins — ${users.join(', ')}`
              : `${key}: 0 check-ins`;
          } else {
            cell.style.opacity = '.18';
          }

          mini.appendChild(cell);
        }

        box.appendChild(mini);
        grid.appendChild(box);
      }

      container.appendChild(grid);

      const legend = document.createElement('div');
      legend.className = 'legend';
      legend.innerHTML = `
        <span>Årsheatmap</span>
        <div class="legend-scale">
          <span>Låg</span>
          <span class="legend-box" style="background:#244b7a;"></span>
          <span class="legend-box" style="background:#2d6aa7;"></span>
          <span class="legend-box" style="background:#3d8fd9;"></span>
          <span class="legend-box" style="background:#6dc0ff;"></span>
          <span>Hög</span>
        </div>
      `;
      container.appendChild(legend);
    }

    function renderOverview(records) {
      if (state.overview === 'month') {
        renderMonthOverview(records);
      } else {
        renderYearOverview(records);
      }
    }

    function renderDashboard() {
      const records = getFilteredRecords();
      renderLogTable(records);
      updateStats(records);
      updateCeramicStat();
      renderCharts(records);
      renderOverview(records);
    }

    function setStatus(message, isError = false) {
      const el = document.getElementById('statusLine');
      el.textContent = message;
      el.classList.toggle('error', isError);
    }

    function bindEvents() {
      document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state.period = btn.dataset.period;
          renderDashboard();
        });
      });

      document.querySelectorAll('.overview-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.overview = btn.dataset.overview;
          document.querySelectorAll('.overview-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.overview === state.overview);
          });
          renderDashboard();
        });

      document.getElementById('exportExcelBtn').addEventListener('click', () => {
  exportToExcel();
        });  
      });

      document.getElementById('ceramicStartDate').addEventListener('change', (e) => {
        state.ceramicStartDate = e.target.value;
        updateCeramicStat();
      });

      document.getElementById('ceramicEndDate').addEventListener('change', (e) => {
        state.ceramicEndDate = e.target.value;
        updateCeramicStat();
      });

      document.getElementById('ceramicPricePerKg').addEventListener('input', (e) => {
        state.ceramicPricePerKg = Math.max(0, Number(e.target.value) || 0);
        updateCeramicStat();
      });

      document.getElementById('guestCeramicPricePerKg').addEventListener('input', (e) => {
        state.guestCeramicPricePerKg = Math.max(0, Number(e.target.value) || 0);
        updateCeramicStat();
      });

      document.getElementById('adultGuestPrice').addEventListener('input', (e) => {
        state.adultGuestPrice = Math.max(0, Number(e.target.value) || 0);
        updateCeramicStat();
      });

      document.getElementById('childGuestPrice').addEventListener('input', (e) => {
        state.childGuestPrice = Math.max(0, Number(e.target.value) || 0);
        updateCeramicStat();
      });

      document.getElementById('userSelect').addEventListener('change', (e) => {
        state.selectedUser = e.target.value;
        renderDashboard();
      });

      document.getElementById('addMemberBtn').addEventListener('click', addMember);
      document.getElementById('newMemberName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addMember();
      });
      document.getElementById('saveMembersCsvBtn').addEventListener('click', saveMembersToAzure);

      document.getElementById('addActivityBtn').addEventListener('click', addActivity);
      document.getElementById('newActivityName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addActivity();
      });
      document.getElementById('saveActivitiesCsvBtn').addEventListener('click', saveActivitiesToAzure);
    }

    async function init() {
      setDefaultCeramicPeriod();
      bindEvents();

      try {
        await loadMembers();
        await loadConfiguredActivities();
        await loadActivities();
      } catch (error) {
        console.error(error);
        setStatus('● Offline', true);
        setMembersStatus(error.message || 'Kunde inte läsa medlemsfilen.', true);
        setActivitiesStatus(error.message || 'Kunde inte läsa aktivitetsfilen.', true);
      }

      setInterval(async () => {
        try {
          await loadActivities();
        } catch (error) {
          console.error(error);
          setStatus('● Offline', true);
        }
      }, pollIntervalMs);
    }

    init();
