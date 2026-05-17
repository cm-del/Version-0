// ========== IndexedDB ==========
const DB_NAME = 'PoultryFarmDBv3';
const DB_VERSION = 1;
const STORE_NAME = 'appState';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get('data');
    req.onsuccess = () => resolve(req.result || {});
    req.onerror = reject;
  });
}

async function saveData(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(data, 'data');
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

// ========== البيانات العامة ==========
let houses = [];            // { name, cycles: [{ id, startDate, initialCount, initialWeight, isActive }] }
let dailyRecords = [];     // { id, house, cycleId, date, feedType, feedBags, dead, medications, expenses, weight, mortalityNotes }
let loans = [];
let stock = { starter: 0, grower: 0, finisher: 0 };

let currentHouse = null;
let currentCycleId = null;
let editingId = null;
let editingLoanId = null;
let chartInstance = null;
let deferredPrompt = null;

// إعدادات الأعمدة (حالة الظهور)
let columnVisibility = {
  age: true, feedType: true, feedBags: true, kg: true,
  dead: true, medications: true, expenses: true, weight: true,
  mortalityNotes: true
};

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
  return { starter: 'بادي', grower: 'نامي', finisher: 'ناهي' }[t] || t;
}

function getActiveCycle(house) {
  return house.cycles?.find(c => c.isActive);
}

// ========== التبويبات والتنقل ==========
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    renderTab(tab);
  });
});

function renderTab(tab) {
  const main = document.getElementById('mainContent');
  const tpl = document.getElementById(tab + 'Template');
  if (!tpl) return;
  main.innerHTML = tpl.innerHTML;
  if (tab === 'daily') setupDailyTab();
  else if (tab === 'warehouse') setupWarehouseTab();
  else if (tab === 'loans') setupLoansTab();
  else if (tab === 'charts') setupChartsTab();
  else if (tab === 'more') setupMoreTab();
  checkAlerts();
}

// ========== إعداد التبويبات ==========
function setupDailyTab() {
  populateHouseSelect();
  document.getElementById('houseSelect').addEventListener('change', onHouseChange);
  document.getElementById('cycleSelect')?.addEventListener('change', onCycleChange);
  document.getElementById('feedType').addEventListener('change', updateFeedHintAndEstimate);
  document.getElementById('dailyForm').addEventListener('submit', onDailySubmit);
  document.getElementById('date').addEventListener('change', updateFeedEstimate);
  document.getElementById('houseSelect').dispatchEvent(new Event('change'));
  updateFeedHintAndEstimate();
  document.getElementById('date').valueAsDate = new Date();
}

function setupWarehouseTab() {
  renderWarehouse();
  document.getElementById('warehouseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('whType').value;
    const bags = parseFloat(document.getElementById('whBags').value) || 0;
    if (bags <= 0) return;
    stock[type] += bags;
    await persistData();
    renderWarehouse();
    e.target.reset();
    document.getElementById('whBags').value = 1;
    checkAlerts();
  });
}

function setupLoansTab() {
  document.getElementById('loanForm').addEventListener('submit', onLoanSubmit);
  renderLoansTable();
  document.getElementById('loanDate').valueAsDate = new Date();
}

function setupChartsTab() {
  const container = document.getElementById('chartHouseCheckboxes');
  container.innerHTML = '';
  houses.forEach(h => {
    container.innerHTML += `<label><input type="checkbox" class="chart-house-cb" value="${h.name}" checked> ${h.name}</label>`;
  });
  document.getElementById('chartType').addEventListener('change', drawChart);
  document.querySelectorAll('.chart-house-cb').forEach(cb => cb.addEventListener('change', drawChart));
  drawChart();
}

function setupMoreTab() {
  document.getElementById('installBtn').style.display = deferredPrompt ? 'block' : 'none';
  document.getElementById('importFile').addEventListener('change', importAllData);
}

