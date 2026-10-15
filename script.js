// Sales Dashboard Application Logic
let STATE = {
    data: [],
    filteredData: [],
    previousData: [], // For Time-Intelligence comparison
    filters: {
        start: '', end: '', branch: 'all', category: 'all', product: 'all', txSearch: '', prodSearch: ''
    },
    pagination: { tx: { page: 1, limit: 10, total: 0 }, prod: { page: 1, limit: 5, total: 0 } },
    sort: { tx: { col: 'date', dir: 'desc' }, prod: { col: 'revenue', dir: 'desc' } },
    charts: {}
};

// Formatting Utilities (Thai locale)
const fmtCurrency = (val) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(val);
const fmtNum = (val) => new Intl.NumberFormat('th-TH').format(val);
const fmtPct = (val) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val) + '%';
const fmtDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
};

function initApp() {
    if (window.lucide) {
        lucide.createIcons();
    }
    processRawData();
    validateData();
    populateFilters();
    setupEventListeners();
    applyFilters();
    
    // Start Framer Motion animations
    setTimeout(setupAnimations, 100);
}

function processRawData() {
    STATE.data = RAW_DATA.map(row => {
        const qty = Number(row['จำนวนขาย (หน่วย)']) || 0;
        const price = Number(row['ราคาขายต่อหน่วย (บาท)']) || 0;
        const cost = Number(row['ต้นทุนต่อหน่วย (บาท)']) || 0;
        const revenue = qty * price;
        const totalCost = qty * cost;
        const profit = revenue - totalCost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return {
            id: row['รหัสรายการ'] || '-',
            date: row['วันที่'] || '',
            branch: row['สาขา'] || 'ไม่ระบุสาขา',
            product: row['สินค้า'] || 'ไม่ระบุสินค้า',
            category: row['หมวดหมู่'] || 'ไม่ระบุหมวดหมู่',
            qty: qty,
            price: price,
            cost: cost,
            revenue: revenue,
            totalCost: totalCost,
            profit: profit,
            margin: margin
        };
    });
    STATE.data.sort((a, b) => a.date.localeCompare(b.date));
    STATE.filteredData = [...STATE.data];
    if (STATE.data.length > 0) {
        document.getElementById('filter-start-date').value = STATE.data[0].date;
        document.getElementById('filter-end-date').value = STATE.data[STATE.data.length - 1].date;
    }
}

function validateData() {
    let missing = 0, duplicates = 0, invalidNums = 0;
    const ids = new Set();
    STATE.data.forEach(r => {
        if (!r.id || r.id === '-') missing++;
        if (ids.has(r.id)) duplicates++;
        ids.add(r.id);
        if (r.qty < 0 || r.price < 0 || r.cost < 0) invalidNums++;
    });
    if (missing > 0 || duplicates > 0 || invalidNums > 0) {
        const summaryEl = document.getElementById('data-validation-summary');
        if (summaryEl) summaryEl.style.display = 'block';
        const detailsEl = document.getElementById('validation-details');
        if (detailsEl) {
            detailsEl.innerHTML = `
                <div><strong>จำนวนรายการทั้งหมด:</strong> ${fmtNum(STATE.data.length)} รายการ</div>
                <div><strong>ข้อมูลสูญหาย (ค่าว่าง):</strong> ${fmtNum(missing)} รายการ</div>
                <div><strong>รายการซ้ำ:</strong> ${fmtNum(duplicates)} รายการ</div>
                <div><strong>ตัวเลขผิดปกติ:</strong> ${fmtNum(invalidNums)} รายการ</div>
            `;
        }
    }
}

function populateFilters() {
    const branches = [...new Set(STATE.data.map(d => d.branch))].sort();
    const categories = [...new Set(STATE.data.map(d => d.category))].sort();
    const products = [...new Set(STATE.data.map(d => d.product))].sort();
    
    const addOpts = (selId, arr) => {
        const el = document.getElementById(selId);
        if (!el) return;
        arr.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            el.appendChild(opt);
        });
    };
    addOpts('filter-branch', branches);
    addOpts('filter-category', categories);
    addOpts('filter-product', products);
}

