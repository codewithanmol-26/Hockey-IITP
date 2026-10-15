// Extra UI pieces: avatars, umpire whistle + signal pictures, chart, sharing (any app), reports.
// Loaded before app.js. Everything here is only called after app.js has started, so it can use its globals (P, SS, esc, fmt ...).

// ---------- avatars & photos ----------
const AVC=['#1459d9','#13a05d','#d6409f','#7a5af8','#e08a00','#0f9ea8','#c2410c'];
function avatar(name,photo,size,cls){
  size=size||40;const s=String(name||'?').trim(),c=AVC[[...s].reduce((a,ch)=>a+ch.charCodeAt(0),0)%AVC.length];
  return photo?`<img class="avi ${cls||''}" src="${photo}" alt="" style="width:${size}px;height:${size}px">`
    :`<span class="avi ${cls||''}" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.42)}px;background:${c}">${esc((s[0]||'?').toUpperCase())}</span>`;
}
// choose a photo, centre-crop to a small square and give back a JPEG data URL
function pickPhoto(cb){
  const f=document.createElement('input');f.type='file';f.accept='image/*';
  f.onchange=()=>{const fl=f.files[0];if(!fl)return;const rd=new FileReader();
    rd.onload=()=>{const im=new Image();im.onload=()=>{const S=180,c=document.createElement('canvas');c.width=c.height=S;const m=Math.min(im.width,im.height),x=(im.width-m)/2,y=(im.height-m)/2;
      c.getContext('2d').drawImage(im,x,y,m,m,0,0,S,S);cb(c.toDataURL('image/jpeg',.78))};im.onerror=()=>alert('That file is not a picture.');im.src=rd.result};rd.readAsDataURL(fl)};
  f.click();
}

// ---------- umpire whistle (synthesised, no audio files) ----------
let ACX=null;
const soundOn=()=>{try{return localStorage.getItem('hk_sound')!=='0'}catch(e){return true}};
function playWhistle(kind){
  try{
    ACX=ACX||new (window.AudioContext||window.webkitAudioContext)();const c=ACX;if(c.state==='suspended')c.resume();
    const pat={short:[[0,.3]],long:[[0,1]],double:[[0,.24],[.36,.24]],final:[[0,.24],[.36,.24],[.72,.9]]}[kind||'short'],t0=c.currentTime+.02;
    pat.forEach(([s,d])=>{
      const o=c.createOscillator(),o2=c.createOscillator(),l=c.createOscillator(),lg=c.createGain(),g=c.createGain();
      o.frequency.value=2850;o2.frequency.value=3130;l.frequency.value=36;lg.gain.value=170;           // the "pea" trill
      l.connect(lg);lg.connect(o.frequency);lg.connect(o2.frequency);
      g.gain.setValueAtTime(0,t0+s);g.gain.linearRampToValueAtTime(.3,t0+s+.03);g.gain.setValueAtTime(.3,t0+s+d-.06);g.gain.linearRampToValueAtTime(0,t0+s+d);
      o.connect(g);o2.connect(g);g.connect(c.destination);[o,o2,l].forEach(x=>{x.start(t0+s);x.stop(t0+s+d+.05)});
    });
  }catch(e){}
}
const blow=k=>{if(soundOn())playWhistle(k)};
function whistleSvg(sz){
  return`<svg class="whs" width="${sz||28}" height="${sz||28}" viewBox="0 0 64 64" aria-hidden="true"><path d="M12 14c0-5 8-5 8 0v8" fill="none" stroke="#9aa7b4" stroke-width="3" stroke-linecap="round"/>
  <rect x="31" y="22" width="30" height="14" rx="4" fill="#f5b50a"/><rect x="31" y="22" width="30" height="5" rx="2.5" fill="#ffd45c"/>
  <circle cx="26" cy="40" r="17" fill="#f5b50a"/><circle cx="26" cy="40" r="17" fill="none" stroke="#c98d00" stroke-width="2"/>
  <circle cx="26" cy="40" r="9" fill="#fff3c9" stroke="#c98d00" stroke-width="2"/><circle cx="26" cy="40" r="4" fill="#e5484d"/>
  <rect x="34" y="23" width="10" height="3" rx="1.5" fill="#7a5500" opacity=".55"/></svg>`;
}

