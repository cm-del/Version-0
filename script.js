// ========== IndexedDB ==========
const DB_NAME = 'PoultryFarmDBv7';
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
let currentPin = localStorage.getItem('appPin') || '';

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
    analytics: 'تحليلات',
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
    houseName: 'اسم العنبر:',
    initialCount: 'العدد الأولي:',
    initialWeight: 'الوزن الابتدائي (جرام):',
    deleteConfirm: 'هل أنت متأكد من حذف هذا العنبر؟',
    currentCount: 'العدد الحالي',
    lastWeight: 'آخر وزن',
    lastRecord: 'آخر تسجيل',
    estimated: 'المقترح',
    bags: 'ش',
    stock: 'الرصيد',
    kg: 'كجم',
    age: 'العمر',
    timeline: 'الجدول الزمني',
    sync: 'مزامنة مع جهاز آخر',
    ocr: 'مسح فاتورة',
    pin: 'تغيير رمز PIN',
    voiceNotSupported: 'المتصفح لا يدعم الإدخال الصوتي',
    ocrProcessing: 'جاري تحليل الصورة...',
    syncConnected: 'تم الاتصال بالجهاز الآخر',
    syncWaiting: 'في انتظار اتصال...',
    weatherLoading: 'جاري تحميل الطقس...',
    whatsappShare: 'مشاركة عبر واتساب',
    analyticsTitle: 'تحليلات متقدمة',
    selectHouseCycle: 'اختر عنبراً ودورة',
    noDataForAnalytics: 'لا توجد بيانات كافية للتحليلات',
    weather: 'الطقس',
    humidity: 'الرطوبة',
    temperature: 'درجة الحرارة',
    syncPeerId: 'معرف جهازك:',
    enterPeerId: 'أدخل معرف الجهاز الآخر:',
    connect: 'اتصال',
    sendData: 'إرسال البيانات',
    receiveData: 'استقبال البيانات',
    enterPin: 'أدخل الرمز الجديد (4 أرقام):',
    wrongPin: 'رمز خاطئ',
    pinSaved: 'تم حفظ الرمز',
    noPin: 'لا يوجد رمز، اضغط دخول للمتابعة',
    ocrResult: 'نتيجة المسح',
    extractData: 'استخراج البيانات',
    barcodeNotFound: 'لم يتم العثور على باركود',
    barcodeScanning: 'جاري مسح الباركود...',
    shareMessage: 'ملخص الدورة الحالية',
    predictedSellDate: 'تاريخ البيع المتوقع',
    costPerKg: 'تكلفة الكيلو',
    profitMargin: 'هامش الربح المتوقع',
    timelineEmpty: 'لا توجد سجلات لهذه الدورة',
    feedConsumed: 'علف مستهلك',
    weightProgress: 'تطور الوزن',
    mortalityTotal: 'إجمالي النافق',
    dailyMortality: 'نافق يومي',
    comparisonChart: 'رسم بياني مقارن',
    avgWeight: 'متوسط الوزن',
  },
  en: {
    offline: 'You are offline',
    appName: 'Poultry Farm',
    home: 'Home',
    warehouse: 'Warehouse',
    loans: 'Loans',
    analytics: 'Analytics',
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
    houseName: 'House name:',
    initialCount: 'Initial count:',
    initialWeight: 'Initial weight (g):',
    deleteConfirm: 'Are you sure you want to delete this house?',
    currentCount: 'Current Count',
    lastWeight: 'Last Weight',
    lastRecord: 'Last Record',
    estimated: 'Estimated',
    bags: 'bags',
    stock: 'Stock',
    kg: 'kg',
    age: 'Age',
    timeline: 'Timeline',
    sync: 'Sync with another device',
    ocr: 'Scan Invoice',
    pin: 'Change PIN',
    voiceNotSupported: 'Voice input not supported',
    ocrProcessing: 'Processing image...',
    syncConnected: 'Connected to peer',
    syncWaiting: 'Waiting for connection...',
    weatherLoading: 'Loading weather...',
    whatsappShare: 'Share via WhatsApp',
    analyticsTitle: 'Advanced Analytics',
    selectHouseCycle: 'Select a house and cycle',
    noDataForAnalytics: 'Not enough data for analytics',
    weather: 'Weather',
    humidity: 'Humidity',
    temperature: 'Temperature',
    syncPeerId: 'Your Peer ID:',
    enterPeerId: 'Enter peer ID:',
    connect: 'Connect',
    sendData: 'Send Data',
    receiveData: 'Receive Data',
    enterPin: 'Enter new PIN (4 digits):',
    wrongPin: 'Wrong PIN',
    pinSaved: 'PIN saved',
    noPin: 'No PIN set, press Enter to continue',
    ocrResult: 'OCR Result',
    extractData: 'Extract Data',
    barcodeNotFound: 'Barcode not found',
    barcodeScanning: 'Scanning barcode...',
    shareMessage: 'Current Cycle Summary',
    predictedSellDate: 'Predicted sell date',
    costPerKg: 'Cost per kg',
    profitMargin: 'Expected profit margin',
    timelineEmpty: 'No records for this cycle',
    feedConsumed: 'Feed Consumed',
    weightProgress: 'Weight Progress',
    mortalityTotal: 'Total Mortality',
    dailyMortality: 'Daily Mortality',
    comparisonChart: 'Comparison Chart',
    avgWeight: 'Average Weight',
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
}

