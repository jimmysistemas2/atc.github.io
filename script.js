
const fmt = new Intl.NumberFormat('es-PE');
let rawData, currentData;

const palette = ['#26d9ff','#3877ff','#9b5cff','#50f5a8','#ffd166','#ff5c8a','#8be9fd','#c084fc'];

async function init(){
  rawData = await fetch('data.json').then(r=>r.json());
  currentData = rawData;
  document.getElementById('title').textContent = rawData.metadata.title;
  document.getElementById('subtitle').textContent = rawData.metadata.subtitle;
  document.getElementById('periodo').textContent = rawData.metadata.periodo;
  buildFilter();
  currentData = getScopedData();
  renderAll(currentData);
}

function getScopedData(){
  const sel = document.getElementById('filterEstablecimiento');
  const selected = sel?.value || 'Todos los establecimientos';
  if(selected === 'Todos los establecimientos' || selected === 'ALL') return rawData;
  return rawData.byEstablecimiento?.[selected] || rawData;
}

function buildFilter(){
  const sel = document.getElementById('filterEstablecimiento');
  const items = rawData.filters?.establecimientos || ['Todos los establecimientos', ...rawData.establecimientos.map(x=>x.ESTABLECIMIENTO)];
  sel.innerHTML = items.map((x,i)=>`<option value="${x}">${i===0 ? 'Toda la RIS Ate' : x}</option>`).join('');
  sel.addEventListener('change', ()=>{
    currentData = getScopedData();
    document.body.classList.add('scope-changing');
    setTimeout(()=>document.body.classList.remove('scope-changing'), 450);
    renderAll(currentData);
    showScopeToast(currentData.metadata.scope || sel.value);
  });
}

function showScopeToast(scope){
  let toast = document.getElementById('scopeToast');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'scopeToast';
    toast.className = 'scope-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-filter"></i><span>Vista actual: <b>${scope === 'Todos los establecimientos' ? 'Toda la RIS Ate' : scope}</b></span>`;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 2100);
}

function iconFor(label){
  const map = {
    'Atenciones':'fa-notes-medical','Atendidos':'fa-users','Concentración':'fa-wave-square','Calidad HIS':'fa-shield-halved',
    'Establecimientos':'fa-hospital','UPS registradas':'fa-layer-group','Profesionales':'fa-user-doctor','Periodo':'fa-calendar-days'
  };
  return map[label] || 'fa-chart-simple';
}

function kpiCard(label,value,hint){
  const numeric = Number(String(value).replace(/[^0-9.]/g,'')) || 0;
  const ring = label === 'Calidad HIS' ? Math.min(numeric,100) : label === 'Concentración' ? Math.min(numeric*20,100) : 76;
  return `<article class="kpi">
    <div class="kpi-ring" style="--p:${ring}"><span></span></div>
    <div class="label">${label}</div>
    <div class="value counter" data-target="${String(value).replace(/[^0-9.]/g,'')}" data-original="${value}">${value}</div>
    <div class="hint">${hint}</div>
    <i class="fa-solid ${iconFor(label)} icon"></i>
  </article>`;
}

function animateCounters(){
  document.querySelectorAll('.counter').forEach(el=>{
    const original = el.dataset.original || el.textContent;
    const target = Number(el.dataset.target);
    if(!target || original.includes('-')) { el.textContent = original; return; }
    let start = 0;
    const duration = 950;
    const t0 = performance.now();
    function tick(now){
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(start + (target - start) * eased);
      el.textContent = original.includes('%') ? val + '%' : fmt.format(val);
      if(p < 1) requestAnimationFrame(tick); else el.textContent = original;
    }
    requestAnimationFrame(tick);
  });
}

function renderKPIs(d){
  const k = d.kpis;
  document.getElementById('resumen').innerHTML = [
    kpiCard('Atenciones', fmt.format(k.atenciones), 'Producción asistencial total'),
    kpiCard('Atendidos', fmt.format(k.atendidos), 'Personas únicas normalizadas'),
    kpiCard('Concentración', k.concentracion, 'Atenciones por atendido'),
    kpiCard('Calidad HIS', k.calidad + '%', 'Índice compuesto validado'),
    kpiCard('Establecimientos', fmt.format(k.establecimientos), 'Cobertura operativa'),
    kpiCard('UPS registradas', fmt.format(k.ups), 'Servicios productivos'),
    kpiCard('Profesionales', fmt.format(k.profesionales), 'RRHH que atiende'),
    kpiCard('Periodo', d.metadata.periodo, 'Corte de información')
  ].join('');
  animateCounters();
}

