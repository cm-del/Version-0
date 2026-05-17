// ========== مفاتيح التخزين ==========
const HOUSES_KEY = 'farmHouses_v2';     // الأن صف من كائنات {name, startDate, initialCount, initialWeight}
const DAILY_KEY = 'farmDailyRecords_v2';
const LOANS_KEY = 'farmLoans';
const STOCK_KEY = 'farmStock';         // { starter: 0, grower: 0, finisher: 0 }

// ========== متغيرات عامة ==========
let houses = [];
let dailyRecords = [];
let loans = [];
let stock = { starter: 0, grower: 0, finisher: 0 };
let currentHouse = null; // اسم العنبر الحالي (نص)
let chartInstance = null;

// ========== تحميل / حفظ البيانات ==========
function loadData() {
  // العنابر
  const storedHouses = localStorage.getItem(HOUSES_KEY);
  if (storedHouses) {
    try {
      houses = JSON.parse(storedHouses);
    } catch (e) { houses = []; }
  } else {
    // تحويل من الصيغة القديمة إن وجدت
    const old = localStorage.getItem('farmHouses');
    if (old) {
      try {
        const names = JSON.parse(old);
        houses = names.map(n => ({
          name: n,
          startDate: '',
          initialCount: 0,
          initialWeight: 0
        }));
      } catch (e) { houses = []; }
    }
  }
  // السجلات اليومية
  dailyRecords = JSON.parse(localStorage.getItem(DAILY_KEY) || '[]');
  // السلف
  loans = JSON.parse(localStorage.getItem(LOANS_KEY) || '[]');
  // المخزون
  const savedStock = localStorage.getItem(STOCK_KEY);
  if (savedStock) {
    stock = JSON.parse(savedStock);
  } else {
    stock = { starter: 0, grower: 0, finisher: 0 };
  }
}

function saveHouses() { localStorage.setItem(HOUSES_KEY, JSON.stringify(houses)); }
function saveDaily() { localStorage.setItem(DAILY_KEY, JSON.stringify(dailyRecords)); }
function saveLoans() { localStorage.setItem(LOANS_KEY, JSON.stringify(loans)); }
function saveStock() { localStorage.setItem(STOCK_KEY, JSON.stringify(stock)); }

// ========== دوال العنابر ==========
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
  // استعادة العنبر الحالي
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
  if (!currentHouse) {
    infoDiv.textContent = 'لا يوجد عنبر مختار';
    return;
  }
  const house = houses.find(h => h.name === currentHouse);
  if (!house) return;
  const start = house.startDate ? house.startDate : 'غير محدد';
  const initialCount = house.initialCount || 0;
  const initialWeight = house.initialWeight || 0;
  infoDiv.innerHTML = `بداية الدورة: ${start} | العدد الأولي: ${initialCount} | الوزن الابتدائي: ${initialWeight} جم`;
}

function addHouse() {
  const name = prompt('اسم العنبر الجديد:');
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  if (houses.some(h => h.name === trimmed)) {
    alert('هذا العنبر موجود بالفعل');
    return;
  }
  const startDate = prompt('تاريخ بداية الدورة (YYYY-MM-DD):', '');
  const initialCount = parseInt(prompt('عدد الكتاكيت الأولي:', '0')) || 0;
  const initialWeight = parseFloat(prompt('متوسط الوزن الابتدائي (جرام):', '40')) || 0;

  houses.push({ name: trimmed, startDate, initialCount, initialWeight });
  saveHouses();
  populateHouseSelects();
}