function changeLanguage(lang) {
  currentLanguage = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  localStorage.setItem('language', lang);
  applyTranslations();
  const activeTab = document.querySelector('.nav-btn.active')?.dataset.tab;
  if (activeTab) renderTab(activeTab);
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

// ========== PIN ==========
function checkPin() {
  currentPin = localStorage.getItem('appPin') || '';
  if (!currentPin) {
    document.getElementById('pinScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
    initApp();
    return;
  }
  document.getElementById('pinScreen').style.display = 'flex';
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('pinInput').focus();
}

function submitPin() {
  const input = document.getElementById('pinInput').value;
  if (input === currentPin) {
    document.getElementById('pinScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
    document.getElementById('pinError').style.display = 'none';
    initApp();
  } else {
    document.getElementById('pinError').style.display = 'block';
    document.getElementById('pinInput').value = '';
  }
}

function setupPin() {
  const newPin = prompt(t('enterPin'));
  if (newPin && newPin.length === 4 && /^\d+$/.test(newPin)) {
    localStorage.setItem('appPin', newPin);
    currentPin = newPin;
    alert(t('pinSaved'));
  } else if (newPin) {
    alert(t('wrongPin'));
  }
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
  else if (tab === 'analytics') renderAnalytics();
  else if (tab === 'more') setupMore();
  checkAlerts();
  if (tab === 'dashboard') loadWeather();
}

// ========== الطقس ==========
async function loadWeather() {
  const widget = document.getElementById('weatherWidget');
  if (!widget) return;
  widget.textContent = t('weatherLoading');
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
    const { latitude, longitude } = pos.coords;
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relativehumidity_2m&timezone=auto`);
    const json = await resp.json();
    const temp = json.current_weather.temperature;
    const humidity = json.hourly.relativehumidity_2m[0];
    widget.innerHTML = `🌡 ${temp}°C | 💧 ${humidity}% ${t('humidity')}`;
  } catch {
    widget.textContent = '';
  }
}

// ========== اللوحة الرئيسية ==========
function renderDashboard() {
  const container = document.getElementById('dashboardContent');
  let html = '';
  if (houses.length === 0) html = `<p>${t('noHouses')}</p>`;
  else {
    houses.forEach(house => {
      const cycle = getActiveCycle(house);
      if (!cycle) return;
      const recs = dailyRecords.filter(r => r.house === house.name && r.cycleId === cycle.id);
      const dead = recs.reduce((s, r) => s + r.dead, 0);
      const birds = Math.max(0, cycle.initialCount - dead);
      const lastRec = recs.sort((a,b)=>b.date.localeCompare(a.date))[0];
      html += `<div class="dashboard-card">
        <h3>${house.name} - ${t('cycle')} ${cycle.startDate}</h3>
        <div class="card-row"><span>🐣 ${t('currentCount')}:</span><strong>${birds}</strong></div>
        <div class="card-row"><span>⚖️ ${t('lastWeight')}:</span><strong>${lastRec?.weight || 0} جم</strong></div>
        <div class="card-row"><span>📅 ${t('lastRecord')}:</span><strong>${lastRec?.date || '—'}</strong></div>
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

// ========== الإدخال الصوتي ==========
let recognition = null;
function startVoiceInput() {
  if (!('webkitSpeechRecognition' in window)) {
    alert(t('voiceNotSupported'));
    return;
  }
  recognition = new webkitSpeechRecognition();
  recognition.lang = currentLanguage === 'ar' ? 'ar-SA' : 'en-US';
  recognition.continuous = false;
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    parseVoiceInput(transcript);
  };
  recognition.start();
}

function parseVoiceInput(text) {
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'عنبر' || words[i].toLowerCase() === 'house') {
      const val = words[i+1];
      if (val) {
        document.getElementById('houseSelect').value = val;
        document.getElementById('houseSelect').dispatchEvent(new Event('change'));
      }
    }
    if (words[i] === 'شكاير' || words[i].toLowerCase() === 'bags') {
      const val = parseFloat(words[i-1]);
      if (!isNaN(val)) document.getElementById('feedBags').value = val;
    }
    if (words[i] === 'بادي' || words[i].toLowerCase() === 'starter') document.getElementById('feedType').value = 'starter';
    if (words[i] === 'نامي' || words[i].toLowerCase() === 'grower') document.getElementById('feedType').value = 'grower';
    if (words[i] === 'ناهي' || words[i].toLowerCase() === 'finisher') document.getElementById('feedType').value = 'finisher';
    if (words[i] === 'نافق' || words[i].toLowerCase() === 'dead') {
      const val = parseInt(words[i+1]);
      if (!isNaN(val)) document.getElementById('dead').value = val;
    }
    if (words[i] === 'وزن' || words[i].toLowerCase() === 'weight') {
      const val = parseFloat(words[i+1]);
      if (!isNaN(val)) document.getElementById('weight').value = val;
    }
    if (words[i] === 'أدوية' || words[i].toLowerCase() === 'medications') {
      const meds = words.slice(i+1).join(' ');
      document.getElementById('medications').value = meds;
      break;
    }
  }
  updateFeedHintAndEstimate();
}

// ========== الباركود ==========
function startBarcodeScan(targetFieldId) {
  const el = document.createElement('div');
  el.id = 'barcodeScanner';
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.width = '100%';
  el.style.height = '100%';
  el.style.background = '#000';
  el.style.zIndex = '3000';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.innerHTML = `<div style="width:300px;height:300px"><div id="barcodeReader"></div></div>
    <button style="margin-top:20px" onclick="document.getElementById('barcodeScanner').remove()">إغلاق</button>`;
  document.body.appendChild(el);

  const html5QrCode = new Html5Qrcode("barcodeReader");
  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      const text = decodedText.toLowerCase();
      let feedType = '';
      if (text.includes('starter') || text.includes('بادي')) feedType = 'starter';
      else if (text.includes('grower') || text.includes('نامي')) feedType = 'grower';
      else if (text.includes('finisher') || text.includes('ناهي')) feedType = 'finisher';
      if (feedType && document.getElementById(targetFieldId)) {
        document.getElementById(targetFieldId).value = feedType;
        if (targetFieldId === 'feedType') updateFeedHintAndEstimate();
      }
      html5QrCode.stop().then(() => el.remove());
    },
    () => {}
  ).catch(err => {
    alert(t('barcodeNotFound'));
    el.remove();
  });
}