function setupEventListeners() {
    ['filter-start-date', 'filter-end-date', 'filter-branch', 'filter-category', 'filter-product'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                const key = id.replace('filter-', '').replace('-date', '');
                STATE.filters[key] = e.target.value;
                applyFilters();
            });
        }
    });

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (STATE.data.length > 0) {
                document.getElementById('filter-start-date').value = STATE.data[0].date;
                document.getElementById('filter-end-date').value = STATE.data[STATE.data.length - 1].date;
            }
            document.getElementById('filter-branch').value = 'all';
            document.getElementById('filter-category').value = 'all';
            document.getElementById('filter-product').value = 'all';
            document.getElementById('search-tx').value = '';
            document.getElementById('search-product').value = '';
            STATE.filters.txSearch = '';
            STATE.filters.prodSearch = '';
            applyFilters();
        });
    }
    
    const searchTx = document.getElementById('search-tx');
    if (searchTx) {
        searchTx.addEventListener('input', (e) => {
            STATE.filters.txSearch = e.target.value.toLowerCase().trim();
            STATE.pagination.tx.page = 1;
            updateTransactionsTable();
        });
    }
    
    const searchProd = document.getElementById('search-product');
    if (searchProd) {
        searchProd.addEventListener('input', (e) => {
            STATE.filters.prodSearch = e.target.value.toLowerCase().trim();
            STATE.pagination.prod.page = 1;
            updateProductTable();
        });
    }
    
    // PDF Export
    const btnPdf = document.getElementById('btn-export-pdf');
    if (btnPdf) btnPdf.addEventListener('click', () => window.print());

    // CSV Export
    const btnCsv = document.getElementById('btn-export');
    if (btnCsv) {
        btnCsv.addEventListener('click', () => {
            if (!STATE.filteredData || STATE.filteredData.length === 0) {
                alert('ไม่มีข้อมูลสำหรับส่งออก');
                return;
            }
            const headers = ['รหัสรายการ', 'วันที่', 'สาขา', 'สินค้า', 'หมวดหมู่', 'จำนวนขาย (หน่วย)', 'ราคาต่อหน่วย (บาท)', 'ต้นทุนต่อหน่วย (บาท)', 'รายได้ (บาท)', 'ต้นทุนรวม (บาท)', 'กำไรขั้นต้น (บาท)', 'อัตรากำไร (%)'];
            const rows = STATE.filteredData.map(d => [
                d.id,
                d.date,
                `"${d.branch}"`,
                `"${d.product}"`,
                `"${d.category}"`,
                d.qty,
                d.price,
                d.cost,
                d.revenue,
                d.totalCost,
                d.profit,
                d.margin.toFixed(2)
            ]);
            const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `รายงานยอดขาย_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
    
    // Dark Mode Toggle
    const btnTheme = document.getElementById('btn-theme-toggle');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            btnTheme.innerHTML = isDark ? '<i data-lucide="sun" class="w-5 h-5"></i>' : '<i data-lucide="moon" class="w-5 h-5"></i>';
            if (window.lucide) lucide.createIcons();
            applyFilters();
        });
    }
    
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const isTx = th.closest('table').id === 'table-transactions';
            const s = isTx ? STATE.sort.tx : STATE.sort.prod;
            const col = th.dataset.sort;
            if (s.col === col) s.dir = s.dir === 'asc' ? 'desc' : 'asc';
            else { s.col = col; s.dir = 'asc'; }
            if (isTx) updateTransactionsTable(); else updateProductTable();
        });
    });
}

function calculatePreviousPeriodData() {
    if (!STATE.filters.start || !STATE.filters.end) return [];
    const msInDay = 86400000;
    const startD = new Date(STATE.filters.start);
    const endD = new Date(STATE.filters.end);
    const diffDays = Math.round((endD - startD) / msInDay) + 1;
    
    if (diffDays <= 0) return [];
    
    const prevEnd = new Date(startD.getTime() - msInDay);
    const prevStart = new Date(prevEnd.getTime() - ((diffDays - 1) * msInDay));
    
    const prevStartStr = prevStart.toISOString().split('T')[0];
    const prevEndStr = prevEnd.toISOString().split('T')[0];
    
    return STATE.data.filter(d => {
        let match = true;
        if (d.date < prevStartStr) match = false;
        if (d.date > prevEndStr) match = false;
        if (STATE.filters.branch !== 'all' && d.branch !== STATE.filters.branch) match = false;
        if (STATE.filters.category !== 'all' && d.category !== STATE.filters.category) match = false;
        if (STATE.filters.product !== 'all' && d.product !== STATE.filters.product) match = false;
        return match;
    });
}

function applyFilters() {
    STATE.filters.start = document.getElementById('filter-start-date').value;
    STATE.filters.end = document.getElementById('filter-end-date').value;
    STATE.filters.branch = document.getElementById('filter-branch').value;
    STATE.filters.category = document.getElementById('filter-category').value;
    STATE.filters.product = document.getElementById('filter-product').value;
    
    STATE.filteredData = STATE.data.filter(d => {
        let match = true;
        if (STATE.filters.start && d.date < STATE.filters.start) match = false;
        if (STATE.filters.end && d.date > STATE.filters.end) match = false;
        if (STATE.filters.branch !== 'all' && d.branch !== STATE.filters.branch) match = false;
        if (STATE.filters.category !== 'all' && d.category !== STATE.filters.category) match = false;
        if (STATE.filters.product !== 'all' && d.product !== STATE.filters.product) match = false;
        return match;
    });
    
    STATE.previousData = calculatePreviousPeriodData();
    
    const minD = STATE.filteredData.reduce((min, p) => p.date < min ? p.date : min, STATE.filteredData[0]?.date || '');
    const maxD = STATE.filteredData.reduce((max, p) => p.date > max ? p.date : max, STATE.filteredData[0]?.date || '');
    const rangeEl = document.getElementById('date-range-display');
    if (rangeEl) {
        rangeEl.textContent = STATE.filteredData.length > 0 
            ? `ช่วงข้อมูล: ${fmtDate(minD)} - ${fmtDate(maxD)} (รวม ${fmtNum(STATE.filteredData.length)} รายการ)`
            : 'ไม่พบข้อมูลตามเงื่อนไขตัวกรอง';
    }

    updateKPIs();
    updateCharts();
    updateTables();
    updateExecutiveSummary();
    updateTransactionsTable();
}

function renderTrend(elementId, current, previous, isReverseGood = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (previous === 0) { el.innerHTML = ''; return; }
    
    const pct = ((current - previous) / previous) * 100;
    const isPositive = pct > 0;
    const isNeutral = pct === 0;
    
    let icon = isNeutral ? '→' : (isPositive ? '▲' : '▼');
    let colorClass = 'trend-neutral';
    
    if (!isNeutral) {
        if (isReverseGood) {
            colorClass = isPositive ? 'trend-down' : 'trend-up';
        } else {
            colorClass = isPositive ? 'trend-up' : 'trend-down';
        }
    }
    
    el.innerHTML = `<span class="${colorClass}">${icon} ${Math.abs(pct).toFixed(1)}%</span> <span class="text-sky-700/70 dark:text-sky-400 font-normal ml-1">เทียบช่วงก่อนหน้า</span>`;
}

function updateKPIs() {
    let rev = 0, prof = 0, units = 0, txs = STATE.filteredData.length;
    STATE.filteredData.forEach(d => { rev += d.revenue; prof += d.profit; units += d.qty; });
    
    let pRev = 0, pProf = 0, pUnits = 0, pTxs = STATE.previousData.length;
    STATE.previousData.forEach(d => { pRev += d.revenue; pProf += d.profit; pUnits += d.qty; });
    
    let margin = rev > 0 ? (prof / rev) * 100 : 0;
    let avgSales = txs > 0 ? rev / txs : 0;
    
    document.getElementById('kpi-revenue').textContent = fmtCurrency(rev);
    document.getElementById('kpi-profit').textContent = fmtCurrency(prof);
    document.getElementById('kpi-units').textContent = fmtNum(units);
    document.getElementById('kpi-transactions').textContent = fmtNum(txs);
    document.getElementById('kpi-margin').textContent = fmtPct(margin);
    document.getElementById('kpi-avg-sales').textContent = fmtCurrency(avgSales);
    
    renderTrend('kpi-revenue-trend', rev, pRev);
    renderTrend('kpi-profit-trend', prof, pProf);
    renderTrend('kpi-units-trend', units, pUnits);
    renderTrend('kpi-tx-trend', txs, pTxs);
    
    document.getElementById('eff-asp').textContent = units > 0 ? fmtCurrency(rev / units) : '฿0.00';
    document.getElementById('eff-acu').textContent = units > 0 ? fmtCurrency((rev - prof) / units) : '฿0.00';
    document.getElementById('eff-ppu').textContent = units > 0 ? fmtCurrency(prof / units) : '฿0.00';
    document.getElementById('eff-rpt').textContent = txs > 0 ? fmtCurrency(rev / txs) : '฿0.00';
    
    // Target Progress Logic
    const allDates = [...new Set(STATE.data.map(d => d.date))];
    let totalGlobalRev = 0;
    STATE.data.forEach(d => totalGlobalRev += d.revenue);
    const avgDaily = totalGlobalRev / (allDates.length || 1);

    const startD = new Date(STATE.filters.start || allDates[0]);
    const endD = new Date(STATE.filters.end || allDates[allDates.length - 1]);
    const diffDays = Math.max(1, Math.round((endD - startD) / 86400000) + 1);
    
    const targetRevenue = avgDaily * diffDays;
    const targetPct = targetRevenue > 0 ? Math.min(100, Math.round((rev / targetRevenue) * 100)) : 0;

    const tRevTxt = document.getElementById('target-revenue-text');
    if (tRevTxt) {
        tRevTxt.textContent = `${fmtCurrency(rev)} / ${fmtCurrency(targetRevenue)}`;
        document.getElementById('target-pct').textContent = `${targetPct}%`;
        document.getElementById('target-progress-bar').style.width = `${targetPct}%`;
    }
}

function createOrUpdateChart(id, type, data, options = {}) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (STATE.charts[id]) STATE.charts[id].destroy();
    const ctx = canvas.getContext('2d');
    
    const isDark = document.documentElement.classList.contains('dark');
    Chart.defaults.color = isDark ? '#bae6fd' : '#0c4a6e';
    Chart.defaults.borderColor = isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(186, 230, 253, 0.45)';
    Chart.defaults.font.family = "'Prompt', 'Outfit', sans-serif";
    Chart.defaults.font.size = 12;
    
    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
            legend: { 
                display: data.datasets && data.datasets.length > 1, 
                position: 'bottom',
                labels: { 
                    usePointStyle: true, 
                    padding: 16, 
                    font: { size: 12, family: "'Prompt', sans-serif" },
                    color: isDark ? '#e0f2fe' : '#0c4a6e'
                }
            },
            datalabels: { display: false } 
        },
        scales: {
            x: { 
                grid: { display: false },
                ticks: { color: isDark ? '#7dd3fc' : '#475569', font: { family: "'Prompt', sans-serif" } }
            },
            y: { 
                border: { display: false }, 
                grid: { color: isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(186, 230, 253, 0.45)' },
                ticks: { color: isDark ? '#7dd3fc' : '#475569', font: { family: "'Prompt', sans-serif" } }
            }
        },
        interaction: { mode: 'index', intersect: false },
        elements: {
            line: { tension: 0.35 },
            point: { radius: 0, hitRadius: 10, hoverRadius: 6 }
        }
    };
    
    STATE.charts[id] = new Chart(ctx, { type: type, data: data, options: Object.assign({}, defaultOptions, options) });
}

function updateCharts() {
    // 1. Revenue & Profit Trend
    const daily = {};
    STATE.filteredData.forEach(d => {
        if (!daily[d.date]) daily[d.date] = { rev: 0, prof: 0, units: 0 };
        daily[d.date].rev += d.revenue;
        daily[d.date].prof += d.profit;
        daily[d.date].units += d.qty;
    });
    const dates = Object.keys(daily).sort();
    
    createOrUpdateChart('chart-revenue-trend', 'line', {
        labels: dates.map(fmtDate),
        datasets: [{
            label: 'รายได้รวม',
            data: dates.map(d => daily[d].rev),
            borderColor: '#0284c7',
            backgroundColor: 'rgba(14, 165, 233, 0.18)',
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            pointHoverBackgroundColor: '#0284c7'
        }]
    }, {
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(ctx) {
                        const d = dates[ctx.dataIndex];
                        return [
                            `รายได้: ${fmtCurrency(daily[d].rev)}`,
                            `จำนวนขาย: ${fmtNum(daily[d].units)} หน่วย`,
                            `กำไรขั้นต้น: ${fmtCurrency(daily[d].prof)}`
                        ];
                    }
                }
            }
        }
    });
    
    createOrUpdateChart('chart-profit-trend', 'bar', {
        labels: dates.map(fmtDate),
        datasets: [
            { label: 'รายได้', data: dates.map(d => daily[d].rev), backgroundColor: '#38bdf8', borderRadius: 4 },
            { label: 'กำไรขั้นต้น', data: dates.map(d => daily[d].prof), backgroundColor: '#0284c7', borderRadius: 4 }
        ]
    }, {
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(ctx) {
                        return `${ctx.dataset.label}: ${fmtCurrency(ctx.raw)}`;
                    }
                }
            }
        }
    });
    
    // 2. Heatmap
    const heatmapContainer = document.getElementById('heatmap-container');
    if (heatmapContainer) {
        heatmapContainer.innerHTML = '';
        let maxDailyRev = Math.max(...dates.map(d => daily[d].rev), 1);
        dates.forEach(d => {
            const ratio = daily[d].rev / maxDailyRev;
            let bgClass = 'bg-sky-100 dark:bg-slate-800';
            if (ratio > 0.8) bgClass = 'bg-sky-950 dark:bg-sky-400';
            else if (ratio > 0.6) bgClass = 'bg-sky-700 dark:bg-sky-500';
            else if (ratio > 0.4) bgClass = 'bg-sky-500 dark:bg-sky-600';
            else if (ratio > 0.2) bgClass = 'bg-sky-300 dark:bg-sky-800';
            
            const col = document.createElement('div');
            col.className = 'flex flex-col flex-1 min-w-[32px] items-center gap-1';
            
            const cell = document.createElement('div');
            cell.className = `heatmap-cell ${bgClass} border border-sky-200/50`;
            cell.innerHTML = `<div class="tooltip">
                    <strong>วันที่: ${fmtDate(d)}</strong><br>
                    รายได้: ${fmtCurrency(daily[d].rev)}<br>
                    จำนวนขาย: ${fmtNum(daily[d].units)} หน่วย<br>
                    กำไรขั้นต้น: ${fmtCurrency(daily[d].prof)}
                </div>`;
            
            const label = document.createElement('span');
            label.className = 'text-[10px] text-sky-800 dark:text-sky-400 rotate-45 origin-top-left mt-2 whitespace-nowrap font-medium';
            label.textContent = d.substring(5);
            col.appendChild(cell);
            col.appendChild(label);
            heatmapContainer.appendChild(col);
        });
    }
    
    // 3. Category Donut & Bar
    const cats = {};
    STATE.filteredData.forEach(d => {
        if (!cats[d.category]) cats[d.category] = { rev: 0, prof: 0, units: 0, cost: 0 };
        cats[d.category].rev += d.revenue;
        cats[d.category].prof += d.profit;
        cats[d.category].units += d.qty;
        cats[d.category].cost += d.totalCost;
    });
    const catNames = Object.keys(cats).sort((a, b) => cats[b].rev - cats[a].rev);
    const totalCatRev = catNames.reduce((s, c) => s + cats[c].rev, 0);
    
    createOrUpdateChart('chart-category-donut', 'doughnut', {
        labels: catNames,
        datasets: [{
            data: catNames.map(c => cats[c].rev),
            backgroundColor: ['#0284c7', '#38bdf8', '#0ea5e9', '#60a5fa', '#0369a1'],
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 6
        }]
    }, {
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(ctx) {
                        const val = ctx.raw;
                        const pct = totalCatRev > 0 ? ((val / totalCatRev) * 100).toFixed(1) : 0;
                        return `${ctx.label}: ${fmtCurrency(val)} (${pct}%)`;
                    }
                }
            }
        }
    });
    
    createOrUpdateChart('chart-category-bar', 'bar', {
        labels: catNames,
        datasets: [{
            label: 'กำไรขั้นต้น',
            data: catNames.map(c => cats[c].prof),
            backgroundColor: '#0284c7',
            borderRadius: 6
        }]
    }, {
        indexAxis: 'y',
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(ctx) {
                        return `กำไรขั้นต้น: ${fmtCurrency(ctx.raw)}`;
                    }
                }
            }
        }
    });
    
    // 4. Branch Chart
    const branches = {};
    STATE.filteredData.forEach(d => {
        if (!branches[d.branch]) branches[d.branch] = { rev: 0, prof: 0, units: 0, tx: 0, cost: 0 };
        branches[d.branch].rev += d.revenue;
        branches[d.branch].prof += d.profit;
        branches[d.branch].units += d.qty;
        branches[d.branch].cost += d.totalCost;
        branches[d.branch].tx += 1;
    });
    const bNames = Object.keys(branches).sort((a, b) => branches[b].rev - branches[a].rev);
    
    createOrUpdateChart('chart-branch-perf', 'bar', {
        labels: bNames,
        datasets: [
            { label: 'รายได้', data: bNames.map(b => branches[b].rev), backgroundColor: '#0284c7', borderRadius: 6 },
            { label: 'กำไรขั้นต้น', data: bNames.map(b => branches[b].prof), backgroundColor: '#38bdf8', borderRadius: 6 }
        ]
    });
    
    // Update Branch Ranking UI
    const branchCont = document.getElementById('branch-ranking-container');
    if (branchCont) {
        branchCont.innerHTML = bNames.map((b, i) => {
            let badge = '';
            if (i === 0) badge = '🥇';
            else if (i === 1) badge = '🥈';
            else if (i === 2) badge = '🥉';
            else badge = `<span class="w-6 h-6 rounded-full bg-sky-100 text-sky-800 text-xs font-bold flex items-center justify-center">${i + 1}</span>`;
            return `<div class="flex items-center justify-between p-3.5 bg-sky-50/60 dark:bg-slate-800/80 rounded-xl border border-sky-100 dark:border-sky-900 cursor-pointer hover:bg-sky-100/70 hover:border-sky-300 transition" onclick="filterByBranch('${b}')">
                <div class="flex items-center gap-3">
                    <span class="text-xl flex items-center justify-center w-7">${badge}</span>
                    <div>
                        <div class="font-bold text-sky-950 dark:text-sky-100">${b}</div>
                        <div class="text-xs text-sky-700 dark:text-sky-300">${fmtNum(branches[b].tx)} รายการขาย</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-bold text-sky-950 dark:text-sky-100">${fmtCurrency(branches[b].rev)}</div>
                    <div class="text-xs text-emerald-600 font-semibold">${fmtPct((branches[b].prof / branches[b].rev) * 100)} กำไร</div>
                </div>
            </div>`;
        }).join('');
    }
    
    document.querySelector('#table-branches tbody').innerHTML = bNames.map(b => `<tr>
        <td class="font-medium cursor-pointer text-sky-700 hover:text-sky-900 hover:underline" onclick="filterByBranch('${b}')">${b}</td>
        <td class="text-right">${fmtNum(branches[b].tx)} รายการ</td>
        <td class="text-right">${fmtNum(branches[b].units)} ชิ้น</td>
        <td class="text-right font-medium">${fmtCurrency(branches[b].rev)}</td>
        <td class="text-right">${fmtCurrency(branches[b].cost)}</td>
        <td class="text-right text-emerald-600 font-semibold">${fmtCurrency(branches[b].prof)}</td>
        <td class="text-right font-medium text-sky-700">${fmtPct((branches[b].prof / branches[b].rev) * 100)}</td>
    </tr>`).join('');

    document.querySelector('#table-categories tbody').innerHTML = catNames.map(c => `<tr>
        <td class="font-medium cursor-pointer text-sky-700 hover:text-sky-900 hover:underline" onclick="filterByCat('${c}')">${c}</td>
        <td class="text-right">${fmtNum(cats[c].units)} ชิ้น</td>
        <td class="text-right font-medium">${fmtCurrency(cats[c].rev)}</td>
        <td class="text-right">${fmtCurrency(cats[c].cost)}</td>
        <td class="text-right text-emerald-600 font-semibold">${fmtCurrency(cats[c].prof)}</td>
        <td class="text-right font-medium text-sky-700">${fmtPct((cats[c].prof / cats[c].rev) * 100)}</td>
    </tr>`).join('');

    // Top Products
    const prods = {};
    STATE.filteredData.forEach(d => {
        if (!prods[d.product]) prods[d.product] = { rev: 0, prof: 0, units: 0, cat: d.category, cost: 0 };
        prods[d.product].rev += d.revenue;
        prods[d.product].prof += d.profit;
        prods[d.product].units += d.qty;
        prods[d.product].cost += d.totalCost;
    });
    const pArr = Object.keys(prods).map(k => ({ name: k, ...prods[k] }));
    
    const topRev = [...pArr].sort((a, b) => b.rev - a.rev).slice(0, 10);
    createOrUpdateChart('chart-top-revenue', 'bar', {
        labels: topRev.map(p => p.name),
        datasets: [{ label: 'รายได้', data: topRev.map(p => p.rev), backgroundColor: '#0284c7', borderRadius: 6 }]
    }, { indexAxis: 'y' });
    
    const topProf = [...pArr].sort((a, b) => b.prof - a.prof).slice(0, 10);
    createOrUpdateChart('chart-top-profit', 'bar', {
        labels: topProf.map(p => p.name),
        datasets: [{ label: 'กำไรขั้นต้น', data: topProf.map(p => p.prof), backgroundColor: '#38bdf8', borderRadius: 6 }]
    }, { indexAxis: 'y' });

    // Strategy: Bubble Chart
    const maxRev = Math.max(...pArr.map(p => p.rev), 1);
    
    const catColorMap = {
        'กาแฟ': { bg: 'rgba(2, 132, 199, 0.75)', border: '#0284c7' },
        'เบเกอรี': { bg: 'rgba(56, 189, 248, 0.8)', border: '#0ea5e9' },
        'เครื่องดื่มอื่น': { bg: 'rgba(96, 165, 250, 0.75)', border: '#3b82f6' }
    };
    const fallbackColor = { bg: 'rgba(14, 165, 233, 0.7)', border: '#0284c7' };

    const bubbleData = {
        datasets: [{
            label: 'สินค้า',
            data: pArr.map(p => ({
                x: p.units,
                y: p.rev > 0 ? (p.prof / p.rev) * 100 : 0,
                r: Math.max(6, (p.rev / maxRev) * 14),
                productName: p.name,
                category: p.cat,
                revenue: p.rev
            })),
            backgroundColor: function(context) {
                const d = context.raw;
                if (!d) return fallbackColor.bg;
                return catColorMap[d.category] ? catColorMap[d.category].bg : fallbackColor.bg;
            },
            borderColor: function(context) {
                const d = context.raw;
                if (!d) return fallbackColor.border;
                return catColorMap[d.category] ? catColorMap[d.category].border : fallbackColor.border;
            },
            borderWidth: 2
        }]
    };
    
    const isDark = document.documentElement.classList.contains('dark');
    createOrUpdateChart('chart-bubble', 'bubble', bubbleData, {
        plugins: {
            datalabels: {
                display: true,
                formatter: function(value) {
                    return value.productName;
                },
                font: { family: "'Prompt', sans-serif", size: 11, weight: '600' },
                color: isDark ? '#f0f9ff' : '#0c4a6e',
                anchor: 'end',
                align: 'end',
                offset: 4
            },
            tooltip: {
                callbacks: {
                    label: function(ctx) {
                        const d = ctx.raw;
                        return `${d.productName} (${d.category}) | ปริมาณขาย: ${fmtNum(d.x)} ชิ้น | กำไร: ${d.y.toFixed(1)}% | รายได้: ${fmtCurrency(d.revenue)}`;
                    }
                }
            },
            legend: { display: false }
        },
        layout: {
            padding: { top: 20, right: 30, left: 10, bottom: 10 }
        },
        scales: {
            x: { 
                grid: { display: true, color: isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(186, 230, 253, 0.45)', borderDash: [4, 4] },
                title: { display: true, text: 'ปริมาณขาย (หน่วย)', font: { family: "'Prompt', sans-serif", size: 12, weight: '600' }, color: isDark ? '#7dd3fc' : '#0c4a6e' },
                grace: '10%'
            },
            y: { 
                grid: { display: true, color: isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(186, 230, 253, 0.45)', borderDash: [4, 4] },
                title: { display: true, text: 'อัตรากำไรขั้นต้น (%)', font: { family: "'Prompt', sans-serif", size: 12, weight: '600' }, color: isDark ? '#7dd3fc' : '#0c4a6e' },
                grace: '10%',
                ticks: {
                    callback: function(value) { return value + '%'; }
                }
            }
        }
    });

    // Strategy: Day of Week
    const dowNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const dowRev = [0, 0, 0, 0, 0, 0, 0];
    STATE.filteredData.forEach(d => {
        const dayIdx = new Date(d.date).getDay();
        dowRev[dayIdx] += d.revenue;
    });
    createOrUpdateChart('chart-dow', 'bar', {
        labels: dowNames,
        datasets: [{ label: 'ยอดขายรวมตามวัน', data: dowRev, backgroundColor: '#0284c7', borderRadius: 6 }]
    });

    // Insights Logic
    if (pArr.length > 0) {
        const bestU = [...pArr].sort((a, b) => b.units - a.units)[0];
        document.getElementById('insight-best-units').textContent = bestU.name;
        document.getElementById('insight-best-units-val').textContent = `${fmtNum(bestU.units)} ชิ้น`;
        
        const bestR = [...pArr].sort((a, b) => b.rev - a.rev)[0];
        document.getElementById('insight-best-rev').textContent = bestR.name;
        document.getElementById('insight-best-rev-val').textContent = fmtCurrency(bestR.rev);
        
        const bestP = [...pArr].sort((a, b) => b.prof - a.prof)[0];
        document.getElementById('insight-best-prof').textContent = bestP.name;
        document.getElementById('insight-best-prof-val').textContent = fmtCurrency(bestP.prof);
        
        const bestM = [...pArr].sort((a, b) => (b.prof / b.rev) - (a.prof / a.rev))[0];
        document.getElementById('insight-best-margin').textContent = bestM.name;
        document.getElementById('insight-best-margin-val').textContent = fmtPct((bestM.prof / bestM.rev) * 100);
    }
    if (bNames.length > 0) {
        document.getElementById('insight-best-branch').textContent = bNames[0];
        document.getElementById('insight-best-branch-val').textContent = fmtCurrency(branches[bNames[0]].rev);
    }
    if (dates.length > 0) {
        const bestD = [...dates].sort((a, b) => daily[b].rev - daily[a].rev)[0];
        document.getElementById('insight-best-day').textContent = fmtDate(bestD);
        document.getElementById('insight-best-day-val').textContent = fmtCurrency(daily[bestD].rev);
    }

    // Matrix: Branch x Category
    let mxBranchCatHtml = '<thead><tr><th>สาขา</th>';
    catNames.forEach(c => mxBranchCatHtml += `<th class="text-right">${c}</th>`);
    mxBranchCatHtml += '<th class="text-right bg-sky-100/60 dark:bg-sky-950/60">รวม</th></tr></thead><tbody>';
    let maxValCat = 0;
    bNames.forEach(b => {
        catNames.forEach(c => {
            let v = 0;
            STATE.filteredData.forEach(d => { if (d.branch === b && d.category === c) v += d.revenue; });
            if (v > maxValCat) maxValCat = v;
        });
    });
    bNames.forEach(b => {
        mxBranchCatHtml += `<tr><td class="font-medium text-sky-900 dark:text-sky-100">${b}</td>`;
        let sum = 0;
        catNames.forEach(c => {
            let v = 0;
            STATE.filteredData.forEach(d => { if (d.branch === b && d.category === c) v += d.revenue; });
            sum += v;
            let pct = maxValCat > 0 ? (v / maxValCat) * 100 : 0;
            mxBranchCatHtml += `<td class="text-right matrix-cell"><div class="matrix-bg" style="width: ${pct}%"></div>${fmtCurrency(v)}</td>`;
        });
        mxBranchCatHtml += `<td class="text-right font-bold bg-sky-100/50 dark:bg-sky-950/50 text-sky-950 dark:text-sky-100">${fmtCurrency(sum)}</td></tr>`;
    });
    document.getElementById('table-matrix-branch-cat').innerHTML = mxBranchCatHtml + '</tbody>';

    // Matrix: Product x Branch
    let mxProdBranchHtml = '<thead><tr><th>สินค้า</th>';
    bNames.forEach(b => mxProdBranchHtml += `<th class="text-right">${b}</th>`);
    mxProdBranchHtml += '<th class="text-right bg-sky-100/60 dark:bg-sky-950/60">รวม</th></tr></thead><tbody>';
    pArr.sort((a, b) => b.units - a.units).forEach(p => {
        mxProdBranchHtml += `<tr><td class="font-medium whitespace-nowrap text-sky-900 dark:text-sky-100">${p.name}</td>`;
        let sum = 0;
        bNames.forEach(b => {
            let u = 0;
            STATE.filteredData.forEach(d => { if (d.branch === b && d.product === p.name) u += d.qty; });
            sum += u;
            mxProdBranchHtml += `<td class="text-right">${u > 0 ? fmtNum(u) : '-'}</td>`;
        });
        mxProdBranchHtml += `<td class="text-right font-bold bg-sky-100/50 dark:bg-sky-950/50 text-sky-950 dark:text-sky-100">${fmtNum(sum)} ชิ้น</td></tr>`;
    });
    document.getElementById('table-matrix-prod-branch').innerHTML = mxProdBranchHtml + '</tbody>';
}

function updateTables() {
    updateProductTable();
}

function updateProductTable() {
    const prods = {};
    STATE.filteredData.forEach(d => {
        if (!prods[d.product]) prods[d.product] = { product: d.product, category: d.category, rev: 0, prof: 0, units: 0, cost: 0 };
        prods[d.product].rev += d.revenue;
        prods[d.product].prof += d.profit;
        prods[d.product].units += d.qty;
        prods[d.product].cost += d.totalCost;
    });
    let pArr = Object.values(prods);
    
    const sq = STATE.filters.prodSearch;
    if (sq) {
        pArr = pArr.filter(p => p.product.toLowerCase().includes(sq) || p.category.toLowerCase().includes(sq));
    }
    
    const col = STATE.sort.prod.col;
    const dir = STATE.sort.prod.dir === 'asc' ? 1 : -1;
    pArr.sort((a, b) => {
        if (col === 'product' || col === 'category') return a[col].localeCompare(b[col]) * dir;
        let valA = a[col] || (col === 'margin' ? a.prof / a.rev : a[col === 'revenue' ? 'rev' : col === 'units' ? 'units' : col === 'profit' ? 'prof' : 'cost']);
        let valB = b[col] || (col === 'margin' ? b.prof / b.rev : b[col === 'revenue' ? 'rev' : col === 'units' ? 'units' : col === 'profit' ? 'prof' : 'cost']);
        return (valA - valB) * dir;
    });
    
    STATE.pagination.prod.total = pArr.length;
    const maxPage = Math.ceil(pArr.length / STATE.pagination.prod.limit) || 1;
    if (STATE.pagination.prod.page > maxPage) STATE.pagination.prod.page = Math.max(1, maxPage);
    
    const startIdx = (STATE.pagination.prod.page - 1) * STATE.pagination.prod.limit;
    const slice = pArr.slice(startIdx, startIdx + STATE.pagination.prod.limit);
    
    document.querySelector('#table-products tbody').innerHTML = slice.map((p, i) => `<tr>
        <td class="font-bold text-sky-700">#${startIdx + i + 1}</td>
        <td class="font-bold text-sky-950 dark:text-sky-100">${p.product}</td>
        <td><span class="bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 px-2.5 py-1 rounded-full text-xs font-medium">${p.category}</span></td>
        <td class="text-right">${fmtNum(p.units)} ชิ้น</td>
        <td class="text-right font-medium">${fmtCurrency(p.rev)}</td>
        <td class="text-right">${fmtCurrency(p.cost)}</td>
        <td class="text-right text-emerald-600 font-bold">${fmtCurrency(p.prof)}</td>
        <td class="text-right font-bold text-sky-600">${fmtPct((p.prof / p.rev) * 100)}</td>
    </tr>`).join('');
    
    const infoEl = document.getElementById('product-page-info');
    if (infoEl) {
        infoEl.textContent = pArr.length === 0 
            ? 'ไม่พบข้อมูลสินค้า' 
            : `แสดง ${startIdx + 1} ถึง ${Math.min(startIdx + STATE.pagination.prod.limit, pArr.length)} จากทั้งหมด ${fmtNum(pArr.length)} สินค้า`;
    }
    renderPagination('product-pagination', STATE.pagination.prod.page, maxPage, (p) => {
        STATE.pagination.prod.page = p;
        updateProductTable();
    });
}

function updateTransactionsTable() {
    let data = [...STATE.filteredData];
    const sq = STATE.filters.txSearch;
    if (sq) {
        data = data.filter(d => 
            d.id.toLowerCase().includes(sq) || 
            d.product.toLowerCase().includes(sq) || 
            d.branch.toLowerCase().includes(sq) || 
            d.category.toLowerCase().includes(sq)
        );
    }
    
    const col = STATE.sort.tx.col;
    const dir = STATE.sort.tx.dir === 'asc' ? 1 : -1;
    data.sort((a, b) => {
        if (col === 'date' || col === 'id' || col === 'branch' || col === 'product' || col === 'category') return a[col].localeCompare(b[col]) * dir;
        return (a[col] - b[col]) * dir;
    });
    
    STATE.pagination.tx.total = data.length;
    const maxPage = Math.ceil(data.length / STATE.pagination.tx.limit) || 1;
    if (STATE.pagination.tx.page > maxPage) STATE.pagination.tx.page = Math.max(1, maxPage);
    
    const startIdx = (STATE.pagination.tx.page - 1) * STATE.pagination.tx.limit;
    const slice = data.slice(startIdx, startIdx + STATE.pagination.tx.limit);
    
    document.querySelector('#table-transactions tbody').innerHTML = slice.map(d => `<tr>
        <td class="font-mono text-xs font-semibold text-sky-700">${d.id}</td>
        <td>${fmtDate(d.date)}</td>
        <td>${d.branch}</td>
        <td class="font-semibold text-sky-950 dark:text-sky-100">${d.product}</td>
        <td><span class="bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded-full text-xs">${d.category}</span></td>
        <td class="text-right">${fmtNum(d.qty)}</td>
        <td class="text-right">${fmtCurrency(d.price)}</td>
        <td class="text-right">${fmtCurrency(d.cost)}</td>
        <td class="text-right font-semibold">${fmtCurrency(d.revenue)}</td>
        <td class="text-right">${fmtCurrency(d.totalCost)}</td>
        <td class="text-right text-emerald-600 font-semibold">${fmtCurrency(d.profit)}</td>
        <td class="text-right font-medium text-sky-700">${fmtPct(d.margin)}</td>
    </tr>`).join('');
    
    const infoEl = document.getElementById('tx-page-info');
    if (infoEl) {
        infoEl.textContent = data.length === 0 
            ? 'ไม่พบข้อมูลรายการขาย' 
            : `แสดง ${startIdx + 1} ถึง ${Math.min(startIdx + STATE.pagination.tx.limit, data.length)} จากทั้งหมด ${fmtNum(data.length)} รายการ`;
    }
    renderPagination('tx-pagination', STATE.pagination.tx.page, maxPage, (p) => {
        STATE.pagination.tx.page = p;
        updateTransactionsTable();
    });
    updateSortIcons();
}

function updateSortIcons() {
    ['table-transactions', 'table-products'].forEach(tid => {
        const stateSort = tid === 'table-transactions' ? STATE.sort.tx : STATE.sort.prod;
        document.querySelectorAll(`#${tid} th[data-sort]`).forEach(th => {
            th.innerHTML = th.innerHTML.replace(' ↑', '').replace(' ↓', '');
            if (th.dataset.sort === stateSort.col) th.innerHTML += stateSort.dir === 'asc' ? ' ↑' : ' ↓';
        });
    });
}

