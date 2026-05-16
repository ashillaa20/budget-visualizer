const form         = document.getElementById('transactionForm');
const txList       = document.getElementById('txList');
const emptyMsg     = document.getElementById('emptyMsg');
const statsEl      = document.getElementById('stats');
const statCount    = document.getElementById('statCount');
const statTotal    = document.getElementById('statTotal');
const statAvg      = document.getElementById('statAvg');
const balanceEl    = document.getElementById('balance');
const categoryEl   = document.getElementById('category');
const filterEl     = document.getElementById('filterCategory');
const sortEl       = document.getElementById('sortOption');
const newCatInput  = document.getElementById('newCategory');
const addCatBtn    = document.getElementById('addCategoryBtn');
const chartBox     = document.getElementById('chartBox');
const chartEmpty   = document.getElementById('chartEmpty');
const toastEl      = document.getElementById('toast');

const itemNameErr  = document.getElementById('itemNameError');
const amountErr    = document.getElementById('amountError');
const categoryErr  = document.getElementById('categoryError');
const catMgrErr    = document.getElementById('categoryMgrError');

let transactions     = load('transactions', []);
let customCategories = load('customCategories', []);

const COLORS = [
  '#2d7a4f','#f5c842','#4caf7d','#e6b82e',
  '#1a5c3a','#f7d96b','#82c9a0','#c0392b',
  '#3d9960','#fae08a','#a8d5b5','#e67e22',
];

const chart = new Chart(
  document.getElementById('expenseChart').getContext('2d'),
  {
    type: 'pie',
    data: { labels: [], datasets: [{ data: [], backgroundColor: COLORS, borderWidth: 2, borderColor: 'transparent', hoverOffset: 6 }] },
    options: {
      responsive: true,
      animation: { duration: 300 },
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 }, color: '#7a7560' } },
        tooltip: {
          callbacks: {
            label(item) {
              const sum = item.dataset.data.reduce((a, b) => a + b, 0);
              const pct = sum > 0 ? ((item.parsed / sum) * 100).toFixed(1) : 0;
              return ` Rp ${item.parsed.toLocaleString('id-ID')} (${pct}%)`;
            }
          }
        }
      }
    }
  }
);

// Init
customCategories.forEach(c => { addOption(categoryEl, c); addOption(filterEl, c); });
refresh();

// Events
form.addEventListener('submit', addTransaction);
sortEl.addEventListener('change', refresh);
filterEl.addEventListener('change', refresh);
addCatBtn.addEventListener('click', addCategory);
txList.addEventListener('click', e => {
  const btn = e.target.closest('[data-id]');
  if (btn) deleteTransaction(Number(btn.dataset.id));
});

