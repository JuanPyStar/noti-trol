// Noti-Trol PRO
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
// fecha
try{$('#today').textContent=new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'short',year:'numeric'})+' · Cúcuta 27°C';}catch{}
// tema (robusto: sin localStorage no debe romper el botón)
const root=document.documentElement,tb=document.getElementById('themeBtn');
function getSaved(){try{return localStorage.getItem('nt-theme');}catch(e){return null;}}
function setSaved(v){try{localStorage.setItem('nt-theme',v);}catch(e){}}
function paint(){const d=root.dataset.theme==='dark';tb.textContent=d?'☀️ Claro':'🌙 Oscuro';}
const saved=getSaved();if(saved){root.dataset.theme=saved;}paint();
tb.addEventListener('click',()=>{const n=root.dataset.theme==='dark'?'light':'dark';root.dataset.theme=n;setSaved(n);paint();});
// filtros portada + conteo
const chips=$$('.chip'),q=$('#q'),res=$('#resCount');
function apply(){const f=$('.chip.active').dataset.filter,t=(q.value||'').toLowerCase().trim();let n=0;
$$('.sport').forEach(s=>{const okS=f==='all'||s.dataset.sport===f;let vis=false;
s.querySelectorAll('.card').forEach(c=>{const ok=okS&&(!t||c.dataset.tags.includes(t));c.style.display=ok?'':'none';if(ok){vis=true;n++;}});
s.style.display=vis?'':'none';});res.textContent=n+' historias'+(t?` para "${q.value}"`:'')+' · actualizado hace 5 min';}
chips.forEach(c=>c.onclick=()=>{chips.forEach(x=>x.classList.remove('active'));c.classList.add('active');apply();});
q.addEventListener('input',apply);apply();
// bloc: tabs + leídas + contador
const list=$('#notifList'),count=$('#notifCount');
function refresh(){const u=list.querySelectorAll('li:not(.read)').length;count.textContent=u;count.style.display=u?'':'none';}
list.onclick=e=>{const li=e.target.closest('li');if(li){li.classList.toggle('read');refresh();}};
$('#btnClear').onclick=()=>{list.querySelectorAll('li').forEach(li=>li.classList.add('read'));refresh();toast('Bloc marcado como leído ✔');};
$$('.bt').forEach(b=>b.onclick=()=>{$$('.bt').forEach(x=>x.classList.remove('active'));b.classList.add('active');const t=b.dataset.t;list.querySelectorAll('li').forEach(li=>li.style.display=(t==='all'||li.dataset.sport===t)?'':'none');});
$('#btnNotif').onclick=()=>$('#blocPanel').scrollIntoView({behavior:'smooth',block:'center'});
refresh();
// scores → filtran
$$('.score').forEach((s,i)=>s.onclick=()=>{const map=['futbol','baloncesto','tenis','ciclismo','f1'];chips.forEach(x=>x.classList.toggle('active',x.dataset.filter===map[i]));apply();document.getElementById(map[i]).scrollIntoView({behavior:'smooth'});});
// rango
const nv=$('#nivel'),out=$('#nivelOut');nv.oninput=()=>out.textContent=nv.value;
// toast + top
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(()=>t.hidden=true,3200);}
const top=$('#top');addEventListener('scroll',()=>top.classList.toggle('show',scrollY>700));top.onclick=()=>scrollTo({top:0,behavior:'smooth'});
// form
$('#formAlertas').addEventListener('submit',e=>{e.preventDefault();const f=e.target;
if(!f.nombre.value.trim()||f.nombre.value.trim().length<3)return toast('Revisa el nombre (mín. 3 letras).');
if(!f.email.checkValidity())return toast('Correo inválido.');
if(!f.deporte.value)return toast('Elige tu deporte favorito.');
if(!f.querySelector('[name=canal]:checked'))return toast('Elige un canal.');
$('#formOk').hidden=false;const li=document.createElement('li');
li.innerHTML=`<span class="dot"></span><div><strong>${f.deporte.value.toUpperCase()} · ALERTA ACTIVADA</strong><p>Hola ${f.nombre.value.trim()}, avisos ${f.hora.value} por ${[...f.querySelectorAll('[name=canal]:checked')].map(c=>c.value).join(', ')}</p><time>ahora mismo</time></div>`;
list.prepend(li);$$('.bt').forEach(x=>x.classList.toggle('active',x.dataset.t==='all'));list.querySelectorAll('li').forEach(x=>x.style.display='');refresh();toast('🔔 Alerta creada en el bloc');f.reset();out.textContent='3';});