// ---------- umpire signal pictures (drawn by the app: a simple umpire figure per signal) ----------
// arm = [upper-arm angle, fore-arm angle] in degrees: 0 = hanging down, 90 = sideways, 180 = straight up, negative = across the body
const POSE=[
 [/^start time/i,{R:[180,180],L:[8,2]}],
 [/^stop time/i,{L:[150,205],R:[150,205]}],
 [/^two minutes/i,{L:[150,175],R:[150,175],t:'2'}],
 [/^one minute/i,{R:[160,175],L:[8,2],t:'1'}],
 [/^bully/i,{L:[40,125],R:[35,50]}],
 [/^goal$/i,{L:[90,92],R:[90,92],t:'🥅'}],
 [/back-line by attacker/i,{L:[90,90],R:[90,90],t:'ATT'}],
 [/back-line by defender/i,{R:[55,55],L:[8,2],t:'DEF'}],
 [/side-line/i,{R:[90,90],L:[8,2]}],
 [/^dangerous/i,{R:[20,-115],L:[8,2]}],
 [/^misconduct/i,{L:[70,82],R:[70,82]}],
 [/^kick/i,{R:[25,10],L:[8,2],leg:1}],
 [/^raised ball/i,{L:[15,-55],R:[15,-55]}],
 [/third party/i,{L:[10,-100],R:[10,-100],t:'↔'}],
 [/stick obstruction/i,{R:[50,50],L:[15,-85]}],
 [/^obstruction/i,{L:[10,-100],R:[10,-100]}],
 [/^5 metres/i,{R:[180,180],L:[8,2],t:'5 m'}],
 [/^advantage/i,{R:[140,140],L:[8,2],t:'➜'}],
 [/^free hit$/i,{R:[90,90],L:[8,2],t:'🏑'}],
 [/^penalty corner$/i,{L:[90,90],R:[90,90],t:'🚩'}],
 [/^penalty stroke$/i,{R:[40,40],L:[180,180],t:'🎯'}]
];
const CARDS=[[/^green card/i,'#1fa75a'],[/^yellow card/i,'#f5c400'],[/^red card/i,'#e5484d']];
function sigSvg(h){
  const cd=CARDS.find(x=>x[0].test(h));
  if(cd)return`<svg class="sigsvg" viewBox="0 0 64 80" role="img" aria-label="${esc(h)}"><rect x="19" y="14" width="28" height="42" rx="4" fill="${cd[1]}" transform="rotate(8 33 35)" stroke="#0003"/><rect x="21" y="16" width="6" height="38" rx="3" fill="#fff" opacity=".22" transform="rotate(8 33 35)"/></svg>`;
  const po=POSE.find(x=>x[0].test(h));if(!po)return'';const p=po[1];
  const sx=22,sy=27,L1=17,L2=15,sk='#f1c7a0',sh='var(--brand)';
  const arm=(side,a)=>{const x=side===1?42:sx,rad=d=>d*Math.PI/180,ex=x+side*L1*Math.sin(rad(a[0])),ey=sy+L1*Math.cos(rad(a[0])),hx=ex+side*L2*Math.sin(rad(a[1])),hy=ey+L2*Math.cos(rad(a[1]));
    return`<path d="M${x} ${sy}L${ex.toFixed(1)} ${ey.toFixed(1)}L${hx.toFixed(1)} ${hy.toFixed(1)}" fill="none" stroke="${sh}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="3.6" fill="${sk}"/>`};
  const leg=p.leg?`<path d="M38 50L52 62L56 74" fill="none" stroke="#1d2b3c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`:`<path d="M38 50L40 76" stroke="#1d2b3c" stroke-width="7" stroke-linecap="round"/>`;
  const bt=p.t?`<text x="8" y="76" font-size="${p.t.length>2?9:12}" font-weight="700" style="fill:var(--ink)">${p.t}</text>`:'';
  return`<svg class="sigsvg" viewBox="0 0 64 80" role="img" aria-label="${esc(h)}"><path d="M26 50L24 76" stroke="#1d2b3c" stroke-width="7" stroke-linecap="round"/>${leg}
  <rect x="22" y="22" width="20" height="30" rx="8" fill="${sh}"/>${arm(-1,p.L)}${arm(1,p.R)}
  <circle cx="32" cy="12" r="8.5" fill="${sk}"/><path d="M23.5 11a8.5 8.5 0 0117 0z" fill="#1d2b3c"/><circle cx="29" cy="13" r="1" fill="#1d2b3c"/><circle cx="35" cy="13" r="1" fill="#1d2b3c"/>
  <rect x="34.5" y="15.2" width="6.5" height="3.2" rx="1.4" fill="#f5b50a"/><circle cx="36" cy="16.8" r="1.5" fill="#c98d00"/>${bt}</svg>`;
}
const SIGSEC=/^Umpire signals|^Personal penalties/;