// Storage
function load(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function save() {
  try {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
  } catch (e) {
    toast('Storage error — data may not be saved.');
  }
}

// Render
function refresh() {
  const filter = filterEl.value;
  const sort   = sortEl.value;

  let list = filter ? transactions.filter(t => t.category === filter) : [...transactions];

  if (sort === 'amount')   list.sort((a, b) => b.amount - a.amount);
  else if (sort === 'category') list.sort((a, b) => a.category.localeCompare(b.category));
  else if (sort === 'date')     list.sort((a, b) => new Date(b.date) - new Date(a.date));
  else                          list.sort((a, b) => a.id - b.id);

  renderList(list);
  updateBalance();
  updateChart();
}

function renderList(list) {
  txList.innerHTML = '';

  if (list.length === 0) {
    statsEl.hidden  = true;
    emptyMsg.hidden = false;
    emptyMsg.textContent = transactions.length > 0
      ? 'No transactions match this filter.'
      : 'No transactions yet.';
    return;
  }

  statsEl.hidden  = false;
  emptyMsg.hidden = true;

  const total = list.reduce((s, t) => s + t.amount, 0);
  statCount.innerHTML = `<strong>${list.length}</strong> items`;
  statTotal.innerHTML = `Total <strong>Rp ${total.toLocaleString('id-ID')}</strong>`;
  statAvg.innerHTML   = `Avg <strong>Rp ${Math.round(total / list.length).toLocaleString('id-ID')}</strong>`;

  list.forEach(t => {
    const date = t.date
      ? new Date(t.date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

    const el = document.createElement('article');
    el.className = 'tx-item';
    el.setAttribute('role', 'listitem');
    el.innerHTML = `
      <div class="tx-info">
        <strong>${esc(t.name)}</strong>
        <div class="tx-meta">
          <span class="tag">${esc(t.category)}</span>
          <span class="tx-amount">Rp ${t.amount.toLocaleString('id-ID')}</span>
          <span class="tx-date">${date}</span>
        </div>
      </div>
      <button class="btn-delete" data-id="${t.id}" aria-label="Delete ${esc(t.name)}">Delete</button>
    `;
    txList.appendChild(el);
  });
}

function updateBalance() {
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  balanceEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
}

function updateChart() {
  const totals = {};
  transactions.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const labels = Object.keys(totals);
  const data   = Object.values(totals);

  if (labels.length === 0) {
    chartBox.hidden   = true;
    chartEmpty.hidden = false;
    return;
  }

  chartBox.hidden   = false;
  chartEmpty.hidden = true;

  chart.data.labels                      = labels;
  chart.data.datasets[0].data            = data;
  chart.data.datasets[0].backgroundColor = labels.map((_, i) => COLORS[i % COLORS.length]);
  chart.update();
}

// Add transaction
function addTransaction(e) {
  e.preventDefault();
  clearErrors();

  const name     = document.getElementById('itemName').value.trim();
  const amtRaw   = document.getElementById('amount').value;
  const category = categoryEl.value;
  const date     = document.getElementById('txDate').value;
  let ok = true;

  if (!name) {
    setError(itemNameErr, document.getElementById('itemName'), 'Required.');
    ok = false;
  } else if (name.length > 100) {
    setError(itemNameErr, document.getElementById('itemName'), 'Max 100 characters.');
    ok = false;
  }

  const amount = parseFloat(amtRaw);
  if (!amtRaw || isNaN(amount) || amount <= 0) {
    setError(amountErr, document.getElementById('amount'), 'Enter a positive amount.');
    ok = false;
  }

  if (!category) {
    setError(categoryErr, categoryEl, 'Select a category.');
    ok = false;
  }

  if (!ok) return;

  transactions.push({
    id: Date.now(),
    name,
    amount,
    category,
    date: date || new Date().toISOString().split('T')[0],
  });

  save();
  refresh();
  form.reset();
  clearErrors();
  toast(`"${name}" added.`);
}

// Delete transaction
function deleteTransaction(id) {
  const t = transactions.find(t => t.id === id);
  transactions = transactions.filter(t => t.id !== id);
  save();
  refresh();
  if (t) toast(`"${t.name}" deleted.`);
}

// Categories
function addCategory() {
  const name = newCatInput.value.trim();
  catMgrErr.textContent = '';

  if (!name) { catMgrErr.textContent = 'Enter a name.'; return; }
  if (name.length > 50) { catMgrErr.textContent = 'Max 50 characters.'; return; }

  const all = ['Food', 'Transport', 'Fun', ...customCategories];
  if (all.some(c => c.toLowerCase() === name.toLowerCase())) {
    catMgrErr.textContent = 'Already exists.';
    return;
  }

  customCategories.push(name);
  addOption(categoryEl, name);
  addOption(filterEl, name);
  save();
  newCatInput.value = '';
  toast(`Category "${name}" added.`);
}

function addOption(select, value) {
  const opt = document.createElement('option');
  opt.value = opt.textContent = value;
  select.appendChild(opt);
}

// Validation helpers
function setError(span, input, msg) {
  span.textContent = msg;
  input.classList.add('invalid');
}

function clearErrors() {
  [itemNameErr, amountErr, categoryErr].forEach(s => { s.textContent = ''; });
  ['itemName', 'amount', 'category'].forEach(id => {
    document.getElementById(id).classList.remove('invalid');
  });
}

// Toast
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// XSS
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
