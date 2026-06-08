import './style.css'

// ── Storage ──
function getLeads() { return JSON.parse(localStorage.getItem('salestrack_leads')) || [] }
function saveLeads(d) { localStorage.setItem('salestrack_leads', JSON.stringify(d)) }
function getActivities() { return JSON.parse(localStorage.getItem('salestrack_activities')) || [] }
function saveActivities(d) { localStorage.setItem('salestrack_activities', JSON.stringify(d)) }

// ── Helpers ──
function fmt$(n) { return '$' + Number(n || 0).toLocaleString('en-US') }

function timeAgo(dateStr) {
  if (!dateStr) return 'No data'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 0) return 'Just now'
  if (mins < 60) return mins + ' minutes ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + ' hours ago'
  const days = Math.floor(hrs / 24)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return days + ' days ago'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function defaultConfidence(stage) {
  return { Prospecting:10, Qualification:25, Proposal:50, Negotiation:75, 'Closed Won':100, 'Closed Lost':0 }[stage] || 0
}

function badgeClass(stage) {
  return { Prospecting:'badge-prospecting', Qualification:'badge-qualification', Proposal:'badge-proposal', Negotiation:'badge-negotiation', 'Closed Won':'badge-won', 'Closed Lost':'badge-lost' }[stage] || 'badge-prospecting'
}

