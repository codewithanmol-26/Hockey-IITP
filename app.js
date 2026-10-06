
const API=(window.API_URL||'').replace(/\/$/,'');
let token='';try{token=localStorage.getItem('hk_token')||''}catch(e){}
async function api(path,o={}){
  const r=await fetch(API+path,{method:o.method||'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:o.body?JSON.stringify(o.body):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(j.error||('Error '+r.status));e.status=r.status;throw e}
  return j;
}
const SCH={team:[['Monday','Rest day','Recovery, no scheduled session',''],['Tuesday','Ball control & passing','Dribbling, trapping, passing triangles, pressure receiving, 1v1s','6:30–8:30 PM'],['Wednesday','Set pieces + fitness','Penalty corners, free hits, agility','6:30–8:30 PM'],['Thursday','Tactical & defense','Team shape, press, transitions, tackling & covering','6:30–8:30 PM'],['Friday','Shooting + match simulation','Circle entries, finishing drills, full-pitch scrimmage at game speed','6:30–8:30 PM'],['Saturday','Position-specific work','FWD circle entries, DEF tackling, GK reflexes','5:30–7:30 AM'],['Sunday','Full match','Stretching and warm-up, then full match play','5:30–7:30 AM']],
gk:[['Monday','Rest day','Recovery, no scheduled session',''],['Tuesday','Reflex & shot-stopping','Close-range reaction saves, low/high ball drills, hand-eye reflex work','6:30–8:30 PM'],['Wednesday','PC defense + fitness','Penalty corner stopping, rushing angles, explosive power & agility','6:30–8:30 PM'],['Thursday','Footwork & positioning','Angle play, narrowing shots, lateral movement, communication with defense','6:30–8:30 PM'],['Friday','Aerial saves + match simulation','High ball handling, rebound control, live match-speed scenarios','6:30–8:30 PM'],['Saturday','1v1 & rebound control','Breakaway defending, second-save reactions, distribution after saves','5:30–7:30 AM'],['Sunday','Full match','Stretching and warm-up, then full match play','5:30–7:30 AM']]};
let P=[],SS={},L={},PL={},admin=false,loaded=false,err='',tab='me',selDate=today(),takeDate=today(),selMonth='',gMonth='all',draft={},draftDate=null,sch='team';
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>new Date(d+'T00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
const mfmt=m=>new Date(m+'-01T00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'});
const dates=()=>Object.keys(SS).sort();
const months=()=>[...new Set([...Object.keys(L),...dates().map(d=>d.slice(0,7))])].sort();
const rdays=m=>(m==='all'?Object.keys(L).reduce((a,k)=>a+L[k].days,0)+dates().length:(L[m]?L[m].days:0)+dates().filter(d=>d.startsWith(m)).length);
async function run(fn){try{await fn()}catch(e){if(e.status===401){alert('Please log in again as captain or vice-captain.');load()}else alert('Could not save: '+e.message)}}

function stats(m){return P.map(p=>{let t=0,pr=0;const j=(p.joined||'0000-00').slice(0,7);
  for(const k in L)if((m==='all'||k===m)&&j<=k){t+=L[k].days;pr+=(L[k].att[p.id]||0)}
  for(const d in SS)if(m==='all'||d.startsWith(m)){const r=SS[d][p.id];if(r!==undefined){t++;if(r)pr++}}
  return{p,pr,t,pct:t?Math.round(pr*100/t):0}})}

async function load(){
  try{
    const d=await api('/api/data'+(token||!me?'':'?me='+encodeURIComponent(me)));
    const was=admin;admin=!!d.role;
    if(admin&&!was)tab='take';
    if(!admin&&(tab==='take'||tab==='players'))tab='me';
    P=d.players.sort((a,b)=>(a.n||999)-(b.n||999)||String(a.name).localeCompare(String(b.name)));
    SS=d.sessions;L=d.legacy;PL=d.plans;loaded=true;err='';render();
  }catch(e){
    if(e.status===401){token='';try{localStorage.removeItem('hk_token')}catch(x){}return load()}
    err='Cannot reach the server. Check your connection and try again.';render();
  }
}
$('auth').onclick=()=>{
  if(admin){token='';try{localStorage.removeItem('hk_token')}catch(x){}admin=false;tab='me';load();return}
  $('er').textContent='';$('dlg').showModal();
};
$('cx').onclick=()=>$('dlg').close();
$('lf').onsubmit=async e=>{e.preventDefault();
  try{const r=await api('/api/login',{method:'POST',body:{role:$('em').value,code:$('pw').value.trim()}});
    token=r.token;try{localStorage.setItem('hk_token',token)}catch(x){}
    $('dlg').close();$('pw').value='';await load();
  }catch(x){$('er').textContent=x.status===429?'Too many tries. Wait a minute.':x.status===401?'Wrong code.':'Cannot reach the server.'}
};

function render(){
  const t=[['me','My progress'],['plan','Playing days'],['stats','Attendance'],['schedule','Schedule'],['rules','Rules'],['warmup','Warm-up']];
  if(admin)t.unshift(['take','Take attendance']);
  if(admin)t.push(['players','Players']);
  if(!t.some(x=>x[0]===tab))tab=t[0][0];
  $('nav').innerHTML=t.map(x=>`<button class="${x[0]===tab?'on':''}" data-t="${x[0]}">${x[1]}</button>`).join('');
  $('nav').querySelectorAll('button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;render()});
  $('auth').textContent=admin?'Log out':'Captain login';
  if(err){$('view').innerHTML=`<div class="card">${esc(err)}</div>`;return}
  if(!loaded){$('view').innerHTML='<p class="mute">Loading…</p>';return}
  ({take:vTake,me:vMe,plan:vPlan,stats:vStats,schedule:vSched,rules:vRules,warmup:vWarm,players:vPlayers})[tab]();
}
const dayIdx=d=>(new Date(d+'T00:00').getDay()+6)%7;

function vTake(){
  const ex=SS[takeDate]||{};
  if(draftDate!==takeDate){draft={...ex};draftDate=takeDate}
  const el=P.filter(p=>!p.joined||p.joined<=takeDate),pl=SCH.team[dayIdx(takeDate)],pend=Object.keys(PL).sort().filter(d=>!SS[d]&&PL[d].status!=='cancelled'&&d<=today());
  $('view').innerHTML=`<div class="card"><h2>Take attendance</h2>
  <div class="ctl"><label>Date <input type="date" id="td" value="${takeDate}"></label><button id="allp">All present</button></div>${pend.length?`<p class="mute">Planned days waiting for attendance:</p><div class="chips" style="margin:0 0 10px">${pend.map(d=>`<button data-pd="${d}">${fmt(d)}</button>`).join('')}</div>`:''}
  <p class="mute">${pl[0]}: ${pl[3]?esc(pl[1])+', '+pl[3]:'rest day on the schedule'}${SS[takeDate]?' · already saved, saving again updates it':''}</p>
  ${el.map(p=>`<div class="row"><span>${esc(p.name)}<br><span class="mute">${esc(p.roll)}</span></span><span class="tog">
  <button class="p ${draft[p.id]===true?'on':''}" data-id="${p.id}" data-v="1">Present</button>
  <button class="a ${draft[p.id]===false?'on':''}" data-id="${p.id}" data-v="0">Absent</button></span></div>`).join('')||'<p class="mute">No players yet. Add them in the Players tab.</p>'}
  <div class="ctl" style="margin-top:12px"><button class="pri" id="sv">Save attendance</button>${SS[takeDate]?'<button class="dng" id="del">Delete this day</button>':''}</div></div>`;
  $('td').onchange=e=>{if(e.target.value){takeDate=e.target.value;vTake()}};
  document.querySelectorAll('.tog button').forEach(b=>b.onclick=()=>{draft[b.dataset.id]=b.dataset.v==='1';const r=b.parentNode;r.querySelector('.p').classList.toggle('on',draft[b.dataset.id]===true);r.querySelector('.a').classList.toggle('on',draft[b.dataset.id]===false)});
  document.querySelectorAll('[data-pd]').forEach(b=>b.onclick=()=>{takeDate=b.dataset.pd;vTake()});
  $('allp').onclick=()=>{el.forEach(p=>draft[p.id]=true);vTake()};
  $('sv').onclick=()=>{
    if(!el.length)return alert('Add players first.');
    const un=el.filter(p=>draft[p.id]===undefined);
    if(un.length)return alert('Tick Present or Absent for: '+un.map(p=>p.name).join(', '));
    const r={};el.forEach(p=>r[p.id]=draft[p.id]);
    run(async()=>{await api('/api/sessions/'+takeDate,{method:'PUT',body:{r:{...ex,...r}}});draftDate=null;await load();alert('Saved for '+fmt(takeDate))});
  };
  if($('del'))$('del').onclick=()=>{if(confirm('Delete attendance for '+fmt(takeDate)+'?'))run(async()=>{await api('/api/sessions/'+takeDate,{method:'DELETE'});draftDate=null;await load()})};
}

function mSel(id,cur,all){return`<select id="${id}">${all?`<option value="all">All time</option>`:''}${months().map(m=>`<option value="${m}" ${m===cur?'selected':''}>${mfmt(m)}</option>`).join('')}</select>`}

function lineSvg(pts){
  const W=640,H=200,px=i=>40+(pts.length>1?i*(W-60)/(pts.length-1):(W-60)/2),py=v=>10+(H-40)*(1-v/100);
  return`<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:420px">${[0,50,100].map(g=>`<line x1="40" x2="${W-20}" y1="${py(g)}" y2="${py(g)}" stroke="var(--line)"/><text x="34" y="${py(g)+4}" text-anchor="end">${g}%</text>`).join('')}
  <polyline fill="none" stroke="var(--p)" stroke-width="2.5" points="${pts.map((p,i)=>px(i)+','+py(p.pct)).join(' ')}"/>
  ${pts.map((p,i)=>`<circle cx="${px(i)}" cy="${py(p.pct)}" r="4" fill="var(--p)"><title>${p.tip}</title></circle>${pts.length<=12||i%Math.ceil(pts.length/10)===0?`<text x="${px(i)}" y="${H-8}" text-anchor="middle">${p.l}</text>`:''}`).join('')}</svg>`}

let dsel=false;
function vStats(){
  if(!months().length){$('view').innerHTML='<div class="card"><h2>Attendance</h2><p class="mute">No attendance recorded yet.</p></div>';return}
  if(!dsel&&dates().length)selDate=dates()[dates().length-1];
  if(!admin&&!P.some(p=>p.id===me)){$('view').innerHTML='<div class="card"><h2>Attendance</h2><p class="mute">Select your roll number in My progress to see your attendance.</p><button class="pri" id="gm2">Go to My progress</button></div>';$('gm2').onclick=()=>{tab='me';render()};return}
  const vis=x=>admin||x.p.id===me;
  const m=gMonth,st=stats(m).filter(x=>x.t&&vis(x)).sort((a,b)=>b.pct-a.pct),n=rdays(m),live=dates().filter(d=>m==='all'||d.startsWith(m));
  const tp=st.reduce((a,x)=>a+x.t,0),tr=tp?Math.round(st.reduce((a,x)=>a+x.pr,0)*100/tp):0;
  let pts,ttl;
  if(m==='all'){ttl=admin?'Team turnout by month':'My attendance by month';pts=months().map(k=>{const q=stats(k).filter(vis),t=q.reduce((a,x)=>a+x.t,0),pr=q.reduce((a,x)=>a+x.pr,0),pct=t?pr*100/t:0;return{l:k.slice(2),pct,tip:mfmt(k)+': '+Math.round(pct)+'%'}})}
  else{ttl=admin?'Team turnout per playing day':'My attendance per playing day';pts=(admin?live:live.filter(d=>SS[d][me]!==undefined)).map(d=>{const v=admin?Object.values(SS[d]):[SS[d][me]],pr=v.filter(Boolean).length,pct=v.length?pr*100/v.length:0;return{l:d.slice(5),pct,tip:fmt(d)+': '+(admin?pr+' present':(pr?'Present':'Absent'))}})}
  const sd=SS[selDate];let day='<p class="mute">No hockey recorded on this date.</p>';
  if(!admin){day=sd&&sd[me]!==undefined?`<div class="row"><span>${fmt(selDate)}</span><span class="tag ${sd[me]?'p':'a'}">${sd[me]?'Present':'Absent'}</span></div>`:'<p class="mute">No record for you on this date.</p>'}else if(sd){const v=P.filter(p=>sd[p.id]!==undefined),pr=v.filter(p=>sd[p.id]).length;
    day=`<div class="stats"><div><b>${pr}</b>Present</div><div><b>${v.length-pr}</b>Absent</div><div><b>${v.length?Math.round(pr*100/v.length):0}%</b>Turnout</div></div>`+v.map(p=>`<div class="row"><span>${esc(p.name)}</span><span class="tag ${sd[p.id]?'p':'a'}">${sd[p.id]?'Present':'Absent'}</span></div>`).join('')}
  $('view').innerHTML=`<div class="card"><h2>Attendance</h2><div class="ctl">${mSel('gm',gMonth,true)}</div>
  <div class="stats"><div><b>${n}</b>Playing days</div><div><b>${tr}%</b>${admin?'Team turnout':'My attendance'}</div></div>
  <table><tr><th>Player</th><th class="n">Present</th><th class="n">Days</th><th>%</th></tr>${st.map(x=>`<tr><td>${esc(x.p.name)}</td><td class="n">${x.pr}</td><td class="n">${x.t}</td><td><div class="bar"><i style="width:${x.pct}%"></i></div>${x.pct}%</td></tr>`).join('')}</table>
  ${L[m]?'<p class="mute">Includes the imported register totals. Players who joined mid-month show a lower %.</p>':''}
  <h2 style="margin-top:18px">${ttl}</h2><div style="overflow-x:auto">${pts.length?lineSvg(pts):'<p class="mute">No day-by-day records for this month. Monthly totals only.</p>'}</div></div>
  <div class="card"><h2>Day by day</h2><div class="ctl"><input type="date" id="sd" value="${selDate}"></div>${day}
  <div class="chips">${live.filter(d=>admin||SS[d][me]!==undefined).reverse().map(d=>`<button data-d="${d}">${fmt(d)}</button>`).join('')}</div></div>`;
  $('gm').onchange=e=>{gMonth=e.target.value;vStats()};
  $('sd').onchange=e=>{if(e.target.value){selDate=e.target.value;dsel=true;vStats()}};
  document.querySelectorAll('.chips button').forEach(b=>b.onclick=()=>{selDate=b.dataset.d;dsel=true;vStats()});
}
function vSched(){
  const ti=dayIdx(today());
  $('view').innerHTML=`<div class="card"><h2>Weekly practice schedule</h2><div class="ctl"><button class="${sch==='team'?'pri':''}" data-s="team">Team</button><button class="${sch==='gk'?'pri':''}" data-s="gk">Goalkeepers</button></div>
  ${SCH[sch].map((r,i)=>`<div class="row ${i===ti?'today':''}"><span><b>${r[0]}</b> · ${esc(r[1])}<br><span class="mute">${esc(r[2])}</span></span><span class="n">${r[3]||'–'}</span></div>`).join('')}
  <p class="mute">Report on time. Timings may shift closer to the tournament based on turf availability and the coach's call. Coach: Kiran Chaudhary.</p></div>`;
  document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{sch=b.dataset.s;vSched()});
}

const RULES=[
["Umpire signals: time and restarts",["Start time|turn to the other umpire, one arm straight up","Stop time|cross fully extended arms at the wrists above the head","Two minutes left|both hands up, index fingers pointing","One minute left|one hand up, index finger pointing","Bully|hands move alternately up and down, palms facing each other","Goal|both arms horizontal, pointing to the centre of the field","Ball out over side-line|one arm raised horizontally in the direction of play","Ball out over back-line by attacker|both arms extended horizontally sideways","Ball out over back-line by defender (unintentional)|one arm, below shoulder level, draws a line from where the ball crossed to the restart spot on the 23 m line"]],
["Umpire signals: conduct of play",["Dangerous play|one forearm diagonally across the chest","Misconduct or bad temper|calming movement, both hands slowly up and down, palms down","Kick (foot)|slightly raise a leg and touch near the foot or ankle","Raised ball|palms face each other horizontally, about 150 mm apart","Obstruction|forearms crossed in front of the chest","Third party (shadow) obstruction|crossed forearms alternately opened and closed","Stick obstruction|one arm held out and down, touch that forearm with the other hand","5 metres distance|one arm straight up, open hand, fingers extended"]],
["Umpire signals: penalties",["Advantage|one arm extended high in the direction the benefiting team is playing","Free hit|one arm raised horizontally in the direction of the free hit","Penalty corner|both arms horizontal, pointing at the goal","Penalty stroke|one arm points at the stroke mark, the other straight up (also means time stopped)"]],
["Match penalties: when each is given",["Free hit|any offence between the 23 m areas, an attacker's offence in the 23 m area, or an unintentional defender offence outside the circle in their own 23 m area","Penalty corner|a defender's offence in the circle that does not stop a probable goal, an intentional offence in the circle against a player without the ball, an intentional offence outside the circle in their 23 m area, ball intentionally played over the back-line by a defender, or ball lodged in a defender's clothing or equipment in the circle","Penalty stroke|a defender's offence in the circle that prevents a probable goal, or an intentional offence in the circle against a player with the ball or a chance to play it","Ball over the back-line|attacker: free hit up to 15 m out. Defender, unintentional: free hit on the 23 m line. Defender, intentional: penalty corner","Free hit rules|ball stationary, opponents at least 5 m away, no intentional raised hit. An attacking free hit in the 23 m area can enter the circle only after the ball travels 5 m or a defender touches it","Penalty stroke taking|ball on the penalty spot, defender on the goal line, taker waits for the whistle, push, flick or scoop only (no dragging), plays the ball once"]],
["Personal penalties (cards)",["Caution|spoken warning","Green card|warning and 2 minutes suspension","Yellow card|at least 5 minutes suspension","Red card|permanently out of the match","Team effect|the team plays one player short for the length of any suspension","Captain|a yellow card must be given if having too many players on the field materially affects the match"]],
["Dress and equipment",["Uniform|field players of a team wear the same clothing. Shorts, skort or skirt are allowed if the same colour and design","Safety|nothing dangerous may be worn. Shin, ankle and mouth protection are recommended","Hand protection|must fit into a box of 290 x 180 x 110 mm without compressing","Face masks|only for defending a penalty corner or stroke (or medical reasons, worn throughout). No other headgear for field players","Knee pads|allowed at penalty corners, outside the socks only if the same colour as the socks or black. Remove penalty corner gear safely once it is over","Captain|wears a distinctive arm-band","Stick|J or U shaped head, flat on the left side only, smooth, no metal. Must pass through a 51 mm ring, bow no more than 25 mm, weight up to 737 g, length up to 105 cm","Ball|hard, white (or a contrasting colour), circumference 224 to 235 mm, weight 156 to 163 g"]],
["Goalkeeper rules and gear",["Gear|at least headgear, leg guards and kickers. Headgear and hand protectors may come off for a penalty stroke","Shirt|different colour from both teams, worn over upper body protection","Size limits|hand protector up to 365 x 228 mm, leg guards up to 300 mm wide, nothing that significantly adds to body size","Where they play|inside their own 23 m area only (except taking a penalty stroke)","Playing the ball|inside the circle with the stick in hand, may use stick and body to deflect or play the ball. Outside the circle, stick only","Not allowed|lying on the ball, or using the equipment in a dangerous way"]],
["Key conduct rules",["Stick|hold it at all times, never lift it over other players' heads, never play with the back of the stick","Hitting|no hard forehand hit with the edge of the stick. No intentional raised hit except a shot at goal","Flick or scoop|dangerous if aimed at an opponent within 5 metres","Aerial ball|opponents stay 5 m away until the receiver touches the ball (new in 2026)","Body|field players must not stop, kick or carry the ball with the body to gain advantage","Obstruction|no backing into, shielding with the stick or body, or running in front of an opponent","Tackling|only when able to play the ball without body contact. Reckless sliding tackles are penalised","Other|no entering or running behind the goals, no throwing equipment, no time wasting, no touching or intimidating players"]],
["Match basics and substitutions",["Length|four quarters of 15 min, 2 min breaks after Q1 and Q3, 10 min half-time","Team|up to 11 on the field and up to 5 substitutes (16 total)","Substitution|any time except from the award of a penalty corner until it is finished (unless the defending goalkeeper is injured or suspended)","Where to swap|within 3 m of the centre line on the agreed side. A player must leave before the replacement enters","Goals|time and play stop after a goal and restart when teams are ready"]],
["Penalty corner basics",["Taker|ball on the back-line at least 10 m from the post, push or hit with no intentional raise, one foot outside the field","Attackers|all others outside the circle, 5 m from the ball, until it is played","Defenders|up to 5 behind the back-line including the goalkeeper, the rest beyond the centre line","Scoring|no goal until the ball has left the circle. A first hit must be no higher than 460 mm at the goal-line","Taker restriction|cannot touch the ball again until another player plays it","Gear|defenders remove masks and pads safely afterwards. Throwing equipment that strikes someone on or above the knee is a yellow card"]],
["What changed in the 2026 rulebook",["Half-time|now 10 minutes","Goals|time and play stop after a goal","Aerial balls|opponents may approach once the receiver has touched the ball, after the first 5 m of space","Goalkeepers|clarified that stick and body can be used inside the circle","Umpire deflection|ball hitting an umpire that gives one team an advantage restarts with a bully","Too many players|yellow card for the captain if it materially affects the match","Goalkeeper glove|maximum length raised from 355 mm to 365 mm"]]];
const WARM=[
["Warm-up: about 12 minutes before practice",["Easy jog|3 minutes around the pitch, building pace gradually","Leg swings|10 forward and back, 10 side to side per leg, holding a stick for balance","High knees and heel flicks|2 x 20 m each","Walking lunge with twist|10 per leg, chest tall","Side shuffles and carioca|2 x 20 m each way, stay low in hockey posture","Stick-handling jog|2 minutes of dribbling in a tight pattern, then a few passes with a partner","Build-up runs|3 x 20 m at about 70%, then 80%, finishing with a quick change of direction"]],
["Stretching: about 10 minutes after practice",["Hamstring|seated or standing, reach toward the toes with a flat back","Quadriceps|standing, heel toward the glute, knees together","Hip flexor|kneeling lunge, tuck the hips forward (important in the bent hockey posture)","Groin|wide-leg seated stretch or side lunge","Calf|hands on a wall, back heel pressed down","Glutes|lying on the back, ankle on the opposite knee, pull the leg toward the chest","Lower back|child's pose with arms long","Shoulders and wrists|cross-body arm stretch, then gentle wrist flexor and extensor stretches for the stick grip"]]];
const DEF=['🧑‍⚖️','🧑‍⚖️','🧑‍⚖️','🚩','🟨','👕','🧤','📋','⏱️','🏑','🆕'];
const IC=[[/^start time/i,'▶️'],[/^stop time/i,'⏹️'],[/minute/i,'⏱️'],[/bully/i,'🤝'],[/^goals?$/i,'🥅'],[/ball out/i,'↗️'],[/dangerous/i,'⚠️'],[/misconduct/i,'✋'],[/kick/i,'🦶'],[/raised ball|aerial|flick/i,'⤴️'],[/obstruct/i,'🚧'],[/5 metres/i,'📏'],[/advantage/i,'👍'],[/free hit/i,'🏑'],[/penalty corner/i,'🚩'],[/penalty stroke/i,'🎯'],[/green card/i,'🟩'],[/yellow card/i,'🟨'],[/red card/i,'🟥'],[/caution/i,'🗣️'],[/captain/i,'🎖️'],[/stick/i,'🏑'],[/ball/i,'⚪'],[/knee|safety|mask|hand protect/i,'🛡️'],[/uniform/i,'👕'],[/glove|gear|shirt|size/i,'🧤'],[/tackl/i,'🏃'],[/substitut|where to swap/i,'🔁'],[/length|half-time/i,'⏱️'],[/^team$/i,'👥'],[/taker|attackers|defenders/i,'👥'],[/scoring/i,'🥅'],[/umpire/i,'🧑‍⚖️'],[/where they play/i,'📍']];
const ic=(h,d)=>{const f=IC.find(r=>r[0].test(h));return f?f[1]:d};
const lst=(a,tag,d)=>`<${tag}${d?' class="ico"':''}>${a.map(x=>{const[h,b]=x.split('|'),i=d?`<span class="ic">${ic(h,d)}</span>`:'';return b?`<li>${i}<span><b>${h}</b>: ${b}</span></li>`:`<li>${i}<span>${x}</span></li>`}).join('')}</${tag}>`;
function vRules(){$('view').innerHTML='<p class="mute">Summary of the FIH Rules of Hockey effective 1 March 2026. The full rulebook decides any dispute.</p>'+RULES.map((r,i)=>`<details class="card" ${i===0?'open':''}><summary>${DEF[i]} ${r[0]}</summary>${lst(r[1],'ul',DEF[i])}</details>`).join('')}
function vWarm(){$('view').innerHTML=WARM.map(r=>`<div class="card"><h2>${r[0]}</h2>${lst(r[1],'ol')}${r[0].startsWith('Stretching')?'<p class="mute">Hold each stretch 20 to 30 seconds per side, breathe normally, no bouncing. Ease off if you feel pain.</p>':'<p class="mute">Do dynamic moves like these before play and save static stretching for after.</p>'}</div>`).join('')}
let me='';try{me=localStorage.getItem('hk_me')||''}catch(e){}
function vMe(){
  if(!P.some(p=>p.id===me))me='';
  let body='<p class="mute">Select your roll number to see your attendance.</p>';
  if(me){
    const a=stats('all').find(x=>x.p.id===me);
    const rows=months().map(m=>{const s=stats(m).find(x=>x.p.id===me);return s&&s.t?`<tr><td>${mfmt(m)}</td><td class="n">${s.pr}/${s.t}</td><td><div class="bar"><i style="width:${s.pct}%"></i></div>${s.pct}%</td></tr>`:''}).join('');
    const recent=dates().reverse().filter(d=>SS[d][me]!==undefined).slice(0,10).map(d=>`<div class="row"><span>${fmt(d)}</span><span class="tag ${SS[d][me]?'p':'a'}">${SS[d][me]?'Present':'Absent'}</span></div>`).join('');
    body=`<p style="margin:0 0 10px"><b>${esc(a.p.name)}</b><br><span class="mute">${esc(a.p.position)}</span></p><div class="stats"><div><b>${a.pct}%</b>Overall</div><div><b>${a.pr}</b>Days attended</div><div><b>${a.t}</b>Playing days</div></div>
    <table><tr><th>Month</th><th class="n">Present</th><th>%</th></tr>${rows}</table>
    <h2 style="margin-top:16px">Recent days</h2>${recent||'<p class="mute">No day-by-day records yet.</p>'}`;
  }
  const key=p=>String(p.roll||p.name);
  $('view').innerHTML=`<div class="card"><h2>My progress</h2>${nextPlan()}<p style="margin:0 0 6px"><b>Select your roll number</b></p>
  <select id="me" style="width:100%;margin-bottom:8px"><option value="">Choose roll number</option>${P.map(p=>`<option value="${p.id}" ${p.id===me?'selected':''}>${esc(key(p))}</option>`).join('')}</select>
  ${me?'<button id="clr" style="width:100%;margin-bottom:8px">Clear selection</button>':''}
  <p class="mute">Your selection is saved on this device so it is here next time you open this page.</p>${body}</div>`;
  const keep=()=>{try{localStorage.setItem('hk_me',me)}catch(x){}};
  $('me').onchange=e=>{me=e.target.value;keep();load()};
  if($('clr'))$('clr').onclick=()=>{me='';keep();load()};
}
function nextPlan(){const d=Object.keys(PL).sort().find(x=>x>=today()&&PL[x].status!=='cancelled');return d?`<p class="note">Next playing day: <b>${fmt(d)}</b>${PL[d].time?', '+esc(PL[d].time):''}${PL[d].note?' · '+esc(PL[d].note):''}</p>`:''}
function vPlan(){
  const td=today(),ks=Object.keys(PL).sort(),up=ks.filter(d=>d>=td),past=ks.filter(d=>d<td).reverse().slice(0,5);
  const row=d=>{const p=PL[d],c=p.status==='cancelled';return`<div class="row"><span><b>${fmt(d)}</b> · ${SCH.team[dayIdx(d)][0]}${p.time?' · '+esc(p.time):''}${c?' · <span class="tag a">Cancelled</span>':''}${SS[d]?' · <span class="tag p">Attendance recorded</span>':''}${p.note?'<br><span class="mute">'+esc(p.note)+'</span>':''}</span>${admin?`<span class="chips" style="margin:0"><button data-a="take" data-d="${d}">Attendance</button><button data-a="cx" data-d="${d}">${c?'Restore':'Cancel'}</button><button class="dng" data-a="rm" data-d="${d}">Delete</button></span>`:''}</div>`};
  $('view').innerHTML=`${admin?`<div class="card"><h2>Schedule a playing day</h2><div class="ctl"><input type="date" id="pd" value="${td}"><input id="pt" placeholder="Time" size="14" value="${esc(SCH.team[dayIdx(td)][3])}"></div><div class="ctl"><input id="pn" placeholder="Note (optional), e.g. practice match" maxlength="80" style="flex:1"><button class="pri" id="pa">Add</button></div></div>`:''}
  <div class="card"><h2>Upcoming playing days</h2>${up.map(row).join('')||'<p class="mute">No playing days scheduled yet.</p>'}</div>
  ${past.length?`<div class="card"><h2>Recent</h2>${past.map(row).join('')}</div>`:''}`;
  if(!admin)return;
  $('pd').onchange=e=>{if(e.target.value)$('pt').value=SCH.team[dayIdx(e.target.value)][3]};
  $('pa').onclick=()=>{const d=$('pd').value;if(!d)return;run(async()=>{await api('/api/plans/'+d,{method:'PUT',body:{time:$('pt').value.trim(),note:$('pn').value.trim(),status:'planned'}});await load()})};
  document.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const d=b.dataset.d,a=b.dataset.a;
    if(a==='take'){takeDate=d;tab='take';render()}
    else if(a==='cx')run(async()=>{await api('/api/plans/'+d,{method:'PUT',body:{...PL[d],status:PL[d].status==='cancelled'?'planned':'cancelled'}});await load()});
    else if(confirm('Delete the plan for '+fmt(d)+'?'))run(async()=>{await api('/api/plans/'+d,{method:'DELETE'});await load()})});
}
function vPlayers(){
  $('view').innerHTML=`<div class="card"><h2>Players (${P.length})</h2>
  ${admin?`<div class="ctl"><input id="nm" placeholder="Name" maxlength="40"><input id="rl" placeholder="Roll no" maxlength="12" size="10"><input id="ps" placeholder="Position" maxlength="40"><button class="pri" id="add">Add player</button></div>`:'<div class="note mute">Log in as captain or vice-captain to add or remove players.</div>'}
  ${admin&&!P.length?'<div class="note">Team list is empty. <button id="imp">Import team and past attendance from the register</button></div>':''}
  ${P.map(p=>`<div class="row"><span>${esc(p.name)}<br><span class="mute">${esc(p.roll)} · ${esc(p.position)}</span></span>${admin?`<button class="dng" data-id="${p.id}">Remove</button>`:''}</div>`).join('')||'<p class="mute">No players yet.</p>'}</div>`;
  if(!admin)return;
  const add=()=>{const n=$('nm').value.trim();if(!n)return;
    if(P.some(p=>p.name.toLowerCase()===n.toLowerCase()))return alert('That player is already added.');
    run(async()=>{await api('/api/players',{method:'POST',body:{n:P.length+1,name:n,roll:$('rl').value.trim(),position:$('ps').value.trim(),joined:today()}});await load()})};
  $('add').onclick=add;$('nm').onkeydown=e=>{if(e.key==='Enter')add()};
  document.querySelectorAll('.row .dng').forEach(b=>b.onclick=()=>{const p=P.find(x=>x.id===b.dataset.id);if(confirm('Remove '+p.name+' from the team? Their records stay hidden in the database.'))run(async()=>{await api('/api/players/'+p.id,{method:'DELETE'});await load()})});
  if($('imp'))$('imp').onclick=()=>run(async()=>{await api('/api/import',{method:'POST'});await load()});
}
load();setInterval(load,20000);
