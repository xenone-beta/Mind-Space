const STORAGE_KEY = 'mind-space.entries.v1';

const MOODS = [
  { id: 'great', label: 'Отлично', emoji: '😄', score: 10, color: '#4ef0a4' },
  { id: 'good', label: 'Хорошо', emoji: '🙂', score: 8, color: '#6de3ff' },
  { id: 'neutral', label: 'Нейтрально', emoji: '😐', score: 6, color: '#9ea4d1' },
  { id: 'sad', label: 'Грустно', emoji: '😔', score: 4, color: '#8194ff' },
  { id: 'bad', label: 'Плохо', emoji: '😞', score: 3, color: '#9b7bff' },
  { id: 'stress', label: 'Стресс', emoji: '😣', score: 2, color: '#ff7c9b' },
  { id: 'energy', label: 'Энергия', emoji: '⚡', score: 9, color: '#f6dd5d' },
];

const TAGS = ['Работа', 'Семья', 'Здоровье', 'Деньги', 'Хобби', 'Погода'];

const LICENSE_TEXT = `OpenSphere License (OSL)\n\nCopyright (c) 2026 Mind Space contributors\n\nРазрешается бесплатно, при соблюдении условий этой лицензии:\n1. Использовать приложение для личных целей.\n2. Изучать исходный код.\n3. Модифицировать код для личного некоммерческого использования.\n4. Распространять копии исходного кода при условии сохранения этого уведомления и указания авторства.\n\nЗапрещается без письменного согласия правообладателя:\n- использовать код в коммерческих целях (продажа, интеграция в платные сервисы, получение прибыли);\n- включать код в проприетарное (закрытое) ПО;\n- выдавать изменённые версии за оригинальный продукт без явного описания изменений.\n\nОтказ от гарантий:\nПРОЕКТ ПРЕДОСТАВЛЯЕТСЯ «КАК ЕСТЬ», БЕЗ ЛЮБЫХ ГАРАНТИЙ, ЯВНЫХ ИЛИ ПОДРАЗУМЕВАЕМЫХ, ВКЛЮЧАЯ, НО НЕ ОГРАНИЧИВАЯСЬ ГАРАНТИЯМИ ТОВАРНОЙ ПРИГОДНОСТИ, ПРИГОДНОСТИ ДЛЯ КОНКРЕТНОЙ ЦЕЛИ И ОТСУТСТВИЯ НАРУШЕНИЯ ПРАВ.\n\nОграничение ответственности:\nНИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ АВТОРЫ ИЛИ ПРАВООБЛАДАТЕЛИ НЕ НЕСУТ ОТВЕТСТВЕННОСТИ ПО ИСКАМ ИЛИ ИНЫМ ТРЕБОВАНИЯМ, ВОЗНИКШИМ ИЗ-ЗА ИСПОЛЬЗОВАНИЯ ИЛИ НЕВОЗМОЖНОСТИ ИСПОЛЬЗОВАНИЯ ПРОЕКТА.`;

const state = {
  entries: loadEntries(),
  selectedMood: MOODS[2].id,
  selectedTags: new Set(),
  editingId: null,
};

const tabButtons = [...document.querySelectorAll('.tab-btn')];
const panels = [...document.querySelectorAll('.tab-panel')];
const moodOptions = document.getElementById('moodOptions');
const tagOptions = document.getElementById('tagOptions');
const entryForm = document.getElementById('entryForm');
const intensityInput = document.getElementById('intensity');
const intensityValue = document.getElementById('intensityValue');
const noteInput = document.getElementById('note');
const cancelEditButton = document.getElementById('cancelEdit');
const historyList = document.getElementById('historyList');
const historyCardTemplate = document.getElementById('historyCardTemplate');
const heatmap = document.getElementById('heatmap');
const trendCanvas = document.getElementById('trendChart');
const periodSelect = document.getElementById('periodSelect');
const tagCloud = document.getElementById('tagCloud');
const exportJsonButton = document.getElementById('exportJson');
const exportCsvButton = document.getElementById('exportCsv');
const importFileInput = document.getElementById('importFile');
const resetDataButton = document.getElementById('resetData');
const licenseText = document.getElementById('licenseText');

