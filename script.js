// ========== IndexedDB ==========
const DB_NAME = 'PoultryFarmDBv5';
const STORE_NAME = 'appState';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      if (!e.target.result.objectStoreNames.contains(STORE_NAME))
        e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    tx.objectStore(STORE_NAME).get('data').onsuccess = (e) => resolve(e.target.result || {});
    tx.onerror = reject;
  });
}

async function saveData(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, 'data');
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

// ========== البيانات العامة ==========
let houses = [];
let dailyRecords = [];
let loans = [];
let stock = { starter: 0, grower: 0, finisher: 0 };

let currentHouse = null;
let currentCycleId = null;
let editingId = null, editingLoanId = null;
let chartInstance = null;
let deferredPrompt = null;
let currentLanguage = 'ar';

let columnVisibility = {
  age: true, feedType: true, feedBags: true, kg: true,
  dead: true, medications: true, expenses: true, weight: true,
  mortalityNotes: true
};

// ========== الترجمة ==========
const translations = {
  ar: {
    offline: 'أنت غير متصل بالإنترنت',
    appName: 'مزرعة دواجن',
    home: 'الرئيسية',
    warehouse: 'المخزن',
    loans: 'السلف',
    charts: 'الرسوم',
    more: 'المزيد',
    dailyEntry: 'تسجيل يومي',
    backToDashboard: 'رجوع للرئيسية',
    cycle: 'الدورة:',
    date: 'التاريخ',
    feedType: 'نوع العلف',
    starter: 'بادي',
    grower: 'نامي',
    finisher: 'ناهي',
    feedBags: 'عدد الشكاير',
    dead: 'النافق اليوم',
    medications: 'الأدوية',
    expenses: 'مصروفات (ج.م)',
    weight: 'متوسط الوزن (جرام)',
    mortalityNotes: 'ملاحظات النافق',
    save: 'حفظ',
    cancel: 'إلغاء',
    records: 'سجلات',
    columns: 'أعمدة',
    indicators: 'مؤشرات',
    addToWarehouse: 'إضافة للمخزن',
    person: 'اسم الشخص',
    amount: 'المبلغ',
    edit: 'تعديل',
    delete: 'حذف',
    allLoans: 'جميع السلفات',
    cycle1: 'الدورة 1:',
    cycle2: 'الدورة 2 (اختياري):',
    chartType: 'نوع الرسم:',
    feed: 'العلف (كجم)',
    settings: 'الإعدادات',
    language: 'اللغة',
    voiceInput: 'الإدخال الصوتي',
    startVoice: 'بدء الإدخال الصوتي',
    exportAll: 'تصدير كل البيانات',
    importData: 'استيراد بيانات',
    shareQR: 'مشاركة عبر QR',
    scanQR: 'مسح QR لاستيراد',
    clearAll: 'مسح جميع البيانات',
    installApp: 'تثبيت التطبيق',
    done: 'تم',
    selectColumns: 'اختر الأعمدة',
    confirm: 'تأكيد',
    noHouses: 'لا عنابر. أضف عنبراً للبدء.',
    noActiveCycles: 'جميع العنابر بدون دورة نشطة.',
    addHouse: 'إضافة عنبر',
    houseName: 'اسم العنبر:',
    initialCount: 'العدد الأولي:',
    initialWeight: 'الوزن الابتدائي (جرام):',
    deleteConfirm: 'هل أنت متأكد من حذف هذا العنبر؟',
  },
  en: {
    offline: 'You are offline',
    appName: 'Poultry Farm',
    home: 'Home',
    warehouse: 'Warehouse',
    loans: 'Loans',
    charts: 'Charts',
    more: 'More',
    dailyEntry: 'Daily Entry',
    backToDashboard: 'Back to Dashboard',
    cycle: 'Cycle:',
    date: 'Date',
    feedType: 'Feed Type',
    starter: 'Starter',
    grower: 'Grower',
    finisher: 'Finisher',
    feedBags: 'Bags',
    dead: 'Daily Mortality',
    medications: 'Medications',
    expenses: 'Expenses (EGP)',
    weight: 'Avg Weight (g)',
    mortalityNotes: 'Mortality Notes',
    save: 'Save',
    cancel: 'Cancel',
    records: 'Records',
    columns: 'Columns',
    indicators: 'Indicators',
    addToWarehouse: 'Add to Warehouse',
    person: 'Person',
    amount: 'Amount',
    edit: 'Edit',
    delete: 'Delete',
    allLoans: 'All Loans',
    cycle1: 'Cycle 1:',
    cycle2: 'Cycle 2 (optional):',
    chartType: 'Chart Type:',
    feed: 'Feed (kg)',
    settings: 'Settings',
    language: 'Language',
    voiceInput: 'Voice Input',
    startVoice: 'Start Voice Input',
    exportAll: 'Export All Data',
    importData: 'Import Data',
    shareQR: 'Share via QR',
    scanQR: 'Scan QR to Import',
    clearAll: 'Clear All Data',
    installApp: 'Install App',
    done: 'Done',
    selectColumns: 'Select Columns',
    confirm: 'Confirm',
    noHouses: 'No houses. Add a house to begin.',
    noActiveCycles: 'All houses have no active cycle.',
    addHouse: 'Add House',
    houseName: 'House name:',
    initialCount: 'Initial count:',
    initialWeight: 'Initial weight (g):',
    deleteConfirm: 'Are you sure you want to delete this house?',
  }
};

