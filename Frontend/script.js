// script.js – ES6 module
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'https://cdn.jsdelivr.net/npm/date-fns@2.30.0/+esm';

// Add this at the top of script.js
document.addEventListener('DOMContentLoaded', () => {
  const currentPage = location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('bg-primary/10', 'text-primary', 'font-medium');
      link.classList.remove('hover:bg-primary/5');
    }
  });
});

// ---------- STATE ----------
const STORAGE_KEY = 'runanywhere_tasks';
let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let devices = ['Laptop', 'Phone', 'Tablet', 'Desktop'];
let currentEditId = null;

// ---------- DOM CACHE ----------
const els = {
  navBtns: document.querySelectorAll('.nav-btn'),
  newTaskBtn: document.getElementById('newTaskBtn'),
  quickForm: document.getElementById('quickForm'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  modalForm: document.getElementById('modalForm'),
  closeModal: document.getElementById('closeModal'),
  deleteTask: document.getElementById('deleteTask'),
  tasksTbody: document.querySelector('#tasksTable tbody'),
  activityList: document.getElementById('activityList'),
  devicesList: document.getElementById('devicesList'),
  statsRow: document.getElementById('statsRow'),
  miniStats: document.getElementById('miniStats'),
  calendarHeader: document.getElementById('calendarHeader'),
  calendarGrid: document.getElementById('calendarGrid'),
  prevMonth: document.getElementById('prevMonth'),
  nextMonth: document.getElementById('nextMonth'),
};

// ---------- HELPERS ----------
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const formatTime = (iso) => new Date(iso).toLocaleString([], {dateStyle:'short', timeStyle:'short'});

// ---------- RENDERERS ----------
function renderStats() {
  const total = tasks.length;
  const pending = tasks.filter(t => t.status === 'Pending').length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const html = `
    <div class="bg-card p-4 rounded-lg border border-border">
      <div class="text-2xl font-bold text-primary">${total}</div>
      <div class="text-sm text-gray-400">Total Tasks</div>
    </div>
    <div class="bg-card p-4 rounded-lg border border-border">
      <div class="text-2xl font-bold text-yellow-400">${pending}</div>
      <div class="text-sm text-gray-400">Pending</div>
    </div>
    <div class="bg-card p-4 rounded-lg border border-border">
      <div class="text-2xl font-bold text-green-400">${completed}</div>
      <div class="text-sm text-gray-400">Completed</div>
    </div>
    <div class="bg-card p-4 rounded-lg border border-border">
      <div class="text-2xl font-bold text-blue-400">${devices.length}</div>
      <div class="text-sm text-gray-400">Devices</div>
    </div>
  `;
  els.statsRow.innerHTML = html;
}

function renderTasks() {
  const upcoming = tasks
    .filter(t => new Date(t.time) > new Date())
    .sort((a,b) => new Date(a.time) - new Date(b.time))
    .slice(0, 5);

  const rows = upcoming.map(t => `
    <tr class="border-b border-border/50">
      <td class="py-2">${t.name}</td>
      <td class="py-2"><span class="tag tag-${t.type.toLowerCase()}">${t.type}</span></td>
      <td class="py-2">${formatTime(t.time)}</td>
      <td class="py-2">${t.device}</td>
      <td class="py-2"><span class="status status-${t.status.toLowerCase()}">${t.status}</span></td>
      <td class="py-2"><button data-id="${t.id}" class="edit-btn text-primary text-xs">Edit</button></td>
    </tr>
  `).join('');
  els.tasksTbody.innerHTML = rows || '<tr><td colspan="6" class="text-center py-4 text-gray-500">No upcoming tasks</td></tr>';
}

function renderActivity() {
  const recent = tasks
    .sort((a,b) => new Date(b.time) - new Date(a.time))
    .slice(0, 5);

  const items = recent.map(t => `
    <li class="flex items-center gap-3">
      <div class="w-2 h-2 rounded-full ${t.status==='Completed'?'bg-green-400':'bg-yellow-400'}"></div>
      <div>
        <div class="font-medium">${t.name}</div>
        <div class="text-xs text-gray-400">${t.type} on ${t.device} • ${formatTime(t.time)}</div>
      </div>
    </li>
  `).join('');
  els.activityList.innerHTML = items || '<li class="text-gray-500">No recent activity</li>';
}

function renderDevices() {
  const html = devices.map(d => `
    <div class="flex items-center justify-between py-2 border-b border-border/30">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-green-400 rounded-full"></div>
        <span>${d}</span>
      </div>
      <span class="text-xs text-gray-400">Online</span>
    </div>
  `).join('');
  els.devicesList.innerHTML = html;
}

function renderMiniStats() {
  const typeCount = tasks.reduce((a,c)=> (a[c.type] = (a[c.type]||0)+1, a), {});
  const entries = Object.entries(typeCount).slice(0,4);
  const html = entries.map(([type,cnt]) => `
    <div class="bg-gray-800 rounded p-3 text-center">
      <div class="text-lg font-bold text-primary">${cnt}</div>
      <div class="text-xs text-gray-400">${type}</div>
    </div>
  `).join('');
  els.miniStats.innerHTML = html || '<div class="text-gray-500 col-span-2">No data</div>';
}

// ---------- CHART ----------
let pieChart = null;
function renderChart() {
  const counts = tasks.reduce((a,c)=> (a[c.type] = (a[c.type]||0)+1, a), {});
  const labels = Object.keys(counts);
  const data = Object.values(counts);

  const ctx = document.getElementById('pieChart').getContext('2d');
  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: ['#a78bfa','#10b981','#f59e0b','#3b82f6'], borderWidth:0 }] },
    options: { responsive:true, plugins:{legend:{position:'bottom'}} }
  });
}

