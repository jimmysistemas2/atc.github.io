
const fmt = new Intl.NumberFormat('es-PE');
let rawData, currentData;
let charts = {};
let state = {
  ipress: 'Todos los establecimientos',
  ups: null,
  course: null,
  month: null,
  mode: 'both'
};

async function init(){
  rawData = await fetch('data.json').then(r=>r.json());
  currentData = rawData;
  buildFilter();
  bindToolbar();
  render(currentData);
}

function scope(){
  if(state.ipress === 'Todos los establecimientos') return rawData;
  return rawData.byEstablecimiento?.[state.ipress] || rawData;
}

function buildFilter(){
  const sel = document.getElementById('filterEstablecimiento');
  const items = rawData.filters?.establecimientos || ['Todos los establecimientos'];
  sel.innerHTML = items.map((x,i)=>`<option value="${x}">${i===0?'Toda la RIS Ate':x}</option>`).join('');
  sel.value = state.ipress;
  sel.addEventListener('change', ()=>{
    state.ipress = sel.value;
    state.ups = null;
    state.course = null;
    state.month = null;
    currentData = scope();
    render(currentData);
    flash();
    decision('Filtro IPRESS aplicado', `Todo el dashboard se actualizó para: ${state.ipress === 'Todos los establecimientos' ? 'Toda la RIS Ate' : state.ipress}.`);
  });
}

function bindToolbar(){
  document.addEventListener('click', e=>{
    const btn = e.target.closest('.chart-mode');
    if(!btn) return;
    state.mode = btn.dataset.mode;
    document.querySelectorAll('.chart-mode').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    renderAttChart(currentData);
    decision('Vista del gráfico actualizada', `Ahora se muestra: ${btn.textContent.trim()}. Esta vista permite comparar producción, cobertura o intensidad de uso.`);
  });
}

function flash(){
  document.body.classList.add('scope-changing');
  setTimeout(()=>document.body.classList.remove('scope-changing'), 350);
}

function kpi(icon,title,value,cls,action){
  return `<button class="kpi ${cls||''}" data-kpi="${action}">
    <i class="fa-solid ${icon}"></i>
    <div><small>${title}</small><b>${value}</b><span>Click para analizar</span></div>
  </button>`;
}

function renderKpis(d){
  const box = document.getElementById('kpis');
  box.innerHTML = [
    kpi('fa-kit-medical','Total Atenciones',fmt.format(d.kpis.atenciones),'','atenciones'),
    kpi('fa-users','Total Atendidos',fmt.format(d.kpis.atendidos),'','atendidos'),
    kpi('fa-bullseye','Concentración',d.kpis.concentracion,'','concentracion'),
    kpi('fa-hospital','IPRESS Activas',d.kpis.establecimientos,'orange','ipress'),
    kpi('fa-building','UPS Activas',d.kpis.ups,'orange','ups'),
    kpi('fa-user-doctor','Profesionales Activos',fmt.format(d.kpis.profesionales),'blue','profesionales')
  ].join('');
  box.querySelectorAll('.kpi').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const type = btn.dataset.kpi;
      const title = btn.querySelector('small').textContent;
      const value = btn.querySelector('b').textContent;
      let msg = '';
      if(type==='atenciones') msg = `Producción total: ${value}. Sirve para dimensionar carga asistencial y turnos.`;
      if(type==='atendidos') msg = `Cobertura real: ${value} personas únicas. No debe confundirse con atenciones.`;
      if(type==='concentracion') msg = `Concentración: ${value}. Valores altos sugieren reconsulta, continuidad de tratamiento o presión asistencial.`;
      if(type==='ipress') msg = `IPRESS activas: ${value}. Revise ranking para priorizar soporte y supervisión.`;
      if(type==='ups') msg = `UPS activas: ${value}. Revise servicios de mayor demanda para reorganizar oferta.`;
      if(type==='profesionales') msg = `Profesionales activos: ${value}. Útil para analizar productividad y brechas RRHH.`;
      decision(title, msg);
    });
  });
}

function renderContext(){
  const box = document.getElementById('activeContext');
  if(!box) return;
  box.innerHTML = [
    `<span><i class="fa-solid fa-filter"></i> Vista: <b>${state.ipress==='Todos los establecimientos'?'Toda la RIS Ate':state.ipress}</b></span>`,
    state.ups ? `<span>UPS: <b>${state.ups}</b><button data-clear="ups">×</button></span>` : '',
    state.course ? `<span>Curso: <b>${state.course}</b><button data-clear="course">×</button></span>` : '',
    state.month ? `<span>Mes: <b>${state.month}</b><button data-clear="month">×</button></span>` : ''
  ].filter(Boolean).join('');
  box.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(btn.dataset.clear==='ups') state.ups=null;
      if(btn.dataset.clear==='course') state.course=null;
      if(btn.dataset.clear==='month') state.month=null;
      renderContext();
      decision('Filtro visual retirado', 'Se retiró el filtro visual seleccionado. Los indicadores principales se mantienen según IPRESS seleccionada.');
    });
  });
}