// ---------- chart: smooth area, hover read-out, average line, best / lowest labels ----------
const CH={};
function chartInto(id,pts,o){
  CH[id]={pts,o:o||{}};drawChart(id);
}
function drawChart(id){
  const el=$(id),c=CH[id];if(!el||!c)return;const pts=c.pts;if(!pts.length){el.innerHTML='';return}
  const W=Math.max(260,el.clientWidth||320),H=230,L=38,R=14,T=16,B=28,iw=W-L-R,ih=H-T-B;
  const x=i=>L+(pts.length>1?i*iw/(pts.length-1):iw/2),y=v=>T+ih*(1-Math.max(0,Math.min(100,v))/100);
  const avg=pts.reduce((a,p)=>a+p.pct,0)/pts.length;
  const xy=pts.map((p,i)=>[x(i),y(p.pct)]);
  // smooth curve (monotone-ish Catmull-Rom with the control points clamped so it never overshoots the data)
  let d='M'+xy[0][0]+' '+xy[0][1];
  for(let i=0;i<xy.length-1;i++){const p0=xy[i-1]||xy[i],p1=xy[i],p2=xy[i+1],p3=xy[i+2]||p2,t=.18;
    const c1=[p1[0]+(p2[0]-p0[0])*t,Math.max(T,Math.min(T+ih,p1[1]+(p2[1]-p0[1])*t))],c2=[p2[0]-(p3[0]-p1[0])*t,Math.max(T,Math.min(T+ih,p2[1]-(p3[1]-p1[1])*t))];
    d+=`C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`}
  const area=d+`L${xy[xy.length-1][0]} ${T+ih}L${xy[0][0]} ${T+ih}Z`;
  const mx=pts.reduce((a,p,i)=>p.pct>pts[a].pct?i:a,0),mn=pts.reduce((a,p,i)=>p.pct<pts[a].pct?i:a,0),step=Math.ceil(pts.length/Math.max(2,Math.floor(iw/54)));
  const lab=(i,cl,dy)=>`<text x="${xy[i][0]}" y="${xy[i][1]+dy}" text-anchor="${i===0?'start':i===pts.length-1?'end':'middle'}" class="cl ${cl}">${Math.round(pts[i].pct)}%</text>`;
  const gid='g'+id;
  el.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="chs" role="img" aria-label="${esc(c.o.title||'Attendance chart')}">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity=".32"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>
  ${[0,25,50,75,100].map(g=>`<line x1="${L}" x2="${W-R}" y1="${y(g)}" y2="${y(g)}" class="gl${g===0?' base':''}"/><text x="${L-6}" y="${y(g)+4}" text-anchor="end">${g}</text>`).join('')}
  <line x1="${L}" x2="${W-R}" y1="${y(avg)}" y2="${y(avg)}" class="avg"/><text x="${W-R}" y="${y(avg)-5}" text-anchor="end" class="avgt">avg ${Math.round(avg)}%</text>
  <path d="${area}" fill="url(#${gid})"/><path d="${d}" class="ln" pathLength="1"/>
  ${pts.length<=36?xy.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.6" class="dt"/>`).join(''):''}
  ${pts.length>1?lab(mx,'hi',-9)+(mn!==mx?lab(mn,'lo',17):''):''}
  ${pts.map((p,i)=>i%step===0||i===pts.length-1?`<text x="${x(i)}" y="${H-8}" text-anchor="${i===0?'start':i===pts.length-1?'end':'middle'}">${esc(p.l)}</text>`:'').join('')}
  <line class="xh" y1="${T}" y2="${T+ih}" x1="0" x2="0" hidden/><circle class="hd" r="6" hidden/>
  <rect x="${L-6}" y="${T}" width="${iw+12}" height="${ih+6}" fill="transparent" class="hit"/></svg><div class="tip" hidden></div>`;
  const svg=el.firstChild,tip=el.lastChild,xh=svg.querySelector('.xh'),hd=svg.querySelector('.hd');
  const move=e=>{const r=svg.getBoundingClientRect(),px=(e.clientX-r.left)*(W/r.width);let i=Math.round((px-L)/(iw/Math.max(1,pts.length-1)));i=Math.max(0,Math.min(pts.length-1,i));
    xh.setAttribute('x1',xy[i][0]);xh.setAttribute('x2',xy[i][0]);hd.setAttribute('cx',xy[i][0]);hd.setAttribute('cy',xy[i][1]);xh.hidden=hd.hidden=false;
    tip.innerHTML=`<b>${esc(pts[i].tip)}</b>`;tip.hidden=false;const tw=tip.offsetWidth,left=Math.max(0,Math.min(W-tw,xy[i][0]*(r.width/W)-tw/2));tip.style.left=left+'px';tip.style.top=Math.max(0,xy[i][1]*(r.height/H)-44)+'px'};
  const hide=()=>{xh.hidden=hd.hidden=tip.hidden=true};
  const hit=svg.querySelector('.hit');hit.addEventListener('pointermove',move);hit.addEventListener('pointerdown',move);hit.addEventListener('pointerleave',hide);
}
let _rz;window.addEventListener('resize',()=>{clearTimeout(_rz);_rz=setTimeout(()=>Object.keys(CH).forEach(drawChart),120)});

// ---------- sharing: any app (system share sheet), with a fallback list of common apps ----------
const to91=p=>{const n=String(p||'').replace(/\D/g,'');return n.length===10?'91'+n:n};
function shareLinks(text,title,phone){
  const t=encodeURIComponent(text),ph=to91(phone);
  return[['💬','WhatsApp','https://wa.me/?text='+t],...(ph?[['📲','WhatsApp to '+phone,'https://wa.me/'+ph+'?text='+t]]:[]),['✈️','Telegram','https://t.me/share/url?url=%20&text='+t],['✉️','Email','mailto:?subject='+encodeURIComponent(title||'Inter IIT Hockey')+'&body='+t],['📱','SMS (text message)','sms:'+(phone?String(phone).replace(/[^0-9+]/g,''):'')+'?&body='+t]];
}
function shareDlg(){let d=$('shdlg');if(!d){d=document.createElement('dialog');d.id='shdlg';document.body.appendChild(d)}return d}
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch(x){}a.remove();return ok}}
// body of a share dialog: editable text + native share + other apps + copy
function shareBody(d,text,title,phone,head){
  d.innerHTML=`${head||`<h2>Share</h2>`}<p><textarea id="shx" rows="9"></textarea></p><div class="shl" id="shl"></div><div class="ctl"><button class="pri" id="shn" ${navigator.share?'':'hidden'}>⤴ Share to any app…</button><button id="shc">📋 Copy</button><button id="shz">Close</button></div><p id="shm" class="mute" role="status"></p>`;
  $('shx').value=text;const cur=()=>$('shx').value;
  const draw=()=>{$('shl').innerHTML=shareLinks(cur(),title,phone).map((l,i)=>`<a class="shb" href="${l[2]}" target="_blank" rel="noopener"><span>${l[0]}</span>${esc(l[1])}</a>`).join('')};draw();$('shx').oninput=draw;
  $('shn').onclick=async()=>{try{await navigator.share({title:title||'Inter IIT Hockey',text:cur()})}catch(e){}};
  $('shc').onclick=async()=>{$('shm').textContent=(await copyText(cur()))?'Copied. Paste it in any app.':'Could not copy. Select the text and copy it.'};
  $('shz').onclick=()=>d.close();
}
async function shareText(text,title,phone){
  if(navigator.share){try{await navigator.share({title:title||'Inter IIT Hockey',text});return}catch(e){if(e&&e.name==='AbortError')return}}
  const d=shareDlg();shareBody(d,text,title,phone);d.showModal();
}
function appShareText(){return'🏑 *Inter IIT Hockey: Attendance app*\nSchedule, attendance and rules for the team.\nOpen: '+location.origin+location.pathname.replace(/index\.html$/,'')+'\nLog in with your roll number. Tip: tap "Install app" or "Add to Home Screen" to use it like an app.'}
const shareApp=()=>shareText(appShareText(),'Inter IIT Hockey app');

// ---------- attendance reports: whole team, a month, a date or one person -> any app ----------
const pbar=p=>'▓'.repeat(Math.round(p/10))+'░'.repeat(10-Math.round(p/10));
function reportText(sc,v){
  const td=dlong(today());
  if(sc==='date')return attMsg(v);
  if(sc==='person'){
    const pl=[...P,...RM].find(x=>x.id===v);if(!pl)return'';const a=statsFor(pl,'all');
    const ms=months().map(m=>{const s=statsFor(pl,m);return s.t?`• ${mfmt(m)}: ${s.pr}/${s.t} (${s.pct}%)`:''}).filter(Boolean);
    const rec=dates().reverse().filter(d=>SS[d][v]!==undefined).slice(0,12).map(d=>`${SS[d][v]?'✅':'❌'} ${dlong(d)}`);
    return`🏑 *Inter IIT Hockey: Attendance of ${pl.name}*\n${pl.roll?'Roll no: '+pl.roll+'\n':''}📅 Till ${td}\n\n*Overall: ${a.pr}/${a.t} days (${a.pct}%)*\n${pbar(a.pct)}\n\n*Month by month*\n${ms.join('\n')||'-'}\n\n*Recent days*\n${rec.join('\n')||'-'}`;
  }
  const m=sc==='month'?v:'all',st=stats(m).filter(x=>x.t).sort((a,b)=>b.pct-a.pct||b.pr-a.pr),tp=st.reduce((a,x)=>a+x.t,0),tr=tp?Math.round(st.reduce((a,x)=>a+x.pr,0)*100/tp):0;
  const live=dates().filter(d=>m==='all'||d.startsWith(m));
  const dl=m==='all'?'':'\n\n*Day by day*\n'+live.map(d=>{const q=P.filter(p=>SS[d][p.id]!==undefined),pr=q.filter(p=>SS[d][p.id]).length;return`${fmt(d)}: ${pr}/${q.length} present`}).join('\n');
  const medal=['🥇','🥈','🥉'];
  return`🏑 *Inter IIT Hockey: Attendance report*\n📅 ${m==='all'?'Overall, till '+td:mfmt(m)}\n🗓 Playing days: ${rdays(m)}\n📈 Team turnout: ${tr}%\n\n`+st.map((x,i)=>`${medal[i]||(i+1)+'.'} ${x.p.name} ${x.pr}/${x.t} (${x.pct}%) ${pbar(x.pct)}`).join('\n')+dl;
}
function statsFor(p,m){let t=0,pr=0;const j=(p.joined||'0000-00').slice(0,7);
  for(const k in L)if((m==='all'||k===m)&&j<=k){t+=L[k].days;pr+=(L[k].att[p.id]||0)}
  for(const d in SS)if(m==='all'||d.startsWith(m)){const r=SS[d][p.id];if(r!==undefined){t++;if(r)pr++}}
  return{p,pr,t,pct:t?Math.round(pr*100/t):0}}
function openReport(pre){
  const d=shareDlg(),adm=admin;
  const scopes=adm?[['team','Whole team, overall'],['month','A month'],['date','A playing day'],['person','One person']]:[['person','My attendance']];
  const head=`<h2>Share attendance report</h2><div class="ctl"><label class="fl" style="flex:1;margin:0">What to send<select id="rsc">${scopes.map(s=>`<option value="${s[0]}">${s[1]}</option>`).join('')}</select></label><label class="fl" id="rvw" style="flex:1;margin:0"><span id="rvl"></span><select id="rv"></select></label></div>`;
  shareBody(d,'','Attendance report','',head);
  let phn='';
  const links=()=>{$('shl').innerHTML=shareLinks($('shx').value,'Attendance report',phn).map(l=>`<a class="shb" href="${l[2]}" target="_blank" rel="noopener"><span>${l[0]}</span>${esc(l[1])}</a>`).join('')};
  const upd=()=>{const sc=$('rsc').value,v=$('rv').value,pl=sc==='person'?P.find(p=>p.id===v):null;phn=adm&&pl&&pl.contact||'';$('shx').value=reportText(sc,v);links()};
  const fill=()=>{const sc=$('rsc').value,rv=$('rv');$('rvw').hidden=sc==='team';
    if(sc==='month'){$('rvl').textContent='Month';rv.innerHTML=months().slice().reverse().map(m=>`<option value="${m}">${mfmt(m)}</option>`).join('')}
    else if(sc==='date'){$('rvl').textContent='Date';rv.innerHTML=dates().slice().reverse().map(x=>`<option value="${x}">${dlong(x)}</option>`).join('')}
    else if(sc==='person'){$('rvl').textContent='Person';rv.innerHTML=(adm?P:P.filter(p=>p.id===me)).map(p=>`<option value="${p.id}">${esc(p.name)}${p.roll?' · '+esc(p.roll):''}</option>`).join('')}
    if(pre&&pre.sc===sc&&pre.v)rv.value=pre.v;upd()};
  if(pre&&scopes.some(s=>s[0]===pre.sc))$('rsc').value=pre.sc;
  $('rsc').onchange=fill;$('rv').onchange=upd;$('shx').oninput=links;
  fill();d.showModal();
}