// ========== OCR ==========
function startOCR() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('ocrModal').style.display = 'flex';
    document.getElementById('ocrText').value = t('ocrProcessing');
    const result = await Tesseract.recognize(file, 'ara+eng');
    document.getElementById('ocrText').value = result.data.text;
  };
  input.click();
}

function parseOCRText() {
  const text = document.getElementById('ocrText').value;
  const lines = text.split('\n');
  lines.forEach(line => {
    if (line.includes('كيلو') || line.includes('kg')) {
      const num = parseFloat(line.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) alert(`الكمية المستخرجة: ${num} كجم`);
    }
    if (line.includes('جنيه') || line.includes('egp')) {
      const num = parseFloat(line.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) alert(`المبلغ المستخرج: ${num} ج.م`);
    }
  });
  document.getElementById('ocrModal').style.display = 'none';
}

// ========== تنبيهات Push ==========
function checkAlerts() {
  let alerts = [];
  for (let t in stock) if (stock[t] < 3) alerts.push(`${t('stock')} ${getArabicFeedName(t)}: ${stock[t]} ${t('bags')}`);
  const today = new Date().toISOString().slice(0,10);
  houses.forEach(house => {
    const cycle = getActiveCycle(house);
    if (!cycle) return;
    const recs = dailyRecords.filter(r => r.house === house.name && r.cycleId === cycle.id);
    if (recs.length && recs.sort((a,b)=>b.date.localeCompare(a.date))[0].date < today)
      alerts.push(`${house.name} ${t('lastRecord')} ${today}`);
    if (cycle.startDate) {
      const days = Math.floor((new Date() - new Date(cycle.startDate)) / 86400000);
      if (days >= 40 && days <= 45) alerts.push(`${house.name} ${t('predictedSellDate')}`);
    }
  });
  const bar = document.getElementById('alertBar');
  if (bar) {
    bar.style.display = alerts.length ? 'block' : 'none';
    bar.textContent = alerts.join(' | ');
  }
  if (alerts.length && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_ALERT',
      body: alerts[0]
    });
  }
}