function makeBarcode(text){
  let out=''; const s=String(text||'RISATE');
  for(let i=0;i<55;i++){
    const code=s.charCodeAt(i%s.length)+i*11;
    const h=16+(code%14);
    const w=1+(code%3);
    out += `<span style="height:${h}px;width:${w}px"></span>`;
  }
  return out;
}

function renderIpress(d){
  const box = document.getElementById('rankIpress');
  box.innerHTML = (d.establecimientos||[]).slice(0,10).map((x,i)=>`
    <button class="ipress-row click" data-ipress="${x.ESTABLECIMIENTO}">
      <div class="num">${i+1}</div>
      <div class="name">${x.ESTABLECIMIENTO}</div>
      <div class="barcode">${makeBarcode(x.ESTABLECIMIENTO)}</div>
      <div class="val">${fmt.format(x.atenciones)}</div>
    </button>
  `).join('');
  box.querySelectorAll('.ipress-row').forEach(row=>{
    row.addEventListener('click', ()=>{
      state.ipress = row.dataset.ipress;
      state.ups = null; state.course = null; state.month = null;
      const sel = document.getElementById('filterEstablecimiento');
      if(sel) sel.value = state.ipress;
      currentData = scope();
      render(currentData);
      flash();
      decision('IPRESS seleccionada', `Se actualizó todo el dashboard para ${state.ipress}: KPIs, gráficos, ranking UPS, curso de vida, tendencia y alertas.`);
    });
  });
}

function renderUps(d){
  const icons=['fa-square-h','fa-people-group','fa-family','fa-person-pregnant','fa-brain','fa-lungs','fa-tooth','fa-apple-whole','fa-flask','fa-pills'];
  const box = document.getElementById('rankUps');
  box.innerHTML = (d.ups||[]).slice(0,10).map((x,i)=>`
    <button class="ups-row click ${state.ups===x.UPS_DESCRIPCION?'selected':''}" data-ups="${x.UPS_DESCRIPCION}">
      <b>${i+1}</b><i class="fa-solid ${icons[i%icons.length]}"></i>
      <div class="name">${x.UPS_DESCRIPCION}</div><span class="dot"></span>
      <div class="value">${fmt.format(x.atenciones)}</div>
    </button>
  `).join('');
  box.querySelectorAll('.ups-row').forEach(row=>{
    row.addEventListener('click', ()=>{
      state.ups = row.dataset.ups;
      renderContext();
      decision('UPS seleccionada', `La UPS ${state.ups} concentra demanda dentro del alcance actual. Evaluar capacidad instalada, turnos, RRHH y oportunidad de atención.`);
    });
  });
}

function chart(id,type,labels,datasets,extra={}){
  const el = document.getElementById(id);
  if(!el) return;
  if(charts[id]) charts[id].destroy();
  charts[id] = new Chart(el,{
    type,
    data:{labels,datasets},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      animation:{duration:900,easing:'easeOutQuart'},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{labels:{color:'#fff',usePointStyle:true}},
        tooltip:{
          backgroundColor:'rgba(3,12,19,.96)',
          borderColor:'rgba(35,224,211,.32)',
          borderWidth:1,
          padding:12
        }
      },
      onClick:(event, elements)=>{
        if(elements.length){
          const idx = elements[0].index;
          state.month = labels[idx];
          const v1 = datasets[0]?.data[idx] || 0;
          const v2 = datasets[1]?.data[idx] || 0;
          renderContext();
          decision('Punto del gráfico seleccionado', `Periodo ${state.month}: valor principal ${fmt.format(Number(v1))}${datasets[1] ? ' y valor comparativo ' + fmt.format(Number(v2)) : ''}. Útil para revisar incrementos, caídas o subregistro.`);
        }
      },
      scales:type==='line'?{
        x:{ticks:{color:'#fff'},grid:{color:'rgba(255,255,255,.08)'}},
        y:{ticks:{color:'#fff'},grid:{color:'rgba(255,255,255,.08)'}}
      }:{
        x:{ticks:{color:'#fff'},grid:{display:false}},
        y:{ticks:{color:'#fff'},grid:{color:'rgba(255,255,255,.08)'}}
      },
      ...extra
    }
  });
}

function renderAttChart(d){
  const m = d.monthly || [];
  const labels = m.map(x=>x.periodo.replace('2026-',''));
  let datasets;
  if(state.mode==='atenciones'){
    datasets=[{label:'Atenciones',data:m.map(x=>x.atenciones),backgroundColor:'#00b7b3',borderRadius:8}];
  } else if(state.mode==='atendidos'){
    datasets=[{label:'Atendidos',data:m.map(x=>x.atendidos),backgroundColor:'#f26a1b',borderRadius:8}];
  } else if(state.mode==='ratio'){
    datasets=[{label:'Concentración',data:m.map(x=>Number((x.atenciones/Math.max(x.atendidos,1)).toFixed(2))),backgroundColor:'#23e0d3',borderRadius:8}];
  } else {
    datasets=[
      {label:'Atenciones',data:m.map(x=>x.atenciones),backgroundColor:'#00b7b3',borderRadius:8},
      {label:'Atendidos',data:m.map(x=>x.atendidos),backgroundColor:'#f26a1b',borderRadius:8}
    ];
  }
  chart('attChart','bar',labels,datasets);
}

