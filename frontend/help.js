// v22 additions, loaded BEFORE app.js (everything here runs only after app.js has started, so it can use its globals: $, esc, api, token, PL, span, today ...)
//   1. text size (A- / A+), because pinch-zoom is switched off
//   2. six-box code entry
//   3. a playing day disappears from "next / upcoming" once its end time has passed
//   4. FAQs and help: a message to the admins (works without logging in), and the admins' inbox

// ---------------------------------------------------------------- 1. text size
const FS_STEPS=[85,92,100,110,120,132];
function fsGet(){try{const v=+localStorage.getItem('hk_fs');return FS_STEPS.includes(v)?v:100}catch(e){return 100}}
function fsSet(v){try{localStorage.setItem('hk_fs',String(v))}catch(e){}document.documentElement.style.fontSize=v+'%'}
function fsRow(){
  const v=fsGet(),i=FS_STEPS.indexOf(v);
  return`<div class="ms">Text size</div><div class="mrow fsrow"><button type="button" class="fsb" data-fs="-1" aria-label="Smaller text" ${i<=0?'disabled':''}>A−</button><span class="fsv" aria-live="polite">${v}%</span><button type="button" class="fsb big" data-fs="1" aria-label="Bigger text" ${i>=FS_STEPS.length-1?'disabled':''}>A+</button><button type="button" class="fsb" data-fs="0" aria-label="Normal text size">Reset</button></div>`;
}
function wireFs(m){
  m.querySelectorAll('[data-fs]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();const d=+b.dataset.fs,i=FS_STEPS.indexOf(fsGet());
    fsSet(d===0?100:FS_STEPS[Math.max(0,Math.min(FS_STEPS.length-1,i+d))]);
    const row=m.querySelector('.fsrow');if(row){const t=document.createElement('div');t.innerHTML=fsRow();row.replaceWith(t.querySelector('.fsrow'));wireFs(m)}
  });
}
fsSet(fsGet());
// pinch-zoom stays off on iPhone too (the viewport tag is not always enough)
['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t,e=>e.preventDefault()));

// ---------------------------------------------------------------- 2. six-box code
function sixBox(id){
  return`<div class="six" id="${id}" role="group" aria-label="6 digit code">${[0,1,2,3,4,5].map(i=>`<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" ${i?'autocomplete="off"':'autocomplete="one-time-code"'} aria-label="Digit ${i+1} of 6">`).join('')}</div>`;
}
function bindSix(id,onFull){
  const box=document.getElementById(id);if(!box)return;
  const ins=[...box.querySelectorAll('input')];
  const fill=(from,digits)=>{let k=from;for(const ch of digits){if(k>5)break;ins[k].value=ch;k++}(ins[Math.min(k,5)]).focus();if(onFull&&box.val().length===6)onFull()};
  box.val=()=>ins.map(x=>x.value).join('');
  box.clear=()=>{ins.forEach(x=>x.value='');ins[0].focus()};
  ins.forEach((el,i)=>{
    el.oninput=()=>{const d=el.value.replace(/\D/g,'');el.value='';if(d)fill(i,d)};
    el.onkeydown=e=>{
      if(e.key==='Backspace'&&!el.value&&i>0){e.preventDefault();ins[i-1].value='';ins[i-1].focus()}
      else if(e.key==='ArrowLeft'&&i>0){e.preventDefault();ins[i-1].focus()}
      else if(e.key==='ArrowRight'&&i<5){e.preventDefault();ins[i+1].focus()}
    };
    el.onpaste=e=>{e.preventDefault();const d=((e.clipboardData||window.clipboardData).getData('text')||'').replace(/\D/g,'').slice(0,6);if(d)fill(0,d)};
    el.onfocus=()=>el.select();
  });
}

// ---------------------------------------------------------------- 3. playing day end time
// A playing day is "live" until its end time. After that it is hidden from "next playing day" and upcoming lists (it stays in the calendar history).
function planLive(d){
  const p=PL[d];if(!p||p.status==='cancelled')return false;
  const t=today();if(d>t)return true;if(d<t)return false;
  const s=span(p.time);if(!s)return true;          // no time written: keep it for the whole day
  const n=new Date();return n.getHours()*60+n.getMinutes()<s.b;
}
let _liveSig='';
setInterval(()=>{ // once a minute: if a playing day just ended, redraw so it disappears
  try{
    if(typeof PL==='undefined'||!PL)return;
    const sig=Object.keys(PL).filter(planLive).join(',')+'|'+(typeof ANN!=='undefined'?ANN.filter(annActive).length:0);
    if(_liveSig&&sig!==_liveSig){const a=document.getElementById('app');if(a&&!a.hidden&&['me','plan'].includes(tab)&&!prof)render();if(!document.getElementById('pub').hidden)drawPublic()}
    _liveSig=sig;
  }catch(e){}
},60000);

// ---------------------------------------------------------------- 4. FAQs and help
const FAQS=[
  ['How do I log in?','Players: press Log in, type your roll number and your code. First time? We e-mail you a 6 digit code and you then choose your own code. The captain must have added you to the team list first. Captain, vice-captain and admins use the Captain / Admin tab.'],
  ['I forgot my code.','Send a message below, or ask the captain to press Reset code next to your name. Then sign up again with a new e-mail code.'],
  ['I am not getting notifications.','Open the app, allow notifications when it asks, and install the app to your home screen. On iPhone, notifications only work after “Add to Home Screen”. Also check that notifications are allowed for this app in your phone settings.'],
  ['How do I install the app?','Android / Chrome: browser menu ⋮ → Install app. iPhone: Share button → Add to Home Screen.'],
  ['How do I make the text bigger or smaller?','Open the menu (⋮) and use A− / A+ under Text size.'],
  ['How is my attendance counted?','It is your present days out of all recorded working days. Open the Attendance tab for month-by-month charts.'],
  ['Can I tell the captain I cannot come?','Yes. Open Playing days, pick the day and choose Active, Injured, Out or Maybe.'],
  ['Why did a playing day disappear?','A playing day is hidden from the upcoming list once its end time has passed. Past days stay in the calendar.']
];
let helpDraft={topic:'Other',name:'',contact:'',text:''},helpMsg='',helpBusy=false;
function helpCard(){
  const logged=!!(typeof token==='string'&&token),who=logged&&typeof WHO==='string'?WHO:'';
  if(!helpDraft.name&&who)helpDraft.name=who;
  const topics=['Login or sign-up','Attendance','Playing days','Notifications','Photos','Other'];
  return`<div class="card help" id="helpcard"><h2>FAQs &amp; help</h2>
  <div class="faq">${FAQS.map(f=>`<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join('')}</div>
  <h3 class="chh">Still need help? Message the admins</h3>
  <label class="fl">About<select id="hp_t">${topics.map(t=>`<option ${t===helpDraft.topic?'selected':''}>${t}</option>`).join('')}</select></label>
  ${logged?'':`<label class="fl">Your name<input id="hp_n" maxlength="40" value="${esc(helpDraft.name)}" placeholder="Name and roll number"></label>`}
  <label class="fl">${logged?'Phone or e-mail (optional)':'Phone or e-mail, so the admin can reply'}<input id="hp_c" maxlength="80" value="${esc(helpDraft.contact)}" placeholder="optional"></label>
  <label class="fl">Message<textarea id="hp_m" rows="4" maxlength="1000" placeholder="Write your question or problem">${esc(helpDraft.text)}</textarea></label>
  <p id="hp_e" class="${helpMsg.startsWith('✓')?'ok':'err'}" role="status">${esc(helpMsg)}</p>
  <div class="ctl"><button class="pri" id="hp_s" ${helpBusy?'disabled':''}>${helpBusy?'Sending…':'Send to admin'}</button></div></div>`;
}
function bindHelp(){
  const g=id=>document.getElementById(id);if(!g('hp_s'))return;
  const keep=()=>{helpDraft.topic=g('hp_t').value;if(g('hp_n'))helpDraft.name=g('hp_n').value;helpDraft.contact=g('hp_c').value;helpDraft.text=g('hp_m').value};
  ['hp_t','hp_n','hp_c','hp_m'].forEach(i=>{if(g(i))g(i).oninput=g(i).onchange=keep});
  g('hp_s').onclick=async()=>{
    keep();if(helpDraft.text.trim().length<5){helpMsg='Please write your message first.';g('hp_e').className='err';g('hp_e').textContent=helpMsg;return}
    helpBusy=true;g('hp_s').disabled=true;g('hp_s').textContent='Sending…';
    try{
      const hd={'Content-Type':'application/json'};if(typeof token==='string'&&token)hd.Authorization='Bearer '+token;
      const r=await fetch(API+'/api/help',{method:'POST',headers:hd,body:JSON.stringify(helpDraft)});
      const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('Error '+r.status));
      helpDraft.text='';helpMsg='✓ Sent. The admins will see your message.';
    }catch(e){helpMsg=e.message&&!/fetch|network/i.test(e.message)?e.message:'Could not send. Check your connection and try again.'}
    helpBusy=false;const c=g('helpcard');if(c){c.outerHTML=helpCard();bindHelp()}
  };
}
// put the help card at the bottom of every page in the app (not on the attendance-taking page)
function helpFooter(){
  const v=document.getElementById('view');if(!v||document.getElementById('helpcard'))return;
  if(typeof tab!=='undefined'&&(tab==='take'||tab==='helpbox'))return;
  v.insertAdjacentHTML('beforeend',helpCard());bindHelp();
}

// admins: inbox of help messages
let HM=[],hmLoaded=false,hmBusy=false,hmErr='';
async function loadHelpbox(){
  hmBusy=true;hmErr='';
  try{const r=await api('/api/help');HM=r.items||[];hmLoaded=true}catch(e){hmErr='Could not load messages: '+(e.status?e.message:'check your connection')}
  hmBusy=false;if(tab==='helpbox'&&!prof)render();
}
function vHelpbox(){
  if(!hmLoaded&&!hmBusy&&!hmErr)loadHelpbox();
  const open=HM.filter(m=>m.status!=='done'),done=HM.filter(m=>m.status==='done');
  const row=m=>`<div class="bgc ${m.status==='done'?'fx2':''}"><div class="bgh"><b>${esc(m.topic||'Other')}</b><span class="pill ${m.status==='done'?'g':'r'}">${m.status==='done'?'Done':'New'}</span></div><p style="margin:4px 0">${esc(m.text)}</p><span class="mute" style="font-size:.82rem">${esc(m.name||'Unknown')}${m.role==='visitor'?' (not logged in)':' ('+esc(m.role)+')'} · ${when(m.at)}${m.contact?' · '+esc(m.contact):''}</span>
  <div class="chips"><button data-hm="${m.id}">${m.status==='done'?'Reopen':'✔ Mark done'}</button><button class="x" data-hd="${m.id}">🗑</button></div></div>`;
  $('view').innerHTML=`<div class="card"><h2>Help messages (${open.length} new)</h2><p class="mute">Sent from the FAQs &amp; help section at the bottom of the app.</p>${HM.length?open.map(row).join('')+(done.length?`<h3 class="chh">Done (${done.length})</h3>`+done.map(row).join(''):''):empty('💬',hmErr||(hmLoaded?'No messages.':'Loading…'))}${hmErr?'<div class="ctl"><button id="hmtry">Try again</button></div>':''}</div>`;
  if($('hmtry'))$('hmtry').onclick=()=>{hmErr='';hmLoaded=false;render()};
  document.querySelectorAll('[data-hm]').forEach(b=>b.onclick=()=>{const x=HM.find(y=>y.id===b.dataset.hm);if(x)run(async()=>{await api('/api/help/'+x.id,{method:'PUT',body:{status:x.status==='done'?'open':'done'}});await loadHelpbox()})});
  document.querySelectorAll('[data-hd]').forEach(b=>b.onclick=()=>{if(confirm('Delete this message?'))run(async()=>{await api('/api/help/'+b.dataset.hd,{method:'DELETE'});await loadHelpbox()})});
}
