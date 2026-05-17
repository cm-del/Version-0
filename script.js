// مفتاح الحفظ في localStorage
const STORAGE_KEY = 'poultryFarmData';
let records = [];

// تحميل البيانات عند فتح الصفحة
function loadRecords() {
  const stored = localStorage.getItem(STORAGE_KEY);
  records = stored ? JSON.parse(stored) : [];
  renderTable();
  updateSummary();
}

// حفظ البيانات إلى localStorage
function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// عرض الجدول
function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  records.forEach((rec, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${rec.date}</td>
      <td>${rec.birdsCount}</td>
      <td>${rec.dead}</td>
      <td>${rec.weight || '-'}</td>
      <td>${rec.feed}</td>
      <td>${rec.cost}</td>
      <td>${rec.notes || '-'}</td>
      <td><button class="delete" onclick="deleteRecord(${index})">🗑️</button></td>
    `;
    tbody.appendChild(row);
  });
}

// تحديث الملخص
function updateSummary() {
  let totalDead = 0, totalFeed = 0, totalCost = 0;
  records.forEach(rec => {
    totalDead += Number(rec.dead) || 0;
    totalFeed += Number(rec.feed) || 0;
    totalCost += Number(rec.cost) || 0;
  });
  document.getElementById('totalDead').textContent = totalDead;
  document.getElementById('totalFeed').textContent = totalFeed.toFixed(2);
  document.getElementById('totalCost').textContent = totalCost.toFixed(2);
}

// إضافة سجل جديد
document.getElementById('dataForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const newRecord = {
    date: document.getElementById('date').value,
    birdsCount: document.getElementById('birdsCount').value,
    dead: document.getElementById('dead').value,
    weight: document.getElementById('weight').value,
    feed: document.getElementById('feed').value,
    cost: document.getElementById('cost').value,
    notes: document.getElementById('notes').value
  };

  records.push(newRecord);
  saveRecords();
  renderTable();
  updateSummary();
  this.reset();
});

// حذف صف واحد
function deleteRecord(index) {
  if (confirm('هل تريد حذف هذا السجل؟')) {
    records.splice(index, 1);
    saveRecords();
    renderTable();
    updateSummary();
  }
}

// مسح كل البيانات
function clearAll() {
  if (confirm('تحذير: سيتم مسح جميع السجلات نهائياً. هل أنت متأكد؟')) {
    records = [];
    saveRecords();
    renderTable();
    updateSummary();
  }
}

// تشغيل التحميل أول مرة
loadRecords();