function renderCharts(d){
  const m = d.monthly || [];
  const labels = m.map(x=>x.periodo.replace('2026-',''));
  renderAttChart(d);
  chart('trend','line',labels,[
    {label:'Atenciones',data:m.map(x=>x.atenciones),borderColor:'#23e0d3',backgroundColor:'rgba(0,183,179,.38)',fill:true,tension:.45,pointBackgroundColor:'#fff',pointRadius:5,pointHoverRadius:8}
  ]);
  const days = 30;
  document.getElementById('p1').textContent = fmt.format(Math.round(d.kpis.atenciones/days));
  document.getElementById('p2').textContent = fmt.format(Math.round(d.kpis.atendidos/days));
  document.getElementById('p3').textContent = d.kpis.concentracion;
}

function lifeIcon(x){
  x=String(x).toLowerCase();
  if(x.includes('niño')) return 'fa-baby';
  if(x.includes('adolescente')) return 'fa-child-reaching';
  if(x.includes('joven')) return 'fa-user-graduate';
  if(x.includes('adulto mayor')) return 'fa-people-group';
  if(x.includes('adulto')) return 'fa-user-tie';
  return 'fa-users';
}

function renderCourse(d){
  const max = Math.max(...(d.cursoVida||[]).map(x=>x.atenciones),1);
  const box = document.getElementById('course');
  box.innerHTML = (d.cursoVida||[]).slice(0,5).map(x=>{
    const p = Math.round(x.atenciones/max*100);
    return `<button class="life click ${state.course===x.CURSO_VIDA_VALIDADO?'selected':''}" data-course="${x.CURSO_VIDA_VALIDADO}">
      <span>${x.CURSO_VIDA_VALIDADO}</span><i class="fa-solid ${lifeIcon(x.CURSO_VIDA_VALIDADO)}"></i>
      <b>${p}%</b><small>${fmt.format(x.atendidos)} atendidos</small>
      <div class="progress"><i style="width:${p}%"></i></div>
    </button>`;
  }).join('');
  box.querySelectorAll('.life').forEach(card=>{
    card.addEventListener('click', ()=>{
      state.course = card.dataset.course;
      renderContext();
      decision('Curso de vida seleccionado', `Grupo ${state.course}: priorice campañas, oferta y programación preventiva según esta población.`);
    });
  });
}

function renderAlerts(d){
  const box = document.getElementById('alerts');
  box.innerHTML = (d.alerts||[]).map((x,i)=>{
    const cls = i===0?'red':i===3?'green':'orange';
    const icon = i===3?'fa-circle-check':'fa-triangle-exclamation';
    return `<button class="alert ${cls} click">
      <i class="fa-solid ${icon}"></i><div><b>${fmt.format(x.value)}</b><small>${x.decision}</small></div>
    </button>`;
  }).join('');
  box.querySelectorAll('.alert').forEach(a=>{
    a.addEventListener('click', ()=> decision('Alerta de calidad', a.querySelector('small').textContent));
  });
}

function decision(title, text){
  const box = document.getElementById('decisionPanel');
  if(!box) return;
  const topUps = currentData.ups?.[0]?.UPS_DESCRIPCION || 'No definido';
  const topIpress = currentData.establecimientos?.[0]?.ESTABLECIMIENTO || state.ipress;
  box.innerHTML = `
    <div class="decision-title"><i class="fa-solid fa-lightbulb"></i><b>${title}</b></div>
    <p>${text}</p>
    <div class="decision-grid">
      <span><small>IPRESS foco</small><b>${topIpress}</b></span>
      <span><small>UPS crítica</small><b>${topUps}</b></span>
      <span><small>Concentración</small><b>${currentData.kpis.concentracion}</b></span>
    </div>`;
}

function render(d){
  renderContext();
  renderKpis(d);
  renderIpress(d);
  renderUps(d);
  renderCharts(d);
  renderCourse(d);
  renderAlerts(d);
  decision('Lectura ejecutiva inicial', 'Haga clic en una IPRESS, UPS, curso de vida, KPI o barra del gráfico para activar análisis dinámico. Todos los elementos están vinculados al filtro actual.');
}

init();

// Menú móvil
document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.getElementById('mobileMenuBtn');
  const overlay=document.getElementById('sidebarOverlay');
  if(btn) btn.addEventListener('click',()=>document.body.classList.toggle('sidebar-open'));
  if(overlay) overlay.addEventListener('click',()=>document.body.classList.remove('sidebar-open'));
});