init();

function init() {
  setupTabs();
  renderMoodOptions();
  renderTagOptions();
  bindEvents();
  licenseText.textContent = LICENSE_TEXT;
  refreshUI();
}

function setupTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.toggle('active', b === button));
      panels.forEach((panel) => panel.classList.toggle('active', panel.id === button.dataset.tab));
    });
  });
}

function bindEvents() {
  intensityInput.addEventListener('input', () => {
    intensityValue.textContent = intensityInput.value;
  });

  entryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveEntry();
  });

  cancelEditButton.addEventListener('click', resetForm);
  periodSelect.addEventListener('change', renderTrendChart);

  exportJsonButton.addEventListener('click', () => {
    downloadFile('mind-space-export.json', JSON.stringify(state.entries, null, 2), 'application/json');
  });

  exportCsvButton.addEventListener('click', () => {
    const csvHeader = 'id,createdAt,mood,intensity,note,tags\n';
    const csvRows = state.entries.map((entry) => {
      const tags = entry.tags.join('|').replaceAll('"', '""');
      const note = entry.note.replaceAll('"', '""');
      return `${entry.id},${entry.createdAt},${entry.mood},${entry.intensity},"${note}","${tags}"`;
    });
    downloadFile('mind-space-export.csv', csvHeader + csvRows.join('\n'), 'text/csv;charset=utf-8');
  });

  importFileInput.addEventListener('change', importEntries);

  resetDataButton.addEventListener('click', () => {
    if (!window.confirm('Удалить все записи без возможности восстановления?')) return;
    state.entries = [];
    persistEntries();
    resetForm();
    refreshUI();
  });
}

function renderMoodOptions() {
  moodOptions.innerHTML = '';
  MOODS.forEach((mood) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = `${mood.emoji} ${mood.label}`;
    button.classList.toggle('active', mood.id === state.selectedMood);
    button.addEventListener('click', () => {
      state.selectedMood = mood.id;
      renderMoodOptions();
    });
    moodOptions.appendChild(button);
  });
}

function renderTagOptions() {
  tagOptions.innerHTML = '';
  TAGS.forEach((tag) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = tag;
    button.classList.toggle('active', state.selectedTags.has(tag));
    button.addEventListener('click', () => {
      state.selectedTags.has(tag) ? state.selectedTags.delete(tag) : state.selectedTags.add(tag);
      renderTagOptions();
    });
    tagOptions.appendChild(button);
  });
}

function saveEntry() {
  const payload = {
    id: state.editingId ?? crypto.randomUUID(),
    createdAt: state.editingId ? getExistingEntry(state.editingId)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mood: state.selectedMood,
    intensity: Number(intensityInput.value),
    note: noteInput.value.trim(),
    tags: [...state.selectedTags],
  };

  if (state.editingId) {
    state.entries = state.entries.map((entry) => (entry.id === state.editingId ? payload : entry));
  } else {
    state.entries.unshift(payload);
  }

  persistEntries();
  resetForm();
  refreshUI();
}

function getExistingEntry(id) {
  return state.entries.find((entry) => entry.id === id);
}

function resetForm() {
  state.editingId = null;
  state.selectedMood = MOODS[2].id;
  state.selectedTags = new Set();
  intensityInput.value = '5';
  intensityValue.textContent = '5';
  noteInput.value = '';
  cancelEditButton.classList.add('hidden');
  renderMoodOptions();
  renderTagOptions();
}

function refreshUI() {
  renderHistory();
  renderHeatmap();
  renderTrendChart();
  renderTagCloud();
}