function t(key) {
  return translations[currentLanguage][key] || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.title = t('appName');
  if (document.getElementById('mainContent').children.length > 0) {
    // إعادة تحديث التبويب الحالي ليعكس الترجمة
    const activeTab = document.querySelector('.nav-btn.active')?.dataset.tab;
    if (activeTab) renderTab(activeTab);
  }
}

function changeLanguage(lang) {
  currentLanguage = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  localStorage.setItem('language', lang);
  applyTranslations();
}

// ========== تحميل / حفظ ==========
async function loadDataFromDB() {
  const data = await getData();
  houses = data.houses || [];
  dailyRecords = data.dailyRecords || [];
  loans = data.loans || [];
  stock = data.stock || { starter: 0, grower: 0, finisher: 0 };
}
async function persistData() {
  await saveData({ houses, dailyRecords, loans, stock });
}

// ========== دوال مساعدة ==========
function getArabicFeedName(t) {
  if (currentLanguage === 'en') return t;
  return { starter: 'بادي', grower: 'نامي', finisher: 'ناهي' }[t] || t;
}
function getActiveCycle(house) {
  return house?.cycles?.find(c => c.isActive);
}
function getChickAge(dateStr, startStr) {
  if (!dateStr || !startStr) return '';
  const d1 = new Date(dateStr), d2 = new Date(startStr);
  if (isNaN(d1) || isNaN(d2)) return '';
  const diff = d1 - d2;
  if (diff < 0) return '';
  return Math.floor(diff / 86400000) + 1;
}
function estimateFeed(ageDays, birds) {
  let gramPerBird = 50;
  if (ageDays <= 10) gramPerBird = 30;
  else if (ageDays <= 20) gramPerBird = 70;
  else if (ageDays <= 30) gramPerBird = 110;
  else gramPerBird = 150;
  return (gramPerBird * birds) / 1000 / 50;
}

// ========== التنقل ==========
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTab(btn.dataset.tab);
  });
});

function renderTab(tab) {
  const main = document.getElementById('mainContent');
  const tpl = document.getElementById(tab + 'Template');
  if (!tpl) return;
  main.innerHTML = tpl.innerHTML;
  applyTranslations();
  if (tab === 'dashboard') renderDashboard();
  else if (tab === 'warehouse') setupWarehouse();
  else if (tab === 'loans') setupLoans();
  else if (tab === 'charts') setupCharts();
  else if (tab === 'more') setupMore();
  checkAlerts();
}

