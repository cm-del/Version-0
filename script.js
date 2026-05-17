// ---------- مفاتيح التخزين ----------
const HOUSES_KEY = 'farmHouses';
const DAILY_KEY = 'farmDailyRecords';
const LOANS_KEY = 'farmLoans';

// ---------- بيانات التطبيق ----------
let houses = [];            // مصفوفة أسماء العنابر
let dailyRecords = [];      // سجلات يومية
let loans = [];             // سلف
let currentHouse = '';      // العنبر النشط في التبويب اليومي
let chartInstance = null;   // لتدمير الرسم القديم قبل إنشاء جديد

// ---------- دوال مساعدة للحفظ والتحميل ----------
function loadData() {
  houses = JSON.parse(localStorage.getItem(HOUSES_KEY) || '[]');
  dailyRecords = JSON.parse(localStorage.getItem(DAILY_KEY) || '[]');
  loans = JSON.parse(localStorage.getItem(LOANS_KEY) || '[]');
}
function saveHouses() { localStorage.setItem(HOUSES_KEY, JSON.stringify(houses)); }
function saveDaily() { localStorage.setItem(DAILY_KEY, JSON.stringify(dailyRecords)); }
function saveLoans() { localStorage.setItem(LOANS_KEY, JSON.stringify(loans)); }

// ---------- إدارة العنابر ----------
function populateHouseSelects() {
  const dailySelect = document.getElementById('houseSelect');
  const chartSelect = document.getElementById('chartHouseSelect');
  dailySelect.innerHTML = chartSelect.innerHTML = '';
  if (houses.length === 0) {
    dailySelect.innerHTML = '<option value="">-- لا يوجد عنابر --</option>';
    chartSelect.innerHTML = '<option value="">-- لا يوجد عنابر --</option>';
  } else {
    houses.forEach(house => {
      dailySelect.innerHTML += `<option value="${house}">${house}</option>`;
      chartSelect.innerHTML += `<option value="${house}">${house}</option>`;
    });
  }
  // استعادة العنبر المختار إن أمكن
  if (currentHouse && houses.includes(currentHouse)) {
    dailySelect.value = currentHouse;
  } else if (houses.length > 0) {
    currentHouse = houses[0];
    dailySelect.value = currentHouse;
  }
  updateCurrentHouseTitle();
}

function addHouse() {
  const name = prompt('اسم العنبر الجديد:');
  if (name && name.trim()) {
    const trimmed = name.trim();
    if (houses.includes(trimmed)) {
      alert('هذا العنبر موجود بالفعل');
      return;
    }
    houses.push(trimmed);
    saveHouses();
    populateHouseSelects();
  }
}

document.getElementById('houseSelect').addEventListener('change', function() {
  currentHouse = this.value;
  updateCurrentHouseTitle();
  renderDailyTable();
});

function updateCurrentHouseTitle() {
  document.getElementById('currentHouseTitle').textContent = currentHouse || '---';
}

// ---------- السجل اليومي ----------
document.getElementById('dailyForm').addEventListener('submit', function(e) {
  e.preventDefault();
  if (!currentHouse) {
    alert('الرجاء اختيار عنبر أولاً');
    return;
  }
  const record = {
    id: Date.now(),
    house: currentHouse,
    date: document.getElementById('date').value,
    feedBags: parseFloat(document.getElementById('feedBags').value) || 0,
    dead: parseInt(document.getElementById('dead').value) || 0,
    medications: document.getElementById('medications').value.trim(),
    expenses: parseFloat(document.getElementById('expenses').value) || 0,
    weight: parseFloat(document.getElementById('weight').value) || 0,
    mortalityNotes: document.getElementById('mortalityNotes').value.trim()
  };
  dailyRecords.push(record);
  saveDaily();
  renderDailyTable();
  this.reset();
  // إعادة تعيين التاريخ لليوم الحالي
  document.getElementById('date').valueAsDate = new Date();
});

function renderDailyTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  if (!currentHouse) return;
  const filtered = dailyRecords
    .filter(r => r.house === currentHouse)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // الأحدث أولاً
  filtered.forEach(rec => {
    const kg = (rec.feedBags * 50).toFixed(1);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${rec.date}</td>
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
  if (confirm('حذف هذا السجل؟')) {
    dailyRecords = dailyRecords.filter(r => r.id !== id);
    saveDaily();
    renderDailyTable();
  }
}

// ---------- السلف ----------
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
  loans
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .forEach(loan => {
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
  if (confirm('حذف هذه السلفة؟')) {
    loans = loans.filter(l => l.id !== id);
    saveLoans();
    renderLoansTable();
  }
}

// ---------- التنقل بين التبويبات ----------
function showTab(tab) {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  if (tab === 'daily') {
    document.getElementById('dailySection').style.display = 'block';
    document.getElementById('tabDaily').classList.add('active');
    renderDailyTable();
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

// ---------- الرسوم البيانية ----------
document.getElementById('chartHouseSelect').addEventListener('change', drawChart);
document.getElementById('chartType').addEventListener('change', drawChart);

function drawChart() {
  const house = document.getElementById('chartHouseSelect').value;
  const type = document.getElementById('chartType').value;
  if (!house) {
    if (chartInstance) chartInstance.destroy();
    return;
  }

  // تصفية سجلات العنبر وترتيبها تصاعدياً بالتاريخ
  let records = dailyRecords
    .filter(r => r.house === house)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (records.length === 0) {
    if (chartInstance) chartInstance.destroy();
    alert('لا توجد بيانات لهذا العنبر بعد');
    return;
  }

  const labels = records.map(r => r.date);
  let dataPoints = [];
  let labelText = '';

  if (type === 'weight') {
    dataPoints = records.map(r => r.weight);
    labelText = 'متوسط الوزن (جرام)';
  } else if (type === 'dead') {
    dataPoints = records.map(r => r.dead);
    labelText = 'النافق';
  } else if (type === 'feed') {
    dataPoints = records.map(r => r.feedBags * 50);
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
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

// ---------- التهيئة الأولية ----------
function init() {
  loadData();
  populateHouseSelects();
  document.getElementById('date').valueAsDate = new Date();
  document.getElementById('loanDate').valueAsDate = new Date();
  // التبويب الافتراضي
  showTab('daily');
}

init();