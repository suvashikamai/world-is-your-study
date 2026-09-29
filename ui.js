/* ============ UI ============ */
const NAV = [
  ['home','🏠','Home'],['study','📚','Study'],['schedule','🗓️','Schedule'],['world','🌍','My World'],
  ['friends','🤝','Friends'],['league','🏅','League'],['rewards','🎁','Rewards'],['stats','📊','Statistics'],['profile','👤','Profile'],
];
const MOBILE_NAV = [['home','🏠','Home'],['study','📚','Study'],['world','🌍','World'],['friends','🤝','Friends'],['more','☰','More']];

/* ---------- toasts & overlays ---------- */
function showToast(msg, kind='info'){
  const box=$('#toasts'); if(!box) return;
  const el=document.createElement('div'); el.className='toast '+kind; el.textContent=msg; box.appendChild(el);
  while(box.children.length>3) box.firstChild.remove();
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),320); }, kind==='big'?2800:2300);
}
G.onToast = showToast;
function floatFx(text, x, y, col){
  const el=document.createElement('div'); el.className='float'; el.textContent=text;
  el.style.left=(x||innerWidth/2)+'px'; el.style.top=(y||innerHeight/2)+'px'; if(col) el.style.color=col;
  document.body.appendChild(el); setTimeout(()=>el.remove(),1400);
}
let modalOnClose=null;
function openModal(html, cls='', onClose){
  closeModal(true);
  const bg=document.createElement('div'); bg.className='modal-bg'; bg.id='modalbg';
  bg.innerHTML=`<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener('click',e=>{ if(e.target===bg && !bg.dataset.lock) closeModal(); });
  $('#modal-root').appendChild(bg); modalOnClose=onClose||null;
  const f=bg.querySelector('[autofocus]'); if(f) setTimeout(()=>f.focus(),30);
}
function closeModal(silent){ const m=$('#modalbg'); if(m) m.remove(); const cb=modalOnClose; modalOnClose=null; if(cb && !silent) cb(); }

/* ---------- small renderers ---------- */
const bar = (pct, cls='', title='') => `<div class="bar ${cls}" ${title?`title="${esc(title)}"`:''}><i style="width:${clamp(pct,0,100).toFixed(1)}%"></i></div>`;
function avatarHTML(p, size=''){ if(!p) return `<div class="avatar ${size}" style="background:var(--panel3)">?</div>`; return `<div class="avatar ${size}" style="background:${esc(p.avatarCol||'#58d0e8')}33;box-shadow:inset 0 0 0 2px ${esc(p.avatarCol||'#58d0e8')}">${esc(p.avatar||'🦉')}</div>`; }
function meP(){ return {avatar:G.S.profile.avatar, avatarCol:G.S.profile.avatarCol, displayName:G.S.profile.displayName}; }
function leagueChip(t){ const L=LEAGUES[t||0]; return `<span class="chip" style="color:${L.col};border-color:${L.col}55;background:${L.col}18">🏅 ${L.n}</span>`; }
function thName(th){ const t=TOWNHALL[th||1]; return `${t.icon} ${t.name}`; }
function subjName(id){ const s=G.S.subjects.find(x=>x.id===id); return s? s.name : 'General'; }
function subjCol(id){ const s=G.S.subjects.find(x=>x.id===id); return s? s.col : '#9bb0c7'; }
function rewardText(r){ const a=[]; if(r.xp) a.push(`+${r.xp} XP`); if(r.coins) a.push(`+${r.coins} 🪙`); if(r.mat) a.push(`+${r.mat} 🧱`); if(r.chest) a.push(`${CHESTS[r.chest].i} ${CHESTS[r.chest].n}`); return a.join(' · '); }

/* ---------- shell ---------- */
function renderShell(){
  $('#app').innerHTML = `
  <div class="app">
    <aside class="side">
      <div class="brand"><div class="logo">🌍</div><div><b>World Is Your Study</b><span>Study builds worlds</span></div></div>
      <nav class="nav" id="sidenav"></nav>
      <div style="margin-top:auto" class="tiny dim" id="sidefoot"></div>
    </aside>
    <div class="main">
      <header class="top" id="topbar"></header>
      <main class="content">
        <div id="worldPanel" hidden></div>
        <div id="view"></div>
      </main>
    </div>
  </div>
  <nav class="bottom" id="bottomnav"></nav>`;
}
function renderChrome(){
  const S=G.S; if(!S || !S.profile) return;
  const notifs=notifications(); const actN=notifs.filter(n=>n.act).length;
  const dots={rewards:claimableCount()+Object.values(S.chests).reduce((a,b)=>a+b,0), friends:incomingRequests().length+allChallenges().filter(x=>x.role==='receiver'&&!S.social.chState[x.c.id]&&!chExpired(x.c)).length, world:canUpgradeTH()?1:0};
  $('#sidenav').innerHTML = NAV.map(([k,i,l])=>`<a href="#${k}" data-a="nav" data-v="${k}" class="${G.view===k?'on':''}"><span class="ic">${i}</span>${l}${dots[k]?`<span class="dot">${dots[k]}</span>`:''}</a>`).join('');
  const moreOn = ['schedule','league','rewards','stats','profile'].includes(G.view);
  const moreDot = dots.rewards;
  $('#bottomnav').innerHTML = MOBILE_NAV.map(([k,i,l])=>`<a href="#${k}" data-a="${k==='more'?'more':'nav'}" data-v="${k}" class="${(G.view===k||(k==='more'&&moreOn))?'on':''}"><span class="ic">${i}</span>${l}${(k==='more'?moreDot:dots[k])?'<span class="dot"></span>':''}</a>`).join('');
  const lp=levelProgress(S.xp); const st=currentStreak();
  const active=S.active;
  $('#topbar').innerHTML = `
    <button class="me" data-a="nav" data-v="profile" aria-label="Profile">
      <div style="position:relative">${avatarHTML(meP())}<span class="lvbadge">${lp.level}</span></div>
      <div class="who"><div style="font-weight:800">${esc(S.profile.displayName)}</div>
        <div class="xpline" title="${fmtNum(lp.into)} / ${fmtNum(lp.need)} XP to level ${lp.level+1}">${bar(lp.pct*100,'thin')}</div></div>
    </button>
    ${active?`<button class="pill xp" data-a="nav" data-v="study" id="topclock" style="cursor:pointer">⏱ <span class="num" id="topclockv">${fmtClock(elapsedSec())}</span></button>`:''}
    <div class="res">
      <span class="pill xp" title="Total XP">⭐ <span class="num">${fmtNum(S.xp)}</span></span>
      <span class="pill coin" title="Study Coins">🪙 <span class="num">${fmtNum(S.coins)}</span></span>
      <span class="pill mat" title="Building materials">🧱 <span class="num">${fmtNum(S.mat)}</span></span>
      <span class="pill fire" title="Daily streak">🔥 <span class="num">${st}</span></span>
      <button class="bell" data-a="notifs" aria-label="Notifications">🔔${actN?`<i>${actN}</i>`:''}</button>
    </div>`;
  $('#sidefoot').innerHTML = G.offline ? `<span style="color:var(--warn)">Preview mode · not saved</span>` : `@${esc(S.profile.username)} · ${esc(S.profile.playerId)}${G.netDown?' · <span style="color:var(--warn)">offline</span>':''}`;
}

/* ---------- master render ---------- */
function render(){
  if(!G.uid && !G.offline){ renderAuth(); return; }
  if(!G.S){ $('#app').innerHTML=`<div class="splash"><div><div style="font-size:56px">🌍</div><p class="muted" style="margin-top:10px">Loading your world…</p></div></div>`; return; }
  if(!G.S.profile){ renderOnboarding(); return; }
  if(!$('#view')) renderShell();
  renderChrome();
  const v=G.view;
  const wp=$('#worldPanel'); wp.hidden = v!=='world';
  const fn = VIEWS[v] || VIEWS.home;
  const sc = window.scrollY;
  $('#view').innerHTML = fn();
  if(v==='world') mountWorldPanel(); else if(window.World) World.pause();
  if(v==='study') tick();
  window.scrollTo(0, sc);
}
function go(v, arg){ if(v===G.view && arg===undefined){ render(); return; } G.view=v; G.viewArg=arg; if(v!=='world') G.worldTarget=null; try{ history.replaceState(null,'','#'+v);}catch(e){} render(); window.scrollTo(0,0); }

/* ======================= HOME ======================= */
function greeting(){ const h=new Date().getHours(); return h<5?'Burning the midnight oil':h<12?'Good morning':h<17?'Good afternoon':h<21?'Good evening':'Good night'; }
function friendFeed(limit=8){
  const items=[];
  const add=(u,p)=>{ (u===G.uid? G.S.social.feed : (p.feed||[])).forEach(f=>{ const t = f.ago!=null ? Date.now()-f.ago*60000 : f.t; items.push({u, p, f, t}); }); };
  add(G.uid, meP());
  friendsList().forEach(u=>add(u,P(u)));
  return items.sort((a,b)=>b.t-a.t).slice(0,limit);
}
function feedHTML(items){
  if(!items.length) return `<div class="empty">No activity yet. Add friends and study to fill this feed.</div>`;
  const icon={session:'🔥',badge:'🏆',th:'🏗️',challenge:'🎁',level:'⭐',streak:'🔥',build:'🏠',friend:'🤝'};
  return `<div class="list feed">${items.map(({u,p,f,t})=>{ const rx=reactionsFor(u,f.id);
    return `<div class="li"><div style="font-size:20px;width:28px;text-align:center">${icon[f.type]||'✨'}</div>
      <div class="grow"><div><b>${u===G.uid?'You':esc(p.displayName)}</b> ${esc(f.text)}</div>
      <div class="tiny dim">${timeAgo(t)}</div>
      <div class="react">${REACTIONS.map(e=>`<button class="${rx.mine===e?'on':''}" data-a="react" data-u="${esc(u)}" data-id="${esc(f.id)}" data-e="${e}" ${u===G.uid?'disabled':''}>${e}${rx.counts[e]?` <span class="num tiny">${rx.counts[e]}</span>`:''}</button>`).join('')}</div></div>
      ${avatarHTML(u===G.uid?meP():p,'sm')}</div>`; }).join('')}</div>`;
}
const VIEWS = {};
VIEWS.home = () => {
  const S=G.S, d=today(), goal=S.goalMin, pct=Math.min(100, d.min/goal*100), st=currentStreak();
  const w=weekAgg(), rank=myRank(), nu=nextUnlock(), cs=cityStats(S.city), lp=levelProgress(S.xp);
  const qs=dailyQuests();
  const todayBadges=Object.entries(S.badges).filter(([id,t])=>dayKey(tzNow(t))===dayKey()).map(([id])=>allBadges().find(b=>b.id===id)).filter(Boolean);
  const todayTasks=S.tasks.filter(t=>t.date===dayKey()||(!t.done&&t.date<dayKey()));
  const builds=activeBuilds();
  return `
  ${G.offline?`<div class="lock-note" style="margin-bottom:14px">Preview mode: Firebase isn’t configured yet, so progress isn’t saved and friends aren’t connected. Fill in firebase-config.js to connect it.</div>`:''}
  ${G.netDown?`<div class="lock-note" style="margin-bottom:14px">You’re offline. You can look around; changes will work again once you reconnect.</div>`:''}
  <section class="hero">
    <svg class="sky" viewBox="0 0 800 200" preserveAspectRatio="none" aria-hidden="true"><g fill="#0f2233">${skyline()}</g></svg>
    <div class="row spread" style="align-items:flex-start;gap:18px">
      <div class="stack" style="gap:10px;min-width:0;flex:1 1 320px">
        <div class="eyebrow">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</div>
        <h1 class="greet">${greeting()}, ${esc(S.profile.displayName.toUpperCase())}!</h1>
        <div class="row">${st?`<span class="flame">🔥 ${st} DAY STREAK</span>`:`<span class="flame" style="color:var(--muted);border-color:var(--line2);background:transparent">🔥 Start a streak today</span>`}
          ${leagueChip(S.league.tier)} <span class="chip">${thName(S.city.th)}</span></div>
        <div style="max-width:520px">
          <div class="row spread small"><b>Today's progress</b><span class="num">${fmtMin(d.min)} / ${fmtMin(goal)} · ${Math.round(pct)}%</span></div>
          <div style="margin-top:6px">${bar(pct,'thick gold')}</div>
        </div>
        <div class="row" style="margin-top:4px">
          ${S.active?`<button class="btn xl cyan" data-a="nav" data-v="study">⏱ Back to your session</button>`:`<button class="btn xl gold" data-a="quickstart">▶ Start studying</button>`}
          <button class="btn ghost" data-a="nav" data-v="world">🌍 Enter my world</button>
        </div>
      </div>
      <div class="ring" style="--p:${(lp.pct*100).toFixed(1)}"><div><div class="eyebrow">Level</div><div style="font-family:var(--display);font-size:38px;line-height:1">${lp.level}</div><div class="tiny muted num">${fmtNum(lp.need-lp.into)} XP to go</div></div></div>
    </div>
  </section>

  <div class="grid g4" style="margin-top:14px">
    ${statCard('⏱','Study time today',fmtMin(d.min))}
    ${statCard('⭐','XP today','+'+fmtNum(d.xp),'var(--xp)')}
    ${statCard('🪙','Coins today','+'+fmtNum(d.coins),'var(--coin)')}
    ${statCard('🏅','Weekly rank',rank?'#'+rank:'—','',`${fmtNum(w.xp)} XP this week`)}
    ${statCard('🏛️','Town Hall','Level '+S.city.th,'',TOWNHALL[S.city.th].name)}
    ${statCard('👪','Population',fmtNum(cs.population),'var(--grass)')}
    ${statCard('🏆','Badges',Object.keys(S.badges).length+' / '+allBadges().length)}
    ${statCard('📦','Chests',Object.values(S.chests).reduce((a,b)=>a+b,0),'var(--epic)',`${Math.round(S.chestMin/ECON.chestEveryMin*100)}% to next`)}
  </div>

  <div class="grid g2 collapse" style="margin-top:14px;align-items:start">
    <div class="stack">
      <div class="card">
        <div class="eyebrow">Next unlock</div>
        ${nu?`<div class="unlock" style="margin-top:10px"><div class="big">${nu.b.i}</div><div class="grow"><h3>${esc(nu.b.n)}</h3>
          <div class="small muted">Requires Town Hall ${nu.b.th} · you're at ${S.city.th}</div>
          <div class="row spread small" style="margin-top:8px"><span>Town Hall ${S.city.th+1} progress</span><b class="num">${nu.pct}%</b></div>${bar(nu.pct,'green')}</div></div>`
        :`<p class="muted">Every building is unlocked. Your civilization is complete.</p>`}
      </div>
      <div class="card">
        <div class="row spread"><h3>Today's quests</h3><button class="btn sm ghost" data-a="nav" data-v="rewards">All rewards →</button></div>
        <div class="stack" style="margin-top:12px;gap:8px">${qs.map(questHTML).join('')}</div>
      </div>
      <div class="card">
        <div class="row spread"><h3>Today's tasks</h3><button class="btn sm ghost" data-a="nav" data-v="study">Manage →</button></div>
        <div class="list" style="margin-top:6px">${todayTasks.length?todayTasks.slice(0,6).map(taskRow).join(''):`<div class="empty small">No tasks for today. Add one in Study.</div>`}</div>
      </div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="row spread"><h3>Under construction</h3><span class="chip">${builds.length}/${buildSlotsFor(S.city.th)} slots</span></div>
        ${builds.length?`<div class="stack" style="margin-top:12px;gap:10px">${builds.map(b=>{const d=BMAP[b.id]; return `<div><div class="row spread small"><span>${d.i} ${esc(d.n)}</span><span class="num muted">${Math.round(b.prog)}/${d.min} study min</span></div>${bar(b.prog/d.min*100,'mat')}</div>`;}).join('')}</div>`
          :`<p class="small muted" style="margin-top:8px">Nothing is being built. Place a building in your world, then study to construct it.</p>`}
      </div>
      <div class="card">
        <div class="row spread"><h3>Friend activity</h3><button class="btn sm ghost" data-a="nav" data-v="friends">Friends →</button></div>
        ${feedHTML(friendFeed(6))}
      </div>
      <div class="card">
        <h3>Today's achievements</h3>
        ${todayBadges.length || qs.some(q=>q.claimed)?`<div class="row" style="margin-top:10px">${todayBadges.map(b=>`<span class="chip warn">${b.i} ${esc(b.n)}</span>`).join('')}${qs.filter(q=>q.claimed).map(q=>`<span class="chip ok">${q.i} ${esc(q.t)}</span>`).join('')}</div>`
          :`<p class="small muted" style="margin-top:6px">Finish a session or a quest and it shows up here.</p>`}
      </div>
    </div>
  </div>`;
};
function statCard(ic,l,v,col='',sub=''){ return `<div class="card tight stat"><div class="row nowrap" style="gap:8px"><span>${ic}</span><span class="l">${l}</span></div><div class="v num" style="${col?`color:${col}`:''}">${v}</div>${sub?`<div class="tiny dim">${esc(sub)}</div>`:''}</div>`; }
function skyline(){ const r=seeded('sky'); let x=0, s=''; while(x<800){ const w=18+r()*40, h=30+r()*110; s+=`<rect x="${x.toFixed(0)}" y="${(200-h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="2"/>`; x+=w+3; } return s; }
function questHTML(q){
  return `<div class="quest ${q.done&&!q.claimed?'claim':''}"><div class="qi">${q.i}</div><div class="grow">
    <div class="row spread nowrap"><b class="small">${esc(q.t)}</b><span class="tiny muted num">${fmtNum(q.cur)}/${fmtNum(q.v)}</span></div>
    <div style="margin:6px 0 4px">${bar(q.cur/q.v*100, q.done?'green':'')}</div><div class="tiny dim">${rewardText(q.r)}</div></div>
    ${q.claimed?`<span class="chip ok">✓</span>`:q.done?`<button class="btn sm gold" data-a="claimq" data-id="${q.id}" data-w="${q.kind&&WEEKLY_POOL.some(w=>w.id===q.id)?1:''}">Claim</button>`:''}</div>`;
}
function taskRow(t){
  const kindIc={task:'📝',assignment:'📄',goal:'🎯'}[t.kind]||'📝';
  const overdue=!t.done && t.date<dayKey();
  return `<div class="li"><button class="check ${t.done?'on':''}" data-a="task" data-id="${t.id}" aria-label="Toggle task">${t.done?'✓':''}</button>
    <div class="grow"><div class="${t.done?'done-t':''}">${kindIc} ${esc(t.title)}</div>
    <div class="tiny dim">${t.subjectId?`<span style="color:${subjCol(t.subjectId)}">● ${esc(subjName(t.subjectId))}</span> · `:''}${t.date===dayKey()?'Today':esc(t.date)}${overdue?' · <span style="color:var(--bad)">overdue</span>':''}</div></div>
    <button class="iconbtn" data-a="deltask" data-id="${t.id}" aria-label="Delete task">✕</button></div>`;
}

/* ======================= STUDY ======================= */
let studyUI={mode:'countdown', target:25, subjectId:null, topicId:null, custom:50, taskFilter:'open'};
VIEWS.study = () => {
  const S=G.S;
  if(!studyUI.subjectId && S.subjects[0]) studyUI.subjectId=S.subjects[0].id;
  const a=S.active;
  const timerCard = a ? activeTimerHTML(a) : `
    <div class="card">
      <div class="row spread"><h2>Start a study session</h2><span class="chip">Real time = real progress</span></div>
      <div class="grid g2 collapse" style="margin-top:14px">
        <label class="f">Subject<select id="st-subj" data-ch="st-subj">${S.subjects.map(s=>`<option value="${s.id}" ${s.id===studyUI.subjectId?'selected':''}>${esc(s.name)}</option>`).join('')}<option value="" ${!studyUI.subjectId?'selected':''}>General study</option></select></label>
        <label class="f">Topic (optional)<select id="st-topic" data-ch="st-topic"><option value="">Any topic</option>${(S.subjects.find(s=>s.id===studyUI.subjectId)||{topics:[]}).topics.filter(t=>!t.done).map(t=>`<option value="${t.id}" ${t.id===studyUI.topicId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
      </div>
      <div style="margin-top:14px" class="seg">${['countdown','stopwatch'].map(m=>`<button class="${studyUI.mode===m?'on':''}" data-a="stmode" data-v="${m}">${m==='countdown'?'⏳ Countdown':'⏱ Stopwatch'}</button>`).join('')}</div>
      ${studyUI.mode==='countdown'?`<div class="row" style="margin-top:12px">${[10,25,45,60,90,120].map(m=>`<button class="btn sm ${studyUI.target===m?'cyan':'ghost'}" data-a="sttarget" data-v="${m}">${m} min</button>`).join('')}
        <label class="row nowrap small muted" style="gap:6px">Custom <input type="number" id="st-custom" min="5" max="240" value="${studyUI.custom}" style="width:86px;min-height:34px;padding:4px 8px"> <button class="btn sm ${![10,25,45,60,90,120].includes(studyUI.target)?'cyan':'ghost'}" data-a="stcustom">Set</button></label></div>`
        :`<p class="small muted" style="margin-top:10px">Press start, study, press stop. The actual time is recorded (up to ${ECON.maxSessionMin/60} hours per session).</p>`}
      <div class="row" style="margin-top:16px"><button class="btn xl gold" data-a="start">▶ Start ${studyUI.mode==='countdown'?studyUI.target+' min':'stopwatch'}</button></div>
      <div class="mstrip" style="margin-top:16px">${MILESTONES.slice(0,8).map(m=>`<div title="${m.label}: ${rewardText(m)}">${m.m}m</div>`).join('')}</div>
      <p class="tiny dim" style="margin-top:8px">Every minute earns ${ECON.xpPerMin} XP and ${ECON.coinPerMin} coin, plus a bonus at each checkpoint above. Sessions under ${ECON.minSessionMin} minutes are not recorded.</p>
    </div>`;
  const tasks=S.tasks.filter(t=>studyUI.taskFilter==='open'? !t.done : studyUI.taskFilter==='today'? t.date===dayKey() : t.done).sort((x,y)=>x.date<y.date?-1:1);
  return `
  <div class="sec"><div><div class="eyebrow">The engine of your world</div><h1>Study</h1></div></div>
  ${timerCard}
  <div class="grid g2 collapse" style="margin-top:14px;align-items:start">
    <div class="card">
      <div class="row spread"><h3>Subjects & topics</h3><span class="chip">${S.subjects.length} subjects</span></div>
      <form class="row nowrap" data-form="addsubj" style="margin-top:12px"><input type="text" id="new-subj" placeholder="New subject, e.g. Digital Signal Processing" maxlength="60"><button class="btn cyan">Add</button></form>
      <div class="stack" style="margin-top:12px;gap:14px">${S.subjects.map(subjectBlock).join('') || `<div class="empty small">Add your first subject to start organizing topics.</div>`}</div>
    </div>
    <div class="card">
      <div class="row spread"><h3>Tasks & assignments</h3><div class="seg">${[['open','Open'],['today','Today'],['done','Done']].map(([k,l])=>`<button class="${studyUI.taskFilter===k?'on':''}" data-a="tfilter" data-v="${k}">${l}</button>`).join('')}</div></div>
      <form data-form="addtask" class="stack" style="margin-top:12px;gap:8px">
        <input type="text" id="nt-title" placeholder="What needs doing?" maxlength="90">
        <div class="row nowrap" style="gap:8px">
          <select id="nt-kind" style="flex:1"><option value="task">📝 Task</option><option value="assignment">📄 Assignment</option><option value="goal">🎯 Study goal</option></select>
          <select id="nt-subj" style="flex:1"><option value="">No subject</option>${S.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
          <input type="date" id="nt-date" value="${dayKey()}" style="flex:1">
        </div>
        <button class="btn cyan">Add task</button>
      </form>
      <div class="list" style="margin-top:8px">${tasks.slice(0,40).map(taskRow).join('') || `<div class="empty small" style="margin-top:8px">Nothing here.</div>`}</div>
    </div>
  </div>
  <div class="card" style="margin-top:14px">
    <div class="row spread"><h3>Recent sessions</h3><span class="tiny muted">This month · ${G.monthLog.length} sessions</span></div>
    <div class="tblwrap"><table class="tbl" style="margin-top:8px"><thead><tr><th>When</th><th>Subject</th><th>Mode</th><th>Duration</th><th>XP</th><th>Coins</th></tr></thead>
    <tbody>${G.monthLog.slice(-10).reverse().map(s=>`<tr><td class="small">${new Date(s.st).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td><td>${esc(s.sub)}</td><td class="small muted">${s.mode}</td><td class="num">${fmtMin(s.min)}</td><td class="num" style="color:var(--xp)">+${s.xp}</td><td class="num" style="color:var(--coin)">+${s.c}</td></tr>`).join('') || `<tr><td colspan="6" class="muted small">No sessions yet this month.</td></tr>`}</tbody></table></div>
  </div>`;
};
function subjectBlock(s){
  const done=s.topics.filter(t=>t.done).length;
  return `<div>
    <div class="row nowrap"><span class="subj-dot" style="background:${s.col}"></span><b class="grow">${esc(s.name)}</b><span class="tiny muted num">${done}/${s.topics.length}</span>
    <button class="iconbtn" data-a="delsubj" data-id="${s.id}" aria-label="Delete subject">🗑</button></div>
    ${s.topics.length?`<div style="margin:6px 0 0">${bar(s.topics.length? done/s.topics.length*100:0,'thin green')}</div>`:''}
    <div style="margin-top:6px">${s.topics.map(t=>`<div class="topic"><button class="check ${t.done?'on':''}" data-a="topic" data-s="${s.id}" data-id="${t.id}" aria-label="Toggle topic">${t.done?'✓':''}</button><span class="grow small ${t.done?'done-t':''}">${esc(t.name)}</span><button class="iconbtn" data-a="deltopic" data-s="${s.id}" data-id="${t.id}" aria-label="Delete topic">✕</button></div>`).join('')}
    <form class="topic" data-form="addtopic" data-s="${s.id}"><input type="text" placeholder="+ Add topic" maxlength="60" style="min-height:36px;padding:6px 10px"></form></div>
  </div>`;
}
function activeTimerHTML(a){
  const sub=subjName(a.subjectId); const top=a.topicId? ((G.S.subjects.find(s=>s.id===a.subjectId)||{topics:[]}).topics.find(t=>t.id===a.topicId)||{}).name : '';
  return `<div class="card timer" id="timercard" style="background:linear-gradient(180deg,#183149,#14263a)">
    <div class="row" style="justify-content:center"><span class="chip xp">${a.mode==='countdown'?`⏳ Countdown · ${a.targetMin} min`:'⏱ Stopwatch'}</span><span class="chip"><span class="subj-dot" style="background:${subjCol(a.subjectId)}"></span>${esc(sub)}${top?' · '+esc(top):''}</span>${a.pausedAt?'<span class="chip warn">Paused</span>':''}</div>
    <div class="bigring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="8"/><circle id="ringarc" cx="60" cy="60" r="54" fill="none" stroke="${a.mode==='countdown'?'var(--xp)':'var(--coin)'}" stroke-width="8" stroke-linecap="round" stroke-dasharray="339.3" stroke-dashoffset="339.3"/></svg>
      <div class="inner"><div class="clock" id="clock">00:00</div><div class="small muted" id="clocksub"></div></div></div>
    <div class="bank" id="bank"></div>
    <div class="mstrip" id="mstrip">${MILESTONES.slice(0,8).map(m=>`<div data-m="${m.m}" title="${m.label}: ${rewardText(m)}">${m.m}m</div>`).join('')}</div>
    <div class="small muted" id="nextms"></div>
    <div class="row" style="justify-content:center">
      ${a.pausedAt?`<button class="btn cyan" data-a="resume">▶ Resume</button>`:`<button class="btn ghost" data-a="pause">⏸ Pause</button>`}
      <button class="btn gold xl" data-a="stop">■ Finish session</button>
      <button class="btn ghost sm" data-a="cancelsess">Discard</button>
    </div>
  </div>`;
}
function tick(){
  const a=G.S && G.S.active; const tc=$('#topclockv'); if(tc) tc.textContent=fmtClock(elapsedSec());
  if(!a) return;
  const sec=elapsedSec(a), min=sec/60;
  if(a.mode==='countdown' && a.targetMin && min>=a.targetMin && !a.pausedAt && !G._autoFinishing && !G._finishing && !(G._retryAt>Date.now())){ G._autoFinishing=true; setTimeout(()=>{ G._autoFinishing=false; doFinish(); },50); return; }
  if(G.view!=='study') return;
  const c=$('#clock'); if(!c) return;
  const shown = a.mode==='countdown' ? Math.max(0, a.targetMin*60-sec) : sec;
  c.textContent=fmtClock(shown);
  const arc=$('#ringarc'); const frac = a.mode==='countdown' ? sec/(a.targetMin*60) : (min%60)/60;
  if(arc) arc.setAttribute('stroke-dashoffset', (339.3*(1-clamp(frac,0,1))).toFixed(1));
  const pv=sessionPreview(Math.min(min,ECON.maxSessionMin));
  $('#clocksub').textContent = a.mode==='countdown' ? `${fmtMin(min)} studied` : (min>=ECON.maxSessionMin?`Session cap reached (${ECON.maxSessionMin/60}h)`:'keep going');
  $('#bank').innerHTML = `<span class="chip xp">⭐ +${fmtNum(pv.xp)} XP</span><span class="chip warn">🪙 +${fmtNum(pv.coins)}</span>${pv.mat?`<span class="chip">🧱 +${pv.mat}</span>`:''}<span class="chip epic">🎁 ${Math.min(100,Math.round((G.S.chestMin+min)/ECON.chestEveryMin*100))}% chest</span>`;
  $$('#mstrip div').forEach(d=>{ const hit=min>=+d.dataset.m; if(hit && !d.classList.contains('hit') && G._lastTickMin!==undefined && G._lastTickMin < +d.dataset.m && min-G._lastTickMin<0.2){ const m=MILESTONES.find(x=>x.m===+d.dataset.m); toast(`✨ ${m.m} min · ${m.label} — ${rewardText(m)} banked`,'reward'); } d.classList.toggle('hit',hit); });
  G._lastTickMin=min;
  $('#nextms').textContent = pv.next ? `Next checkpoint in ${Math.ceil(pv.next.m-min)} min: ${pv.next.label} (${rewardText(pv.next)})` : 'All checkpoints banked. Legend.';
}
setInterval(()=>{ try{ tick(); }catch(e){ console.error(e);} }, 1000);

async function doFinish(overrideMin){
  if(!G.S.active || G._finishing) return;
  G._finishing=true;
  const wasFirst = G.S.stats.sessions===0;
  const r = await act('finishSession', {overrideMin});
  G._finishing=false; G._autoFinishing=false;
  if(!r.ok){ G._retryAt=Date.now()+30000; return; }
  onSessionEnd();
  closeModal(true); render();
  if(r.res){ showComplete(r.res, wasFirst); if(document.hidden && r.res.min) deviceAlert('Session complete!', `${fmtMin(r.res.min)} studied · +${r.res.xp} XP · +${r.res.coins} coins`); }
}
function stopDialog(){
  const a=G.S.active; if(!a) return;
  const min=Math.floor(elapsedSec(a)/60);
  if(min < ECON.minSessionMin){ openModal(`<h2>Finish now?</h2><p class="muted">Sessions shorter than ${ECON.minSessionMin} minutes aren’t recorded. You’ve studied ${fmtClock(elapsedSec(a))}.</p><div class="row" style="margin-top:14px"><button class="btn ghost" data-a="closemodal">Keep studying</button><button class="btn red" data-a="cancelsess2">Discard session</button></div>`); return; }
  if(a.mode==='stopwatch' && min>120){
    openModal(`<h2>Long session — ${fmtMin(min)}</h2><p class="muted">If you stepped away and forgot to stop, enter the time you actually studied. Honest minutes build a world you can be proud of.</p>
      <label class="f" style="margin-top:12px">Minutes studied<input type="number" id="adj-min" min="${ECON.minSessionMin}" max="${min}" value="${Math.min(min,ECON.maxSessionMin)}"></label>
      <div class="row" style="margin-top:14px"><button class="btn gold" data-a="finishadj">Save session</button><button class="btn ghost" data-a="closemodal">Keep going</button></div>`);
    return;
  }
  doFinish();
}
function showComplete(r, wasFirst){
  if(r.discarded){ toast(r.capped?`Daily reward limit (${ECON.maxDailyMin/60}h) reached. Rest up — your world will wait.`:`Session too short to record (under ${ECON.minSessionMin} min).`,'warn'); return; }
  const lines=[
    ['📚','Subject',esc(r.sub)],
    ['⏱','Duration',fmtMin(r.min)],
    ['⭐','XP',`+${fmtNum(r.xp)}`,'var(--xp)'],
    ['🪙','Coins',`+${fmtNum(r.coins)}`,'var(--coin)'],
  ];
  if(r.mat) lines.push(['🧱','Materials',`+${r.mat}`,'var(--mat)']);
  lines.push(['🔥','Streak',`${r.streak} day${r.streak===1?'':'s'}${r.streakUp?' ↑':''}`,'var(--fire)']);
  lines.push(['🏗','Civilization progress',`+${r.civ.toFixed(1)}%`,'var(--grass)']);
  lines.push(['🎁','Chest progress',`+${r.chestPct}%`,'var(--epic)']);
  if(r.near) lines.push(['🏆','Achievement progress',`${r.near.i} ${esc(r.near.n)} ${r.near.pct}%`]);
  const extra=[];
  if(r.mults.length) extra.push(`Bonuses: ${r.mults.map(m=>`${m[0]} +${Math.round(m[1]*100)}%`).join(', ')}${r.boostXp?`, chest boost +${r.boostXp} XP`:''}`);
  if(r.lvl1>r.lvl0) extra.push(`⭐ Level up! You reached Level ${r.lvl1}.`);
  r.finished.forEach(d=>extra.push(`🏗️ ${d.i} ${d.n} finished construction.`));
  r.buildProg.forEach(b=>extra.push(`🔨 ${b.d.i} ${b.d.n}: ${b.pct}% built`));
  r.chestsGot.forEach(k=>extra.push(`🎁 ${CHESTS[k].n} earned.`));
  r.badges.forEach(b=>extra.push(`🏆 Badge unlocked: ${b.i} ${b.n}`));
  r.streakRew.forEach(s=>extra.push(`🔥 ${s.d}-day streak reward: ${rewardText(s)}`));
  r.chDone.forEach(c=>extra.push(`🎯 Challenge complete${c.won?' — duel won':''}`));
  if(r.capped) extra.push(`Some minutes weren’t counted because of the ${ECON.maxDailyMin/60}h daily limit.`);
  openModal(`
    <div class="eyebrow" style="text-align:center">Your world moved forward</div>
    <h1 class="complete-h" style="margin:4px 0 14px">SESSION COMPLETE!</h1>
    <div class="stack" style="gap:6px">${lines.map((l,i)=>`<div class="cline" style="animation-delay:${i*70}ms"><span class="ci">${l[0]}</span><span class="small muted">${l[1]}</span><span class="cv" style="${l[3]?`color:${l[3]}`:''}">${l[2]}</span></div>`).join('')}</div>
    ${extra.length?`<div class="stack" style="gap:6px;margin-top:12px">${extra.map(e=>`<div class="small">${esc(e)}</div>`).join('')}</div>`:''}
    <div class="row" style="margin-top:18px">
      ${wasFirst?`<button class="btn gold block" data-a="firsthouse">🏠 Build your first house</button>`:`<button class="btn gold" data-a="closemodal">Continue</button><button class="btn ghost" data-a="gomodal" data-v="world">🌍 See my world</button><button class="btn ghost" data-a="gomodal" data-v="rewards">🎁 Rewards</button>`}
    </div>`, '', null);
  const rect=$('.modal').getBoundingClientRect(); floatFx(`+${r.xp} XP`, rect.left+rect.width/2-50, rect.top+80, 'var(--xp)');
}

/* ======================= SCHEDULE ======================= */
let schedUI={weekOffset:0, repeat:'once'};
VIEWS.schedule = () => {
  const S=G.S; const base=tzNow(); base.setUTCDate(base.getUTCDate()+schedUI.weekOffset*7);
  const days=weekDays(base); const tk=dayKey();
  const nowMin=tzNow().getUTCHours()*60+tzNow().getUTCMinutes();
  const todays=scheduleFor(tk).sort((a,b)=>a.start<b.start?-1:1);
  return `
  <div class="sec"><div><div class="eyebrow">Plan it, then do it</div><h1>Schedule</h1></div></div>
  <div class="grid g2 collapse" style="align-items:start">
    <div class="card">
      <h3>Today's plan</h3>
      <div class="list" style="margin-top:8px">${todays.length?todays.map(e=>{ const done=today().sched.includes(e.id); const [h,m]=e.start.split(':').map(Number); const st=h*60+m, en=st+schedMinutes(e); const now=nowMin>=st-15&&nowMin<en;
        return `<div class="li"><span class="subj-dot" style="background:${subjCol(e.subjectId)}"></span><div class="grow"><b>${esc(schedLabel(e))}</b><div class="tiny muted num">${e.start} – ${e.end} · ${schedMinutes(e)} min</div></div>
        ${done?`<span class="chip ok">Done</span>`:G.S.active?'':`<button class="btn sm ${now?'gold':'ghost'}" data-a="startsched" data-id="${e.id}">▶ Start</button>`}<button class="iconbtn" data-a="delsched" data-id="${e.id}" aria-label="Delete">✕</button></div>`; }).join('')
        :`<div class="empty small">Nothing scheduled today.</div>`}</div>
      <p class="tiny dim" style="margin-top:10px">A scheduled session counts as done when you study at least 80% of its planned time. It feeds your Discipline stat and the “Complete today's schedule” quest.</p>
    </div>
    <div class="card">
      <h3>Add study block</h3>
      <form data-form="addsched" class="stack" style="margin-top:10px;gap:10px">
        <div class="row nowrap" style="gap:8px"><select id="sc-subj" style="flex:1">${S.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}<option value="">General study</option></select>
          <input type="text" id="sc-title" placeholder="Label (optional)" maxlength="40" style="flex:1"></div>
        <div class="seg">${[['once','One day'],['tomorrow','Tomorrow'],['weekly','Repeat weekly'],['week','Every day this week']].map(([k,l])=>`<button type="button" class="${schedUI.repeat===k?'on':''}" data-a="screpeat" data-v="${k}">${l}</button>`).join('')}</div>
        ${schedUI.repeat==='once'?`<label class="f">Date<input type="date" id="sc-date" value="${tk}"></label>`:''}
        ${schedUI.repeat==='weekly'?`<div class="row">${DOW.map((d,i)=>`<label class="chip" style="cursor:pointer"><input type="checkbox" class="sc-dow" value="${i}" ${i===dowOf(tk)?'checked':''}> ${d}</label>`).join('')}</div>`:''}
        <div class="row nowrap" style="gap:8px"><label class="f grow">Start<input type="time" id="sc-start" value="18:00"></label><label class="f grow">End<input type="time" id="sc-end" value="19:00"></label></div>
        <button class="btn cyan">Add to schedule</button>
      </form>
    </div>
  </div>
  <div class="sec"><h2>Week of ${parseDay(days[0]).toLocaleDateString(undefined,{timeZone:'UTC',month:'short',day:'numeric'})}</h2>
    <div class="row"><button class="btn sm ghost" data-a="schweek" data-v="-1">←</button><button class="btn sm ghost" data-a="schweek" data-v="0">This week</button><button class="btn sm ghost" data-a="schweek" data-v="1">→</button></div></div>
  <div style="overflow-x:auto"><div class="week">${days.map((k,i)=>{ const items=scheduleFor(k).sort((a,b)=>a.start<b.start?-1:1); const d=G.S.daily[k];
    return `<div class="day ${k===tk?'today':''}"><div class="row spread"><b>${DOW[i]}</b><span class="tiny muted">${parseDay(k).getUTCDate()}</span></div>
      ${items.map(e=>`<div class="slot ${d&&d.sched.includes(e.id)?'ok':''}" style="--c:${subjCol(e.subjectId)}"><b>${esc(schedLabel(e))}</b><div class="num tiny muted">${e.start}–${e.end}${e.days?' ↻':''}</div></div>`).join('')}
      ${d&&d.min?`<div class="tiny" style="margin-top:auto;color:var(--grass)">Studied ${fmtMin(d.min)}</div>`:''}</div>`; }).join('')}</div></div>`;
};

/* ======================= WORLD ======================= */
let worldUI={cat:'res', mode:'mine', sel:null, placing:null};
VIEWS.world = () => {
  const target=G.worldTarget; const S=G.S;
  if(target && target!==G.uid){
    const p=P(target); if(!p) return `<div class="empty">That world isn’t available.</div>`;
    const cs = p.city && !p.city.hidden ? cityStats(publicCity(p)) : null;
    return `<div class="row spread" style="margin-top:14px"><div class="row">${avatarHTML(p)}<div><h2>${esc(p.displayName)}'s World</h2><div class="small muted">${thName(p.th)} · Level ${p.level}${p.demo?' · <span class="chip">Demo player</span>':''}</div></div></div>
      <button class="btn ghost" data-a="visit" data-u="">← Back to my world</button></div>
      <div class="grid g4" style="margin-top:14px">
        ${statCard('🏛️','Town Hall','Level '+p.th)}${statCard('👪','Population',fmtNum(p.city&&p.city.pop||cs&&cs.population||0))}
        ${statCard('🏆','Badges',p.badgeCount||0)}${statCard('⏱','Total study',p.stats?fmtMin(p.stats.totalMin):'Private')}
      </div>
      ${p.stats?`<div class="card" style="margin-top:14px"><div class="grid g4">${statCard('📅','Consistency (30d)',p.stats.consistency+'%')}${statCard('📝','Tasks done',fmtNum(p.stats.tasksDone))}${statCard('🔁','Sessions',fmtNum(p.stats.sessions))}${statCard('🔥','Best streak',p.bestStreak||0)}</div></div>`:''}
      <div class="card" style="margin-top:14px"><h3>Achievements</h3><div class="row" style="margin-top:10px">${(p.badges||[]).map(id=>allBadges().find(b=>b.id===id)).filter(Boolean).map(b=>`<span class="chip warn">${b.i} ${esc(b.n)}</span>`).join('') || '<span class="muted small">No badges yet.</span>'}</div></div>`;
  }
  const cs=cityStats(S.city), nx=thNext(), ab=activeBuilds();
  const list=BUILDINGS.filter(b=>b.c===worldUI.cat && b.cost);
  const inv=Object.entries(S.inv).filter(([k,v])=>v>0);
  const friendsW=friendsList().map(u=>({u,p:P(u)}));
  return `
  <div class="grid g4" style="margin-top:14px">
    ${statCard('👪','Population',fmtNum(cs.population),'var(--grass)',`Housing ${fmtNum(cs.housing)}`)}
    ${statCard('💼','Employment',cs.employment+'%','',`${fmtNum(cs.jobs)} jobs`)}
    ${statCard('🛣️','Infrastructure',cs.infrastructure+'%')}
    ${statCard('⚡','Energy',`${cs.power}/${cs.powerNeed}`,cs.power>=cs.powerNeed?'var(--grass)':'var(--warn)','supply / demand')}
  </div>
  <div class="grid g2 collapse" style="margin-top:14px;align-items:start">
    <div class="card">
      <div class="row spread"><div><div class="eyebrow">Town Hall</div><h2>${thName(S.city.th)}</h2><div class="small muted">Level ${S.city.th} of ${TH_MAX} · ${gridSizeFor(S.city.th)}×${gridSizeFor(S.city.th)} land · ${buildSlotsFor(S.city.th)} build slot${buildSlotsFor(S.city.th)>1?'s':''}</div></div></div>
      ${nx?`<div class="stack" style="gap:8px;margin-top:12px">
        <div class="small"><b>Upgrade to ${nx.icon} ${nx.name}</b></div>
        ${reqRow('⭐ Player level', lvl(), nx.lvl, 'xp')}${reqRow('🪙 Coins', S.coins, nx.coins, 'gold')}${nx.mat?reqRow('🧱 Materials', S.mat, nx.mat, 'mat'):''}
        <div class="small muted">Unlocks: ${BUILDINGS.filter(b=>b.th===nx.level&&b.cost).map(b=>b.i+' '+esc(b.n)).join(', ')||'more land'}</div>
        <button class="btn ${canUpgradeTH()?'gold':'ghost'}" data-a="upth" ${canUpgradeTH()?'':'disabled'}>🏛️ Upgrade Town Hall</button></div>`
      :`<p class="muted" style="margin-top:10px">Maximum level reached.</p>`}
    </div>
    <div class="card">
      <div class="row spread"><h3>Construction</h3><span class="chip">${ab.length}/${buildSlotsFor(S.city.th)} slots</span></div>
      <p class="tiny dim" style="margin-top:4px">Buildings are built by your study minutes. Every minute you study goes to each building under construction.</p>
      ${ab.length?`<div class="stack" style="margin-top:10px;gap:10px">${ab.map(b=>{const d=BMAP[b.id]; return `<div><div class="row spread small"><span>${d.i} ${esc(d.n)}</span><span class="num muted">${Math.max(0,d.min-Math.round(b.prog))} min left</span></div>${bar(b.prog/d.min*100,'mat')}</div>`;}).join('')}</div>`:`<div class="empty small" style="margin-top:10px">No active construction.</div>`}
      ${inv.length?`<div style="margin-top:14px"><div class="eyebrow">Inventory</div><div class="row" style="margin-top:8px">${inv.map(([k,v])=>`<button class="btn sm ghost" data-a="placeinv" data-id="${k}">${BMAP[k].i} ${esc(BMAP[k].n)} ×${v}</button>`).join('')}</div></div>`:''}
    </div>
  </div>
  <div class="sec"><h2>Build</h2><div class="small muted">🪙 ${fmtNum(S.coins)} · 🧱 ${fmtNum(S.mat)}</div></div>
  <div class="seg" style="margin-bottom:12px">${Object.entries(CATS).map(([k,l])=>`<button class="${worldUI.cat===k?'on':''}" data-a="bcat" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="shop">${list.map(b=>{ const locked=b.th>S.city.th, afford=canAfford(b);
    return `<button class="bcard ${locked?'lock':''}" data-a="buy" data-id="${b.id}" ${locked?'disabled':''}>
      <div class="row spread nowrap"><span class="ic">${b.i}</span>${locked?`<span class="chip">🔒 TH ${b.th}</span>`:b.min?`<span class="chip">⏱ ${b.min}m</span>`:'<span class="chip ok">Instant</span>'}</div>
      <b>${esc(b.n)}</b>
      <div class="tiny muted">${b.w}×${b.d}${b.pop?` · 🏠 ${b.pop*10}`:''}${b.jobs?` · 💼 ${b.jobs*10}`:''}${b.pw?` · ⚡ ${b.pw}`:''}</div>
      <div class="row" style="gap:6px;margin-top:auto"><span class="num small" style="color:${afford?'var(--coin)':'var(--bad)'}">🪙 ${fmtNum(b.cost)}</span>${b.mat?`<span class="num small" style="color:var(--mat)">🧱 ${b.mat}</span>`:''}</div></button>`; }).join('')}</div>
  <div class="sec"><h2>Friend worlds</h2></div>
  <div class="grid g4">
    <button class="card tight stat" data-a="visit" data-u="" style="text-align:left;border-color:var(--xp)"><span class="l">MY WORLD</span><span class="v">${TOWNHALL[S.city.th].icon} Level ${S.city.th}</span><span class="tiny dim">Enter</span></button>
    ${friendsW.map(({u,p})=>`<button class="card tight stat" data-a="visit" data-u="${esc(u)}" style="text-align:left"><span class="l">${esc(p.displayName.toUpperCase())}</span><span class="v">${TOWNHALL[p.th||1].icon} Level ${p.th||1}</span><span class="tiny dim">${p.city&&p.city.hidden?'City is private':'Visit'}</span></button>`).join('')}
  </div>`;
};
function reqRow(l, have, need, cls){ const ok=have>=need; return `<div><div class="row spread small"><span>${l}</span><span class="num ${ok?'':'muted'}">${fmtNum(have)} / ${fmtNum(need)} ${ok?'✓':''}</span></div>${bar(Math.min(100,have/need*100),cls+' thin')}</div>`; }
function publicCity(p){ if(!p || !p.city || p.city.hidden) return {th:(p&&p.th)||1, b:[], flag:'#ccc'}; return {th:p.city.th, flag:p.city.flag, b:(p.city.b||[]).map(a=>Array.isArray(a)?{u:a[0]+a[1]+'_'+a[2], id:a[0], x:a[1], z:a[2], r:a[3], done:a[4]!==0}:{u:a.i+a.x+'_'+a.z, id:a.i, x:a.x, z:a.z, r:a.r, done:a.d!==0})}; }

function mountWorldPanel(){
  const wp=$('#worldPanel');
  const target=G.worldTarget && G.worldTarget!==G.uid ? G.worldTarget : null;
  const p = target ? P(target) : null;
  if(!wp.dataset.built){
    wp.dataset.built='1';
    wp.innerHTML = `<div class="sec" style="margin-top:0"><div><div class="eyebrow" id="w-eyebrow">Your study built this</div><h1 id="w-title">My World</h1></div></div>
      <div class="worldwrap" id="worldwrap"><div id="worldcanvas" style="position:absolute;inset:0"></div>
        <div class="hud"><div class="glass small" id="w-hud"></div><div class="glass small" id="w-sel" hidden></div></div>
        <div class="hudbtns" id="w-btns"></div>
        <div class="placebar glass" id="w-place" hidden></div>
      </div>`;
  }
  $('#w-title').textContent = p ? `${p.displayName}'s World` : 'My World';
  $('#w-eyebrow').textContent = p ? (p.city&&p.city.hidden ? 'This player keeps their city private' : 'Visiting — look, don’t touch') : 'Your study built this';
  const city = p ? publicCity(p) : G.S.city;
  const cs = cityStats(city);
  $('#w-hud').innerHTML = `<b>${thName(city.th)}</b><div class="tiny muted">👪 ${fmtNum(cs.population)} · 🏗️ ${cs.built} buildings</div><div class="tiny muted" id="w-clock"></div>`;
  $('#w-btns').innerHTML = `
    <button class="btn sm ghost glass" data-a="wtime">🌗 <span id="w-timelbl">${{real:'Real time',cycle:'Day cycle',day:'Day',night:'Night'}[G.S.dayMode]||'Real time'}</span></button>
    <button class="btn sm ghost glass" data-a="wweather">☁️ ${esc(G.S.weather==='auto'?'Auto weather':G.S.weather)}</button>
    <button class="btn sm ghost glass" data-a="wgfx">⚙️ ${esc(G.S.gfx)}</button>
    <button class="btn sm ghost glass" data-a="wreset">⌖</button>`;
  loadWorldLib().then(ok=>{
    if(!ok || G.S.gfx==='2d'){ World2D.show($('#worldcanvas'), city); return; }
    World.mount($('#worldcanvas'));
    World.setOptions({gfx:G.S.gfx, dayMode:G.S.dayMode, weather:G.S.weather});
    World.load(city, {editable:!p, owner:p?p.displayName:G.S.profile.displayName});
    World.resume();
    if(worldUI.placing && !World.placement()) World.beginPlace(worldUI.placing.id, worldUI.placing.inv);
  });
}
let worldLibP=null;
function loadWorldLib(){
  if(worldLibP) return worldLibP;
  const add=src=>new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
  worldLibP = add('https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js')
    .then(()=>add('https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js'))
    .then(()=>add('https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/utils/BufferGeometryUtils.js').catch(()=>{}))
    .then(()=>{ try{ const c=document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl')); }catch(e){ return false; } })
    .catch(()=>false);
  return worldLibP;
}
function worldPlaceUI(state){ // called by World during placement
  const el=$('#w-place'); if(!el) return;
  if(!state){ el.hidden=true; return; }
  const d=BMAP[state.id];
  el.hidden=false;
  el.innerHTML = `<span class="small"><b>${d.i} ${esc(d.n)}</b> ${state.valid?'':'<span style="color:var(--bad)">· blocked</span>'}</span>
    <button class="btn sm ghost" data-a="wrot">⟳</button><button class="btn sm green" data-a="wconfirm" ${state.valid?'':'disabled'}>✓ Place</button><button class="btn sm ghost" data-a="wcancel">✕</button>`;
}
function worldSelectUI(b){
  const el=$('#w-sel'); if(!el) return;
  if(!b){ el.hidden=true; worldUI.sel=null; return; }
  worldUI.sel=b.u; const d=BMAP[b.id]; el.hidden=false;
  const editable=!G.worldTarget;
  el.innerHTML = `<div class="row spread nowrap"><b>${d.i} ${esc(d.n)}</b><button class="iconbtn" data-a="wdesel" aria-label="Close">✕</button></div>
    <div class="tiny muted">${CATS[d.c]}${d.pop?` · 🏠 ${d.pop*10}`:''}${d.jobs?` · 💼 ${d.jobs*10}`:''}${d.pw?` · ⚡ ${d.pw}`:''}</div>
    ${b.done===false?`<div style="margin:6px 0">${bar(b.prog/d.min*100,'mat thin')}</div><div class="tiny">${Math.max(0,d.min-Math.round(b.prog))} study min to finish</div>`:''}
    ${editable?`<div class="row" style="margin-top:8px;gap:6px"><button class="btn sm ghost" data-a="wmove">Move</button><button class="btn sm ghost" data-a="wrot2">Rotate</button><button class="btn sm ghost" data-a="wremove">${d.cost?'Sell':'Store'}</button></div>`:''}`;
}

/* ======================= FRIENDS ======================= */
let friendUI={q:''};
VIEWS.friends = () => {
  const S=G.S; const fr=friendsList(); const inc=incomingRequests(); const out=outgoingRequests();
  const q=friendUI.q.trim().toLowerCase();
  const results = q ? Object.entries(G.players).filter(([u,p])=>u!==G.uid && p.displayName && ((p.username||'').toLowerCase().includes(q) || (p.displayName||'').toLowerCase().includes(q) || (p.playerId||'').toLowerCase().includes(q))).slice(0,12) : [];
  const rows=[{u:G.uid,p:Object.assign({},meP(),{level:lvl(),streak:currentStreak()}),today:today().min}].concat(fr.map(u=>({u,p:P(u),today:playerToday(P(u))}))).sort((a,b)=>(b.today||0)-(a.today||0));
  const ch=allChallenges();
  const pendingIn=ch.filter(x=>x.role==='receiver' && !S.social.chState[x.c.id] && !chExpired(x.c));
  const active=ch.filter(x=>{ const cs=S.social.chState[x.c.id]; return cs && cs.s==='accepted' && !chExpired(x.c); });
  const sent=ch.filter(x=>x.role==='sender' && x.c.type==='solo');
  const done=ch.filter(x=>{ const cs=S.social.chState[x.c.id]; return cs && cs.s==='done'; }).slice(0,6);
  return `
  <div class="sec"><div><div class="eyebrow">Study together, grow together</div><h1>Friends</h1></div>
    <button class="btn gold" data-a="newch" ${fr.length?'':'disabled'}>🎯 New challenge</button></div>
  <div class="grid g2 collapse" style="align-items:start">
    <div class="card">
      <div class="row spread"><div><div class="eyebrow">Your player ID</div><div class="num" style="font-size:20px;font-weight:700">${esc(S.profile.playerId)}</div><div class="tiny muted">@${esc(S.profile.username)}</div></div>
      <div class="row" style="gap:6px"><button class="btn sm ghost" data-a="copyid">Copy ID</button><button class="btn sm gold" data-a="share">📨 Invite</button></div></div>
      <form data-form="fsearch" style="margin-top:14px"><input type="search" id="fq" placeholder="Search by name, @username or player ID" value="${esc(friendUI.q)}" autocomplete="off"></form>
      ${q?`<div class="list" style="margin-top:8px">${results.map(([u,p])=>{ const isF=fr.includes(u), pend=out.includes(u), incm=inc.includes(u);
        return `<div class="li">${avatarHTML(p,'sm')}<div class="grow"><b>${esc(p.displayName)}</b> ${p.demo?'<span class="chip">Demo</span>':''}<div class="tiny muted">@${esc(p.username)} · Lv ${p.level||1} · ${esc(p.playerId||'')}</div></div>
          ${isF?'<span class="chip ok">Friends</span>':pend?'<span class="chip">Requested</span>':incm?`<button class="btn sm green" data-a="faccept" data-u="${esc(u)}">Accept</button>`:`<button class="btn sm cyan" data-a="fadd" data-u="${esc(u)}">Add</button>`}</div>`; }).join('') || '<div class="empty small">No players match.</div>'}</div>`:''}
      ${inc.length?`<div class="eyebrow" style="margin-top:16px">Friend requests</div><div class="list">${inc.map(u=>`<div class="li">${avatarHTML(P(u),'sm')}<div class="grow"><b>${esc(P(u).displayName)}</b><div class="tiny muted">Lv ${P(u).level||1}</div></div><button class="btn sm green" data-a="faccept" data-u="${esc(u)}">Accept</button><button class="btn sm ghost" data-a="freject" data-u="${esc(u)}">Decline</button></div>`).join('')}</div>`:''}
      ${out.length?`<div class="eyebrow" style="margin-top:16px">Sent requests</div><div class="list">${out.map(u=>`<div class="li">${avatarHTML(P(u),'sm')}<div class="grow">${esc(P(u).displayName)}</div><span class="chip">Pending</span><button class="iconbtn" data-a="fremove" data-u="${esc(u)}" aria-label="Cancel">✕</button></div>`).join('')}</div>`:''}
      ${!q&&!inc.length&&!out.length&&!fr.length?`<p class="small muted" style="margin-top:12px">Try searching “Arun” or “Priya” — demo players who accept instantly — or share your player ID with classmates.</p>`:''}
    </div>
    <div class="card">
      <h3>Today</h3>
      <div class="tblwrap"><table class="tbl" style="margin-top:6px"><thead><tr><th>Friend</th><th>Level</th><th>Today</th><th>Streak</th><th></th></tr></thead><tbody>
      ${rows.map(r=>{ const studying = r.u!==G.uid && P(r.u) && P(r.u).studying; return `<tr class="${r.u===G.uid?'me':''}"><td><div class="row nowrap" style="gap:8px">${avatarHTML(r.p,'sm')}<div><b>${r.u===G.uid?'You':esc(r.p.displayName)}</b>${studying?`<div class="tiny" style="color:var(--grass)">● studying ${esc(studying.subj)}</div>`:''}</div></div></td>
        <td class="num">${r.p.level||1}</td><td class="num">${r.today==null?'—':fmtMin(r.today)}</td><td class="num">🔥 ${r.p.streak||0}</td>
        <td>${r.u===G.uid?'':`<button class="btn sm ghost" data-a="fprofile" data-u="${esc(r.u)}">View</button>`}</td></tr>`; }).join('')}
      </tbody></table></div>
    </div>
  </div>

  <div class="sec"><h2>Challenges</h2><span class="small muted">Friendship points: ${S.stats.fcp||0}</span></div>
  <div class="grid g2 collapse" style="align-items:start">
    <div class="card">
      <h3>Incoming</h3>
      <div class="stack" style="margin-top:10px;gap:10px">${pendingIn.map(x=>chCard(x,'in')).join('') || '<div class="empty small">No new challenges.</div>'}</div>
      <h3 style="margin-top:18px">Active</h3>
      <div class="stack" style="margin-top:10px;gap:10px">${active.map(x=>chCard(x,'active')).join('') || '<div class="empty small">Accept a challenge or start a duel.</div>'}</div>
    </div>
    <div class="card">
      <h3>Sent</h3>
      <div class="stack" style="margin-top:10px;gap:10px">${sent.slice(0,8).map(x=>chCard(x,'sent')).join('') || '<div class="empty small">You haven’t challenged anyone yet.</div>'}</div>
      ${done.length?`<h3 style="margin-top:18px">Completed</h3><div class="stack" style="margin-top:10px;gap:10px">${done.map(x=>chCard(x,'done')).join('')}</div>`:''}
      ${(()=>{const c=comboState(); return `<div class="quest" style="margin-top:16px"><div class="qi">⚡</div><div class="grow"><b class="small">Combo bonus</b><div class="tiny muted">Finish your own task or quest <b>and</b> a friend challenge today: +50 coins, a chest and +20% XP for the rest of the day.</div>
        <div class="row" style="margin-top:6px"><span class="chip ${c.own?'ok':''}">${c.own?'✓':'○'} Daily task</span><span class="chip ${c.friend?'ok':''}">${c.friend?'✓':'○'} Friend challenge</span></div></div>${c.claimed?'<span class="chip ok">Active</span>':''}</div>`;})()}
    </div>
  </div>

  <div class="sec"><h2>Activity feed</h2></div>
  <div class="card">${feedHTML(friendFeed(20))}</div>`;
};
function chCard(x, kind){
  const c=x.c, S=G.S, cs=S.social.chState[c.id]; const other=P(partnerOf(x)); const name=other?other.displayName:'Friend';
  const typeL={solo:'Solo',duel:'⚔️ Duel',team:'🧩 Team'}[c.type];
  const r=challengeReward(c);
  const head = x.role==='receiver' ? `<b>${esc(name)}</b> challenged you` : `You challenged <b>${esc(name)}</b>`;
  let body='';
  if(kind==='in') body=`<div class="row" style="margin-top:8px"><button class="btn sm green" data-a="chaccept" data-id="${c.id}">Accept</button><button class="btn sm ghost" data-a="chdecline" data-id="${c.id}">Decline</button></div>`;
  if(kind==='active'){
    const mine=cs.prog||0, ps=partnerState(x), theirs=(ps&&ps.prog)||0;
    body = c.type==='team' ? `<div class="small" style="margin-top:8px">Together: <span class="num">${mine+theirs}/${c.min} min</span></div>${bar((mine+theirs)/c.min*100,'green')}`
      : `<div class="small" style="margin-top:8px">You: <span class="num">${mine}/${c.min} min</span></div>${bar(mine/c.min*100)}${c.type==='duel'?`<div class="small" style="margin-top:6px">${esc(name)}: <span class="num">${theirs}/${c.min} min</span></div>${bar(theirs/c.min*100,'fire')}`:''}`;
  }
  if(kind==='sent'){ const st=other&&other.chState&&other.chState[c.id]; body=`<div class="row" style="margin-top:8px"><span class="chip ${st&&st.s==='done'?'ok':st&&st.s==='declined'?'bad':''}">${st? {accepted:`Accepted · ${st.prog||0}/${c.min} min`,declined:'Declined',done:'Completed ✓'}[st.s] : chExpired(c)?'Expired':'Waiting'}</span></div>`; }
  if(kind==='done') body=`<div class="row" style="margin-top:8px"><span class="chip ok">Completed${cs.won?' · won':''}</span>${x.role==='receiver'?`<button class="btn sm ghost" data-a="chback" data-u="${esc(x.from)}" data-min="${c.min}" data-subj="${esc(c.subj)}" data-type="${c.type}">↩ Send one back</button>`:''}</div>`;
  return `<div class="quest" style="display:block"><div class="row spread nowrap"><div class="small">${head}</div><span class="chip">${typeL}</span></div>
    <div style="font-weight:800;margin-top:6px">“Study ${esc(c.subj||'any subject')} for ${c.min} minutes”</div>
    ${c.msg?`<div class="tiny muted">${esc(c.msg)}</div>`:''}
    <div class="tiny dim" style="margin-top:4px">Reward: +${r.xp} XP · +${r.coins} 🪙 · +1 friendship point${c.type==='duel'?' · winner +50 🪙':''} · due ${esc(c.deadline)}</div>${body}</div>`;
}
function challengeModal(pre={}){
  const fr=friendsList();
  openModal(`<h2>New challenge</h2><p class="small muted">Challenges count study minutes you log after accepting. Keep it friendly.</p>
    <form data-form="newch" class="stack" style="margin-top:12px;gap:10px">
      <label class="f">Friend<select id="ch-to">${fr.map(u=>`<option value="${esc(u)}" ${pre.to===u?'selected':''}>${esc(P(u).displayName)}</option>`).join('')}</select></label>
      <label class="f">Subject (optional)<input type="text" id="ch-subj" maxlength="40" placeholder="e.g. DSP" value="${esc(pre.subj||'')}"></label>
      <div class="row nowrap" style="gap:8px"><label class="f grow">Minutes<select id="ch-min">${[15,25,30,45,60,90,120].map(m=>`<option ${+pre.min===m||(!pre.min&&m===45)?'selected':''}>${m}</option>`).join('')}</select></label>
      <label class="f grow">Deadline<select id="ch-dl"><option value="0">Today</option><option value="1">Tomorrow</option><option value="3" selected>3 days</option><option value="7">1 week</option></select></label></div>
      <label class="f">Type<select id="ch-type"><option value="solo" ${pre.type==='solo'?'selected':''}>Solo — they study, you cheer</option><option value="duel" ${pre.type==='duel'?'selected':''}>Duel — both study, first to finish wins</option><option value="team" ${pre.type==='team'?'selected':''}>Team — your minutes add up together</option></select></label>
      <label class="f">Message<input type="text" id="ch-msg" maxlength="80" placeholder="You got this!"></label>
      <div class="row"><button class="btn gold">Send challenge</button><button type="button" class="btn ghost" data-a="closemodal">Cancel</button></div>
    </form>`);
}
function friendProfile(u){
  const p=P(u); if(!p) return; const w=playerWeek(p);
  openModal(`<div class="row">${avatarHTML(p,'lg')}<div class="grow"><h2>${esc(p.displayName)}</h2><div class="small muted">@${esc(p.username)} · ${esc(p.playerId||'')} ${p.demo?'· Demo player':''}</div>
    <div class="row" style="margin-top:6px">${leagueChip(p.league)}<span class="chip">${thName(p.th)}</span></div></div></div>
    <div class="grid g3" style="margin-top:16px">${statCard('⭐','Level',p.level||1)}${statCard('🔥','Streak',p.streak||0)}${statCard('📅','This week',fmtNum(w.xp)+' XP')}
      ${statCard('⏱','Today',playerToday(p)==null?'Private':fmtMin(playerToday(p)))}${statCard('🏆','Badges',p.badgeCount||0)}${statCard('👪','Population',fmtNum(p.city&&p.city.pop||0))}</div>
    <div class="row" style="margin-top:16px"><button class="btn cyan" data-a="visitm" data-u="${esc(u)}">🌍 Visit world</button><button class="btn gold" data-a="chto" data-u="${esc(u)}">🎯 Challenge</button><button class="btn ghost" data-a="compare" data-u="${esc(u)}">Compare</button><button class="btn ghost sm" data-a="fremove" data-u="${esc(u)}">Remove friend</button></div>`);
}
function compareModal(u){
  const p=P(u); const w=playerWeek(p); const mw=weekAgg();
  const rowsC=[['Level',lvl(),p.level||1],['Total XP',G.S.xp,p.xp||0],['XP this week',mw.xp,w.xp],['Study hours (all time)',Math.round(G.S.stats.totalMin/60),p.stats?Math.round(p.stats.totalMin/60):null],
    ['Tasks completed',G.S.stats.tasksDone,p.stats?p.stats.tasksDone:null],['Current streak',currentStreak(),p.streak||0],['Consistency (30d)',consistency(30).pct+'%',p.stats?p.stats.consistency+'%':null],['Town Hall',G.S.city.th,p.th||1],['Badges',Object.keys(G.S.badges).length,p.badgeCount||0]];
  openModal(`<h2>You & ${esc(p.displayName)}</h2><p class="small muted">Different paths, same goal. Use this to find a study rhythm that works for both of you.</p>
    <div class="tblwrap"><table class="tbl" style="margin-top:10px"><thead><tr><th></th><th>You</th><th>${esc(p.displayName)}</th></tr></thead><tbody>
    ${rowsC.map(r=>`<tr><td class="small muted">${r[0]}</td><td class="num"><b>${typeof r[1]==='number'?fmtNum(r[1]):r[1]}</b></td><td class="num">${r[2]==null?'<span class="dim">Private</span>':typeof r[2]==='number'?fmtNum(r[2]):r[2]}</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:14px"><button class="btn gold" data-a="chto" data-u="${esc(u)}">🧩 Start a team challenge</button><button class="btn ghost" data-a="closemodal">Close</button></div>`);
}

/* ======================= LEAGUE ======================= */
let leagueUI={tab:'mine'};
VIEWS.league = () => {
  const S=G.S, t=S.league.tier, L=LEAGUES[t];
  const board=leagueUI.tab==='mine'? leagueBoard(t) : leagueBoard();
  const all=leagueBoard();
  const left=Math.max(0,weekEndsAt()-nowMs());
  const top=(f,label,fmt)=>{ const x=all.slice().sort((a,b)=>f(b)-f(a))[0]; return x&&f(x)>0? `<div class="li"><div class="grow small muted">${label}</div>${avatarHTML(x.u===G.uid?meP():x.p,'sm')}<b>${x.u===G.uid?'You':esc(x.p.displayName)}</b><span class="num small">${fmt(f(x))}</span></div>`:''; };
  return `
  <div class="sec"><div><div class="eyebrow">Weekly competition</div><h1>League</h1></div><span class="chip">Resets in ${Math.floor(left/86400000)}d ${Math.floor(left%86400000/3600000)}h</span></div>
  <div class="card" style="background:linear-gradient(135deg,${L.col}22,var(--panel))">
    <div class="row spread"><div class="row"><div style="font-size:44px">🏅</div><div><div class="eyebrow">Your league</div><h2 style="color:${L.col}">${L.n.toUpperCase()}</h2>
      <div class="small muted">${L.promo===Infinity?'Top tier. Hold your place.':`Promotion: finish top 3 (300+ XP) or earn ${fmtNum(L.promo)} XP this week`}</div></div></div>
      <div class="stat" style="text-align:right"><span class="l">Your rank</span><span class="v">#${myRank()||'—'}</span><span class="tiny dim">${fmtNum(weekAgg().xp)} XP</span></div></div>
    <div class="row" style="margin-top:14px;gap:6px">${LEAGUES.map((x,i)=>`<span class="chip" style="${i===t?`color:${x.col};border-color:${x.col}`:''}">${x.n}</span>${i<LEAGUES.length-1?'<span class="dim">›</span>':''}`).join('')}</div>
  </div>
  <div class="grid g2 collapse" style="margin-top:14px;align-items:start">
    <div class="card">
      <div class="row spread"><h3>Leaderboard</h3><div class="seg"><button class="${leagueUI.tab==='mine'?'on':''}" data-a="ltab" data-v="mine">${L.n}</button><button class="${leagueUI.tab==='all'?'on':''}" data-a="ltab" data-v="all">Everyone</button></div></div>
      <div class="tblwrap"><table class="tbl" style="margin-top:8px"><thead><tr><th>#</th><th>Player</th><th>XP</th><th>Hours</th><th>Days</th></tr></thead><tbody>
      ${board.map((x,i)=>`<tr class="${x.u===G.uid?'me':''}"><td class="num"><b>${i<3?['🥇','🥈','🥉'][i]:i+1}</b></td><td><div class="row nowrap" style="gap:8px">${avatarHTML(x.u===G.uid?meP():x.p,'sm')}<div><b>${x.u===G.uid?'You':esc(x.p.displayName)}</b>${x.p.demo?' <span class="tiny dim">demo</span>':''}${leagueUI.tab==='all'?`<div class="tiny" style="color:${LEAGUES[x.p.league||0].col}">${LEAGUES[x.p.league||0].n}</div>`:''}</div></div></td>
        <td class="num">${fmtNum(x.w.xp)}</td><td class="num">${(x.w.min/60).toFixed(1)}</td><td class="num">${x.w.days}/7</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No players yet.</td></tr>'}</tbody></table></div>
    </div>
    <div class="stack">
      <div class="card"><h3>This week's standouts</h3><div class="list" style="margin-top:6px">
        ${top(x=>x.w.xp,'🏆 Best performer',v=>fmtNum(v)+' XP')}${top(x=>x.w.days,'📅 Most consistent',v=>v+' days')}
        ${top(x=>x.w.xp-(x.u===G.uid?weekAgg(prevWeekDate()).xp:x.last),'📈 Biggest improvement',v=>'+'+fmtNum(v)+' XP')}
        ${top(x=>x.w.min,'⏱ Most study hours',v=>(v/60).toFixed(1)+' h')}${top(x=>x.w.tasks,'📝 Most tasks completed',v=>v)}
      </div></div>
      <div class="card"><h3>Your history</h3>${S.league.hist.length?`<div class="list" style="margin-top:6px">${S.league.hist.slice(0,10).map(h=>`<div class="li"><span class="grow small">${esc(h.wk)}</span><span class="small" style="color:${LEAGUES[h.tier].col}">${LEAGUES[h.tier].n}</span><span class="num small">#${h.rank}</span><span class="num small">${fmtNum(h.xp)} XP</span><span>${h.res==='up'?'⬆️':h.res==='down'?'⬇️':'➖'}</span></div>`).join('')}</div>`:`<p class="small muted" style="margin-top:6px">Your weekly results will appear here after your first full week.</p>`}</div>
    </div>
  </div>`;
};

/* ======================= REWARDS ======================= */
VIEWS.rewards = () => {
  const S=G.S; const dq=dailyQuests(), wq=weeklyQuests(); const cur=currentStreak();
  const m=computeMetrics(); const cats=[...new Set(allBadges().map(b=>b.cat))];
  const mt=monthAgg(monthKey());
  return `
  <div class="sec"><div><div class="eyebrow">Earned by studying</div><h1>Rewards</h1></div>${S.boost?`<span class="chip epic">⚡ ×${S.boost.mult} XP boost · ${S.boost.min} min left</span>`:''}</div>
  <div class="grid g2 collapse" style="align-items:start">
    <div class="card"><div class="row spread"><h3>Daily quests</h3><span class="tiny muted">Refresh at midnight</span></div><div class="stack" style="margin-top:10px;gap:8px">${dq.map(questHTML).join('')}</div></div>
    <div class="card"><div class="row spread"><h3>Weekly missions</h3><span class="tiny muted">${esc(weekKey())}</span></div><div class="stack" style="margin-top:10px;gap:8px">${wq.map(q=>questHTML(q)).join('')}</div></div>
  </div>
  <div class="sec"><h2>Chests</h2><span class="small muted">${Math.round(S.chestMin/ECON.chestEveryMin*100)}% to your next wooden chest · every 5th is silver</span></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${CHEST_ORDER.map(k=>{ const c=CHESTS[k], n=S.chests[k]||0;
    return `<div class="chest ${n?'has':''}" style="${n?`border-color:${c.col}88`:''}"><div class="ci">${c.i}</div><b class="small">${c.n}</b><span class="num tiny muted">× ${n}</span>
      <button class="btn sm ${n?'gold':'ghost'}" data-a="openchest" data-v="${k}" ${n?'':'disabled'}>Open</button><button class="btn sm ghost" data-a="odds" data-v="${k}" style="min-height:28px;font-size:12px">Odds</button></div>`; }).join('')}</div>
  <div class="sec"><h2>Streak rewards</h2><span class="small muted">🔥 ${cur} day${cur===1?'':'s'} · best ${Math.max(S.bestStreak,cur)}</span></div>
  <div class="card"><div class="track">${STREAK_REWARDS.map(r=>`<div class="node ${cur>=r.d?'got':''}"><div style="font-family:var(--display);font-size:18px">${r.d}d</div><div class="tiny">${rewardText(r)}</div></div>`).join('')}</div>
    <p class="tiny dim" style="margin-top:8px">A day counts once you study ${ECON.studyDayMin} minutes. Rewards are paid automatically as your streak grows.</p></div>
  <div class="sec"><h2>Monthly titles</h2><span class="small muted">${new Date().toLocaleDateString(undefined,{month:'long'})} · titles are earned fresh each month</span></div>
  <div class="grid g4">${MONTH_TITLES.map(t=>{ const got=t.test(mt); return `<div class="badge ${got?'got':''}"><div class="bi">${t.i}</div><b class="small">${t.n}</b><div class="tiny muted">${t.d}</div></div>`; }).join('')}</div>
  <div class="sec"><h2>Badges</h2><span class="small muted">${Object.keys(S.badges).length} of ${allBadges().length}</span></div>
  ${cats.map(cat=>`<h3 style="margin:16px 0 10px" class="muted">${cat}</h3><div class="badges">${allBadges().filter(b=>b.cat===cat).map(b=>{ const got=!!S.badges[b.id]; const p=Math.min(1,(m[b.metric]||0)/b.t);
    return `<div class="badge ${got?'got':''}" title="${esc(rewardText(b.r))}"><div class="bi">${b.i}</div><b class="small">${esc(b.n)}</b>${got?`<span class="tiny" style="color:var(--coin)">${new Date(S.badges[b.id]).toLocaleDateString()}</span>`:`<div style="width:80%">${bar(p*100,'thin gold')}</div><span class="tiny dim num">${fmtNum(Math.min(m[b.metric]||0,b.t))}/${fmtNum(b.t)}</span>`}</div>`; }).join('')}</div>`).join('')}`;
};
function chestResult(res){
  const c=CHESTS[res.kind];
  openModal(`<div style="text-align:center"><div style="font-size:72px;animation:pop .5s">${c.i}</div><div class="eyebrow">${c.n}</div><h1 class="complete-h" style="margin:8px 0">${esc(res.lines.join(' · '))}</h1>
    ${res.r.decor?`<p class="small muted">Find it in My World → Inventory and place it anywhere.</p>`:''}
    <div class="row" style="justify-content:center;margin-top:14px">${G.S.chests[res.kind]>0?`<button class="btn gold" data-a="openchest" data-v="${res.kind}">Open another</button>`:''}<button class="btn ghost" data-a="closemodal">Done</button></div></div>`);
}
function oddsModal(k){ const c=CHESTS[k]; openModal(`<h2>${c.i} ${c.n} — drop rates</h2><div class="list" style="margin-top:10px">${c.table.map(r=>`<div class="li"><span class="grow">${r[1]==='coins'?`🪙 ${r[2]}–${r[3]} coins`:r[1]==='xp'?`⭐ ${r[2]}–${r[3]} XP`:r[1]==='mat'?`🧱 ${r[2]}–${r[3]} materials`:r[1]==='boost'?`⚡ ×${r[2]} XP for your next ${r[3]} study minutes`:`🎨 ${r[2]} decoration (${DECOR_POOL[r[2]].map(d=>BMAP[d].n).join(', ')})`}</span><b class="num">${r[0]}%</b></div>`).join('')}</div><button class="btn ghost" style="margin-top:14px" data-a="closemodal">Close</button>`); }

/* ======================= STATS ======================= */
let statsUI={range:30};
function monthAgg(mk){
  const out={min:0,xp:0,tasks:0,days:0,long45:0,subjects:0,best:null,subj:{}};
  Object.entries(G.S.daily).forEach(([k,d])=>{ if(!k.startsWith(mk)) return; out.min+=d.min; out.xp+=d.xp; out.tasks+=d.tasks; out.long45+=d.long45||0; if(d.min>=ECON.studyDayMin) out.days++; if(!out.best||d.min>out.best.min) out.best={k,min:d.min}; Object.entries(d.subj).forEach(([s,m])=>out.subj[s]=(out.subj[s]||0)+m); });
  out.subjects=Object.keys(out.subj).filter(s=>s!=='_general').length; return out;
}
function gameMeters(){
  const S=G.S; const r14=rangeDays(14), r30=rangeDays(30);
  const totalTopics=S.subjects.reduce((a,s)=>a+s.topics.length,0), doneTopics=S.subjects.reduce((a,s)=>a+s.topics.filter(t=>t.done).length,0);
  const knowledge = clamp(Math.round((totalTopics? doneTopics/totalTopics*60 : 0) + Math.min(40, S.stats.tasksDone*1.5)),0,100);
  const sess30 = r30.reduce((a,k)=>a+((S.daily[k]||{}).n||0),0), min30=r30.reduce((a,k)=>a+((S.daily[k]||{}).min||0),0);
  const avg = sess30? min30/sess30 : 0;
  const focus = clamp(Math.round(avg/50*80 + Math.min(20, r30.reduce((a,k)=>a+((S.daily[k]||{}).long45||0),0)*2)),0,100);
  let planned=0, hit=0; r14.forEach(k=>{ const sc=scheduleFor(k); planned+=sc.length; hit+=sc.filter(e=>((S.daily[k]||{}).sched||[]).includes(e.id)).length; });
  const discipline = planned ? Math.round(hit/planned*100) : 0;
  const consistencyV = consistency(30).pct;
  const tasks30=S.tasks.filter(t=>t.createdAt>Date.now()-30*86400000); const productivity = tasks30.length? Math.round(tasks30.filter(t=>t.done).length/tasks30.length*100) : 0;
  const teamwork = clamp(Math.round(S.stats.challengesDone*12 + friendsList().length*6 + Math.min(20,S.stats.reactionsGiven)),0,100);
  return [['Knowledge',knowledge,'Topics and tasks you’ve completed','xp'],['Focus',focus,'Average session length and 45+ min sessions','epic'],['Discipline',discipline,'Scheduled blocks completed (14 days)','gold'],['Consistency',consistencyV,'Days studied in the last 30','fire'],['Productivity',productivity,'Tasks completed vs created (30 days)','green'],['Teamwork',teamwork,'Friend challenges, friends and cheers','mat']];
}
VIEWS.stats = () => {
  const S=G.S; const n=statsUI.range; const allKeys=Object.keys(S.daily).sort();
  const days = n==='all' ? (allKeys.length? (()=>{ const out=[]; let k=allKeys[0]; const end=dayKey(); while(k<=end && out.length<2000){ out.push(k); k=addDays(k,1);} return out; })() : rangeDays(7)) : rangeDays(n);
  const vals=days.map(k=>(S.daily[k]||{}).min||0);
  const tot=vals.reduce((a,b)=>a+b,0); const nSess=days.reduce((a,k)=>a+((S.daily[k]||{}).n||0),0); const tasks=days.reduce((a,k)=>a+((S.daily[k]||{}).tasks||0),0);
  const subj={}; const hours=Array(24).fill(0); const dow=Array(7).fill(0);
  days.forEach(k=>{ const d=S.daily[k]; if(!d) return; Object.entries(d.subj).forEach(([s,m])=>subj[s]=(subj[s]||0)+m); Object.entries(d.hours||{}).forEach(([h,m])=>hours[+h]+=m); dow[dowOf(k)]+=d.min; });
  const subjRows=Object.entries(subj).sort((a,b)=>b[1]-a[1]); const maxS=subjRows[0]?subjRows[0][1]:1;
  const bestH=hours.indexOf(Math.max(...hours)), bestD=dow.indexOf(Math.max(...dow));
  const mk=monthKey(), mt=monthAgg(mk);
  // weekly buckets for longer ranges
  const chartVals = days.length>60 ? (()=>{ const w=[]; for(let i=0;i<days.length;i+=7) w.push(vals.slice(i,i+7).reduce((a,b)=>a+b,0)); return w; })() : vals;
  const chartLbl = days.length>60 ? chartVals.map((_,i)=>i===0||i===chartVals.length-1||i%4===0? parseDay(days[i*7]).toLocaleDateString(undefined,{timeZone:'UTC',month:'short',day:'numeric'}):'') : days.map((k,i)=> days.length<=7? DOW[dowOf(k)] : (i%Math.ceil(days.length/6)===0||i===days.length-1)? parseDay(k).getUTCDate()+'' : '');
  const fr=friendsList();
  return `
  <div class="sec"><div><div class="eyebrow">Your study, in numbers</div><h1>Statistics</h1></div>
    <div class="seg">${[[7,'7 days'],[30,'30 days'],[90,'90 days'],['all','All time']].map(([k,l])=>`<button class="${statsUI.range===k?'on':''}" data-a="srange" data-v="${k}">${l}</button>`).join('')}</div></div>
  <div class="card">
    <div class="row spread"><h3>Player stats</h3><span class="tiny muted">Game statistics from your recorded activity — not a measure of ability or personality.</span></div>
    <div class="stack" style="margin-top:14px;gap:12px">${gameMeters().map(([l,v,d,c])=>`<div class="meter" title="${esc(d)}"><b>${l}</b>${bar(v,c+' thick')}<span class="num" style="text-align:right;font-weight:700">${v}</span></div>`).join('')}</div>
  </div>
  <div class="grid g4" style="margin-top:14px">
    ${statCard('⏱','Total study',fmtMin(tot))}${statCard('🔁','Sessions',fmtNum(nSess),'',`avg ${fmtMin(nSess?tot/nSess:0)}`)}
    ${statCard('📝','Tasks completed',fmtNum(tasks))}${statCard('📅','Most productive',tot?DOW[bestD]:'—','',tot?`best hour ${pad2(bestH)}:00`:'')}
  </div>
  <div class="card chart" style="margin-top:14px"><div class="row spread"><h3>${days.length>60?'Weekly':'Daily'} study time</h3><span class="tiny muted">minutes</span></div>${svgBars(chartVals, chartLbl, 'var(--xp)', S.goalMin*(days.length>60?7:1))}</div>
  <div class="grid g2 collapse" style="margin-top:14px;align-items:start">
    <div class="card"><h3>Subject distribution</h3><div class="stack" style="margin-top:12px;gap:10px">${subjRows.map(([s,m])=>`<div><div class="row spread small"><span><span class="subj-dot" style="display:inline-block;background:${s==='_general'?'#9bb0c7':subjCol(s)}"></span> ${esc(s==='_general'?'General':subjName(s))}</span><span class="num muted">${fmtMin(m)} · ${Math.round(m/tot*100)}%</span></div><div class="bar thin"><i style="width:${m/maxS*100}%;background:${s==='_general'?'#9bb0c7':subjCol(s)}"></i></div></div>`).join('') || '<div class="empty small">No study time in this range.</div>'}</div></div>
    <div class="card chart"><h3>Time of day</h3>${svgBars(hours, hours.map((_,i)=>i%6===0?pad2(i):''), 'var(--epic)')}<h3 style="margin-top:12px">Day of week</h3>${svgBars(dow, DOW, 'var(--grass)')}</div>
  </div>
  <div class="card" style="margin-top:14px"><div class="row spread"><h3>Streak history</h3><span class="small muted">🔥 ${currentStreak()} now · best ${Math.max(S.bestStreak,currentStreak())} · ${consistency(30).days}/30 study days</span></div>
    <div class="heat" style="margin-top:12px">${(()=>{ const ks=rangeDays(7*20); const pad=dowOf(ks[0]); return Array(pad).fill('<i style="visibility:hidden"></i>').join('')+ks.map(k=>{ const m=(S.daily[k]||{}).min||0; const a=m?clamp(0.25+m/180,0.25,1):0; return `<i title="${k}: ${fmtMin(m)}" style="${a?`background:rgba(255,125,92,${a.toFixed(2)})`:''}"></i>`; }).join(''); })()}</div></div>
  <div class="card" style="margin-top:14px"><h3>${new Date().toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3>
    <div class="grid g4" style="margin-top:12px">${statCard('⏱','Study hours',(mt.min/60).toFixed(1))}${statCard('⭐','XP',fmtNum(mt.xp))}${statCard('📝','Tasks',mt.tasks)}${statCard('📅','Study days',mt.days)}
      ${statCard('🏆','Best day',mt.best&&mt.best.min?fmtMin(mt.best.min):'—','',mt.best&&mt.best.min?parseDay(mt.best.k).toLocaleDateString(undefined,{timeZone:'UTC',month:'short',day:'numeric'}):'')}
      ${statCard('📚','Top subject',(()=>{const e=Object.entries(mt.subj).sort((a,b)=>b[1]-a[1])[0]; return e? esc(e[0]==='_general'?'General':subjName(e[0])) : '—';})())}
      ${statCard('📈','Daily average',fmtMin(mt.min/tzNow().getUTCDate()))}${statCard('🎯','Consistency',Math.round(mt.days/tzNow().getUTCDate()*100)+'%')}</div>
    <div class="row" style="margin-top:12px">${MONTH_TITLES.filter(t=>t.test(mt)).map(t=>`<span class="chip warn">${t.i} ${t.n}</span>`).join('') || '<span class="small muted">Monthly titles: Scholar (30h), Consistency Master (25 days), Focus Master (20 long sessions), Study Explorer (5 subjects).</span>'}</div></div>
  ${fr.length?`<div class="card" style="margin-top:14px"><h3>Friend comparison</h3><p class="small muted">Everyone studies at their own pace. Tap a friend for a side-by-side view.</p>
    <div class="tblwrap"><table class="tbl" style="margin-top:8px"><thead><tr><th>Player</th><th>Week XP</th><th>Week hours</th><th>Streak</th><th>Town Hall</th><th>Badges</th><th></th></tr></thead><tbody>
    ${[{u:G.uid,p:Object.assign(meP(),{streak:currentStreak(),th:S.city.th,badgeCount:Object.keys(S.badges).length}),w:weekAgg()}].concat(fr.map(u=>({u,p:P(u),w:playerWeek(P(u))}))).map(x=>`<tr class="${x.u===G.uid?'me':''}"><td><div class="row nowrap" style="gap:8px">${avatarHTML(x.p,'sm')}<b>${x.u===G.uid?'You':esc(x.p.displayName)}</b></div></td><td class="num">${fmtNum(x.w.xp)}</td><td class="num">${(x.w.min/60).toFixed(1)}</td><td class="num">🔥 ${x.p.streak||0}</td><td class="num">${x.p.th||1}</td><td class="num">${x.p.badgeCount||0}</td><td>${x.u===G.uid?'':`<button class="btn sm ghost" data-a="compare" data-u="${esc(x.u)}">Compare</button>`}</td></tr>`).join('')}</tbody></table></div></div>`:''}`;
};
function svgBars(vals, labels, col, goal){
  const W=640, H=180, pl=34, pb=22, pt=10, n=vals.length; const max=Math.max(10, goal||0, ...vals);
  const nice = (()=>{ const s=[15,30,60,120,180,240,300,600,1200,1800,3000,6000]; return s.find(x=>x>=max)||max; })();
  const bw=(W-pl-6)/n; const y=v=>pt+(H-pt-pb)*(1-v/nice);
  let g=''; [0,.5,1].forEach(f=>{ const v=nice*f; g+=`<line x1="${pl}" x2="${W-4}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.07)"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v>=120?Math.round(v/60)+'h':Math.round(v)}</text>`; });
  if(goal) g+=`<line x1="${pl}" x2="${W-4}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--coin)" stroke-dasharray="4 4" opacity=".7"/><text x="${W-6}" y="${y(goal)-4}" text-anchor="end" style="fill:var(--coin)">goal</text>`;
  const bars=vals.map((v,i)=>{ const x=pl+i*bw+bw*0.15, w=Math.max(1,bw*0.7), yy=y(v); return `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${w.toFixed(1)}" height="${(H-pb-yy).toFixed(1)}" rx="${Math.min(4,w/3).toFixed(1)}" fill="${col}" opacity="${i===n-1?1:.75}"><title>${Math.round(v)} min</title></rect>${labels[i]?`<text x="${(x+w/2).toFixed(1)}" y="${H-6}" text-anchor="middle">${esc(labels[i])}</text>`:''}`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="bar chart">${g}${bars}</svg>`;
}

/* ======================= PROFILE ======================= */
VIEWS.profile = () => {
  const S=G.S, pr=S.profile;
  const tog=(grp,k,l,d)=>`<div class="li"><div class="grow"><b class="small">${l}</b>${d?`<div class="tiny muted">${d}</div>`:''}</div><label class="toggle"><input type="checkbox" data-ch="tog" data-g="${grp}" data-k="${k}" ${S[grp][k]?'checked':''}><span></span></label></div>`;
  return `
  <div class="sec"><div><div class="eyebrow">Account</div><h1>Profile</h1></div></div>
  <div class="grid g2 collapse" style="align-items:start">
    <div class="card">
      <div class="row">${avatarHTML(meP(),'lg')}<div class="grow"><h2>${esc(pr.displayName)}</h2><div class="small muted">@${esc(pr.username)} · Player ID <span class="num">${esc(pr.playerId)}</span></div>
        <div class="row" style="margin-top:6px"><span class="chip xp">Level ${lvl()}</span>${leagueChip(S.league.tier)}<span class="chip">${thName(S.city.th)}</span></div></div></div>
      <form data-form="profile" class="stack" style="margin-top:16px;gap:10px">
        <label class="f">Display name<input type="text" id="pf-name" maxlength="24" value="${esc(pr.displayName)}"></label>
        <div class="f"><span>Avatar</span><div class="pickgrid" id="pf-av">${AVATARS.map(a=>`<button type="button" class="${a===pr.avatar?'on':''}" data-a="pickav" data-v="${a}">${a}</button>`).join('')}</div></div>
        <div class="f"><span>Color</span><div class="colpick">${AVATAR_COLS.map(c=>`<button type="button" class="${c===pr.avatarCol?'on':''}" data-a="pickcol" data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
        <div class="f"><span>City flag color</span><div class="colpick">${AVATAR_COLS.map(c=>`<button type="button" class="${c===S.city.flag?'on':''}" data-a="pickflag" data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
        <label class="f">Daily study goal<select id="pf-goal">${[15,30,45,60,90,120,180,240].map(m=>`<option value="${m}" ${S.goalMin===m?'selected':''}>${fmtMin(m)}</option>`).join('')}</select></label>
        <button class="btn cyan">Save profile</button>
      </form>
      <div class="lock-note" style="margin-top:16px;background:var(--bg2);border-color:var(--line2);color:var(--muted)">Your subjects, tasks, schedule and session history are private to you. Friends see only what you share below.</div>
    </div>
    <div class="stack">
      <div class="card"><h3>Privacy — what other players see</h3><div class="list" style="margin-top:6px">
        ${tog('privacy','city','My city','Buildings and layout when friends visit')}${tog('privacy','stats','Study statistics','Total hours, sessions, tasks, consistency')}
        ${tog('privacy','today','Today’s study time','Shown in friend lists')}${tog('privacy','studying','“Studying now” status','Friends see when a session is running')}</div>
        <p class="tiny dim" style="margin-top:8px">Your name, level, streak, Town Hall level, badges and weekly XP are always visible so leagues and friend search work.</p></div>
      <div class="card"><h3>Notifications</h3><div class="list" style="margin-top:6px">
        ${tog('notif','friend','Friend requests')}${tog('notif','challenge','Challenges')}${tog('notif','quest','Quest rewards ready')}${tog('notif','streak','Streak reminders','After 5 PM if you haven’t studied')}
        ${tog('notif','sched','Scheduled sessions')}${tog('notif','league','Weekly league results')}${tog('notif','build','Town Hall upgrades')}${tog('notif','badge','Badges')}${tog('notif','chest','Chests')}${tog('notif','friendAch','Friend achievements')}</div>
        <p class="tiny dim" style="margin-top:8px">Notifications appear inside the app under 🔔.</p></div>
      <div class="card"><h3>Graphics</h3><div class="seg" style="margin-top:10px">${[['auto','Auto'],['high','High'],['low','Low (battery saver)'],['2d','2D map']].map(([k,l])=>`<button class="${S.gfx===k?'on':''}" data-a="setgfx" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="card"><h3>App & account</h3>
        <div class="small muted" style="margin-top:4px">${G.offline?'Preview mode':`Signed in as <b>@${esc(pr.username)}</b>${G.authEmail&&!G.authEmail.endsWith('@wiys.example.com')?' · '+esc(G.authEmail):''}`}</div>
        <div class="row" style="margin-top:10px">
          ${G.installPrompt?`<button class="btn sm gold" data-a="install">📲 Install app</button>`:G.standalone?`<span class="chip ok">Installed</span>`:`<span class="small muted">To install: open the browser menu and choose <b>Add to Home Screen</b>${/iPhone|iPad/.test(navigator.userAgent)?' (Safari → Share → Add to Home Screen)':''}.</span>`}
          ${'Notification' in window && Notification.permission!=='granted'?`<button class="btn sm ghost" data-a="devnotif">🔔 Allow device alerts</button>`:''}
          ${G.offline?'':`<button class="btn sm ghost" data-a="signout">Sign out</button>`}
        </div></div>
      <div class="card"><h3>Start over</h3><p class="small muted">Erase your progress, city and history. This can’t be undone.</p><button class="btn red sm" style="margin-top:10px" data-a="resetask">Reset my progress</button></div>
    </div>
  </div>`;
};

/* ======================= ONBOARDING ======================= */
let ob={step:0, name:'', username:'', avatar:'🦉', col:'#58d0e8', subj:'', topics:'', goal:60, err:''};
async function renderOnboarding(){
  if(ob.step===0 && !ob.name && G.authName) ob.name=G.authName.split(' ')[0];
  const steps=5;
  const dots=`<div class="ob-step">${Array.from({length:steps},(_,i)=>`<i class="${i<=ob.step?'on':''}"></i>`).join('')}</div>`;
  let body='';
  if(ob.step===0) body=`<div style="font-size:64px">🌍</div><div class="eyebrow">Welcome to</div><h1 style="font-size:40px">WORLD IS YOUR STUDY</h1><p class="muted" style="font-size:17px;margin:10px auto 20px;max-width:420px">Your study builds your world. Every real minute you study earns XP and coins, raises buildings and grows your civilization.</p>
    <div class="stack" style="max-width:360px;margin:0 auto 18px;text-align:left;gap:6px">${['📚 Study with a timer','⭐ Earn XP, coins and badges','🏗️ Build and upgrade your city','🤝 Compete with friends in weekly leagues'].map(s=>`<div class="cline" style="animation:none">${s}</div>`).join('')}</div>
    <button class="btn xl gold" data-a="ob" data-v="1">Let's begin</button>`;
  if(ob.step===1) body=`<h2>Choose your name</h2><p class="muted small">This is how friends will find you.</p>
    <form data-form="ob1" class="stack" style="margin-top:14px;gap:10px;text-align:left">
      <label class="f">Display name<input type="text" id="ob-name" maxlength="24" value="${esc(ob.name)}" placeholder="Ajay" autofocus></label>
      <label class="f">Username<input type="text" id="ob-user" maxlength="20" value="${esc(ob.username)}" placeholder="ajay_studies" ${G.lockUsername?'readonly':''}></label>
      <div class="tiny dim">3–20 characters: letters, numbers, underscore.</div>
      ${ob.err?`<div class="small" style="color:var(--bad)">${esc(ob.err)}</div>`:''}
      <button class="btn gold">Next</button></form>`;
  if(ob.step===2) body=`<h2>Pick your avatar</h2><div class="pickgrid" style="margin-top:14px">${AVATARS.map(a=>`<button class="${a===ob.avatar?'on':''}" data-a="obav" data-v="${a}">${a}</button>`).join('')}</div>
    <div class="colpick" style="justify-content:center;margin-top:14px">${AVATAR_COLS.map(c=>`<button class="${c===ob.col?'on':''}" data-a="obcol" data-v="${c}" style="background:${c}"></button>`).join('')}</div>
    <div style="margin:18px auto;width:max-content">${avatarHTML({avatar:ob.avatar,avatarCol:ob.col},'lg')}</div><button class="btn gold" data-a="ob" data-v="3">Next</button>`;
  if(ob.step===3) body=`<h2>Create your first subject</h2><p class="muted small">You can add more later.</p>
    <form data-form="ob3" class="stack" style="margin-top:14px;gap:10px;text-align:left">
      <label class="f">Subject<input type="text" id="ob-subj" maxlength="60" value="${esc(ob.subj)}" placeholder="Digital Signal Processing" autofocus></label>
      <label class="f">Topics (comma separated, optional)<input type="text" id="ob-topics" maxlength="200" value="${esc(ob.topics)}" placeholder="Sampling, DFT, FFT, Filters"></label>
      ${ob.err?`<div class="small" style="color:var(--bad)">${esc(ob.err)}</div>`:''}
      <button class="btn gold">Next</button></form>`;
  if(ob.step===4) body=`<h2>Set today's study goal</h2><p class="muted small">Start small. Even 10 minutes moves your world forward.</p>
    <div class="row" style="justify-content:center;margin:16px 0">${[15,30,60,90,120].map(m=>`<button class="btn ${ob.goal===m?'cyan':'ghost'}" data-a="obgoal" data-v="${m}">${fmtMin(m)}</button>`).join('')}</div>
    <button class="btn xl gold" data-a="obfinish">Create my world</button>
    ${ob.err?`<div class="small" style="color:var(--bad);margin-top:10px">${esc(ob.err)}</div>`:''}`;
  $('#app').innerHTML=`<div class="splash"><div class="card" style="width:min(520px,100%);padding:28px 22px;text-align:center">${ob.step>0?dots:''}${body}</div></div>`;
  const f=$('[autofocus]'); if(f) f.focus();
}
async function finishOnboarding(){
  if(G._registering) return; G._registering=true; ob.err='';
  const subjects = ob.subj.trim() ? [{id:uid8(), name:ob.subj.trim(), topics:ob.topics.split(',').map(t=>t.trim()).filter(Boolean).slice(0,20).map(n=>({id:uid8(), name:n}))}] : [];
  const r = await act('register', {displayName:ob.name.trim(), username:ob.username.trim().toLowerCase(), avatar:ob.avatar, avatarCol:ob.col, goal:ob.goal, subjects});
  G._registering=false;
  if(!r.ok){ ob.err=r.err; if(/username/i.test(r.err)) ob.step=1; renderOnboarding(); return; }
  if(subjects[0]) studyUI.subjectId=subjects[0].id;
  G.view='study'; studyUI.mode='countdown'; studyUI.target=10;
  renderShell(); render();
  openModal(`<div style="text-align:center"><div style="font-size:56px">🌱</div><h2>Your settlement is waiting</h2><p class="muted" style="margin:8px 0 16px">You got a founder's grant of <b style="color:var(--coin)">100 coins</b>. Now complete your first study session — a 10-minute countdown is a great start. When it's done you'll build your first house.</p>
    <button class="btn gold xl" data-a="obstart">▶ Start 10 minutes</button><div style="margin-top:10px"><button class="btn ghost sm" data-a="closemodal">I'll pick my own</button></div></div>`);
}

/* ======================= sign in / create account ======================= */
let authUI={tab:'create', err:'', busy:false};
function renderAuth(){
  const t=authUI.tab;
  $('#app').innerHTML=`<div class="splash"><div class="card" style="width:min(440px,100%);padding:28px 22px">
    <div style="text-align:center"><div style="font-size:52px">🌍</div><h1 style="font-size:30px;margin-top:6px">WORLD IS YOUR STUDY</h1><p class="muted" style="margin:6px 0 18px">Your study builds your world.</p></div>
    <div class="seg" style="display:flex;margin-bottom:14px"><button style="flex:1" class="${t==='create'?'on':''}" data-a="authtab" data-v="create">Create account</button><button style="flex:1" class="${t==='signin'?'on':''}" data-a="authtab" data-v="signin">Sign in</button></div>
    <form data-form="auth" class="stack" style="gap:10px;text-align:left">
      ${t==='create'?`
        <label class="f">Username<input type="text" id="au-user" maxlength="20" autocomplete="username" autocapitalize="none" placeholder="ajay_studies" required></label>
        <label class="f">Password<input type="password" id="au-pass" minlength="6" autocomplete="new-password" required style="background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:10px 12px;min-height:44px"></label>
        <label class="f">Confirm password<input type="password" id="au-pass2" minlength="6" autocomplete="new-password" required style="background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:10px 12px;min-height:44px"></label>
        <div class="tiny dim">Username: 3–20 letters, numbers or underscore. Password: at least 6 characters.</div>`
      :`
        <label class="f">Username or email<input type="text" id="au-user" autocomplete="username" autocapitalize="none" required></label>
        <label class="f">Password<input type="password" id="au-pass" autocomplete="current-password" required style="background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:10px 12px;min-height:44px"></label>`}
      ${authUI.err?`<div class="small" style="color:var(--bad)">${esc(authUI.err)}</div>`:''}
      <button class="btn gold" ${authUI.busy?'disabled':''}>${authUI.busy?'Please wait…':t==='create'?'Create account':'Sign in'}</button>
    </form>
    <div class="row" style="margin:14px 0;gap:10px"><span class="grow" style="height:1px;background:var(--line)"></span><span class="tiny muted">or</span><span class="grow" style="height:1px;background:var(--line)"></span></div>
    <button class="btn ghost block" data-a="google" ${authUI.busy?'disabled':''}>Continue with Google</button>
  </div></div>`;
  const f=$('#au-user'); if(f) f.focus();
}
function authError(e){
  const c=(e&&e.code)||'';
  return c.includes('email-already-in-use')?'That username is taken. Try another.'
    : c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found')?'Username or password is incorrect.'
    : c.includes('weak-password')?'Use at least 6 characters for your password.'
    : c.includes('too-many-requests')?'Too many attempts. Wait a minute and try again.'
    : c.includes('network')?'No internet connection.'
    : c.includes('popup-closed')?'Google sign-in was closed.'
    : (e&&e.message)||'Sign-in failed.';
}

/* ======================= events ======================= */
const ACTIONS = {
  nav:(e,d)=>{ e.preventDefault(); go(d.v); if(d.v==='league') act('setView',{leagueSeen:1}); },
  more:(e)=>{ e.preventDefault(); openModal(`<h2>More</h2><div class="stack" style="margin-top:12px;gap:8px">${NAV.filter(n=>!['home','study','world','friends'].includes(n[0])).map(([k,i,l])=>`<button class="btn ghost block" style="justify-content:flex-start" data-a="gomodal" data-v="${k}">${i} ${l}</button>`).join('')}</div>`); },
  gomodal:(e,d)=>{ closeModal(true); go(d.v); if(d.v==='league') act('setView',{leagueSeen:1}); },
  closemodal:()=>closeModal(),
  notifs:()=>{ const n=notifications(); act('setView',{notifSeen:1}); openModal(`<h2>Notifications</h2><div class="list" style="margin-top:10px">${n.map(x=>`<button class="li" style="background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;width:100%" data-a="gomodal" data-v="${x.go}"><span style="font-size:20px">${x.i}</span><span class="grow small">${esc(x.t)}</span><span class="dim">›</span></button>`).join('') || '<div class="empty">You’re all caught up.</div>'}</div>`); },
  quickstart:()=>go('study'),
  // auth
  authtab:(e,d)=>{ authUI.tab=d.v; authUI.err=''; renderAuth(); },
  google:async()=>{ authUI.busy=true; authUI.err=''; renderAuth(); try{ await AUTH.google(); }catch(err){ authUI.err=authError(err); } authUI.busy=false; if(!G.uid) renderAuth(); },
  signout:()=>AUTH.signOut(),
  install:async()=>{ const p=G.installPrompt; if(!p) return; p.prompt(); try{ await p.userChoice; }catch(_){} G.installPrompt=null; render(); },
  devnotif:async()=>{ try{ const r=await Notification.requestPermission(); toast(r==='granted'?'Device alerts on: you’ll get a ping when a countdown ends.':'Alerts stay off.','info'); }catch(_){ } render(); },
  // study
  stmode:(e,d)=>{ studyUI.mode=d.v; render(); },
  sttarget:(e,d)=>{ studyUI.target=+d.v; render(); },
  stcustom:()=>{ const v=clamp(parseInt($('#st-custom').value)||25,5,240); studyUI.custom=v; studyUI.target=v; render(); },
  start:()=>{ act('startSession',{id:uid8(), subjectId:studyUI.subjectId, topicId:studyUI.topicId, mode:studyUI.mode, targetMin:studyUI.mode==='countdown'?studyUI.target:0}); G._lastTickMin=0; onSessionStart(); render(); },
  obstart:()=>{ closeModal(true); studyUI.mode='countdown'; studyUI.target=10; ACTIONS.start(); },
  pause:()=>{ act('pauseSession'); render(); }, resume:()=>{ act('resumeSession'); render(); },
  stop:()=>stopDialog(),
  finishadj:()=>{ const v=parseInt($('#adj-min').value); doFinish(isNaN(v)?undefined:v); },
  cancelsess:()=>openModal(`<h2>Discard this session?</h2><p class="muted">The time won’t be recorded and you won’t earn rewards for it.</p><div class="row" style="margin-top:14px"><button class="btn red" data-a="cancelsess2">Discard</button><button class="btn ghost" data-a="closemodal">Keep studying</button></div>`),
  cancelsess2:()=>{ act('cancelSession'); closeModal(true); onSessionEnd(); render(); },
  task:(e,d)=>{ act('toggleTask',{id:d.id}); render(); },
  deltask:(e,d)=>{ act('delTask',{id:d.id}); render(); },
  topic:(e,d)=>{ act('toggleTopic',{sid:d.s, tid:d.id}); render(); },
  deltopic:(e,d)=>{ act('delTopic',{sid:d.s, tid:d.id}); render(); },
  delsubj:(e,d)=>{ const s=G.S.subjects.find(x=>x.id===d.id); openModal(`<h2>Delete “${esc(s.name)}”?</h2><p class="muted">Its topics go too. Past study time stays in your statistics.</p><div class="row" style="margin-top:14px"><button class="btn red" data-a="delsubj2" data-id="${d.id}">Delete</button><button class="btn ghost" data-a="closemodal">Cancel</button></div>`); },
  delsubj2:(e,d)=>{ act('delSubject',{id:d.id}); if(studyUI.subjectId===d.id) studyUI.subjectId=null; closeModal(true); render(); },
  tfilter:(e,d)=>{ studyUI.taskFilter=d.v; render(); },
  claimq:(e,d)=>{ const r=act(WEEKLY_POOL.some(w=>w.id===d.id)?'claimWeekly':'claimQuest',{id:d.id}); const b=e.target.getBoundingClientRect(); floatFx('✨', b.left, b.top); render(); },
  // schedule
  screpeat:(e,d)=>{ schedUI.repeat=d.v; render(); },
  schweek:(e,d)=>{ schedUI.weekOffset = +d.v===0 ? 0 : schedUI.weekOffset + (+d.v); render(); },
  delsched:(e,d)=>{ act('delSched',{id:d.id}); render(); },
  startsched:(e,d)=>{ const s=G.S.schedule.find(x=>x.id===d.id); if(!s) return; act('startSession',{id:uid8(), subjectId:s.subjectId, mode:'countdown', targetMin:schedMinutes(s), schedId:s.id}); G._lastTickMin=0; onSessionStart(); go('study'); },
  // world
  bcat:(e,d)=>{ worldUI.cat=d.v; render(); },
  buy:(e,d)=>{ const b=BMAP[d.id]; const S=G.S; const first = b.c==='res' && !S.city.b.some(q=>BMAP[q.id]&&BMAP[q.id].c==='res');
    if(!first && !canAfford(b)){ toast(`Need ${fmtNum(b.cost)} coins${b.mat?` and ${b.mat} materials`:''}. Study to earn more.`,'warn'); return; }
    if(b.min>0 && !first && activeBuilds().length>=buildSlotsFor(S.city.th)){ toast('All construction slots are busy. Study to finish them first.','warn'); return; }
    worldUI.placing={id:d.id, inv:false}; window.scrollTo({top:0,behavior:'smooth'}); if(window.World && World.ready) World.beginPlace(d.id,false); toast('Tap a spot in your world to place it','info'); },
  placeinv:(e,d)=>{ worldUI.placing={id:d.id, inv:true}; window.scrollTo({top:0,behavior:'smooth'}); if(window.World && World.ready) World.beginPlace(d.id,true); },
  firsthouse:()=>{ closeModal(true); G.worldTarget=null; worldUI.placing={id:'house_s', inv:false}; go('world'); toast('Tap a green spot to place your first house — it’s free!','big'); },
  wconfirm:()=>{ const p=World.placement(); if(!p) return;
    const r = p.moveU ? act('moveBuilding',{u:p.moveU, x:p.x, z:p.z, r:p.r}) : act('placeBuilding',{id:p.id, x:p.x, z:p.z, r:p.r, inv:p.inv, u:uid8()});
    if(!r.ok) return; World.endPlace(); worldUI.placing=null; render(); },
  wcancel:()=>{ World.endPlace(); worldUI.placing=null; render(); },
  wrot:()=>World.rotatePlace(),
  wdesel:()=>World.select(null),
  wmove:()=>{ const b=G.S.city.b.find(x=>x.u===worldUI.sel); if(b) World.beginMove(b); },
  wrot2:()=>{ const b=G.S.city.b.find(x=>x.u===worldUI.sel); if(!b) return; const r=act('moveBuilding',{u:b.u, x:b.x, z:b.z, r:((b.r||0)+1)%4}); if(r.ok) render(); },
  wremove:()=>{ const u=worldUI.sel; const b=G.S.city.b.find(x=>x.u===u); if(!b) return; const d=BMAP[b.id]; openModal(`<h2>${d.cost?'Sell':'Store'} ${esc(d.n)}?</h2><p class="muted">${d.cost?`You get ${Math.floor(d.cost*0.5)} coins back (50%).`:'It goes back to your inventory.'}${b.done===false?' Construction progress is lost.':''}</p><div class="row" style="margin-top:14px"><button class="btn red" data-a="wremove2" data-u="${u}">${d.cost?'Sell':'Store'}</button><button class="btn ghost" data-a="closemodal">Cancel</button></div>`); },
  wremove2:(e,d)=>{ act('removeBuilding',{u:d.u}); closeModal(true); World.select(null); render(); },
  wtime:()=>{ const order=['real','cycle','day','night']; const v=order[(order.indexOf(G.S.dayMode)+1)%order.length]; act('setView',{dayMode:v}); World.setOptions({dayMode:v}); render(); },
  wweather:()=>{ const order=['auto','sunny','cloudy','rain','storm','snow','fog']; const v=order[(order.indexOf(G.S.weather)+1)%order.length]; act('setView',{weather:v}); World.setOptions({weather:v}); render(); },
  wgfx:()=>{ const order=['auto','high','low','2d']; const v=order[(order.indexOf(G.S.gfx)+1)%order.length]; act('setView',{gfx:v}); if(window.World&&World.ready) World.setOptions({gfx:v}); $('#worldPanel').dataset.built=''; render(); },
  wreset:()=>World.resetCamera(),
  upth:()=>{ const r=act('upgradeTH'); if(r.ok){ render(); const w=$('#worldwrap'); if(w){ const b=w.getBoundingClientRect(); floatFx('🏛️ LEVEL UP', b.left+b.width/2-60, b.top+b.height/2); } } },
  visit:(e,d)=>{ G.worldTarget=d.u||null; G.view='world'; render(); window.scrollTo(0,0); },
  visitm:(e,d)=>{ closeModal(true); ACTIONS.visit(e,d); },
  setgfx:(e,d)=>{ act('setView',{gfx:d.v}); $('#worldPanel').dataset.built=''; render(); },
  // friends
  copyid:()=>{ const id=G.S.profile.playerId; try{ navigator.clipboard.writeText(id).then(()=>toast('Player ID copied','info'),()=>toast('Your ID: '+id,'info')); }catch(e){ toast('Your ID: '+id,'info'); } },
  share:async()=>{ const url=location.href.split('#')[0].split('?')[0]; const text=`Join me on World Is Your Study — my username is @${G.S.profile.username}`; try{ if(navigator.share){ await navigator.share({title:'World Is Your Study', text, url}); return; } }catch(_){ return; } try{ await navigator.clipboard.writeText(text+' '+url); toast('Invite link copied','info'); }catch(_){ toast(url,'info'); } },
  fadd:(e,d)=>{ act('addFriend',{u:d.u}); render(); }, faccept:(e,d)=>{ act('addFriend',{u:d.u}); render(); },
  freject:(e,d)=>{ act('declineFriend',{u:d.u}); render(); },
  fremove:(e,d)=>{ act('removeFriend',{u:d.u}); closeModal(true); render(); },
  fprofile:(e,d)=>friendProfile(d.u),
  compare:(e,d)=>compareModal(d.u),
  newch:()=>challengeModal(),
  chto:(e,d)=>challengeModal({to:d.u, type: e.target.textContent.includes('team')?'team':'solo'}),
  chback:(e,d)=>challengeModal({to:d.u, min:d.min, subj:d.subj, type:d.type}),
  chaccept:(e,d)=>{ act('respondChallenge',{id:d.id, accept:true}); render(); }, chdecline:(e,d)=>{ act('respondChallenge',{id:d.id, accept:false}); render(); },
  react:(e,d)=>{ act('react',{owner:d.u, evId:d.id, emoji:d.e}); render(); },
  // league / stats
  ltab:(e,d)=>{ leagueUI.tab=d.v; render(); },
  srange:(e,d)=>{ statsUI.range = d.v==='all'?'all':+d.v; render(); },
  // rewards
  openchest:async(e,d)=>{ if(G._opening) return; G._opening=true; const r=await act('openChest',{kind:d.v}); G._opening=false; render(); if(r.ok && r.res) chestResult(r.res); },
  odds:(e,d)=>oddsModal(d.v),
  // profile
  pickav:(e,d)=>{ act('setProfile',{avatar:d.v}); render(); },
  pickcol:(e,d)=>{ act('setProfile',{avatarCol:d.v}); render(); },
  pickflag:(e,d)=>{ act('setProfile',{flag:d.v}); render(); },
  resetask:()=>openModal(`<h2>Reset everything?</h2><p class="muted">Your level, coins, city, badges, subjects and history will be erased. Type RESET to confirm.</p><input type="text" id="rs" style="margin-top:12px" autocomplete="off"><div class="row" style="margin-top:14px"><button class="btn red" data-a="reset2">Erase my progress</button><button class="btn ghost" data-a="closemodal">Cancel</button></div>`),
  reset2:()=>{ if(($('#rs').value||'').trim()!=='RESET'){ toast('Type RESET to confirm','warn'); return; } act('reset'); closeModal(true); toast('Progress reset. A fresh world awaits.','info'); go('home'); },
  // onboarding
  ob:(e,d)=>{ ob.step=+d.v; ob.err=''; renderOnboarding(); },
  obav:(e,d)=>{ ob.avatar=d.v; renderOnboarding(); }, obcol:(e,d)=>{ ob.col=d.v; renderOnboarding(); },
  obgoal:(e,d)=>{ ob.goal=+d.v; renderOnboarding(); },
  obfinish:()=>finishOnboarding(),
};
const FORMS = {
  auth:async f=>{
    const user=($('#au-user').value||'').trim(), pass=$('#au-pass').value||'';
    authUI.err='';
    if(authUI.tab==='create'){
      const u=user.toLowerCase();
      if(!/^[a-z0-9_]{3,20}$/.test(u)){ authUI.err='Username must be 3–20 letters, numbers or underscores.'; return renderAuth(); }
      if(pass.length<6){ authUI.err='Use at least 6 characters for your password.'; return renderAuth(); }
      if(pass!==$('#au-pass2').value){ authUI.err='Passwords don’t match.'; return renderAuth(); }
      authUI.busy=true; renderAuth();
      try{ await AUTH.signUp(u, pass); }catch(e){ authUI.err=authError(e); }
    } else {
      authUI.busy=true; renderAuth();
      try{ await AUTH.signIn(user, pass); }catch(e){ authUI.err=authError(e); }
    }
    authUI.busy=false; if(!G.uid) renderAuth();
  },
  addsubj:f=>{ const i=$('#new-subj'); if(!i.value.trim()) return; const id=uid8(); const r=act('addSubject',{id, name:i.value}); if(r.ok && !studyUI.subjectId) studyUI.subjectId=id; render(); setTimeout(()=>{ const n=$('#new-subj'); if(n) n.focus(); },0); },
  addtopic:f=>{ const v=f.querySelector('input').value; if(v.trim()){ act('addTopic',{sid:f.dataset.s, id:uid8(), name:v}); render(); } },
  addtask:f=>{ const t=$('#nt-title').value; if(!t.trim()) return; act('addTask',{id:uid8(), title:t, kind:$('#nt-kind').value, subjectId:$('#nt-subj').value||null, date:$('#nt-date').value||dayKey()}); render(); },
  addsched:f=>{
    const subjectId=$('#sc-subj').value||null, title=$('#sc-title').value.trim(), start=$('#sc-start').value, end=$('#sc-end').value;
    if(!start||!end||end<=start){ toast('End time must be after start time','warn'); return; }
    const base={subjectId, title, start, end}; let entries=[];
    if(schedUI.repeat==='once') entries=[Object.assign({id:uid8(), date:$('#sc-date').value||dayKey()},base)];
    else if(schedUI.repeat==='tomorrow') entries=[Object.assign({id:uid8(), date:addDays(dayKey(),1)},base)];
    else if(schedUI.repeat==='weekly'){ const days=$$('.sc-dow').filter(c=>c.checked).map(c=>+c.value); if(!days.length){ toast('Pick at least one day','warn'); return; } entries=[Object.assign({id:uid8(), days},base)]; }
    else entries=weekDays().filter(k=>k>=dayKey()).map(k=>Object.assign({id:uid8(), date:k},base));
    const r=act('addSched',{entries}); if(r.ok) toast('Added to your schedule','info'); render();
  },
  fsearch:f=>{},
  newch:f=>{ const to=$('#ch-to').value; if(!to) return; const r=act('sendChallenge',{id:uid8(), to, subj:$('#ch-subj').value, min:+$('#ch-min').value, type:$('#ch-type').value, deadline:addDays(dayKey(), +$('#ch-dl').value), msg:$('#ch-msg').value}); if(r.ok){ closeModal(true); render(); } },
  profile:f=>{ const n=$('#pf-name').value.trim(); if(!n){ toast('Display name can’t be empty','warn'); return; } const r=act('setProfile',{displayName:n, goal:+$('#pf-goal').value}); if(r.ok) toast('Profile saved','info'); render(); },
  ob1:f=>{ const name=$('#ob-name').value.trim(), user=$('#ob-user').value.trim().toLowerCase();
    ob.name=name; ob.username=user;
    if(!name){ ob.err='Enter a display name.'; return renderOnboarding(); }
    if(!/^[a-z0-9_]{3,20}$/.test(user)){ ob.err='Username must be 3–20 letters, numbers or underscores.'; return renderOnboarding(); }
    if(Object.entries(G.players).some(([u,p])=>u!==G.uid && (p.username||'').toLowerCase()===user)){ ob.err='That username is taken. Try another.'; return renderOnboarding(); }
    ob.err=''; ob.step=2; renderOnboarding(); },
  ob3:f=>{ ob.subj=$('#ob-subj').value; ob.topics=$('#ob-topics').value; if(!ob.subj.trim()){ ob.err='Add one subject to start with.'; return renderOnboarding(); } ob.err=''; ob.step=4; renderOnboarding(); },
};
const READONLY_OK = new Set(['nav','more','gomodal','closemodal','notifs','visit','visitm','fprofile','compare','ltab','srange','bcat','odds','wreset','tfilter','stmode','sttarget','schweek','wdesel','authtab','google','signout','install','devnotif','share','copyid','ob','obav','obcol','obgoal','quickstart']);
document.addEventListener('click', e=>{
  const el=e.target.closest('[data-a]'); if(!el) return;
  const fn=ACTIONS[el.dataset.a]; if(!fn) return;
  if(el.tagName==='A') e.preventDefault();
  if(G.netDown && G.useServer && !READONLY_OK.has(el.dataset.a)){ toast('You’re offline. Reconnect to make changes.','warn'); return; }
  try{ const p=fn(e, el.dataset); if(p && p.catch) p.catch(err=>{ console.error(err); toast('Something went wrong: '+err.message,'warn'); }); }catch(err){ console.error(err); toast('Something went wrong: '+err.message,'warn'); }
});
document.addEventListener('submit', e=>{
  const f=e.target.closest('[data-form]'); if(!f) return; e.preventDefault();
  try{ const p=FORMS[f.dataset.form] && FORMS[f.dataset.form](f); if(p && p.catch) p.catch(console.error); }catch(err){ console.error(err); }
});
document.addEventListener('change', e=>{
  const el=e.target;
  if(el.dataset.ch==='st-subj'){ studyUI.subjectId=el.value||null; studyUI.topicId=null; render(); }
  else if(el.dataset.ch==='st-topic'){ studyUI.topicId=el.value||null; }
  else if(el.dataset.ch==='tog'){ const r=act('setPref',{group:el.dataset.g, key:el.dataset.k, value:el.checked}); if(r.ok && el.dataset.g==='privacy') toast('Privacy updated','info'); }
});
document.addEventListener('input', e=>{ if(e.target.id==='fq'){ friendUI.q=e.target.value; const pos=e.target.selectionStart; render(); const n=$('#fq'); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos);}catch(_){} } } });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

/* ---------- session side-effects on the device: keep screen awake, alert when a countdown ends ---------- */
let wakeLock=null;
async function onSessionStart(){ try{ if('wakeLock' in navigator) wakeLock=await navigator.wakeLock.request('screen'); }catch(_){ } }
function onSessionEnd(){ try{ if(wakeLock){ wakeLock.release(); wakeLock=null; } }catch(_){ } }
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && G.S && G.S.active && !wakeLock) onSessionStart(); });

function deviceAlert(title, body){
  try{ if(!('Notification' in window) || Notification.permission!=='granted') return;
    if(navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r=>r.showNotification(title,{body, icon:'icons/icon-192.png', badge:'icons/icon-192.png', tag:'wiys-session'}));
    else new Notification(title,{body, icon:'icons/icon-192.png'}); }catch(_){ }
}