function renderHistory() {
  historyList.innerHTML = '';
  const sorted = [...state.entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!sorted.length) {
    historyList.innerHTML = '<p class="card">Пока нет записей. Добавьте первую на вкладке «Ввод».</p>';
    return;
  }

  sorted.forEach((entry) => {
    const mood = MOODS.find((item) => item.id === entry.mood) ?? MOODS[2];
    const node = historyCardTemplate.content.cloneNode(true);
    const card = node.querySelector('.entry-card');

    card.style.setProperty('--card-color', mood.color);
    node.querySelector('.entry-mood').textContent = `${mood.emoji} ${mood.label} · ${entry.intensity}/10`;
    node.querySelector('.entry-date').textContent = new Date(entry.createdAt).toLocaleString('ru-RU');
    node.querySelector('.entry-note').textContent = entry.note || 'Без заметки';

    const tagsContainer = node.querySelector('.entry-tags');
    entry.tags.forEach((tag) => {
      const chip = document.createElement('span');
      chip.textContent = tag;
      tagsContainer.appendChild(chip);
    });

    node.querySelector('.edit-btn').addEventListener('click', () => startEditing(entry.id));
    node.querySelector('.delete-btn').addEventListener('click', () => deleteEntry(entry.id));

    historyList.appendChild(node);
  });
}

function startEditing(id) {
  const entry = getExistingEntry(id);
  if (!entry) return;
  state.editingId = id;
  state.selectedMood = entry.mood;
  state.selectedTags = new Set(entry.tags);
  intensityInput.value = String(entry.intensity);
  intensityValue.textContent = String(entry.intensity);
  noteInput.value = entry.note;
  cancelEditButton.classList.remove('hidden');
  renderMoodOptions();
  renderTagOptions();
  document.querySelector('[data-tab="entry"]').click();
}

function deleteEntry(id) {
  if (!window.confirm('Удалить эту запись?')) return;
  state.entries = state.entries.filter((entry) => entry.id !== id);
  persistEntries();
  refreshUI();
}

function renderHeatmap() {
  heatmap.innerHTML = '';
  const end = new Date();
  for (let i = 89; i >= 0; i -= 1) {
    const day = new Date(end);
    day.setDate(end.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    const dayEntries = state.entries.filter((entry) => entry.createdAt.startsWith(key));
    const representative = chooseDailyRepresentative(dayEntries);

    const cell = document.createElement('div');
    cell.className = 'heat-cell';
    if (representative) {
      const mood = MOODS.find((item) => item.id === representative.mood) ?? MOODS[2];
      const alpha = Math.max(0.25, representative.intensity / 10);
      cell.style.background = hexToRgba(mood.color, alpha);
      cell.title = `${key}: ${mood.label}, интенсивность ${representative.intensity}`;
    } else {
      cell.title = `${key}: нет данных`;
    }
    heatmap.appendChild(cell);
  }
}

function chooseDailyRepresentative(entries) {
  if (!entries.length) return null;
  const grouped = entries.reduce((acc, entry) => {
    const list = acc[entry.mood] ?? [];
    list.push(entry);
    acc[entry.mood] = list;
    return acc;
  }, {});

  const moodId = Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length || avgIntensity(b[1]) - avgIntensity(a[1]))[0][0];

  const moodEntries = grouped[moodId];
  return moodEntries.sort((a, b) => b.intensity - a.intensity)[0];
}

function avgIntensity(entries) {
  return entries.reduce((sum, entry) => sum + entry.intensity, 0) / entries.length;
}

function renderTrendChart() {
  const period = Number(periodSelect.value);
  const labels = [];
  const points = [];

  for (let i = period - 1; i >= 0; i -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    const dayEntries = state.entries.filter((entry) => entry.createdAt.startsWith(key));
    const value = dayEntries.length
      ? dayEntries.reduce((sum, entry) => sum + moodScore(entry) * (entry.intensity / 10), 0) / dayEntries.length
      : null;

    labels.push(`${day.getDate()}.${day.getMonth() + 1}`);
    points.push(value);
  }

  drawLineChart(trendCanvas, labels, points);
}