// ── Toast ──
function showToast(msg, type = 'info') {
  const cfg = { success:{bg:'#f0fdf4',c:'#15803d',b:'#22c55e',i:'fa-circle-check'}, error:{bg:'#fef2f2',c:'#dc2626',b:'#ef4444',i:'fa-circle-xmark'}, info:{bg:'#eff6ff',c:'#1d4ed8',b:'#3b82f6',i:'fa-circle-info'} }
  const s = cfg[type] || cfg.info
  const t = document.createElement('div')
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:1000;background:${s.bg};color:${s.c};border-left:4px solid ${s.b};padding:14px 20px;border-radius:12px;font-size:14px;font-weight:500;min-width:280px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);animation:slideUp .3s ease;font-family:'Plus Jakarta Sans',sans-serif;`
  t.innerHTML = `<i class="fa-solid ${s.i}"></i><span>${msg}</span>`
  document.body.appendChild(t)
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(() => t.remove(), 300) }, 3000)
}

// ── State ──
let viewMode = 'table'
const STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

// ── Init ──
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('current-date-chip').textContent = new Date('2026-06-08').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
  if (getLeads().length > 0) renderPipeline()
})

// ── Sample Data ──
function loadSampleData() {
  const leads = [
    { id:'lead_1', name:'AeroSpace Cloud Server Suite', company:'AeroSpace Dynamics', email:'procurement@aerospacedynamics.com', phone:'+1-541-555-0192', dealSize:85000, source:'Website', stage:'Prospecting', confidence:10, notes:'Initial inbound corporate query for private multi-region enterprise storage arrays.', createdAt:new Date('2026-06-08T02:00:00').toISOString(), updatedAt:new Date('2026-06-08T08:00:00').toISOString() },
    { id:'lead_2', name:'Quantum Health CRM Expansion', company:'Quantum Health Services', email:'dr.vance@quantumhealth.org', phone:'+1-206-555-0143', dealSize:142000, source:'Referral', stage:'Proposal', confidence:50, notes:'RFP response delivered. Client auditing privacy framework compliance requirements.', createdAt:new Date('2026-06-01T09:15:00').toISOString(), updatedAt:new Date('2026-06-01T09:15:00').toISOString() },
    { id:'lead_3', name:'Nexus Core Freight POS System', company:'Nexus Logistics Framework', email:'logistics-leads@nexus.io', phone:'+44-20-7946-0958', dealSize:54000, source:'Event', stage:'Negotiation', confidence:90, notes:'Contract review process initiated. Procurement reviewing legal terms agreements.', createdAt:new Date('2026-05-25T14:20:00').toISOString(), updatedAt:new Date('2026-06-05T11:00:00').toISOString() }
  ]
  const acts = [
    { id:'act_1', type:'Call', leadId:'lead_1', leadName:'AeroSpace Cloud Server Suite', company:'AeroSpace Dynamics', date:new Date('2026-06-08T08:30:00').toISOString(), duration:15, notes:'Brief introductory scoping sync.', nextAction:'Deliver quotation brief.', createdAt:new Date('2026-06-08T08:45:00').toISOString() },
    { id:'act_2', type:'Email', leadId:'lead_2', leadName:'Quantum Health CRM Expansion', company:'Quantum Health Services', date:new Date('2026-06-01T09:15:00').toISOString(), duration:0, notes:'Emailed formal SOW draft.', nextAction:'Follow up via telephone.', createdAt:new Date('2026-06-01T09:20:00').toISOString() }
  ]
  saveLeads(leads); saveActivities(acts)
  showToast('Sample data loaded successfully.', 'success')
  renderPipeline()
}

// ── Render Pipeline ──
function renderPipeline() {
  document.getElementById('empty-state-view').classList.add('hidden')
  document.getElementById('pipeline-active-view').classList.remove('hidden')
  calcKPIs()
  if (viewMode === 'table') {
    document.getElementById('table-container').classList.remove('hidden')
    document.getElementById('kanban-container').classList.add('hidden')
    renderTable()
  } else {
    document.getElementById('table-container').classList.add('hidden')
    document.getElementById('kanban-container').classList.remove('hidden')
    renderKanban()
  }
}

// ── Switch View ──
function switchView(mode) {
  viewMode = mode
  const bt = document.getElementById('toggle-table-btn'), bk = document.getElementById('toggle-kanban-btn')
  if (mode === 'table') {
    bt.classList.add('active','text-[#0f172a]'); bt.classList.remove('text-[#64748b]')
    bk.classList.remove('active','text-[#0f172a]'); bk.classList.add('text-[#64748b]')
  } else {
    bk.classList.add('active','text-[#0f172a]'); bk.classList.remove('text-[#64748b]')
    bt.classList.remove('active','text-[#0f172a]'); bt.classList.add('text-[#64748b]')
  }
  renderPipeline()
}

// ── KPI Calculations ──
function calcKPIs() {
  const leads = getLeads()
  let gross = 0, weighted = 0, won = 0, closed = 0
  leads.forEach(d => {
    const v = Number(d.dealSize || 0), c = Number(d.confidence || 0)
    gross += v
    weighted += v * (c / 100)
    if (d.stage === 'Closed Won') { won++; closed++ }
    else if (d.stage === 'Closed Lost') closed++
  })
  document.getElementById('kpi-gross').textContent = fmt$(gross)
  document.getElementById('kpi-weighted').textContent = fmt$(weighted)
  document.getElementById('kpi-winrate').textContent = (closed > 0 ? Math.round(won / closed * 100) : 0) + '%'
}

// ── Filtered + Sorted ──
function getFiltered() {
  let leads = getLeads()
  const q = document.getElementById('search-bar').value.toLowerCase().trim()
  const stage = document.getElementById('filter-stage').value
  const sort = document.getElementById('sort-order').value
  if (q) leads = leads.filter(d => d.name.toLowerCase().includes(q) || d.company.toLowerCase().includes(q) || (d.notes && d.notes.toLowerCase().includes(q)))
  if (stage !== 'All') leads = leads.filter(d => d.stage === stage)
  if (sort === 'ValueHighLow') leads.sort((a,b) => Number(b.dealSize) - Number(a.dealSize))
  else if (sort === 'ValueLowHigh') leads.sort((a,b) => Number(a.dealSize) - Number(b.dealSize))
  else if (sort === 'Alpha') leads.sort((a,b) => a.name.localeCompare(b.name))
  return leads
}

function refreshView() { viewMode === 'table' ? renderTable() : renderKanban() }

// ── Render Table ──
function renderTable() {
  const leads = getFiltered()
  const tbody = document.getElementById('deals-tbody')
  tbody.innerHTML = ''
  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-[#94a3b8] font-medium"><i class="fa-solid fa-folder-open text-2xl block mb-2 text-slate-300"></i>No matching records found.</td></tr>`
    return
  }
  leads.forEach(d => {
    const ev = Number(d.dealSize || 0) * (Number(d.confidence || 0) / 100)
    const relTime = timeAgo(d.updatedAt)
    let dateColor = 'text-[#64748b]'
    if (relTime.includes('days ago')) { const dd = parseInt(relTime); if (dd >= 7) dateColor = 'text-red-500 font-semibold' }

    const tr = document.createElement('tr')
    tr.className = 'hover:bg-[#f8fafc] transition-colors cursor-pointer group'
    tr.onclick = e => { if (e.target.closest('select') || e.target.closest('button') || e.target.closest('input')) return; openEditModal(d.id) }

    tr.innerHTML = `
      <td class="px-5 py-4">
        <div class="font-bold text-[#0f172a] group-hover:text-[#6366f1] transition-colors">${d.name}</div>
        <div class="text-xs text-[#94a3b8] font-medium mt-0.5">${d.company}</div>
      </td>
      <td class="px-5 py-4 font-bold text-[#0f172a]">${fmt$(d.dealSize)}</td>
      <td class="px-5 py-4">
        <select onchange="inlineStage('${d.id}',this.value)" class="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs font-semibold px-2 py-1.5 text-[#475569] focus:outline-none focus:border-[#6366f1]">
          ${STAGES.map(s => `<option value="${s}" ${d.stage===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td class="px-5 py-4 text-center">
        <div class="flex items-center justify-center gap-1.5">
          <input type="number" min="0" max="100" value="${d.confidence}"
            onchange="inlineConfidence('${d.id}',this.value)"
            class="w-12 text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#6366f1] focus:outline-none text-sm font-medium text-slate-700 py-0.5">
          <span class="text-xs text-slate-400 font-semibold">%</span>
        </div>
      </td>
      <td class="px-5 py-4 font-bold text-[#6366f1]">${fmt$(ev)}</td>
      <td class="px-5 py-4 text-center">
        <div class="flex items-center justify-center gap-2">
          <button onclick="quickLog('${d.id}','Call')" class="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:text-[#6366f1] hover:border-indigo-200 flex items-center justify-center text-xs text-[#64748b] transition-all" title="Log Call"><i class="fa-solid fa-phone"></i></button>
          <button onclick="quickLog('${d.id}','Email')" class="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:text-[#6366f1] hover:border-indigo-200 flex items-center justify-center text-xs text-[#64748b] transition-all" title="Log Email"><i class="fa-solid fa-envelope"></i></button>
        </div>
      </td>
      <td class="px-5 py-4 text-right ${dateColor} text-xs">${relTime}</td>`
    tbody.appendChild(tr)
  })
}

// ── Render Kanban ──
function renderKanban() {
  const leads = getFiltered()
  const container = document.getElementById('kanban-container')
  container.innerHTML = ''
  STAGES.forEach(stage => {
    const cards = leads.filter(d => d.stage === stage)
    let sum = 0; cards.forEach(d => sum += Number(d.dealSize || 0))
    const col = document.createElement('div')
    col.className = 'w-[280px] shrink-0 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-4 flex flex-col space-y-3 min-h-[480px] transition-colors'
    col.ondragover = e => e.preventDefault()
    col.ondrop = e => kanbanDrop(e, stage)
    col.innerHTML = `
      <div class="flex flex-col mb-2">
        <div class="flex justify-between items-center">
          <span class="text-xs font-bold uppercase tracking-wider text-[#475569]">${stage}</span>
          <span class="bg-slate-200 text-slate-700 text-[11px] px-2 py-0.5 rounded-full font-bold">${cards.length}</span>
        </div>
        <div class="text-xs font-bold text-slate-400 mt-1">${fmt$(sum)}</div>
      </div>
      <div class="flex-1 flex flex-col gap-3 dropzone"></div>`
    const dz = col.querySelector('.dropzone')
    if (!cards.length) {
      dz.innerHTML = `<div class="flex-1 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center p-4 py-8 text-center text-xs text-slate-400 italic font-medium bg-white/50">No deals</div>`
    } else {
      cards.forEach(d => {
        const card = document.createElement('div')
        card.className = 'bg-white p-4 border border-[#e2e8f0] rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-[#6366f1] transition-all flex flex-col space-y-3 group select-none'
        card.draggable = true
        card.ondragstart = e => e.dataTransfer.setData('text/plain', d.id)
        card.onclick = e => { if (!e.target.closest('button')) openEditModal(d.id) }
        card.innerHTML = `
          <div>
            <h4 class="text-xs font-bold text-[#0f172a] line-clamp-2 leading-snug group-hover:text-[#6366f1] transition-colors">${d.name}</h4>
            <p class="text-[11px] text-[#94a3b8] font-medium mt-1 truncate">${d.company}</p>
          </div>
          <div class="flex justify-between items-center pt-1">
            <span class="text-sm font-bold text-[#0f172a]">${fmt$(d.dealSize)}</span>
            <span class="badge ${badgeClass(d.stage)} text-[10px] py-0.5 px-2">${d.confidence}%</span>
          </div>`
        dz.appendChild(card)
      })
    }
    container.appendChild(col)
  })
}

// ── Kanban Drop ──
function kanbanDrop(e, targetStage) {
  e.preventDefault()
  const id = e.dataTransfer.getData('text/plain')
  if (!id) return
  let leads = getLeads()
  const idx = leads.findIndex(l => l.id === id)
  if (idx < 0) return
  const prev = leads[idx].stage
  if (prev === targetStage) return
  leads[idx].stage = targetStage
  leads[idx].confidence = defaultConfidence(targetStage)
  leads[idx].updatedAt = new Date().toISOString()
  saveLeads(leads)
  logActivity(id, `Stage Shift`, `Deal moved from [${prev}] to [${targetStage}].`)
  showToast(`Deal moved to ${targetStage}.`, 'success')
  renderPipeline()
}

// ── Activity Logging ──
function logActivity(leadId, action, text) {
  const leads = getLeads()
  const deal = leads.find(l => l.id === leadId)
  if (!deal) return
  const acts = getActivities()
  acts.push({ id:'act_'+Date.now()+Math.floor(Math.random()*100), type:'Note', leadId, leadName:deal.name, company:deal.company, date:new Date().toISOString(), duration:0, notes:text, nextAction:'', createdAt:new Date().toISOString() })
  saveActivities(acts)
}

function quickLog(id, type) {
  let leads = getLeads()
  const idx = leads.findIndex(l => l.id === id)
  if (idx < 0) return
  leads[idx].updatedAt = new Date().toISOString()
  saveLeads(leads)
  logActivity(id, type, `Logged ${type} follow-up action with client.`)
  showToast(`Logged ${type} activity.`, 'success')
  renderPipeline()
}

// ── Inline Stage Change ──
function inlineStage(id, val) {
  let leads = getLeads()
  const idx = leads.findIndex(l => l.id === id)
  if (idx < 0) return
  const prev = leads[idx].stage
  leads[idx].stage = val
  leads[idx].confidence = defaultConfidence(val)
  leads[idx].updatedAt = new Date().toISOString()
  saveLeads(leads)
  logActivity(id, 'Stage Update', `Stage changed from [${prev}] to [${val}].`)
  showToast('Pipeline stage updated.', 'success')
  renderPipeline()
}

// ── Inline Confidence Change ──
function inlineConfidence(id, val) {
  let c = parseInt(val); if (isNaN(c) || c < 0) c = 0; if (c > 100) c = 100
  let leads = getLeads()
  const idx = leads.findIndex(l => l.id === id)
  if (idx < 0) return
  leads[idx].confidence = c
  leads[idx].updatedAt = new Date().toISOString()
  saveLeads(leads)
  showToast(`Confidence updated to ${c}%.`, 'info')
  calcKPIs()
  if (viewMode === 'table') renderTable(); else renderKanban()
}

// ── Modal CRUD ──
function openCreateModal() {
  document.getElementById('deal-form').reset()
  document.getElementById('f-id').value = ''
  document.getElementById('modal-title').textContent = 'Create Deal'
  document.getElementById('f-delete').classList.add('hidden')
  document.getElementById('f-stage').value = 'Prospecting'
  document.getElementById('f-confidence').value = 10
  document.getElementById('deal-modal').classList.remove('hidden')
}

function openEditModal(id) {
  const leads = getLeads()
  const d = leads.find(l => l.id === id)
  if (!d) return
  document.getElementById('f-id').value = d.id
  document.getElementById('modal-title').textContent = 'Edit Deal'
  document.getElementById('f-name').value = d.name
  document.getElementById('f-company').value = d.company
  document.getElementById('f-value').value = d.dealSize
  document.getElementById('f-stage').value = d.stage
  document.getElementById('f-confidence').value = d.confidence
  document.getElementById('f-source').value = d.source || 'Website'
  document.getElementById('f-notes').value = d.notes || ''
  document.getElementById('f-delete').classList.remove('hidden')
  document.getElementById('deal-modal').classList.remove('hidden')
}

function closeModal() { document.getElementById('deal-modal').classList.add('hidden') }

function syncConfidence() {
  document.getElementById('f-confidence').value = defaultConfidence(document.getElementById('f-stage').value)
}

function saveDeal(e) {
  e.preventDefault()
  const id = document.getElementById('f-id').value
  const name = document.getElementById('f-name').value.trim()
  const company = document.getElementById('f-company').value.trim()
  const dealSize = parseInt(document.getElementById('f-value').value) || 0
  const stage = document.getElementById('f-stage').value
  const confidence = parseInt(document.getElementById('f-confidence').value) || 0
  const source = document.getElementById('f-source').value
  const notes = document.getElementById('f-notes').value.trim()
  let leads = getLeads()
  if (id) {
    const idx = leads.findIndex(l => l.id === id)
    if (idx > -1) { leads[idx] = { ...leads[idx], name, company, dealSize, stage, confidence, source, notes, updatedAt:new Date().toISOString() }; showToast('Deal updated.', 'success') }
  } else {
    leads.push({ id:'lead_'+Date.now(), name, company, dealSize, stage, confidence, source, notes, email:'', phone:'', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() })
    showToast('New deal created.', 'success')
  }
  saveLeads(leads); closeModal(); renderPipeline()
}

function deleteDeal() {
  const id = document.getElementById('f-id').value
  if (!id) return
  if (!confirm('Are you sure you want to permanently delete this deal?')) return
  let leads = getLeads().filter(l => l.id !== id)
  saveLeads(leads)
  let acts = getActivities().filter(a => a.leadId !== id)
  saveActivities(acts)
  showToast('Deal deleted.', 'error')
  closeModal()
  if (!leads.length) { document.getElementById('empty-state-view').classList.remove('hidden'); document.getElementById('pipeline-active-view').classList.add('hidden') }
  else renderPipeline()
}

// ── Export CSV ──
function exportCSV() {
  const leads = getLeads()
  if (!leads.length) { showToast('No data to export.', 'info'); return }
  let csv = 'Name,Company,Deal Value,Stage,Confidence %,Expected Value,Source,Notes\n'
  leads.forEach(d => {
    const ev = Number(d.dealSize || 0) * (Number(d.confidence || 0) / 100)
    csv += `"${d.name}","${d.company}",${d.dealSize},${d.stage},${d.confidence},${ev},"${d.source}","${(d.notes||'').replace(/"/g,'""')}"\n`
  })
  const blob = new Blob([csv], { type:'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'salestrack_pipeline.csv'; a.click()
  showToast('CSV exported.', 'success')
}

// ── Nav Menu ──
function changeMenu(key) {
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.className = 'nav-btn w-full flex items-center gap-3 px-[14px] py-[10px] rounded-[10px] text-[14px] font-medium text-[#64748b] transition-colors hover:bg-[#f8fafc] hover:text-[#0f172a]'
    const i = b.querySelector('i'); if (i) i.classList.remove('text-[#6366f1]')
  })
  const active = document.getElementById('nav-' + key)
  if (active) {
    active.className = 'nav-btn w-full flex items-center gap-3 px-[14px] py-[10px] rounded-[10px] text-[14px] font-semibold bg-[#eef2ff] text-[#6366f1]'
    const ai = active.querySelector('i'); if (ai) ai.classList.add('text-[#6366f1]')
  }
  if (key === 'pipeline') {
    document.getElementById('page-title').textContent = 'Commercial Deals Pipeline'
    const leads = getLeads()
    if (leads.length > 0) renderPipeline()
    else { document.getElementById('empty-state-view').classList.remove('hidden'); document.getElementById('pipeline-active-view').classList.add('hidden') }
  } else {
    document.getElementById('page-title').textContent = key.toUpperCase().replace('_', ' ') + ' Module'
    document.getElementById('empty-state-view').classList.add('hidden')
    document.getElementById('pipeline-active-view').classList.add('hidden')
    showToast(`Switched to ${key.replace('_', ' ')}.`, 'info')
  }
}

// ── Expose to global scope ──
window.loadSampleData = loadSampleData
window.switchView = switchView
window.refreshView = refreshView
window.openCreateModal = openCreateModal
window.openEditModal = openEditModal
window.closeModal = closeModal
window.syncConfidence = syncConfidence
window.saveDeal = saveDeal
window.deleteDeal = deleteDeal
window.inlineStage = inlineStage
window.inlineConfidence = inlineConfidence
window.quickLog = quickLog
window.changeMenu = changeMenu
window.exportCSV = exportCSV
