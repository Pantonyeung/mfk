const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const navItems=[
  ['order','點餐','<path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h5"/>'],
  ['orders','訂單','<path d="M7 4h10v16H7z"/><path d="M9 8h6M9 12h6M9 16h4"/>'],
  ['dine','堂食','<path d="M4 11h16M6 11v7M18 11v7M7 7h10l1 4H6z"/>'],
  ['soldout','售罄','<circle cx="12" cy="12" r="8"/><path d="M7 17 17 7"/>'],
  ['more','更多','<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>']
];

function icon(paths){return `<svg class="shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;}

export function renderGlobalStatusBar({terminalId='SMT',operationLabel='接單中',operationTone='online',lastOrder='—',context='',rightActions=''}={}){
  return `<header class="topbar global-statusbar"><div class="brand shell-brand"><span class="shell-brand-mark">磨</span><strong>磨飯 SMT</strong></div><span class="shell-terminal">${escape(terminalId)}</span>${context?`<span class="shell-context">${escape(context)}</span>`:''}<span class="shell-operation ${escape(operationTone)}"><i></i>${escape(operationLabel)}</span><div class="shell-last-order"><small>最近訂單</small><strong>${escape(lastOrder||'—')}</strong></div><div class="spacer"></div><div class="shell-actions">${rightActions}</div></header>`;
}

export function renderBottomNav(activeRoute,{badges={}}={}){
  return `<nav class="bottom-nav shell-bottom-nav" aria-label="主要功能">${navItems.map(([route,label,paths])=>`<button class="shell-nav-button ${activeRoute===route?'active':''}" data-action="shell-navigate" data-route="${route}" ${activeRoute===route?'aria-current="page"':''}>${icon(paths)}<span>${label}</span>${badges[route]?`<b class="shell-nav-badge">${escape(badges[route])}</b>`:''}</button>`).join('')}</nav>`;
}