// ---------- CALENDAR ----------
let currentMonth = new Date();
function renderCalendar() {
  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({start, end});

  els.calendarHeader.textContent = format(currentMonth, 'MMMM yyyy');

  const header = ['S','M','T','W','T','F','S'].map(d=>`<div class="text-xs text-gray-400">${d}</div>`).join('');
  const grid = days.map(date => {
    const isCurrent = isSameMonth(date, currentMonth);
    const today = isToday(date);
    const day = date.getDate();
    return `<div class="${!isCurrent?'text-gray-600':''} ${today?'bg-primary text-white rounded-full':''} w-8 h-8 flex items-center justify-center text-xs">${day}</div>`;
  });

  // fill leading empty cells
  const lead = start.getDay();
  const leading = Array(lead).fill('<div></div>').join('');
  els.calendarGrid.innerHTML = header + leading + grid.join('');
}
els.prevMonth.onclick = () => { currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1); renderCalendar(); };
els.nextMonth.onclick = () => { currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1); renderCalendar(); };

// ---------- TASK CRUD ----------
function openModal(task = null) {
  currentEditId = task?.id || null;
  document.getElementById('modalTitle').textContent = task ? 'Edit Task' : 'New Task';

  // populate selects
  const typeSel = document.getElementById('mType');
  typeSel.innerHTML = ['Message','Alarm','App','Automation'].map(t=>`<option>${t}</option>`).join('');
  const devSel = document.getElementById('mDevice');
  devSel.innerHTML = devices.map(d=>`<option>${d}</option>`).join('');

  if (task) {
    document.getElementById('mName').value = task.name;
    typeSel.value = task.type;
    document.getElementById('mTime').value = task.time.slice(0,16);
    devSel.value = task.device;
    document.getElementById('mStatus').value = task.status;
  } else {
    document.getElementById('modalForm').reset();
  }
  els.modalBackdrop.classList.remove('hidden');
  els.modalBackdrop.classList.add('flex');
}

function closeModal() {
  els.modalBackdrop.classList.add('hidden');
  els.modalBackdrop.classList.remove('flex');
  currentEditId = null;
}

// Quick form
els.quickForm.onsubmit = e => {
  e.preventDefault();
  const name = els.qTaskName.value.trim();
  const type = els.qTaskType.value;
  const time = els.qTaskTime.value;
  const device = devices[0]; // default
  if (!name || !time) return;

  tasks.push({id: uid(), name, type, time, device, status:'Pending'});
  save(); refreshAll();
  els.quickForm.reset();
};

// Modal form
els.modalForm.onsubmit = e => {
  e.preventDefault();
  const payload = {
    name: document.getElementById('mName').value.trim(),
    type: document.getElementById('mType').value,
    time: document.getElementById('mTime').value,
    device: document.getElementById('mDevice').value,
    status: document.getElementById('mStatus').value,
  };
  if (!payload.name || !payload.time) return;

  if (currentEditId) {
    const idx = tasks.findIndex(t=>t.id===currentEditId);
    tasks[idx] = {...tasks[idx], ...payload};
  } else {
    tasks.push({id: uid(), ...payload});
  }
  save(); refreshAll(); closeModal();
};

els.deleteTask.onclick = () => {
  if (!currentEditId) return;
  tasks = tasks.filter(t=>t.id!==currentEditId);
  save(); refreshAll(); closeModal();
};

// Edit buttons in table
document.addEventListener('click', e => {
  if (e.target.matches('.edit-btn')) {
    const id = e.target.dataset.id;
    const task = tasks.find(t=>t.id===id);
    openModal(task);
  }
});

// New task button
els.newTaskBtn.onclick = () => openModal();

// Close modal
els.closeModal.onclick = closeModal;
els.modalBackdrop.onclick = ev => { if (ev.target===els.modalBackdrop) closeModal(); };
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !els.modalBackdrop.classList.contains('hidden')) closeModal(); });

// ---------- NAV ----------
els.navBtns.forEach(btn => {
  btn.onclick = () => {
    els.navBtns.forEach(b=>b.classList.remove('bg-primary/10','text-primary','font-medium'));
    btn.classList.add('bg-primary/10','text-primary','font-medium');
  };
});

// ---------- REFRESH ----------
function refreshAll() {
  renderStats();
  renderTasks();
  renderActivity();
  renderDevices();
  renderMiniStats();
  renderChart();
}
refreshAll();
renderCalendar();

// Demo data (remove in prod)
if (!tasks.length) {
  tasks = [
    {id:uid(), name:'Morning Alarm', type:'Alarm', time:new Date(Date.now()+36e5).toISOString(), device:'Phone', status:'Pending'},
    {id:uid(), name:'Send Report', type:'Message', time:new Date(Date.now()+72e5).toISOString(), device:'Laptop', status:'Pending'},
    {id:uid(), name:'Backup DB', type:'Automation', time:new Date(Date.now()-36e5).toISOString(), device:'Desktop', status:'Completed'},
  ];
  save(); refreshAll();
}