function renderPagination(elId, current, max, callback) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = '';
    if (max <= 1) return;
    
    const createBtn = (text, p, disabled, active) => {
        const d = document.createElement('div');
        d.className = `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;
        d.textContent = text;
        if (!disabled && !active) d.onclick = () => callback(p);
        return d;
    };
    
    el.appendChild(createBtn('ก่อนหน้า', current - 1, current === 1, false));
    let start = Math.max(1, current - 2), end = Math.min(max, current + 2);
    if (start > 1) {
        el.appendChild(createBtn('1', 1, false, current === 1));
        if (start > 2) el.appendChild(createBtn('...', null, true, false));
    }
    for (let i = start; i <= end; i++) {
        el.appendChild(createBtn(i, i, false, current === i));
    }
    if (end < max) {
        if (end < max - 1) el.appendChild(createBtn('...', null, true, false));
        el.appendChild(createBtn(max, max, false, current === max));
    }
    el.appendChild(createBtn('ถัดไป', current + 1, current === max, false));
}

function updateExecutiveSummary() {
    const summaryEl = document.getElementById('executive-summary');
    if (!summaryEl) return;
    if (STATE.filteredData.length === 0) {
        summaryEl.innerHTML = 'ไม่มีข้อมูลการขายในช่วงเวลาหรือตัวกรองที่ท่านเลือก กรุณาล้างตัวกรองหรือเลือกเงื่อนไขใหม่';
        return;
    }
    
    const bestProd = document.getElementById('insight-best-rev').textContent;
    const bestBranch = document.getElementById('insight-best-branch').textContent;
    const prods = {};
    STATE.filteredData.forEach(d => { prods[d.product] = (prods[d.product] || 0) + d.qty; });
    
    let hasLowMarginHighVol = false;
    let lowMarginItem = '';
    const pStats = [];
    for (let k in prods) {
        let rev = 0, prof = 0;
        STATE.filteredData.forEach(d => { if (d.product === k) { rev += d.revenue; prof += d.profit; } });
        pStats.push({ name: k, vol: prods[k], margin: rev > 0 ? (prof / rev) * 100 : 0 });
    }
    pStats.sort((a, b) => b.vol - a.vol);
    if (pStats.length > 0) {
        const lowM = pStats.slice(0, 3).find(p => p.margin < 30);
        if (lowM) { hasLowMarginHighVol = true; lowMarginItem = lowM.name; }
    }

    let branchText = document.getElementById('filter-branch').value !== 'all' 
        ? `สาขา ${document.getElementById('filter-branch').value}` 
        : 'ทุกสาขา';

    let text = `จากการวิเคราะห์ผลการดำเนินงานยอดขาย (${branchText}) ในช่วงข้อมูลที่เลือก พบว่าสินค้า <strong class="text-sky-950 dark:text-sky-100 font-bold">"${bestProd}"</strong> สามารถสร้างรายได้รวมสูงสุดเป็นอันดับหนึ่ง `;
    if (document.getElementById('filter-branch').value === 'all') {
        text += `โดยมี <strong class="text-sky-950 dark:text-sky-100 font-bold">สาขา ${bestBranch}</strong> เป็นสาขาที่มีผลการดำเนินงานโดดเด่นและมียอดขายสูงสุด `;
    }
    text += `ซึ่งภาพรวมโครงสร้างกำไรสะท้อนถึงประสิทธิภาพการบริหารจัดการที่ดี`;
    
    if (hasLowMarginHighVol) {
        text += `<br><br><span class="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/60 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">⚠️ ข้อเสนอแนะเชิงกลยุทธ์:</span> พบว่าสินค้า <strong class="text-amber-800 dark:text-amber-300">"${lowMarginItem}"</strong> มียอดขายในแง่จำนวนหน่วยสูง แต่มีอัตรากำไรขั้นต้น (Gross Margin) ต่ำกว่า 30% แนะนำให้พิจารณาจัดโปรโมชันแบบ Cross-selling คู่กับสินค้าที่มี Margin สูง หรือพิจารณาเจรจาต้นทุนกับผู้ผลิตเพื่อเพิ่มอัตราผลตอบแทนรวม`;
    }
    
    summaryEl.innerHTML = text;
}

window.filterByBranch = function(branch) {
    document.getElementById('filter-branch').value = branch;
    applyFilters();
    window.location.hash = 'overview';
};

window.filterByCat = function(cat) {
    document.getElementById('filter-category').value = cat;
    applyFilters();
    window.location.hash = 'overview';
};

function setupAnimations() {
    if (!window.Motion) return;
    const { animate, inView, stagger } = window.Motion;

    // Nav entrance animation
    animate("nav", { y: [-40, 0], opacity: [0, 1] }, { duration: 0.45, easing: "ease-out" });

    // KPI Cards entrance
    const kpiCards = document.querySelectorAll(".kpi-card");
    if (kpiCards.length > 0) {
        kpiCards.forEach(c => c.style.opacity = 0);
        animate(kpiCards, { opacity: [0, 1], scale: [0.95, 1] }, { duration: 0.35, delay: stagger(0.04, { startDelay: 0.15 }) });
    }

    // Animate sections on scroll
    document.querySelectorAll('section').forEach(sec => {
        const cards = sec.querySelectorAll('.card');
        if (cards.length > 0) {
            cards.forEach(c => c.style.opacity = 0);
            inView(sec, () => {
                animate(cards, { opacity: [0, 1], y: [30, 0] }, { duration: 0.5, delay: stagger(0.08) });
            }, { amount: 0.08 });
        }
    });
}

// Boot
window.addEventListener('DOMContentLoaded', initApp);