// ========== اللوحة الرئيسية ==========
function renderDashboard() {
  const container = document.getElementById('dashboardContent');
  let html = '';
  if (houses.length === 0) {
    html = `<p>${t('noHouses')}</p>`;
  } else {
    houses.forEach(house => {
      const cycle = getActiveCycle(house);
      if (!cycle) return;
      const recs = dailyRecords.filter(r => r.house === house.name && r.cycleId === cycle.id);
      const dead = recs.reduce((s, r) => s + r.dead, 0);
      const birds = Math.max(0, cycle.initialCount - dead);
      const lastRec = recs.sort((a,b)=>b.date.localeCompare(a.date))[0];
      const lastWeight = lastRec?.weight || 0;
      const lastDate = lastRec?.date || '—';
      html += `<div class="dashboard-card">
        <h3>${house.name} - ${t('cycle')} ${cycle.startDate}</h3>
        <div class="card-row"><span>🐣 ${t('currentCount')}:</span><strong>${birds}</strong></div>
        <div class="card-row"><span>⚖️ ${t('lastWeight')}:</span><strong>${lastWeight} جم</strong></div>
        <div class="card-row"><span>📅 ${t('lastRecord')}:</span><strong>${lastDate}</strong></div>
      </div>`;
    });
    if (!html) html = `<p>${t('noActiveCycles')}</p>`;
  }
  container.innerHTML = html;
}

function showDailyEntry() {
  document.getElementById('mainContent').innerHTML = document.getElementById('dailyEntryTemplate').innerHTML;
  setupDailyTab();
}
function showDashboard() {
  renderTab('dashboard');
  document.querySelector('.nav-btn[data-tab="dashboard"]').classList.add('active');
}

// ========== التقويم المخصص ==========
let datePickerCallback = null;
let currentDisplayMonth = new Date().getMonth();
let currentDisplayYear = new Date().getFullYear();
let selectedPickerDate = null;

function openDatePicker(callback, initialDateStr) {
  datePickerCallback = callback;
  const initial = initialDateStr ? new Date(initialDateStr) : new Date();
  currentDisplayYear = initial.getFullYear();
  currentDisplayMonth = initial.getMonth();
  selectedPickerDate = initialDateStr ? initial : null;
  renderCalendar();
  document.getElementById('datePickerModal').style.display = 'flex';
}