// ========== المزامنة (PeerJS) ==========
let peer = null, syncConn = null;
function startSync() {
  if (!peer) {
    peer = new Peer();
    peer.on('open', (id) => {
      document.getElementById('syncStatus').innerHTML = `${t('syncPeerId')} <strong>${id}</strong>`;
      const otherId = prompt(t('enterPeerId'));
      if (otherId) {
        syncConn = peer.connect(otherId);
        syncConn.on('open', () => {
          document.getElementById('syncStatus').innerHTML = t('syncConnected');
          syncConn.send({ houses, dailyRecords, loans, stock });
        });
        syncConn.on('data', async (data) => {
          houses = data.houses; dailyRecords = data.dailyRecords;
          loans = data.loans; stock = data.stock;
          await persistData();
          alert(t('importData') + ' ' + t('done'));
          renderTab('dashboard');
        });
      }
    });
    peer.on('connection', (conn) => {
      syncConn = conn;
      conn.on('open', () => {
        document.getElementById('syncStatus').innerHTML = t('syncConnected');
      });
      conn.on('data', async (data) => {
        houses = data.houses; dailyRecords = data.dailyRecords;
        loans = data.loans; stock = data.stock;
        await persistData();
        alert(t('importData') + ' ' + t('done'));
        renderTab('dashboard');
      });
    });
  }
}

// ========== تحليلات متقدمة ==========
function renderAnalytics() {
  const container = document.getElementById('analyticsContent');
  if (!houses.length || !dailyRecords.length) {
    container.innerHTML = `<p>${t('noDataForAnalytics')}</p>`;
    return;
  }
  let html = `<h4>${t('comparisonChart')}</h4><canvas id="analyticsChart" width="300" height="200"></canvas>`;
  html += `<h4>${t('predictedSellDate')}</h4><div id="sellPrediction"></div>`;
  html += `<h4>${t('costPerKg')}</h4><div id="costAnalysis"></div>`;
  container.innerHTML = html;

  const ctx = document.getElementById('analyticsChart')?.getContext('2d');
  if (ctx) {
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: houses.map(h => h.name),
        datasets: [{
          label: t('feedConsumed'),
          data: houses.map(h => {
            const cycle = getActiveCycle(h);
            return cycle ? dailyRecords.filter(r => r.house === h.name && r.cycleId === cycle.id).reduce((s,r)=>s+r.feedBags*50,0) : 0;
          }),
          backgroundColor: '#2c3e50'
        }]
      }
    });
  }

  houses.forEach(house => {
    const cycle = getActiveCycle(house);
    if (!cycle) return;
    const start = new Date(cycle.startDate);
    const sellDate = new Date(start.getTime() + 42 * 86400000);
    document.getElementById('sellPrediction').innerHTML += `<p>${house.name}: ${sellDate.toLocaleDateString()}</p>`;
  });
}

