// ---------- IndexedDB Wrapper ----------
const DB_NAME = 'PoultryFarmDB';
const DB_VERSION = 1;
const STORE_NAME = 'appState';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
    const req = store.put(data, 'data');
    req.onsuccess = resolve;
    req.onerror = reject;
  });
}

// ---------- المتغيرات العامة ----------
let houses = [];
let dailyRecords = [];
let loans = [];
let stock = { starter: 0, grower: 0, finisher: 0 };
let currentHouse = null;
let chartInstance = null;

// ---------- تحميل / حفظ البيانات ----------
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

// ---------- إدارة العنابر ----------
function populateHouseSelects() {
  const dailySelect = document.getElementById('houseSelect');
  const chartSelect = document.getElementById('chartHouseSelect');
  dailySelect.innerHTML = chartSelect.innerHTML = '';
  if (houses.length === 0) {
    dailySelect.innerHTML = '<option value="">-- لا يوجد عنابر --</option>';
    chartSelect.innerHTML = '<option value="">-- لا يوجد عنابر --</option>';
  } else {
    houses.forEach(h => {
      const opt = `<option value="${h.name}">${h.name}</option>`;
      dailySelect.innerHTML += opt;
      chartSelect.innerHTML += opt;
    });
  }
  if (currentHouse && houses.some(h => h.name === currentHouse)) {
    dailySelect.value = currentHouse;
  } else if (houses.length > 0) {
    currentHouse = houses[0].name;
    dailySelect.value = currentHouse;
  }
  updateHouseInfo();
  updateCurrentHouseTitle();
}

function updateHouseInfo() {
  const infoDiv = document.getElementById('houseInfo');
  if (!currentHouse) { infoDiv.textContent = 'لا يوجد عنبر مختار'; return; }
  const house = houses.find(h => h.name === currentHouse);
  if (!house) return;
  const start = house.startDate || 'غير محدد';
  const initialCount = house.initialCount || 0;
  const initialWeight = house.initialWeight || 0;
  infoDiv.innerHTML = `بداية الدورة: ${start} | العدد الأولي: ${initialCount} | الوزن الابتدائي: ${initialWeight} جم`;
}

function addHouse() {
  const name = prompt('اسم العنبر الجديد:');
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  if (houses.some(h => h.name === trimmed)) { alert('موجود'); return; }
  const startDate = prompt('تاريخ بداية الدورة (YYYY-MM-DD):', '');
  const initialCount = parseInt(prompt('عدد الكتاكيت الأولي:', '0')) || 0;
  const initialWeight = parseFloat(prompt('متوسط الوزن الابتدائي (جرام):', '40')) || 0;
  houses.push({ name: trimmed, startDate, initialCount, initialWeight });
  persistData().then(populateHouseSelects);
}

function editHouse() {
  if (!currentHouse) { alert('اختر عنبراً'); return; }
  const house = houses.find(h => h.name === currentHouse);
  if (!house) return;
  const newStart = prompt('تاريخ بداية الدورة (YYYY-MM-DD):', house.startDate || '');
  if (newStart !== null) house.startDate = newStart.trim();
  const newCount = prompt('عدد الكتاكيت الأولي:', house.initialCount || 0);
  if (newCount !== null) house.initialCount = parseInt(newCount) || 0;
  const newWeight = prompt('متوسط الوزن الابتدائي (جرام):', house.initialWeight || 40);
  if (newWeight !== null) house.initialWeight = parseFloat(newWeight) || 0;
  persistData().then(() => {
    updateHouseInfo();
    renderDailyTable();
    updatePerformance();
  });
}

document.getElementById('houseSelect').addEventListener('change', function() {
  currentHouse = this.value;
  updateHouseInfo();
  updateCurrentHouseTitle();
  renderDailyTable();
  updatePerformance();
});

function updateCurrentHouseTitle() {
  document.getElementById('currentHouseTitle').textContent = currentHouse || '---';
}