function editHouse() {
  if (!currentHouse) { alert('اختر عنبراً أولاً'); return; }
  const house = houses.find(h => h.name === currentHouse);
  if (!house) return;
  const newStart = prompt('تاريخ بداية الدورة (YYYY-MM-DD):', house.startDate || '');
  if (newStart !== null) {
    house.startDate = newStart.trim();
  }
  const newCount = prompt('عدد الكتاكيت الأولي:', house.initialCount || 0);
  if (newCount !== null) house.initialCount = parseInt(newCount) || 0;
  const newWeight = prompt('متوسط الوزن الابتدائي (جرام):', house.initialWeight || 40);
  if (newWeight !== null) house.initialWeight = parseFloat(newWeight) || 0;
  saveHouses();
  updateHouseInfo();
  // تحديث المؤشرات في حال وجود سجلات
  renderDailyTable();
  updatePerformance();
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

// ========== دالة حساب عمر الكتكوت ==========
function getChickAge(recordDate, houseStart) {
  if (!recordDate || !houseStart) return '';
  const d1 = new Date(recordDate);
  const d2 = new Date(houseStart);
  if (isNaN(d1) || isNaN(d2)) return '';
  const diffTime = d1 - d2;
  if (diffTime < 0) return ''; // تاريخ قبل البداية
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // اليوم الأول = 1
}

// ========== السجل اليومي ==========
// تحديث تلميح رصيد العلف عند تغيير النوع
document.getElementById('feedType').addEventListener('change', updateFeedHint);
function updateFeedHint() {
  const type = document.getElementById('feedType').value;
  const bags = stock[type] || 0;
  document.getElementById('feedStockHint').textContent = `الرصيد الحالي: ${bags} شيكارة`;
}

document.getElementById('dailyForm').addEventListener('submit', function(e) {
  e.preventDefault();
  if (!currentHouse) {
    alert('الرجاء اختيار عنبر أولاً');
    return;
  }
  const feedType = document.getElementById('feedType').value;
  const feedBags = parseFloat(document.getElementById('feedBags').value) || 0;
  if (feedBags <= 0) {
    alert('عدد الشكاير يجب أن يكون أكبر من صفر');
    return;
  }
  // التحقق من المخزون
  if (stock[feedType] < feedBags) {
    alert(`الرصيد غير كافٍ. المتاح من ${getArabicFeedName(feedType)}: ${stock[feedType]} شيكارة`);
    return;
  }

  // خصم من المخزن
  stock[feedType] -= feedBags;
  saveStock();

  const record = {
    id: Date.now(),
    house: currentHouse,
    date: document.getElementById('date').value,
    feedType: feedType,
    feedBags: feedBags,
    dead: parseInt(document.getElementById('dead').value) || 0,
    medications: document.getElementById('medications').value.trim(),
    expenses: parseFloat(document.getElementById('expenses').value) || 0,
    weight: parseFloat(document.getElementById('weight').value) || 0,
    mortalityNotes: document.getElementById('mortalityNotes').value.trim()
  };
  dailyRecords.push(record);
  saveDaily();
  renderDailyTable();
  updatePerformance();
  updateFeedHint();
  this.reset();
  document.getElementById('date').valueAsDate = new Date();
});

function renderDailyTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  if (!currentHouse) return;
  const house = houses.find(h => h.name === currentHouse);
  const filtered = dailyRecords
    .filter(r => r.house === currentHouse)
    .sort((a, b) => a.date.localeCompare(b.date) ? -1 : 1); // الأحدث أولاً

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
      <td><button class="delete-btn" onclick="deleteDailyRecord(${rec.id})">🗑️</button></td>
    `;
    tbody.appendChild(row);
  });
}

function deleteDailyRecord(id) {
  if (!confirm('حذف هذا السجل؟')) return;
  const rec = dailyRecords.find(r => r.id === id);
  if (rec) {
    // إعادة الشكاير للمخزن
    stock[rec.feedType] = (stock[rec.feedType] || 0) + rec.feedBags;
    saveStock();
  }
  dailyRecords = dailyRecords.filter(r => r.id !== id);
  saveDaily();
  renderDailyTable();
  updatePerformance();
  updateFeedHint();
}

// ========== مؤشرات الأداء ==========
function updatePerformance() {
  const box = document.getElementById('performanceContent');
  if (!currentHouse) {
    box.textContent = 'اختر عنبرًا لعرض المؤشرات';
    return;
  }
  const house = houses.find(h => h.name === currentHouse);
  if (!house) { box.textContent = 'بيانات العنبر غير مكتملة'; return; }

  // الحصول على أحدث سجل لمعرفة العدد الحالي والوزن
  const records = dailyRecords
    .filter(r => r.house === currentHouse)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (records.length === 0) {
    box.textContent = 'لا توجد سجلات يومية بعد';
    return;
  }

  const lastRecord = records[records.length - 1];
  const currentCount = lastRecord.birdsCount ? lastRecord.birdsCount : (house.initialCount - records.reduce((sum, r) => sum + r.dead, 0));
  // العدد الحالي: لو لم يتم تخزين birdsCount صراحةً، نعتمد على العدد الأولى ناقص مجموع النافق
  // لكننا لم نعد نخزن birdsCount في السجل. سنحسبه من initialCount - totalDead
  const totalDead = records.reduce((s, r) => s + r.dead, 0);
  const birdsNow = house.initialCount - totalDead;
  if (birdsNow < 0) birdsNow = 0;

  // إجمالي العلف (كجم)
  const totalFeedKg = records.reduce((sum, r) => sum + r.feedBags * 50, 0);

  // الوزن الحالي (من آخر سجل)
  const currentWeight = lastRecord.weight || 0;

  // الوزن الابتدائي
  const initialWeight = house.initialWeight || 0;

  // الزيادة في الوزن لكل طائر
  const weightGain = currentWeight - initialWeight;

  // الوزن الحي الكلي الحالي (تقريبي)
  const totalLiveWeightNow = birdsNow * currentWeight;

  // الوزن الحي الكلي الأولي
  const totalLiveWeightInitial = house.initialCount * initialWeight;

  // الزيادة الكلية في الوزن الحي
  const totalWeightGain = totalLiveWeightNow - totalLiveWeightInitial;

  // معامل التحويل FCR = إجمالي العلف (كجم) / الزيادة الكلية في الوزن الحي (كجم)
  let fcr = '---';
  if (totalWeightGain > 0) {
    fcr = (totalFeedKg / totalWeightGain).toFixed(2);
  }

  // استهلاك العلف لكل طائر (حتى الآن)
  let feedPerBird = '---';
  if (birdsNow > 0) {
    feedPerBird = (totalFeedKg / birdsNow).toFixed(2);
  }

  box.innerHTML = `
    <p>🐣 العدد الحالي: <strong>${birdsNow}</strong> طائر</p>
    <p>⚖️ متوسط الوزن الحالي: <strong>${currentWeight}</strong> جم</p>
    <p>📈 الزيادة في الوزن: <strong>${weightGain}</strong> جم/طائر</p>
    <p>🌾 إجمالي العلف المستهلك: <strong>${totalFeedKg.toFixed(1)}</strong> كجم</p>
    <p>🔄 معامل التحويل (FCR): <strong>${fcr}</strong></p>
    <p>🐔 استهلاك العلف لكل طائر: <strong>${feedPerBird}</strong> كجم/طائر</p>
  `;
}

// ========== المخزن ==========
function renderWarehouse() {
  const div = document.getElementById('warehouseStock');
  div.innerHTML = `
    <p><strong>بادي (بادئ):</strong> ${stock.starter} شيكارة (${stock.starter * 50} كجم)</p>
    <p><strong>نامي:</strong> ${stock.grower} شيكارة (${stock.grower * 50} كجم)</p>
    <p><strong>ناهي:</strong> ${stock.finisher} شيكارة (${stock.finisher * 50} كجم)</p>
  `;
}

document.getElementById('warehouseForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const type = document.getElementById('whType').value;
  const bags = parseFloat(document.getElementById('whBags').value) || 0;
  if (bags <= 0) {
    alert('العدد يجب أن يكون أكبر من صفر');
    return;
  }
  stock[type] = (stock[type] || 0) + bags;
  saveStock();
  renderWarehouse();
  this.reset();
  document.getElementById('whBags').value = 1;
});

// ========== السلف ==========
document.getElementById('loanForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const loan = {
    id: Date.now(),
    date: document.getElementById('loanDate').value,
    person: document.getElementById('loanPerson').value.trim(),
    amount: parseFloat(document.getElementById('loanAmount').value)
  };
  loans.push(loan);
  saveLoans();
  renderLoansTable();
  this.reset();
});

function renderLoansTable() {
  const tbody = document.getElementById('loansBody');
  tbody.innerHTML = '';
  loans.sort((a,b)=> a.date.localeCompare(b.date)).forEach(loan => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${loan.date}</td>
      <td>${loan.person}</td>
      <td>${loan.amount}</td>
      <td><button class="delete-btn" onclick="deleteLoan(${loan.id})">🗑️</button></td>
    `;
    tbody.appendChild(row);
  });
}

