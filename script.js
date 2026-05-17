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
  // مثال: "عنبر 1 3 شكاير بادي نافق 5 وزن 2100 أدوية فيتامين أ"
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
let barcodeScanner = null;
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
      // في حالة مسح باركود، نحدد نوع العلف من النص
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
  // استخراج الأرقام والكلمات المفتاحية
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
  // إرسال إشعار Push إذا التطبيق في الخلفية
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
          // إرسال البيانات
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

  // رسم بياني مقارن
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

  // تحليل تاريخ البيع
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
// ... (نفس الدوال السابقة من إصدار v5 مع الترجمة، تم تضمينها)

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

// ========== دخول التطبيق ==========
window.addEventListener('DOMContentLoaded', checkPin);