// ========== واتساب ==========
function shareWhatsApp() {
  if (!currentHouse || !currentCycleId) return;
  const house = houses.find(h => h.name === currentHouse);
  const cycle = house?.cycles?.find(c => c.id === currentCycleId);
  const recs = dailyRecords.filter(r => r.house === currentHouse && r.cycleId === currentCycleId);
  const dead = recs.reduce((s,r)=>s+r.dead,0);
  const birds = Math.max(0, cycle.initialCount - dead);
  const lastWeight = recs.sort((a,b)=>a.date.localeCompare(b.date)).pop()?.weight || 0;
  const msg = `${t('shareMessage')} ${house.name} - ${cycle.startDate}:\n🐣 ${birds} | ⚖️ ${lastWeight}جم`;
  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ========== باقي الدوال (اليومي، المخزن، السلف، الرسوم، التقويم...) ==========
function setupDailyTab() {
  populateHouseSelect();
  document.getElementById('houseSelect').addEventListener('change', onHouseChange);
  document.getElementById('cycleSelect').addEventListener('change', onCycleChange);
  document.getElementById('feedType').addEventListener('change', updateFeedHintAndEstimate);
  document.getElementById('date').addEventListener('change', updateFeedEstimate);
  document.getElementById('dailyForm').addEventListener('submit', onDailySubmit);
  document.getElementById('houseSelect').dispatchEvent(new Event('change'));
  document.getElementById('date').valueAsDate = new Date();
}

function populateHouseSelect() {
  const sel = document.getElementById('houseSelect');
  if (!sel) return;
  sel.innerHTML = houses.length ? houses.map(h => `<option value="${h.name}">${h.name}</option>`).join('') : '<option>لا عنابر</option>';
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
  if (!house?.cycles) { sel.innerHTML = '<option>لا دورات</option>'; currentCycleId = null; return; }
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

// ** دوال العنابر **
function addHouse() {
  const name = prompt(t('houseName'));
  if (!name?.trim()) return;
  if (houses.some(h => h.name === name.trim())) { alert('موجود'); return; }
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
    if (houses.length) currentHouse = houses[0].name;
    populateHouseSelect();
    updateCycleSelect();
    renderDailyTable();
    updatePerformance();
  });
}