function makeChart(id, type, labels, datasets, options={}){
  const ctx = document.getElementById(id);
  if(ctx.chart) ctx.chart.destroy();
  ctx.chart = new Chart(ctx, {
    type, data:{labels,datasets}, options:{
      responsive:true, maintainAspectRatio:false,
      animation:{duration:900,easing:'easeOutQuart'},
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{color:'#dbeafe',usePointStyle:true,boxWidth:9}}, tooltip:{backgroundColor:'rgba(6,17,31,.95)',borderColor:'rgba(255,255,255,.2)',borderWidth:1,padding:12,cornerRadius:12}},
      scales: type === 'doughnut' || type === 'radar' ? {} : {
        x:{ticks:{color:'#9fb4ce'}, grid:{color:'rgba(255,255,255,.07)'}},
        y:{ticks:{color:'#9fb4ce'}, grid:{color:'rgba(255,255,255,.07)'}}
      },
      ...options
    }
  });
}

function renderCharts(d){
  makeChart('trendChart','line',d.monthly.map(x=>x.periodo),[
    {label:'Atenciones',data:d.monthly.map(x=>x.atenciones),borderColor:palette[0],backgroundColor:'rgba(38,217,255,.14)',fill:true,tension:.4},
    {label:'Atendidos',data:d.monthly.map(x=>x.atendidos),borderColor:palette[3],backgroundColor:'rgba(80,245,168,.08)',fill:true,tension:.4}
  ]);
  makeChart('donutChart','doughnut',d.grupoServicio.map(x=>x.GRUPO_SERVICIO),[
    {data:d.grupoServicio.map(x=>x.atenciones),backgroundColor:palette,borderColor:'rgba(255,255,255,.12)'}
  ]);
  makeChart('courseChart','bar',d.cursoVida.map(x=>x.CURSO_VIDA_VALIDADO),[
    {label:'Atenciones',data:d.cursoVida.map(x=>x.atenciones),backgroundColor:'rgba(38,217,255,.55)'},
    {label:'Atendidos',data:d.cursoVida.map(x=>x.atendidos),backgroundColor:'rgba(80,245,168,.50)'}
  ]);
  makeChart('radarChart','radar',d.grupoServicio.map(x=>x.GRUPO_SERVICIO),[
    {label:'Demanda',data:d.grupoServicio.map(x=>x.atenciones),borderColor:palette[2],backgroundColor:'rgba(155,92,255,.22)',pointBackgroundColor:palette[0]}
  ],{scales:{r:{grid:{color:'rgba(255,255,255,.12)'},angleLines:{color:'rgba(255,255,255,.12)'},pointLabels:{color:'#dbeafe'},ticks:{color:'#9fb4ce',backdropColor:'transparent'}}}});
  makeChart('conditionChart','bar',d.condicion.map(x=>x.CONDICION_VALIDADA),[
    {label:'Atenciones',data:d.condicion.map(x=>x.atenciones),backgroundColor:'rgba(155,92,255,.55)'}
  ],{indexAxis:'y'});

  if(document.getElementById('riskChart') && d.advancedInsights){
    const riskItems = d.advancedInsights.slice(0,10);
    makeChart('riskChart','bar',riskItems.map(x=>x.category),[
      {label:'Score de riesgo',data:riskItems.map(x=>x.riskScore),backgroundColor:'rgba(255,92,138,.52)'}
    ],{indexAxis:'y'});
    const counts = d.advancedInsights.reduce((acc,x)=>{acc[x.priority]=(acc[x.priority]||0)+1;return acc;},{});
    makeChart('priorityChart','doughnut',Object.keys(counts),[
      {data:Object.values(counts),backgroundColor:['#ff5c8a','#ffd166','#50f5a8'],borderColor:'rgba(255,255,255,.12)'}
    ]);
  }
}