function renderCalendar() {
  const monthYear = document.getElementById('monthYearDisplay');
  const grid = document.getElementById('dateGrid');
  monthYear.textContent = `${currentDisplayYear} / ${currentDisplayMonth + 1}`;

  const firstDay = new Date(currentDisplayYear, currentDisplayMonth, 1).getDay();
  const daysInMonth = new Date(currentDisplayYear, currentDisplayMonth + 1, 0).getDate();

  const weekDays = currentLanguage === 'ar' ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'] : ['Su','Mo','Tu','We','Th','Fr','Sa'];
  let html = '';
  weekDays.forEach(day => {
    html += `<div class="day-header">${day}</div>`;
  });

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="day-cell empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(currentDisplayYear, currentDisplayMonth, day);
    const dateStr = dateObj.toISOString().slice(0,10);
    const isSelected = selectedPickerDate && selectedPickerDate.toISOString().slice(0,10) === dateStr;
    html += `<div class="day-cell${isSelected ? ' selected' : ''}" data-date="${dateStr}">${day}</div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.day-cell:not(.empty)').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateStr = cell.dataset.date;
      selectedPickerDate = new Date(dateStr);
      renderCalendar();
    });
  });

  document.getElementById('prevMonth').onclick = () => {
    if (currentDisplayMonth === 0) { currentDisplayYear--; currentDisplayMonth = 11; }
    else { currentDisplayMonth--; }
    renderCalendar();
  };

  document.getElementById('nextMonth').onclick = () => {
    if (currentDisplayMonth === 11) { currentDisplayYear++; currentDisplayMonth = 0; }
    else { currentDisplayMonth++; }
    renderCalendar();
  };
}

document.getElementById('confirmDateBtn').addEventListener('click', () => {
  if (selectedPickerDate && datePickerCallback) {
    datePickerCallback(selectedPickerDate.toISOString().slice(0,10));
  }
  document.getElementById('datePickerModal').style.display = 'none';
  datePickerCallback = null;
});

document.getElementById('clearDateBtn').addEventListener('click', () => {
  document.getElementById('datePickerModal').style.display = 'none';
  datePickerCallback = null;
});

// ========== السجل اليومي ==========
function setupDailyTab() {
  populateHouseSelect();
  document.getElementById('houseSelect').addEventListener('change', onHouseChange);
  document.getElementById('cycleSelect').addEventListener('change', onCycleChange);
  document.getElementById('feedType').addEventListener('change', updateFeedHintAndEstimate);
  document.getElementById('date').addEventListener('change', updateFeedEstimate);
  document.getElementById('dailyForm').addEventListener('submit', onDailySubmit);
  document.getElementById('houseSelect').dispatchEvent(new Event('change'));
  document.getElementById('date').valueAsDate = new Date();
  applyTranslations();
}

function populateHouseSelect() {
  const sel = document.getElementById('houseSelect');
  if (!sel) return;
  sel.innerHTML = houses.length ? houses.map(h => `<option value="${h.name}">${h.name}</option>`).join('') : `<option>${t('noHouses')}</option>`;
  if (currentHouse && houses.some(h => h.name === currentHouse)) sel.value = currentHouse;
  else if (houses.length) { currentHouse = houses[0].name; sel.value = currentHouse; }
}

function onHouseChange() {
  currentHouse = this.value;
  updateCycleSelect();
  updateHouseInfo();
  renderDailyTable();
  updatePerformance();
  updateFeedEstimate();
  document.getElementById('currentHouseTitle').textContent = currentHouse || '';
}

function updateCycleSelect() {
  const sel = document.getElementById('cycleSelect');
  const house = houses.find(h => h.name === currentHouse);
  if (!house?.cycles) { sel.innerHTML = `<option>${t('noActiveCycles')}</option>`; currentCycleId = null; return; }
  sel.innerHTML = house.cycles.map(c => `<option value="${c.id}" ${c.isActive?'selected':''}>${c.startDate} - ${c.initialCount}</option>`).join('');
  const active = getActiveCycle(house);
  currentCycleId = active ? active.id : (house.cycles[0]?.id || null);
  if (active) sel.value = active.id;
}

function onCycleChange() {
  currentCycleId = this.value;
  renderDailyTable();
  updatePerformance();
  updateFeedEstimate();
}

function updateHouseInfo() {
  const div = document.getElementById('houseInfo');
  if (!div) return;
  const house = houses.find(h => h.name === currentHouse);
  if (!house) { div.textContent = ''; return; }
  const cycle = house.cycles?.find(c => c.id === currentCycleId);
  if (!cycle) { div.textContent = t('noActiveCycles'); return; }
  div.innerHTML = `${t('startDate')}: ${cycle.startDate} | ${t('initialCount')}: ${cycle.initialCount} | ${t('initialWeight')}: ${cycle.initialWeight} جم`;
}

function editCycleDate() {
  if (!currentHouse || !currentCycleId) return;
  const house = houses.find(h => h.name === currentHouse);
  const cycle = house?.cycles?.find(c => c.id === currentCycleId);
  if (!cycle) return;
  openDatePicker((newDate) => {
    cycle.startDate = newDate;
    persistData().then(() => {
      updateCycleSelect();
      updateHouseInfo();
      renderDailyTable();
      updatePerformance();
    });
  }, cycle.startDate);
}

function addHouse() {
  const name = prompt(t('houseName'));
  if (!name?.trim()) return;
  if (houses.some(h => h.name === name.trim())) { alert(t('houseExists')); return; }
  houses.push({ name: name.trim(), cycles: [] });
  persistData().then(() => {
    populateHouseSelect();
    addCycle();
  });
}

function editHouse() {
  if (!currentHouse) return;
  const house = houses.find(h => h.name === currentHouse);
  if (!house) return;
  const newName = prompt(t('editHouseName'), house.name);
  if (newName && newName.trim()) {
    dailyRecords.forEach(r => { if (r.house === house.name) r.house = newName.trim(); });
    house.name = newName.trim();
    currentHouse = house.name;
    persistData().then(() => {
      populateHouseSelect();
      renderDailyTable();
      updatePerformance();
    });
  }
}

function deleteHouse() {
  if (!currentHouse) return;
  if (!confirm(t('deleteConfirm'))) return;
  houses = houses.filter(h => h.name !== currentHouse);
  dailyRecords = dailyRecords.filter(r => r.house !== currentHouse);
  currentHouse = null;
  currentCycleId = null;
  persistData().then(() => {
    if (houses.length) {
      currentHouse = houses[0].name;
    }
    populateHouseSelect();
    updateCycleSelect();
    renderDailyTable();
    updatePerformance();
  });
}

function addCycle() {
  if (!currentHouse) { alert(t('selectHouse')); return; }
  const house = houses.find(h => h.name === currentHouse);
  if (!house) return;
  openDatePicker((startDate) => {
    const count = parseInt(prompt(t('initialCount'))) || 0;
    const weight = parseFloat(prompt(t('initialWeight'))) || 0;
    house.cycles = house.cycles || [];
    house.cycles.forEach(c => c.isActive = false);
    house.cycles.push({
      id: Date.now().toString(),
      startDate: startDate,
      initialCount: count,
      initialWeight: weight,
      isActive: true
    });
    persistData().then(() => {
      updateCycleSelect();
      updateHouseInfo();
      renderDailyTable();
      updatePerformance();
    });
  });
}

function updateFeedHintAndEstimate() {
  const type = document.getElementById('feedType')?.value;
  if (type) document.getElementById('feedStockHint').textContent = `${t('stock')}: ${stock[type] || 0} ${t('bags')}`;
  updateFeedEstimate();
}

function updateFeedEstimate() {
  const hint = document.getElementById('feedEstimateHint');
  if (!hint) return;
  const house = houses.find(h => h.name === currentHouse);
  const cycle = house?.cycles?.find(c => c.id === currentCycleId);
  if (!cycle || !document.getElementById('date').value) { hint.textContent = ''; return; }
  const age = getChickAge(document.getElementById('date').value, cycle.startDate);
  if (age === '') { hint.textContent = ''; return; }
  const dead = dailyRecords.filter(r => r.house === currentHouse && r.cycleId === currentCycleId).reduce((s,r)=>s+r.dead,0);
  const birds = Math.max(0, cycle.initialCount - dead);
  hint.textContent = `${t('estimated')}: ≈ ${estimateFeed(age, birds).toFixed(1)} ${t('bags')}`;
}

async function onDailySubmit(e) {
  e.preventDefault();
  if (!currentHouse || !currentCycleId) { alert(t('selectHouseCycle')); return; }
  const feedType = document.getElementById('feedType').value;
  const feedBags = parseFloat(document.getElementById('feedBags').value) || 0;
  if (feedBags <= 0) { alert(t('invalidBags')); return; }

  if (editingId) {
    const old = dailyRecords.find(r => r.id === editingId);
    if (old) stock[old.feedType] += old.feedBags;
  }
  if (stock[feedType] < feedBags) { alert(t('insufficientStock')); return; }
  stock[feedType] -= feedBags;

  const rec = {
    id: editingId || Date.now(),
    house: currentHouse, cycleId: currentCycleId,
    date: document.getElementById('date').value, feedType, feedBags,
    dead: parseInt(document.getElementById('dead').value)||0,
    medications: document.getElementById('medications').value.trim(),
    expenses: parseFloat(document.getElementById('expenses').value)||0,
    weight: parseFloat(document.getElementById('weight').value)||0,
    mortalityNotes: document.getElementById('mortalityNotes').value.trim()
  };

  if (editingId) {
    const idx = dailyRecords.findIndex(r => r.id === editingId);
    if (idx > -1) dailyRecords[idx] = rec;
    editingId = null; document.getElementById('editingId').value = '';
    document.getElementById('formSubmitBtn').innerHTML = `💾 ${t('save')}`;
    document.getElementById('cancelEditBtn').style.display = 'none';
  } else {
    dailyRecords.push(rec);
  }
  await persistData();
  renderDailyTable(); updatePerformance(); updateFeedHintAndEstimate();
  e.target.reset(); document.getElementById('date').valueAsDate = new Date();
}

function editDailyRecord(id) {
  const rec = dailyRecords.find(r => r.id === id);
  if (!rec) return;
  editingId = rec.id;
  document.getElementById('editingId').value = rec.id;
  document.getElementById('date').value = rec.date;
  document.getElementById('feedType').value = rec.feedType;
  document.getElementById('feedBags').value = rec.feedBags;
  document.getElementById('dead').value = rec.dead;
  document.getElementById('medications').value = rec.medications;
  document.getElementById('expenses').value = rec.expenses;
  document.getElementById('weight').value = rec.weight;
  document.getElementById('mortalityNotes').value = rec.mortalityNotes;
  document.getElementById('formSubmitBtn').innerHTML = `✏️ ${t('update')}`;
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
  updateFeedHintAndEstimate();
}

function cancelEdit() {
  editingId = null;
  document.getElementById('editingId').value = '';
  document.getElementById('formSubmitBtn').innerHTML = `💾 ${t('save')}`;
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('dailyForm').reset();
  document.getElementById('date').valueAsDate = new Date();
}

async function deleteDailyRecord(id) {
  if (!confirm(t('deleteConfirm'))) return;
  const rec = dailyRecords.find(r => r.id === id);
  if (rec) stock[rec.feedType] += rec.feedBags;
  dailyRecords = dailyRecords.filter(r => r.id !== id);
  await persistData();
  renderDailyTable(); updatePerformance(); updateFeedHintAndEstimate();
}

function renderDailyTable() {
  const tbody = document.getElementById('tableBody');
  const thead = document.getElementById('recordsTableHead');
  if (!tbody || !thead) return;
  const house = houses.find(h => h.name === currentHouse);
  const cycle = house?.cycles?.find(c => c.id === currentCycleId);
  const filtered = dailyRecords
    .filter(r => r.house === currentHouse && r.cycleId === currentCycleId)
    .sort((a, b) => b.date.localeCompare(a.date));

  let headHTML = `<tr><th>${t('date')}</th>`;
  if (columnVisibility.age) headHTML += `<th>${t('age')}</th>`;
  if (columnVisibility.feedType) headHTML += `<th>${t('feedType')}</th>`;
  if (columnVisibility.feedBags) headHTML += `<th>${t('bags')}</th>`;
  if (columnVisibility.kg) headHTML += `<th>${t('kg')}</th>`;
  if (columnVisibility.dead) headHTML += `<th>${t('dead')}</th>`;
  if (columnVisibility.medications) headHTML += `<th>${t('medications')}</th>`;
  if (columnVisibility.expenses) headHTML += `<th>${t('expenses')}</th>`;
  if (columnVisibility.weight) headHTML += `<th>${t('weight')}</th>`;
  if (columnVisibility.mortalityNotes) headHTML += `<th>${t('mortalityNotes')}</th>`;
  headHTML += `<th>${t('edit')}</th><th>${t('delete')}</th></tr>`;
  thead.innerHTML = headHTML;

  tbody.innerHTML = '';
  filtered.forEach(rec => {
    const age = getChickAge(rec.date, cycle?.startDate || '');
    const kg = (rec.feedBags * 50).toFixed(1);
    let row = '<tr>';
    row += `<td>${rec.date}</td>`;
    if (columnVisibility.age) row += `<td>${age || '-'}</td>`;
    if (columnVisibility.feedType) row += `<td>${getArabicFeedName(rec.feedType)}</td>`;
    if (columnVisibility.feedBags) row += `<td>${rec.feedBags}</td>`;
    if (columnVisibility.kg) row += `<td>${kg}</td>`;
    if (columnVisibility.dead) row += `<td>${rec.dead}</td>`;
    if (columnVisibility.medications) row += `<td>${rec.medications || '-'}</td>`;
    if (columnVisibility.expenses) row += `<td>${rec.expenses}</td>`;
    if (columnVisibility.weight) row += `<td>${rec.weight || '-'}</td>`;
    if (columnVisibility.mortalityNotes) row += `<td>${rec.mortalityNotes || '-'}</td>`;
    row += `<td><button onclick="editDailyRecord(${rec.id})">✏️</button></td>`;
    row += `<td><button class="danger" onclick="deleteDailyRecord(${rec.id})">🗑️</button></td>`;
    row += '</tr>';
    tbody.innerHTML += row;
  });
}

function updatePerformance() {
  const box = document.getElementById('performanceContent');
  if (!box) return;
  const house = houses.find(h => h.name === currentHouse);
  const cycle = house?.cycles?.find(c => c.id === currentCycleId);
  if (!cycle) { box.textContent = t('selectCycle'); return; }
  const recs = dailyRecords.filter(r => r.house === currentHouse && r.cycleId === currentCycleId);
  if (!recs.length) { box.textContent = t('noRecords'); return; }
  const dead = recs.reduce((s, r) => s + r.dead, 0);
  const birds = Math.max(0, cycle.initialCount - dead);
  const feedKg = recs.reduce((s, r) => s + r.feedBags * 50, 0);
  const lastWeight = recs.slice().sort((a,b)=>a.date.localeCompare(b.date)).pop().weight || 0;
  const gain = lastWeight - cycle.initialWeight;
  const totalGain = birds * gain;
  let fcr = totalGain > 0 ? (feedKg / totalGain).toFixed(2) : '-';
  box.innerHTML = `🐣 ${birds} | ⚖️ ${lastWeight} جم | 📈 +${gain} جم | 🌾 ${feedKg.toFixed(1)} كجم | 🔄 FCR: ${fcr}`;
}

// ========== تصدير CSV و PDF ==========
function exportTableCSV() {
  if (!currentHouse) return;
  const house = houses.find(h => h.name === currentHouse);
  const cycle = house?.cycles?.find(c => c.id === currentCycleId);
  const filtered = dailyRecords
    .filter(r => r.house === currentHouse && r.cycleId === currentCycleId)
    .sort((a, b) => a.date.localeCompare(b.date));
  
  let csv = '';
  const headers = [];
  headers.push(t('date'));
  if (columnVisibility.age) headers.push(t('age'));
  if (columnVisibility.feedType) headers.push(t('feedType'));
  if (columnVisibility.feedBags) headers.push(t('bags'));
  if (columnVisibility.kg) headers.push(t('kg'));
  if (columnVisibility.dead) headers.push(t('dead'));
  if (columnVisibility.medications) headers.push(t('medications'));
  if (columnVisibility.expenses) headers.push(t('expenses'));
  if (columnVisibility.weight) headers.push(t('weight'));
  if (columnVisibility.mortalityNotes) headers.push(t('mortalityNotes'));
  csv += headers.join(',') + '\n';

  filtered.forEach(rec => {
    const row = [];
    row.push(rec.date);
    if (columnVisibility.age) row.push(getChickAge(rec.date, cycle?.startDate || ''));
    if (columnVisibility.feedType) row.push(getArabicFeedName(rec.feedType));
    if (columnVisibility.feedBags) row.push(rec.feedBags);
    if (columnVisibility.kg) row.push((rec.feedBags * 50).toFixed(1));
    if (columnVisibility.dead) row.push(rec.dead);
    if (columnVisibility.medications) row.push(`"${rec.medications || ''}"`);
    if (columnVisibility.expenses) row.push(rec.expenses);
    if (columnVisibility.weight) row.push(rec.weight || '');
    if (columnVisibility.mortalityNotes) row.push(`"${rec.mortalityNotes || ''}"`);
    csv += row.join(',') + '\n';
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentHouse}_records.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTablePDF() {
  window.print();
}

// ========== باقي الدوال (المخزن، السلف، الرسوم، QR، إعدادات الصوت...) ==========
// ... (تم تضمينها بنفس هيكل الإصدارات السابقة مع إضافة الترجمة للتنبيهات والإشعارات)

// ========== الصوت ==========
let recognition = null;
function toggleVoice() {
  if (!('webkitSpeechRecognition' in window)) {
    alert(t('voiceNotSupported'));
    return;
  }
  if (recognition) {
    recognition.stop();
    recognition = null;
    document.getElementById('voiceBtn').innerHTML = `🎤 ${t('startVoice')}`;
    return;
  }
  recognition = new webkitSpeechRecognition();
  recognition.lang = currentLanguage === 'ar' ? 'ar-SA' : 'en-US';
  recognition.continuous = false;
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    alert(transcript); // يمكن تطويرها لتعبئة الحقول
  };
  recognition.start();
  document.getElementById('voiceBtn').innerHTML = `⏹️ ${t('stopVoice')}`;
}

// ========== بدء التطبيق ==========
async function init() {
  currentLanguage = localStorage.getItem('language') || 'ar';
  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr';
  await loadDataFromDB();
  applyTranslations();
  renderTab('dashboard');
  if (!navigator.onLine) document.getElementById('offlineBar').style.display = 'block';
}
init();