// ---------- عمر الكتكوت ----------
function getChickAge(recordDate, houseStart) {
  if (!recordDate || !houseStart) return '';
  const d1 = new Date(recordDate);
  const d2 = new Date(houseStart);
  if (isNaN(d1) || isNaN(d2)) return '';
  const diffTime = d1 - d2;
  if (diffTime < 0) return '';
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// ---------- السجل اليومي ----------
document.getElementById('feedType').addEventListener('change', updateFeedHint);
function updateFeedHint() {
  const type = document.getElementById('feedType').value;
  const bags = stock[type] || 0;
  document.getElementById('feedStockHint').textContent = `الرصيد: ${bags} شيكارة`;
}

// تعديل وحفظ
let editingId = null;

document.getElementById('dailyForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!currentHouse) { alert('اختر عنبراً'); return; }
  const feedType = document.getElementById('feedType').value;
  const feedBags = parseFloat(document.getElementById('feedBags').value) || 0;
  if (feedBags <= 0) { alert('عدد الشكاير يجب أن يكون أكبر من صفر'); return; }

  // في حالة التعديل: نعيد الفرق للمخزن
  if (editingId) {
    const oldRec = dailyRecords.find(r => r.id === editingId);
    if (!oldRec) return;
    // نعيد الكمية القديمة للمخزن
    stock[oldRec.feedType] = (stock[oldRec.feedType] || 0) + oldRec.feedBags;
  }

  if (stock[feedType] < feedBags) {
    alert(`الرصيد غير كافٍ. المتاح: ${stock[feedType]} شيكارة`);
    if (editingId) {
      // نرجع الكمية القديمة أيضاً لأننا فشلنا في الحفظ
      const oldRec = dailyRecords.find(r => r.id === editingId);
      if (oldRec) stock[oldRec.feedType] = (stock[oldRec.feedType] || 0) - oldRec.feedBags;
    }
    return;
  }

  // خصم المخزن
  stock[feedType] -= feedBags;

  const record = {
    id: editingId || Date.now(),
    house: currentHouse,
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
    const index = dailyRecords.findIndex(r => r.id === editingId);
    if (index > -1) dailyRecords[index] = record;
    editingId = null;
    document.getElementById('editingId').value = '';
    document.getElementById('formSubmitBtn').textContent = '💾 حفظ السجل';
    document.getElementById('cancelEditBtn').style.display = 'none';
  } else {
    dailyRecords.push(record);
  }

  await persistData();
  renderDailyTable();
  updatePerformance();
  updateFeedHint();
  this.reset();
  document.getElementById('date').valueAsDate = new Date();
});

function cancelEdit() {
  editingId = null;
  document.getElementById('editingId').value = '';
  document.getElementById('formSubmitBtn').textContent = '💾 حفظ السجل';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('dailyForm').reset();
  document.getElementById('date').valueAsDate = new Date();
}

function editDailyRecord(id) {
  const rec = dailyRecords.find(r => r.id === id);
  if (!rec) return;
  document.getElementById('editingId').value = rec.id;
  editingId = rec.id;
  document.getElementById('date').value = rec.date;
  document.getElementById('feedType').value = rec.feedType;
  document.getElementById('feedBags').value = rec.feedBags;
  document.getElementById('dead').value = rec.dead;
  document.getElementById('medications').value = rec.medications || '';
  document.getElementById('expenses').value = rec.expenses;
  document.getElementById('weight').value = rec.weight || '';
  document.getElementById('mortalityNotes').value = rec.mortalityNotes || '';
  document.getElementById('formSubmitBtn').textContent = '✏️ تحديث السجل';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
  updateFeedHint();
}

function deleteDailyRecord(id) {
  if (!confirm('حذف السجل؟')) return;
  const rec = dailyRecords.find(r => r.id === id);
  if (rec) {
    // إعادة الكمية للمخزن
    stock[rec.feedType] = (stock[rec.feedType] || 0) + rec.feedBags;
  }
  dailyRecords = dailyRecords.filter(r => r.id !== id);
  persistData().then(() => {
    renderDailyTable();
    updatePerformance();
    updateFeedHint();
  });
}

function renderDailyTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  if (!currentHouse) return;
  const house = houses.find(h => h.name === currentHouse);
  const filtered = dailyRecords
    .filter(r => r.house === currentHouse)
    .sort((a, b) => a.date.localeCompare(b.date) * -1); // الأحدث أولاً

  filtered.forEach(rec => {
    const age = getChickAge(rec.date, house ? house.startDate : '');
    const kg = (rec.feedBags * 50).toFixed(1);
    const feedName = getArabicFeedName(rec.feedType);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${rec.date}</td>
      <td>${age !== '' ? age : '-'}</td>
      <td>${feedName}</td>
      <td>${rec.feedBags}</td>
      <td>${kg}</td>
      <td>${rec.dead}</td>
      <td>${rec.medications || '-'}</td>
      <td>${rec.expenses}</td>
      <td>${rec.weight || '-'}</td>
      <td>${rec.mortalityNotes || '-'}</td>
      <td><button class="edit-btn" onclick="editDailyRecord(${rec.id})">✏️</button></td>
      <td><button class="delete-btn" onclick="deleteDailyRecord(${rec.id})">🗑️</button></td>
    `;
    tbody.appendChild(row);
  });
}

// ---------- مؤشرات الأداء ----------
function updatePerformance() {
  const box = document.getElementById('performanceContent');
  if (!currentHouse) { box.textContent = 'اختر عنبرًا'; return; }
  const house = houses.find(h => h.name === currentHouse);
  if (!house) return;
  const records = dailyRecords.filter(r => r.house === currentHouse);
  if (records.length === 0) { box.textContent = 'لا توجد سجلات بعد'; return; }
  const totalDead = records.reduce((s, r) => s + r.dead, 0);
  const birdsNow = Math.max(0, house.initialCount - totalDead);
  const totalFeedKg = records.reduce((s, r) => s + r.feedBags * 50, 0);
  const lastWeight = records.sort((a,b)=>a.date.localeCompare(b.date)).pop().weight || 0;
  const weightGain = lastWeight - (house.initialWeight || 0);
  const totalGain = birdsNow * weightGain;
  let fcr = '---';
  if (totalGain > 0) fcr = (totalFeedKg / totalGain).toFixed(2);
  let feedPerBird = '---';
  if (birdsNow > 0) feedPerBird = (totalFeedKg / birdsNow).toFixed(2);

  box.innerHTML = `
    <p>🐣 العدد الحالي: <strong>${birdsNow}</strong> طائر</p>
    <p>⚖️ متوسط الوزن: <strong>${lastWeight}</strong> جم</p>
    <p>📈 الزيادة: <strong>${weightGain}</strong> جم/طائر</p>
    <p>🌾 العلف المستهلك: <strong>${totalFeedKg.toFixed(1)}</strong> كجم</p>
    <p>🔄 معامل التحويل (FCR): <strong>${fcr}</strong></p>
    <p>🐔 استهلاك العلف/طائر: <strong>${feedPerBird}</strong> كجم</p>
  `;
}

// ---------- المخزن ----------
function renderWarehouse() {
  document.getElementById('warehouseStock').innerHTML = `
    <p><strong>بادي:</strong> ${stock.starter} ش (${stock.starter*50} كجم)</p>
    <p><strong>نامي:</strong> ${stock.grower} ش (${stock.grower*50} كجم)</p>
    <p><strong>ناهي:</strong> ${stock.finisher} ش (${stock.finisher*50} كجم)</p>
  `;
}

document.getElementById('warehouseForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const type = document.getElementById('whType').value;
  const bags = parseFloat(document.getElementById('whBags').value) || 0;
  if (bags <= 0) return;
  stock[type] += bags;
  await persistData();
  renderWarehouse();
  this.reset();
  document.getElementById('whBags').value = 1;
});

// ---------- السلف ----------
let editingLoanId = null;

document.getElementById('loanForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const loan = {
    id: editingLoanId || Date.now(),
    date: document.getElementById('loanDate').value,
    person: document.getElementById('loanPerson').value.trim(),
    amount: parseFloat(document.getElementById('loanAmount').value)
  };
  if (!loan.person || !loan.amount) return;

  if (editingLoanId) {
    const index = loans.findIndex(l => l.id === editingLoanId);
    if (index > -1) loans[index] = loan;
    editingLoanId = null;
    document.getElementById('editingLoanId').value = '';
    document.getElementById('loanSubmitBtn').textContent = '💾 حفظ السلفة';
    document.getElementById('cancelLoanEditBtn').style.display = 'none';
  } else {
    loans.push(loan);
  }
  await persistData();
  renderLoansTable();
  this.reset();
});

function cancelLoanEdit() {
  editingLoanId = null;
  document.getElementById('editingLoanId').value = '';
  document.getElementById('loanSubmitBtn').textContent = '💾 حفظ السلفة';
  document.getElementById('cancelLoanEditBtn').style.display = 'none';
  document.getElementById('loanForm').reset();
}

function editLoan(id) {
  const loan = loans.find(l => l.id === id);
  if (!loan) return;
  document.getElementById('editingLoanId').value = loan.id;
  editingLoanId = loan.id;
  document.getElementById('loanDate').value = loan.date;
  document.getElementById('loanPerson').value = loan.person;
  document.getElementById('loanAmount').value = loan.amount;
  document.getElementById('loanSubmitBtn').textContent = '✏️ تحديث السلفة';
  document.getElementById('cancelLoanEditBtn').style.display = 'inline-block';
}

function deleteLoan(id) {
  if (!confirm('حذف السلفة؟')) return;
  loans = loans.filter(l => l.id !== id);
  persistData().then(renderLoansTable);
}

function renderLoansTable() {
  const tbody = document.getElementById('loansBody');
  tbody.innerHTML = '';
  loans.sort((a,b)=>a.date.localeCompare(b.date)).forEach(loan => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${loan.date}</td>
      <td>${loan.person}</td>
      <td>${loan.amount}</td>
      <td><button class="edit-btn" onclick="editLoan(${loan.id})">✏️</button></td>
      <td><button class="delete-btn" onclick="deleteLoan(${loan.id})">🗑️</button></td>
    `;
    tbody.appendChild(row);
  });
}