// ========== العنابر والدورات ==========
function populateHouseSelect() {
  const sel = document.getElementById('houseSelect');
  if (!sel) return;
  sel.innerHTML = houses.length ? houses.map(h => `<option value="${h.name}">${h.name}</option>`).join('') : '<option>لا عنابر</option>';
  if (currentHouse && houses.some(h => h.name === currentHouse)) sel.value = currentHouse;
  else if (houses.length) {
    currentHouse = houses[0].name;
    sel.value = currentHouse;
  }
}

function onHouseChange() {
  currentHouse = this.value;
  updateCycleSelect();
  updateHouseInfo();
  renderDailyTable();
  updatePerformance();
  document.getElementById('currentHouseTitle').textContent = currentHouse || '';
  updateFeedEstimate();
}

function updateCycleSelect() {
  const sel = document.getElementById('cycleSelect');
  if (!sel) return;
  const house = houses.find(h => h.name === currentHouse);
  if (!house || !house.cycles) { sel.innerHTML = '<option>لا دورات</option>'; currentCycleId = null; return; }
  sel.innerHTML = house.cycles.map(c => `<option value="${c.id}" ${c.isActive ? 'selected' : ''}>${c.startDate} - ${c.initialCount} طائر</option>`).join('');
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
  if (!cycle) { div.textContent = 'لا دورة نشطة'; return; }
  div.innerHTML = `بداية: ${cycle.startDate} | العدد الأولي: ${cycle.initialCount} | الوزن الابتدائي: ${cycle.initialWeight} جم`;
}

function addHouse() {
  const name = prompt('اسم العنبر:');
  if (!name?.trim()) return;
  if (houses.some(h => h.name === name.trim())) { alert('موجود'); return; }
  houses.push({ name: name.trim(), cycles: [] });
  persistData().then(() => {
    populateHouseSelect();
    addCycle(); // إضافة أول دورة مباشرة
  });
}

function editHouse() {
  if (!currentHouse) return;
  const house = houses.find(h => h.name === currentHouse);
  if (!house) return;
  const newName = prompt('الاسم الجديد:', house.name);
  if (newName && newName.trim() && newName.trim() !== house.name) {
    house.name = newName.trim();
    dailyRecords.forEach(r => { if (r.house === currentHouse) r.house = house.name; });
    currentHouse = house.name;
  }
  persistData().then(() => {
    populateHouseSelect();
    renderDailyTable();
  });
}