function renderPlotly(d){
  const y = d.heatmap.rows.map(r=>r.establecimiento);
  const x = d.heatmap.groups;
  const z = y.map(e=>x.map(g=>d.heatmap.rows.find(r=>r.establecimiento===e)[g]));
  Plotly.newPlot('heatmap',[{x,y,z,type:'heatmap',colorscale:[[0,'#071426'],[.5,'#3877ff'],[1,'#50f5a8']],hoverongaps:false}],{
    paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',
    font:{color:'#dbeafe'},margin:{l:170,r:20,t:10,b:80},
    transition:{duration:450,easing:'cubic-in-out'}
  },{displayModeBar:false,responsive:true});
  Plotly.newPlot('gauge',[{type:'indicator',mode:'gauge+number',value:d.kpis.calidad,
    number:{suffix:'%'},gauge:{axis:{range:[0,100]},bar:{color:'#50f5a8'},bgcolor:'rgba(255,255,255,.05)',bordercolor:'rgba(255,255,255,.15)',
    steps:[{range:[0,70],color:'rgba(255,92,138,.25)'},{range:[70,90],color:'rgba(255,209,102,.22)'},{range:[90,100],color:'rgba(80,245,168,.20)'}]}}],
    {paper_bgcolor:'rgba(0,0,0,0)',font:{color:'#dbeafe'},margin:{l:30,r:30,t:20,b:20}},
    {displayModeBar:false,responsive:true});
}

function barCell(value, max, accent='cyan'){
  const pct = max ? Math.round((value / max) * 100) : 0;
  return `
    <div class="bar-cell">
      <div class="bar-top"><strong>${fmt.format(value)}</strong><span>${pct}%</span></div>
      <div class="bar-track"><i class="${accent}" style="width:${pct}%"></i></div>
    </div>`;
}

function badgeCell(value){
  const v = Number(value) || 0;
  const cls = v >= 4 ? 'hot' : v >= 2.5 ? 'mid' : 'low';
  return `<span class="metric-badge ${cls}">${v}</span>`;
}

function visualListItem(item, labelKey, max, icon){
  const atenciones = Number(item.atenciones || 0);
  const atendidos = Number(item.atendidos || 0);
  const concentracion = Number(item.concentracion || 0);
  const pct = max ? Math.round((atenciones / max) * 100) : 0;
  const risk = concentracion >= 4 ? 'alto' : concentracion >= 2.5 ? 'medio' : 'bajo';
  const riskText = concentracion >= 4 ? 'Alta recurrencia' : concentracion >= 2.5 ? 'Recurrencia media' : 'Controlado';

  return `
    <article class="exec-rank-card">
      <div class="exec-rank-icon"><i class="fa-solid ${icon}"></i></div>
      <div class="exec-rank-body">
        <div class="exec-rank-head">
          <strong>${item[labelKey]}</strong>
          <span>${pct}%</span>
        </div>
        <div class="exec-rank-bar"><i style="width:${pct}%"></i></div>
        <div class="exec-rank-metrics">
          <div><small>Atenciones</small><b>${fmt.format(atenciones)}</b></div>
          <div><small>Atendidos</small><b>${fmt.format(atendidos)}</b></div>
          <div><small>Concentración</small><b>${concentracion}</b></div>
          <div class="risk ${risk}"><small>Lectura</small><b>${riskText}</b></div>
        </div>
      </div>
    </article>`;
}

function renderTables(d){
  const estBox = document.getElementById('rankingEstablecimientosVisual');
  const upsBox = document.getElementById('rankingUpsVisual');

  if(estBox){
    const maxEst = Math.max(...(d.establecimientos || []).map(x=>x.atenciones), 1);
    estBox.innerHTML = (d.establecimientos || [])
      .slice(0,8)
      .map(x => visualListItem(x, 'ESTABLECIMIENTO', maxEst, 'fa-hospital'))
      .join('');
  }

  if(upsBox){
    const maxUps = Math.max(...(d.ups || []).map(x=>x.atenciones), 1);
    upsBox.innerHTML = (d.ups || [])
      .slice(0,8)
      .map(x => visualListItem(x, 'UPS_DESCRIPCION', maxUps, 'fa-layer-group'))
      .join('');
  }
}