function deleteLoan(id) {
  if (confirm('حذف السلفة؟')) {
    loans = loans.filter(l => l.id !== id);
    saveLoans();
    renderLoansTable();
  }
}

// ========== التبويبات ==========
function showTab(tab) {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  if (tab === 'daily') {
    document.getElementById('dailySection').style.display = 'block';
    document.getElementById('tabDaily').classList.add('active');
    renderDailyTable();
    updatePerformance();
    updateFeedHint();
  } else if (tab === 'warehouse') {
    document.getElementById('warehouseSection').style.display = 'block';
    document.getElementById('tabWarehouse').classList.add('active');
    renderWarehouse();
  } else if (tab === 'loans') {
    document.getElementById('loansSection').style.display = 'block';
    document.getElementById('tabLoans').classList.add('active');
    renderLoansTable();
  } else if (tab === 'charts') {
    document.getElementById('chartsSection').style.display = 'block';
    document.getElementById('tabCharts').classList.add('active');
    populateHouseSelects();
    drawChart();
  }
}

// ========== الرسوم البيانية ==========
document.getElementById('chartHouseSelect').addEventListener('change', drawChart);
document.getElementById('chartType').addEventListener('change', drawChart);

function drawChart() {
  const houseName = document.getElementById('chartHouseSelect').value;
  const type = document.getElementById('chartType').value;
  if (!houseName) {
    if (chartInstance) chartInstance.destroy();
    return;
  }
  let records = dailyRecords
    .filter(r => r.house === houseName)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (records.length === 0) {
    if (chartInstance) chartInstance.destroy();
    alert('لا توجد بيانات لهذا العنبر');
    return;
  }

  const labels = records.map(r => r.date);
  let dataPoints = [], labelText = '';

  if (type === 'weight') {
    dataPoints = records.map(r => r.weight || 0);
    labelText = 'متوسط الوزن (جرام)';
  } else if (type === 'dead') {
    dataPoints = records.map(r => r.dead);
    labelText = 'النافق';
  } else if (type === 'feed') {
    // العلف اليومي: قد يكون هناك أكثر من سجل في نفس اليوم (بادي/نامي) فنقوم بتجميعهم
    const dayMap = {};
    records.forEach(r => {
      dayMap[r.date] = (dayMap[r.date] || 0) + r.feedBags * 50;
    });
    const sortedDates = Object.keys(dayMap).sort();
    labels.length = 0;
    dataPoints = [];
    sortedDates.forEach(d => {
      labels.push(d);
      dataPoints.push(dayMap[d]);
    });
    labelText = 'العلف (كجم)';
  }

  const ctx = document.getElementById('myChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: labelText,
        data: dataPoints,
        borderColor: '#2d6a4f',
        backgroundColor: 'rgba(45,106,79,0.2)',
        tension: 0.1
      }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

// ========== دوال مساعدة ==========
function getArabicFeedName(type) {
  switch(type) {
    case 'starter': return 'بادي';
    case 'grower': return 'نامي';
    case 'finisher': return 'ناهي';
    default: return type;
  }
}

// ========== التهيئة الأولية ==========
function init() {
  loadData();
  populateHouseSelects();
  document.getElementById('date').valueAsDate = new Date();
  document.getElementById('loanDate').valueAsDate = new Date();
  updateFeedHint();
  showTab('daily');
}
init();