function addCycle() {
  if (!currentHouse) { alert('اختر عنبراً أولاً'); return; }
  const house = houses.find(h => h.name === currentHouse);
  if (!house) return;
  const start = prompt('تاريخ البداية (YYYY-MM-DD):', '');
  const count = parseInt(prompt('العدد الأولي:', '0')) || 0;
  const weight = parseFloat(prompt('الوزن الابتدائي (جرام):', '40')) || 0;
  house.cycles = house.cycles || [];
  // تعطيل الدورات السابقة
  house.cycles.forEach(c => c.isActive = false);
  house.cycles.push({
    id: Date.now().toString(),
    startDate: start,
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
}

// ========== السجل اليومي ==========
function updateFeedHintAndEstimate() {
  const type = document.getElementById('feedType')?.value;
  if (type) {
    document.getElementById('feedStockHint').textContent = `الرصيد: ${stock[type] || 0} ش`;
  }
  updateFeedEstimate();
}

function updateFeedEstimate() {
  const hint = document.getElementById('feedEstimateHint');
  if (!hint) return;
  const house = houses.find(h => h.name === currentHouse);
  const cycle = house?.cycles?.find(c => c.id === currentCycleId);
  if (!cycle || !document.getElementById('date').value) {
    hint.textContent = '';
    return;
  }
  const age = getChickAge(document.getElementById('date').value, cycle.startDate);
  if (age === '') { hint.textContent = ''; return; }
  const deadTotal = dailyRecords.filter(r => r.house === currentHouse && r.cycleId === currentCycleId).reduce((s, r) => s + r.dead, 0);
  const birdsNow = Math.max(0, cycle.initialCount - deadTotal);
  const estBags = estimateFeed(age, birdsNow);
  hint.textContent = `المقترح اليوم: حوالي ${estBags.toFixed(1)} ش`;
}

function estimateFeed(ageDays, birds) {
  // جداول تقريبية (جرام/طائر/يوم) و تحويل لشكاير
  let gramPerBird = 50;
  if (ageDays <= 10) gramPerBird = 30;
  else if (ageDays <= 20) gramPerBird = 70;
  else if (ageDays <= 30) gramPerBird = 110;
  else gramPerBird = 150;
  const kgTotal = (gramPerBird * birds) / 1000;
  return kgTotal / 50; // شكاير
}

function getChickAge(dateStr, startStr) {
  if (!dateStr || !startStr) return '';
  const d1 = new Date(dateStr), d2 = new Date(startStr);
  if (isNaN(d1) || isNaN(d2)) return '';
  const diff = d1 - d2;
  if (diff < 0) return '';
  return Math.floor(diff / 86400000) + 1;
}

async function onDailySubmit(e) {
  e.preventDefault();
  if (!currentHouse || !currentCycleId) { alert('اختر عنبر ودورة'); return; }
  const feedType = document.getElementById('feedType').value;
  const feedBags = parseFloat(document.getElementById('feedBags').value) || 0;
  if (feedBags <= 0) { alert('عدد الشكاير غير صحيح'); return; }

  if (editingId) {
    const old = dailyRecords.find(r => r.id === editingId);
    if (old) stock[old.feedType] += old.feedBags;
  }
  if (stock[feedType] < feedBags) {
    alert('الرصيد غير كاف');
    return;
  }
  stock[feedType] -= feedBags;

  const rec = {
    id: editingId || Date.now(),
    house: currentHouse,
    cycleId: currentCycleId,
    date: document.getElementById('date').value,
    feedType,
    feedBags,
    dead: parseInt(document.getElementById('dead').value) || 0,
    medications: document.getElementById('medications').value.trim(),
    expenses: parseFloat(document.getElementById('expenses').value) || 0,
    weight: parseFloat(document.getElementById('weight').value) || 0,
    mortalityNotes: document.getElementById('mortalityNotes').value.trim()
  };

  if (editingId) {
    const idx = dailyRecords.findIndex(r => r.id === editingId);
    if (idx > -1) dailyRecords[idx] = rec;
    editingId = null;
    document.getElementById('editingId').value = '';
    document.getElementById('formSubmitBtn').textContent = '💾 حفظ';
    document.getElementById('cancelEditBtn').style.display = 'none';
  } else {
    dailyRecords.push(rec);
  }
  await persistData();
  renderDailyTable();
  updatePerformance();
  updateFeedHintAndEstimate();
  e.target.reset();
  document.getElementById('date').valueAsDate = new Date();
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
  document.getElementById('formSubmitBtn').textContent = '✏️ تحديث';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
  updateFeedHintAndEstimate();
}

function cancelEdit() {
  editingId = null;
  document.getElementById('editingId').value = '';
  document.getElementById('formSubmitBtn').textContent = '💾 حفظ';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('dailyForm').reset();
  document.getElementById('date').valueAsDate = new Date();
}

async function deleteDailyRecord(id) {
  if (!confirm('حذف السجل؟')) return;
  const rec = dailyRecords.find(r => r.id === id);
  if (rec) stock[rec.feedType] += rec.feedBags;
  dailyRecords = dailyRecords.filter(r => r.id !== id);
  await persistData();
  renderDailyTable();
  updatePerformance();
  updateFeedHintAndEstimate();
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

  // بناء رأس الجدول حسب الأعمدة المختارة
  let headHTML = '<tr><th>التاريخ</th>';
  if (columnVisibility.age) headHTML += '<th>العمر</th>';
  if (columnVisibility.feedType) headHTML += '<th>نوع العلف</th>';
  if (columnVisibility.feedBags) headHTML += '<th>شكاير</th>';
  if (columnVisibility.kg) headHTML += '<th>كجم</th>';
  if (columnVisibility.dead) headHTML += '<th>النافق</th>';
  if (columnVisibility.medications) headHTML += '<th>أدوية</th>';
  if (columnVisibility.expenses) headHTML += '<th>مصروفات</th>';
  if (columnVisibility.weight) headHTML += '<th>الوزن</th>';
  if (columnVisibility.mortalityNotes) headHTML += '<th>ملاحظات</th>';
  headHTML += '<th>تعديل</th><th>حذف</th></tr>';
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
  if (!cycle) { box.textContent = 'اختر دورة'; return; }
  const recs = dailyRecords.filter(r => r.house === currentHouse && r.cycleId === currentCycleId);
  if (!recs.length) { box.textContent = 'لا سجلات'; return; }
  const dead = recs.reduce((s, r) => s + r.dead, 0);
  const birds = Math.max(0, cycle.initialCount - dead);
  const feedKg = recs.reduce((s, r) => s + r.feedBags * 50, 0);
  const lastWeight = recs.slice().sort((a, b) => a.date.localeCompare(b.date)).pop().weight || 0;
  const gain = lastWeight - cycle.initialWeight;
  const totalGain = birds * gain;
  let fcr = totalGain > 0 ? (feedKg / totalGain).toFixed(2) : '-';
  box.innerHTML = `🐣 ${birds} طائر | ⚖️ ${lastWeight} جم | 📈 +${gain} جم | 🌾 ${feedKg.toFixed(1)} كجم | 🔄 FCR: ${fcr}`;
}

// ========== المخزن ==========
function renderWarehouse() {
  const d = document.getElementById('warehouseStock');
  if (d) d.innerHTML = `بادي: ${stock.starter} ش | نامي: ${stock.grower} ش | ناهي: ${stock.finisher} ش`;
}

// ========== السلف ==========
async function onLoanSubmit(e) {
  e.preventDefault();
  const loan = {
    id: editingLoanId || Date.now(),
    date: document.getElementById('loanDate').value,
    person: document.getElementById('loanPerson').value.trim(),
    amount: parseFloat(document.getElementById('loanAmount').value)
  };
  if (editingLoanId) {
    const idx = loans.findIndex(l => l.id === editingLoanId);
    if (idx > -1) loans[idx] = loan;
    editingLoanId = null;
    document.getElementById('loanSubmitBtn').textContent = '💾 حفظ';
    document.getElementById('cancelLoanEditBtn').style.display = 'none';
  } else {
    loans.push(loan);
  }
  await persistData();
  renderLoansTable();
  e.target.reset();
  document.getElementById('loanDate').valueAsDate = new Date();
}

function editLoan(id) {
  const loan = loans.find(l => l.id === id);
  if (!loan) return;
  editingLoanId = loan.id;
  document.getElementById('editingLoanId').value = loan.id;
  document.getElementById('loanDate').value = loan.date;
  document.getElementById('loanPerson').value = loan.person;
  document.getElementById('loanAmount').value = loan.amount;
  document.getElementById('loanSubmitBtn').textContent = '✏️ تحديث';
  document.getElementById('cancelLoanEditBtn').style.display = 'inline-block';
}

function cancelLoanEdit() {
  editingLoanId = null;
  document.getElementById('loanSubmitBtn').textContent = '💾 حفظ';
  document.getElementById('cancelLoanEditBtn').style.display = 'none';
  document.getElementById('loanForm').reset();
}

async function deleteLoan(id) {
  if (!confirm('حذف؟')) return;
  loans = loans.filter(l => l.id !== id);
  await persistData();
  renderLoansTable();
}

function renderLoansTable() {
  const tbody = document.getElementById('loansBody');
  if (!tbody) return;
  tbody.innerHTML = loans.sort((a, b) => b.date.localeCompare(a.date)).map(l => `
    <tr><td>${l.date}</td><td>${l.person}</td><td>${l.amount}</td>
    <td><button onclick="editLoan(${l.id})">✏️</button></td>
    <td><button class="danger" onclick="deleteLoan(${l.id})">🗑️</button></td></tr>
  `).join('');
}

// ========== الرسوم البيانية (مقارنة عنابر) ==========
function drawChart() {
  const type = document.getElementById('chartType')?.value || 'weight';
  const checkboxes = document.querySelectorAll('.chart-house-cb:checked');
  const selectedHouses = Array.from(checkboxes).map(cb => cb.value);
  if (!selectedHouses.length) {
    if (chartInstance) chartInstance.destroy();
    return;
  }
  const datasets = [];
  selectedHouses.forEach(houseName => {
    const recs = dailyRecords.filter(r => r.house === houseName).sort((a, b) => a.date.localeCompare(b.date));
    if (!recs.length) return;
    let data, label;
    if (type === 'weight') {
      data = recs.map(r => r.weight || 0);
      label = `وزن ${houseName}`;
    } else if (type === 'dead') {
      data = recs.map(r => r.dead);
      label = `نافق ${houseName}`;
    } else {
      const dayMap = {};
      recs.forEach(r => dayMap[r.date] = (dayMap[r.date] || 0) + r.feedBags * 50);
      const sorted = Object.keys(dayMap).sort();
      data = sorted.map(d => dayMap[d]);
      label = `علف ${houseName}`;
    }
    datasets.push({ label, data, borderWidth: 2, tension: 0.1 });
  });
  const labels = type === 'feed' ? [...new Set(dailyRecords.filter(r => selectedHouses.includes(r.house)).map(r => r.date))].sort() :
    dailyRecords.filter(r => selectedHouses.includes(r.house)).sort((a,b)=>a.date.localeCompare(b.date)).map(r => r.date);

  const ctx = document.getElementById('myChart')?.getContext('2d');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, { type: 'line', data: { labels, datasets }, options: { responsive: true } });
}

// ========== الأعمدة القابلة للتخصيص ==========
function toggleColumnPicker() {
  const modal = document.getElementById('columnPickerModal');
  if (!modal) return;
  const container = document.getElementById('columnChecks');
  container.innerHTML = '';
  for (let key in columnVisibility) {
    container.innerHTML += `<label><input type="checkbox" class="col-cb" data-key="${key}" ${columnVisibility[key] ? 'checked' : ''}> ${key}</label><br>`;
  }
  modal.style.display = 'flex';
}

function applyColumns() {
  document.querySelectorAll('.col-cb').forEach(cb => {
    columnVisibility[cb.dataset.key] = cb.checked;
  });
  document.getElementById('columnPickerModal').style.display = 'none';
  renderDailyTable();
}

// ========== تصدير/استيراد منفصل ==========
function exportData(type) {
  let data;
  if (type === 'houses') data = houses;
  else if (type === 'dailyRecords') data = dailyRecords;
  else if (type === 'loans') data = loans;
  else if (type === 'stock') data = stock;
  downloadJSON(data, `${type}_backup.json`);
}

function importData(type, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      if (type === 'houses') houses = json;
      else if (type === 'dailyRecords') dailyRecords = json;
      else if (type === 'loans') loans = json;
      else if (type === 'stock') stock = json;
      await persistData();
      alert('تم الاستيراد');
      renderTab(document.querySelector('.nav-btn.active')?.dataset.tab || 'daily');
    } catch { alert('خطأ'); }
  };
  reader.readAsText(file);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ========== تصدير/استيراد كامل ==========