function drawLineChart(canvas, labels, points) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const pad = 28;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#36407f';
  ctx.lineWidth = 1;
  for (let y = 0; y <= 4; y += 1) {
    const yy = pad + (y * (height - pad * 2)) / 4;
    ctx.beginPath();
    ctx.moveTo(pad, yy);
    ctx.lineTo(width - pad, yy);
    ctx.stroke();
  }

  const nonNull = points.filter((value) => value !== null);
  const min = nonNull.length ? Math.min(...nonNull, 0) : 0;
  const max = nonNull.length ? Math.max(...nonNull, 10) : 10;

  ctx.strokeStyle = '#69f0ff';
  ctx.fillStyle = '#69f0ff';
  ctx.lineWidth = 2;
  ctx.beginPath();

  let started = false;
  points.forEach((value, index) => {
    if (value === null) return;
    const x = pad + (index * (width - pad * 2)) / (points.length - 1 || 1);
    const y = height - pad - ((value - min) * (height - pad * 2)) / (max - min || 1);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  points.forEach((value, index) => {
    if (value === null) return;
    const x = pad + (index * (width - pad * 2)) / (points.length - 1 || 1);
    const y = height - pad - ((value - min) * (height - pad * 2)) / (max - min || 1);
    ctx.beginPath();
    ctx.arc(x, y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#aeb6ef';
  ctx.font = '11px sans-serif';
  labels.forEach((label, index) => {
    if (index % Math.ceil(labels.length / 8) !== 0) return;
    const x = pad + (index * (width - pad * 2)) / (labels.length - 1 || 1);
    ctx.fillText(label, x - 14, height - 8);
  });
}

function moodScore(entry) {
  return MOODS.find((mood) => mood.id === entry.mood)?.score ?? 5;
}

function renderTagCloud() {
  tagCloud.innerHTML = '';
  const freq = new Map();
  state.entries.forEach((entry) => entry.tags.forEach((tag) => freq.set(tag, (freq.get(tag) || 0) + 1)));

  if (!freq.size) {
    tagCloud.innerHTML = '<p>Пока нет тегов для отображения.</p>';
    return;
  }

  const max = Math.max(...freq.values());
  [...freq.entries()].sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
    const el = document.createElement('span');
    const size = 0.9 + (count / max) * 1.4;
    el.textContent = `${tag} (${count})`;
    el.style.fontSize = `${size}rem`;
    el.style.color = '#dfe3ff';
    tagCloud.appendChild(el);
  });
}

function importEntries(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || '');
      let imported = [];

      if (file.name.endsWith('.json')) {
        imported = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        imported = parseCsv(text);
      }

      if (!Array.isArray(imported)) throw new Error('Некорректный формат данных');

      state.entries = sanitizeEntries(imported);
      persistEntries();
      refreshUI();
      window.alert(`Импортировано записей: ${state.entries.length}`);
    } catch (error) {
      window.alert(`Ошибка импорта: ${error.message}`);
    } finally {
      importFileInput.value = '';
    }
  };

  reader.readAsText(file, 'utf-8');
}

function parseCsv(csv) {
  const rows = csv.trim().split('\n');
  const [header, ...dataRows] = rows;
  if (!header.includes('id,createdAt,mood,intensity,note,tags')) throw new Error('CSV формат не поддерживается');

  return dataRows.map((row) => {
    const [id, createdAt, mood, intensity, note, tags] = row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    return {
      id,
      createdAt,
      mood,
      intensity: Number(intensity),
      note: note?.replaceAll(/^"|"$/g, '').replaceAll('""', '"') || '',
      tags: (tags?.replaceAll(/^"|"$/g, '').split('|') || []).filter(Boolean),
    };
  });
}

function sanitizeEntries(data) {
  return data
    .filter((item) => item && item.id && item.createdAt)
    .map((item) => ({
      id: String(item.id),
      createdAt: new Date(item.createdAt).toISOString(),
      updatedAt: new Date(item.updatedAt || item.createdAt).toISOString(),
      mood: MOODS.some((mood) => mood.id === item.mood) ? item.mood : MOODS[2].id,
      intensity: clamp(Number(item.intensity) || 5, 1, 10),
      note: String(item.note || ''),
      tags: Array.isArray(item.tags) ? item.tags.filter((tag) => TAGS.includes(tag)) : [],
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitizeEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

function persistEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function downloadFile(name, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(href);
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '');
  const bigint = Number.parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