function addCycle() {
  if (!currentHouse) { alert(t('selectHouseCycle')); return; }
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
  if (feedBags <= 0) { alert('عدد الشكاير غير صحيح'); return; }

  if (editingId) {
    const old = dailyRecords.find(r => r.id === editingId);
    if (old) stock[old.feedType] += old.feedBags;
  }
  if (stock[feedType] < feedBags) { alert('رصيد غير كاف'); return; }
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

// ========== المخزن ==========
function setupWarehouse() {
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
function renderWarehouse() {
  const div = document.getElementById('warehouseStock');
  if (div) div.innerHTML = `بادي: ${stock.starter} ش | نامي: ${stock.grower} ش | ناهي: ${stock.finisher} ش`;
}

// ========== السلف ==========
function setupLoans() {
  document.getElementById('loanForm').addEventListener('submit', onLoanSubmit);
  renderLoansTable();
  document.getElementById('loanDate').valueAsDate = new Date();
}
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
    document.getElementById('loanSubmitBtn').innerHTML = `💾 ${t('save')}`;
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
  document.getElementById('loanSubmitBtn').innerHTML = `✏️ ${t('update')}`;
  document.getElementById('cancelLoanEditBtn').style.display = 'inline-block';
}
function cancelLoanEdit() {
  editingLoanId = null;
  document.getElementById('loanSubmitBtn').innerHTML = `💾 ${t('save')}`;
  document.getElementById('cancelLoanEditBtn').style.display = 'none';
  document.getElementById('loanForm').reset();
}
async function deleteLoan(id) {
  if (!confirm(t('deleteConfirm'))) return;
  loans = loans.filter(l => l.id !== id);
  await persistData();
  renderLoansTable();
}
function renderLoansTable() {
  const tbody = document.getElementById('loansBody');
  if (!tbody) return;
  tbody.innerHTML = loans.sort((a,b) => b.date.localeCompare(a.date)).map(l => `
    <tr><td>${l.date}</td><td>${l.person}</td><td>${l.amount}</td>
    <td><button onclick="editLoan(${l.id})">✏️</button></td>
    <td><button class="danger" onclick="deleteLoan(${l.id})">🗑️</button></td></tr>
  `).join('');
}

// ========== الرسوم البيانية ==========
function setupCharts() {
  const houseSel = document.getElementById('chartHouseSelect');
  if (!houseSel) return;
  houseSel.innerHTML = houses.map(h => `<option value="${h.name}">${h.name}</option>`).join('');
  houseSel.addEventListener('change', updateCycleComparison);
  document.getElementById('chartType')?.addEventListener('change', drawChart);
  if (houses.length) houseSel.dispatchEvent(new Event('change'));
}
function updateCycleComparison() {
  const house = houses.find(h => h.name === document.getElementById('chartHouseSelect')?.value);
  const s1 = document.getElementById('cycle1Select');
  const s2 = document.getElementById('cycle2Select');
  if (!s1 || !s2) return;
  s1.innerHTML = s2.innerHTML = '<option value="">اختر</option>';
  if (house?.cycles) {
    house.cycles.forEach(c => {
      const opt = `<option value="${c.id}">${c.startDate}</option>`;
      s1.innerHTML += opt;
      s2.innerHTML += opt;
    });
  }
  s2.innerHTML = '<option value="">لا مقارنة</option>' + s2.innerHTML;
  s1.addEventListener('change', drawChart);
  s2.addEventListener('change', drawChart);
  drawChart();
}
function drawChart() {
  const houseSel = document.getElementById('chartHouseSelect');
  const house = houseSel?.value;
  const cycle1 = document.getElementById('cycle1Select')?.value;
  const cycle2 = document.getElementById('cycle2Select')?.value;
  const type = document.getElementById('chartType')?.value;
  if (!house || !cycle1) { if(chartInstance) chartInstance.destroy(); return; }
  const getData = (cycleId) => {
    const recs = dailyRecords.filter(r => r.house === house && r.cycleId === cycleId).sort((a,b)=>a.date.localeCompare(b.date));
    if (type === 'weight') return recs.map(r => r.weight || 0);
    if (type === 'dead') return recs.map(r => r.dead);
    const days = {};
    recs.forEach(r => days[r.date] = (days[r.date]||0) + r.feedBags*50);
    return Object.keys(days).sort().map(d => days[d]);
  };
  const labels = type==='feed' ? [...new Set(dailyRecords.filter(r=>r.house===house&&(r.cycleId===cycle1||r.cycleId===cycle2)).map(r=>r.date))].sort()
    : dailyRecords.filter(r=>r.house===house&&r.cycleId===cycle1).sort((a,b)=>a.date.localeCompare(b.date)).map(r=>r.date);
  const datasets = [{ label: `دورة 1`, data: getData(cycle1), borderColor: '#2c3e50', tension: 0.1 }];
  if (cycle2) datasets.push({ label: `دورة 2`, data: getData(cycle2), borderColor: '#c0392b', tension: 0.1 });
  const ctx = document.getElementById('myChart')?.getContext('2d');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, { type: 'line', data: { labels, datasets }, options: { responsive: true } });
}