async function exportAllData() {
  downloadJSON({ houses, dailyRecords, loans, stock }, 'farm_full_backup.json');
  await persistData(); // تحديث تاريخ التصدير للنسخ الاحتياطي التلقائي
  localStorage.setItem('lastBackupDate', new Date().toISOString().slice(0, 10));
}

async function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      houses = json.houses || [];
      dailyRecords = json.dailyRecords || [];
      loans = json.loans || [];
      stock = json.stock || {};
      await persistData();
      alert('تم الاستيراد');
      location.reload();
    } catch { alert('ملف غير صالح'); }
  };
  reader.readAsText(file);
}

async function clearAllData() {
  if (confirm('مسح كل شيء؟')) {
    houses = []; dailyRecords = []; loans = []; stock = { starter: 0, grower: 0, finisher: 0 };
    await persistData();
    location.reload();
  }
}

// ========== التقارير ==========
function showReports() {
  document.getElementById('reportsContainer').style.display = 'block';
  let html = '<h3>ملخص العنابر</h3><table><tr><th>العنبر</th><th>الدورة</th><th>العدد الحالي</th><th>وزن</th><th>علف</th><th>FCR</th></tr>';
  houses.forEach(h => {
    h.cycles?.forEach(c => {
      const recs = dailyRecords.filter(r => r.house === h.name && r.cycleId === c.id);
      const dead = recs.reduce((s,r)=>s+r.dead,0);
      const birds = Math.max(0, c.initialCount - dead);
      const feedKg = recs.reduce((s,r)=>s+r.feedBags*50,0);
      const w = recs.slice().sort((a,b)=>a.date.localeCompare(b.date)).pop()?.weight || 0;
      const gain = w - c.initialWeight;
      const fcr = gain > 0 ? (feedKg / (birds * gain)).toFixed(2) : '-';
      html += `<tr><td>${h.name}</td><td>${c.startDate}</td><td>${birds}</td><td>${w}</td><td>${feedKg.toFixed(1)}</td><td>${fcr}</td></tr>`;
    });
  });
  html += '</table>';
  document.getElementById('reportsContent').innerHTML = html;
}