function renderAlerts(d){
  document.getElementById('alerts').innerHTML = d.alerts.map(a=>`
    <div class="alert ${a.type}">
      <small>${a.title}</small>
      <strong>${fmt.format(a.value)}</strong>
      <p>${a.decision}</p>
    </div>`).join('');
}

let currentPriority = 'ALL';

function renderInsights(d){
  const all = d.advancedInsights || [];
  const filtered = currentPriority === 'ALL' ? all : all.filter(x=>x.priority === currentPriority);
  const high = all.filter(x=>x.priority === 'Alta').length;
  const med = all.filter(x=>x.priority === 'Media').length;
  const avgRisk = all.length ? Math.round(all.reduce((s,x)=>s+(x.riskScore||0),0)/all.length) : 0;
  const maxRisk = all.length ? Math.max(...all.map(x=>x.riskScore||0)) : 0;

  const summary = document.getElementById('insightSummary');
  if(summary){
    summary.innerHTML = `
      <div class="risk-pill"><small>Insights detectados</small><strong>${fmt.format(all.length)}</strong></div>
      <div class="risk-pill"><small>Alta prioridad</small><strong>${fmt.format(high)}</strong></div>
      <div class="risk-pill"><small>Media prioridad</small><strong>${fmt.format(med)}</strong></div>
      <div class="risk-pill"><small>Score máximo</small><strong>${fmt.format(maxRisk)}</strong></div>
    `;
  }

  document.getElementById('insights').innerHTML = filtered.map((x)=>`
    <article class="insight-card">
      <div class="insight-icon"><i class="fa-solid ${x.icon || 'fa-brain'}"></i></div>
      <div class="insight-content">
        <h4>${x.category}</h4>
        <p><b>Hallazgo:</b> ${x.finding}</p>
        <div class="insight-meta">
          <div class="meta-box"><small>Impacto</small>${x.impact}</div>
          <div class="meta-box"><small>Interpretación gerencial</small>${x.management}</div>
        </div>
        <div class="risk-meter"><span style="width:${Math.min(x.riskScore || 0,100)}%"></span></div>
      </div>
      <div class="badge-priority badge-${x.priority}">${x.priority}</div>
    </article>
  `).join('');

  document.querySelectorAll('.chip').forEach(btn=>{
    btn.onclick = () => {
      currentPriority = btn.dataset.priority;
      document.querySelectorAll('.chip').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderInsights(currentData);
    };
  });
}

function renderAll(d){
  document.getElementById('title').textContent = d.metadata.title || rawData.metadata.title;
  document.getElementById('subtitle').textContent = `${d.metadata.subtitle || rawData.metadata.subtitle} · ${d.metadata.scope || 'Todos los establecimientos'}`;
  document.getElementById('periodo').textContent = d.metadata.periodo || rawData.metadata.periodo;
  currentPriority = 'ALL';
  document.querySelectorAll('.chip').forEach((b,i)=>b.classList.toggle('active', i===0));
  renderKPIs(d);
  renderCharts(d);
  renderPlotly(d);
  renderTables(d);
  renderAlerts(d);
  renderVisualRanking(d);
  renderTrafficLights(d);
  renderPerformanceCards(d);
  renderInsights(d);
}

init();