// ---------- التبويبات ----------
function showTab(tab) {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  switch(tab) {
    case 'daily':
      document.getElementById('dailySection').style.display = 'block';
      document.querySelector('.tab:nth-child(1)').classList.add('active');
      renderDailyTable();
      updatePerformance();
      updateFeedHint();
      break;
    case 'warehouse':
      document.getElementById('warehouseSection').style.display = 'block';
      document.querySelector('.tab:nth-child(2)').classList.add('active');
      renderWarehouse();
      break;
    case 'loans':
      document.getElementById('loansSection').style.display = 'block';
      document.querySelector('.tab:nth-child(3)').classList.add('active');
      renderLoansTable();
      break;
    case 'charts':
      document.getElementById('chartsSection').style.display = 'block';
      document.querySelector('.tab:nth-child(4)').classList.add('active');
      populateHouseSelects();
      drawChart();
      break;
    case 'reports':
      document.getElementById('reportsSection').style.display = 'block';
      document.querySelector('.tab:nth-child(5)').classList.add('active');
      generateReports();
      break;
    case 'settings':
      document.getElementById('settingsSection').style.display = 'block';
      document.querySelector('.tab:nth-child(6)').classList.add('active');
      checkInstallBtn();
      break;
  }
}

// ---------- الرسوم البيانية ----------
document.getElementById('chartHouseSelect').addEventListener('change', drawChart);
document.getElementById('chartType').addEventListener('change', drawChart);

function drawChart() {
  const houseName = document.getElementById('chartHouseSelect').value;
  const type = document.getElementById('chartType').value;
  if (!houseName) { if(chartInstance) chartInstance.destroy(); return; }
  let records = dailyRecords.filter(r => r.house === houseName).sort((a,b)=>a.date.localeCompare(b.date));
  if (records.length === 0) { if(chartInstance) chartInstance.destroy(); alert('لا بيانات'); return; }
  const labels = records.map(r=>r.date);
  let data=[], label='';
  if(type==='weight') {
    data=records.map(r=>r.weight||0);
    label='الوزن (جرام)';
  } else if(type==='dead') {
    data=records.map(r=>r.dead);
    label='النافق';
  } else {
    const dayMap={};
    records.forEach(r=>{ dayMap[r.date]=(dayMap[r.date]||0)+r.feedBags*50; });
    const sorted=Object.keys(dayMap).sort();
    labels.length=0; data=[];
    sorted.forEach(d=>{ labels.push(d); data.push(dayMap[d]); });
    label='العلف (كجم)';
  }
  const ctx=document.getElementById('myChart').getContext('2d');
  if(chartInstance) chartInstance.destroy();
  chartInstance=new Chart(ctx,{
    type:'line',
    data:{labels,datasets:[{label,data,borderColor:'#2d6a4f',backgroundColor:'rgba(45,106,79,0.2)',tension:0.1}]},
    options:{responsive:true,plugins:{legend:{position:'bottom'}}}
  });
}