function hideReports() {
  document.getElementById('reportsContainer').style.display = 'none';
}

// ========== التنبيهات ==========
function checkAlerts() {
  let msg = [];
  // نقص المخزون
  for (let t in stock) {
    if (stock[t] < 3) msg.push(`تحذير: ${getArabicFeedName(t)} أقل من 3 شكاير`);
  }
  // فوات تسجيل يومي
  const today = new Date().toISOString().slice(0, 10);
  houses.forEach(h => {
    const active = getActiveCycle(h);
    if (!active) return;
    const recs = dailyRecords.filter(r => r.house === h.name && r.cycleId === active.id);
    if (recs.length && recs.sort((a,b)=>b.date.localeCompare(a.date))[0].date < today) {
      msg.push(`تنبيه: ${h.name} لم يسجل اليوم`);
    }
  });
  const bar = document.getElementById('alertBar');
  if (bar) {
    bar.style.display = msg.length ? 'block' : 'none';
    bar.textContent = msg.join(' | ');
  }
}

// ========== النسخ الاحتياطي التلقائي الأسبوعي (يوم الجمعة) ==========
function autoBackupPrompt() {
  const today = new Date();
  if (today.getDay() === 5) { // الجمعة
    const last = localStorage.getItem('lastBackupDate');
    const todayStr = today.toISOString().slice(0, 10);
    if (last !== todayStr) {
      if (confirm('اليوم الجمعة. هل تريد تحميل نسخة احتياطية؟')) {
        exportAllData();
      }
      localStorage.setItem('lastBackupDate', todayStr);
    }
  }
}

// ========== PWA ==========
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'block';
});

function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      document.getElementById('installBtn').style.display = 'none';
    });
  }
}

// ========== مؤشر الاتصال ==========
window.addEventListener('online', () => document.getElementById('offlineBar').style.display = 'none');
window.addEventListener('offline', () => document.getElementById('offlineBar').style.display = 'block');

// ========== بدء التطبيق ==========
async function init() {
  await loadDataFromDB();
  renderTab('daily');
  autoBackupPrompt();
  if (!navigator.onLine) document.getElementById('offlineBar').style.display = 'block';
}
init();