// Premium UX interactions
function setupPremiumUX(){
  const loader = document.getElementById('loader');
  setTimeout(()=> loader?.classList.add('hidden'), 650);

  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting) entry.target.classList.add('visible');
    });
  },{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

  const sections = [...document.querySelectorAll('section[id]')];
  const navLinks = [...document.querySelectorAll('nav a')];
  const navObserver = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        navLinks.forEach(a=>a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
      }
    });
  },{threshold:.35});
  sections.forEach(s=>navObserver.observe(s));

  document.querySelectorAll('.panel,.kpi').forEach(card=>{
    card.addEventListener('mousemove', e=>{
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX-r.left}px`);
      card.style.setProperty('--my', `${e.clientY-r.top}px`);
    });
  });
}

window.addEventListener('load', setupPremiumUX);


function renderVisualRanking(d){
  const box = document.getElementById('visualRanking');
  if(!box) return;
  const selected = document.getElementById('filterEstablecimiento')?.value || 'Todos los establecimientos';
  const source = (selected === 'Todos los establecimientos' || selected === 'ALL') ? d.establecimientos : d.ups;
  const labelKey = (selected === 'Todos los establecimientos' || selected === 'ALL') ? 'ESTABLECIMIENTO' : 'UPS_DESCRIPCION';
  const max = Math.max(...source.map(x=>x.atenciones),1);
  box.innerHTML = source.slice(0,10).map((x,i)=>{
    const p = Math.round((x.atenciones/max)*100);
    return `<div class="rank-row">
      <div class="rank-num">${String(i+1).padStart(2,'0')}</div>
      <div class="rank-main">
        <div class="rank-title"><span>${x[labelKey]}</span><b>${fmt.format(x.atenciones)}</b></div>
        <div class="rank-track"><i style="width:${p}%"></i></div>
      </div>
      <div class="rank-chip">${p}%</div>
    </div>`;
  }).join('');
}

function renderTrafficLights(d){
  const box = document.getElementById('trafficLights');
  if(!box) return;
  const qDoc = d.quality?.documentos || {};
  const docObs = Object.entries(qDoc).filter(([k])=>k!=='VALIDO').reduce((s,[,v])=>s+v,0);
  const docPct = d.kpis.atenciones ? (docObs/d.kpis.atenciones)*100 : 0;
  const conc = Number(d.kpis.concentracion) || 0;
  const quality = Number(d.kpis.calidad) || 0;
  const upsNo = d.quality?.ups?.['No mapeadas'] || 0;
  const upsPct = d.kpis.atenciones ? (upsNo/d.kpis.atenciones)*100 : 0;
  const items = [
    {label:'Calidad HIS', value:quality.toFixed(1)+'%', state: quality>=94?'green':quality>=88?'yellow':'red', icon:'fa-shield-halved'},
    {label:'Concentración', value:conc, state: conc>=3.5?'red':conc>=2.5?'yellow':'green', icon:'fa-wave-square'},
    {label:'Doc. observados', value:docPct.toFixed(1)+'%', state: docPct>=10?'red':docPct>=5?'yellow':'green', icon:'fa-id-card'},
    {label:'UPS no mapeadas', value:upsPct.toFixed(1)+'%', state: upsPct>=5?'red':upsPct>=2?'yellow':'green', icon:'fa-diagram-project'}
  ];
  box.innerHTML = items.map(x=>`<div class="traffic ${x.state}">
    <div class="traffic-icon"><i class="fa-solid ${x.icon}"></i></div>
    <div><small>${x.label}</small><strong>${x.value}</strong></div>
    <span class="light"></span>
  </div>`).join('');
}

function renderPerformanceCards(d){
  const box = document.getElementById('performanceCards');
  if(!box) return;
  const cards = [
    {title:'IPRESS líder', value:d.establecimientos?.[0]?.ESTABLECIMIENTO || '—', sub:fmt.format(d.establecimientos?.[0]?.atenciones || 0)+' atenciones', icon:'fa-hospital', color:'cyan'},
    {title:'UPS líder', value:d.ups?.[0]?.UPS_DESCRIPCION || '—', sub:fmt.format(d.ups?.[0]?.atenciones || 0)+' atenciones', icon:'fa-layer-group', color:'violet'},
    {title:'Curso predominante', value:d.cursoVida?.[0]?.CURSO_VIDA_VALIDADO || '—', sub:fmt.format(d.cursoVida?.[0]?.atendidos || 0)+' atendidos', icon:'fa-users-viewfinder', color:'green'},
    {title:'Mayor riesgo', value:d.advancedInsights?.[0]?.category || '—', sub:d.advancedInsights?.[0]?.priority || 'Sin prioridad', icon:d.advancedInsights?.[0]?.icon || 'fa-triangle-exclamation', color:'red'}
  ];
  box.innerHTML = cards.map(c=>`<div class="perf-card ${c.color}">
    <i class="fa-solid ${c.icon}"></i>
    <small>${c.title}</small>
    <strong>${c.value}</strong>
    <span>${c.sub}</span>
  </div>`).join('');
}