// ---------- التقارير ----------
function generateReports() {
  const content = document.getElementById('reportsContent');
  if (houses.length === 0) {
    content.innerHTML = '<p>لا توجد عنابر مسجلة.</p>';
    return;
  }
  let html = '<table><thead><tr><th>العنبر</th><th>العدد الحالي</th><th>الوزن (جم)</th><th>علف (كجم)</th><th>نافق</th><th>FCR</th><th>مصروفات</th></tr></thead><tbody>';

  let totalBirds = 0, totalFeed = 0, totalDead = 0, totalExpenses = 0;
  houses.forEach(house => {
    const recs = dailyRecords.filter(r => r.house === house.name);
    const dead = recs.reduce((s,r)=>s+r.dead,0);
    const birds = Math.max(0, house.initialCount - dead);
    const feedKg = recs.reduce((s,r)=>s+r.feedBags*50,0);
    const weight = recs.length ? recs.sort((a,b)=>a.date.localeCompare(b.date)).pop().weight || 0 : 0;
    const gain = weight - (house.initialWeight||0);
    const totalGain = birds * gain;
    const fcr = totalGain > 0 ? (feedKg / totalGain).toFixed(2) : '-';
    const expenses = recs.reduce((s,r)=>s+(r.expenses||0),0);

    html += `<tr>
      <td>${house.name}</td><td>${birds}</td><td>${weight}</td><td>${feedKg.toFixed(1)}</td>
      <td>${dead}</td><td>${fcr}</td><td>${expenses}</td>
    </tr>`;
    totalBirds += birds;
    totalFeed += feedKg;
    totalDead += dead;
    totalExpenses += expenses;
  });
  html += '</tbody></table>';
  html += `<div style="margin-top:15px;"><strong>الإجماليات:</strong> الطيور: ${totalBirds} | العلف: ${totalFeed.toFixed(1)} كجم | النافق: ${totalDead} | المصروفات: ${totalExpenses} ج.م</div>`;
  content.innerHTML = html;
}

// ---------- تصدير / استيراد / مسح ----------
async function exportAllData() {
  const data = { houses, dailyRecords, loans, stock };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `poultry-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      if (json.houses && json.dailyRecords && json.loans && json.stock) {
        houses = json.houses;
        dailyRecords = json.dailyRecords;
        loans = json.loans;
        stock = json.stock;
        await persistData();
        alert('تم استيراد البيانات بنجاح. سيتم إعادة التحميل.');
        location.reload();
      } else {
        alert('ملف غير صالح');
      }
    } catch (err) {
      alert('خطأ في قراءة الملف');
    }
  };
  reader.readAsText(file);
}

async function clearAllData() {
  if (confirm('سيتم مسح جميع البيانات نهائياً. هل أنت متأكد؟')) {
    houses = [];
    dailyRecords = [];
    loans = [];
    stock = { starter:0, grower:0, finisher:0 };
    await persistData();
    location.reload();
  }
}

// ---------- CSV و PDF للجدول اليومي ----------
function exportTableCSV() {
  if (!currentHouse) { alert('اختر عنبراً أولاً'); return; }
  const recs = dailyRecords.filter(r => r.house === currentHouse).sort((a,b)=>a.date.localeCompare(b.date));
  if (recs.length===0) return;
  const houseObj = houses.find(h=>h.name===currentHouse);
  let csv = 'التاريخ,العمر,نوع العلف,شكاير,كجم,النافق,الأدوية,مصروفات,الوزن,ملاحظات\n';
  recs.forEach(r => {
    const age = getChickAge(r.date, houseObj?.startDate || '');
    const kg = (r.feedBags*50).toFixed(1);
    csv += `${r.date},${age},${getArabicFeedName(r.feedType)},${r.feedBags},${kg},${r.dead},"${r.medications||''}",${r.expenses},${r.weight||''},"${r.mortalityNotes||''}"\n`;
  });
  const blob = new Blob(['\uFEFF'+csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentHouse}-سجلات.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printTable() {
  window.print();
}

// ---------- PWA install ----------
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').style.display = 'block';
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

function checkInstallBtn() {
  if (deferredPrompt) {
    document.getElementById('installBtn').style.display = 'block';
  } else {
    document.getElementById('installBtn').style.display = 'none';
  }
}

// ---------- دوال مساعدة ----------
function getArabicFeedName(type) {
  switch(type) {
    case 'starter': return 'بادي';
    case 'grower': return 'نامي';
    case 'finisher': return 'ناهي';
    default: return type;
  }
}

// ---------- البداية ----------
async function init() {
  await loadDataFromDB();
  populateHouseSelects();
  document.getElementById('date').valueAsDate = new Date();
  document.getElementById('loanDate').valueAsDate = new Date();
  updateFeedHint();
  showTab('daily');
}
init();