// ========== أعمدة قابلة للتخصيص ==========
function toggleColumnPicker() {
  const modal = document.getElementById('columnPickerModal');
  const container = document.getElementById('columnChecks');
  container.innerHTML = '';
  for (let key in columnVisibility) {
    container.innerHTML += `<label><input type="checkbox" class="col-cb" data-key="${key}" ${columnVisibility[key]?'checked':''}> ${key}</label><br>`;
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

// ========== التقويم ==========
let datePickerCallback = null, currentDisplayMonth = new Date().getMonth(), currentDisplayYear = new Date().getFullYear(), selectedPickerDate = null;

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
  weekDays.forEach(day => html += `<div class="day-header">${day}</div>`);
  for (let i = 0; i < firstDay; i++) html += `<div class="day-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(currentDisplayYear, currentDisplayMonth, day);
    const dateStr = dateObj.toISOString().slice(0,10);
    const isSelected = selectedPickerDate && selectedPickerDate.toISOString().slice(0,10) === dateStr;
    html += `<div class="day-cell${isSelected ? ' selected' : ''}" data-date="${dateStr}">${day}</div>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.day-cell:not(.empty)').forEach(cell => {
    cell.addEventListener('click', () => { selectedPickerDate = new Date(cell.dataset.date); renderCalendar(); });
  });
  document.getElementById('prevMonth').onclick = () => {
    if (currentDisplayMonth === 0) { currentDisplayYear--; currentDisplayMonth = 11; }
    else currentDisplayMonth--;
    renderCalendar();
  };
  document.getElementById('nextMonth').onclick = () => {
    if (currentDisplayMonth === 11) { currentDisplayYear++; currentDisplayMonth = 0; }
    else currentDisplayMonth++;
    renderCalendar();
  };
}
document.getElementById('confirmDateBtn').addEventListener('click', () => {
  if (selectedPickerDate && datePickerCallback) datePickerCallback(selectedPickerDate.toISOString().slice(0,10));
  document.getElementById('datePickerModal').style.display = 'none';
  datePickerCallback = null;
});
document.getElementById('clearDateBtn').addEventListener('click', () => {
  document.getElementById('datePickerModal').style.display = 'none';
  datePickerCallback = null;
});

// ========== تصدير/استيراد ==========
function exportAllData() { downloadJSON({ houses, dailyRecords, loans, stock }, 'farm_full_backup.json'); }
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
async function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      houses = json.houses || []; dailyRecords = json.dailyRecords || [];
      loans = json.loans || []; stock = json.stock || {};
      await persistData();
      alert('تم الاستيراد');
      location.reload();
    } catch { alert('ملف غير صالح'); }
  };
  reader.readAsText(file);
}
async function clearAllData() {
  if (confirm('مسح كل شيء؟')) {
    houses = []; dailyRecords = []; loans = []; stock = { starter:0, grower:0, finisher:0 };
    await persistData();
    location.reload();
  }
}

// ========== QR ==========
function showQRExport() {
  const container = document.getElementById('qrContainer');
  container.innerHTML = '';
  new QRCode(container, {
    text: JSON.stringify({ houses, dailyRecords, loans, stock }),
    width: 250, height: 250,
    colorDark: '#2c3e50', colorLight: '#ffffff'
  });
}
function startQRImport() {
  const readerEl = document.getElementById('reader');
  readerEl.innerHTML = '';
  const html5QrCode = new Html5Qrcode("reader");
  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    async (decodedText) => {
      try {
        const json = JSON.parse(decodedText);
        if (json.houses && json.dailyRecords && json.loans && json.stock) {
          houses = json.houses; dailyRecords = json.dailyRecords;
          loans = json.loans; stock = json.stock;
          await persistData();
          alert('تم استيراد البيانات');
          html5QrCode.stop().then(() => readerEl.innerHTML = '');
          renderTab('dashboard');
        } else throw new Error();
      } catch { alert('QR غير صالح'); }
    },
    () => {}
  ).catch(err => alert('خطأ في الكاميرا: ' + err));
}

// ========== إعدادات ==========
function setupMore() {
  document.getElementById('installBtn').style.display = deferredPrompt ? 'block' : 'none';
  document.getElementById('importFile').addEventListener('change', importAllData);
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
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; document.getElementById('installBtn').style.display = 'none'; });
  }
}

// ========== اتصال ==========
window.addEventListener('online', () => document.getElementById('offlineBar').style.display = 'none');
window.addEventListener('offline', () => document.getElementById('offlineBar').style.display = 'block');

// ========== بدء التطبيق ==========
async function initApp() {
  currentLanguage = localStorage.getItem('language') || 'ar';
  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr';
  await loadDataFromDB();
  applyTranslations();
  renderTab('dashboard');
  if (!navigator.onLine) document.getElementById('offlineBar').style.display = 'block';
}

window.addEventListener('DOMContentLoaded', checkPin);
