
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
  renderAll(rawData);
}

function buildFilter(){
  const sel = document.getElementById('filterEstablecimiento');
  sel.innerHTML = `<option value="ALL">Todos los establecimientos</option>` + 
    rawData.establecimientos.map(x=>`<option value="${x.ESTABLECIMIENTO}">${x.ESTABLECIMIENTO}</option>`).join('');
  sel.addEventListener('change', ()=> renderAll(rawData));
}

function iconFor(label){
  const map = {
    'Atenciones':'fa-notes-medical','Atendidos':'fa-users','Concentración':'fa-wave-square','Calidad HIS':'fa-shield-halved',
    'Establecimientos':'fa-hospital','UPS registradas':'fa-layer-group','Profesionales':'fa-user-doctor','Periodo':'fa-calendar-days'
  };
  return map[label] || 'fa-chart-simple';
}

function kpiCard(label,value,hint){
  return `<article class="kpi">
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
      plugins:{legend:{labels:{color:'#dbeafe'}}, tooltip:{backgroundColor:'rgba(6,17,31,.95)',borderColor:'rgba(255,255,255,.2)',borderWidth:1}},
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
}

function renderPlotly(d){
  const y = d.heatmap.rows.map(r=>r.establecimiento);
  const x = d.heatmap.groups;
  const z = y.map(e=>x.map(g=>d.heatmap.rows.find(r=>r.establecimiento===e)[g]));
  Plotly.newPlot('heatmap',[{x,y,z,type:'heatmap',colorscale:[[0,'#071426'],[.5,'#3877ff'],[1,'#50f5a8']],hoverongaps:false}],{
    paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',
    font:{color:'#dbeafe'},margin:{l:150,r:20,t:10,b:80}
  },{displayModeBar:false,responsive:true});
  Plotly.newPlot('gauge',[{type:'indicator',mode:'gauge+number',value:d.kpis.calidad,
    number:{suffix:'%'},gauge:{axis:{range:[0,100]},bar:{color:'#50f5a8'},bgcolor:'rgba(255,255,255,.05)',bordercolor:'rgba(255,255,255,.15)',
    steps:[{range:[0,70],color:'rgba(255,92,138,.25)'},{range:[70,90],color:'rgba(255,209,102,.22)'},{range:[90,100],color:'rgba(80,245,168,.20)'}]}}],
    {paper_bgcolor:'rgba(0,0,0,0)',font:{color:'#dbeafe'},margin:{l:30,r:30,t:20,b:20}},
    {displayModeBar:false,responsive:true});
}

function renderTables(d){
  const estCols = [{title:'Establecimiento',data:'ESTABLECIMIENTO'},{title:'Atenciones',data:'atenciones',render:x=>fmt.format(x)},{title:'Atendidos',data:'atendidos',render:x=>fmt.format(x)},{title:'Concentración',data:'concentracion'}];
  const upsCols = [{title:'UPS',data:'UPS_DESCRIPCION'},{title:'Atenciones',data:'atenciones',render:x=>fmt.format(x)},{title:'Atendidos',data:'atendidos',render:x=>fmt.format(x)},{title:'Concentración',data:'concentracion'}];
  if($.fn.DataTable.isDataTable('#tablaEstablecimientos')) $('#tablaEstablecimientos').DataTable().destroy();
  if($.fn.DataTable.isDataTable('#tablaUps')) $('#tablaUps').DataTable().destroy();
  $('#tablaEstablecimientos').DataTable({data:d.establecimientos,columns:estCols,pageLength:6,order:[[1,'desc']]});
  $('#tablaUps').DataTable({data:d.ups,columns:upsCols,pageLength:6,order:[[1,'desc']]});
}

function renderAlerts(d){
  document.getElementById('alerts').innerHTML = d.alerts.map(a=>`
    <div class="alert ${a.type}">
      <small>${a.title}</small>
      <strong>${fmt.format(a.value)}</strong>
      <p>${a.decision}</p>
    </div>`).join('');
}

function renderInsights(d){
  document.getElementById('insights').innerHTML = d.insights.map((x,i)=>`
    <div class="insight"><strong>Insight ${i+1}</strong><p>${x}</p></div>`).join('');
}

function renderAll(d){
  renderKPIs(d); renderCharts(d); renderPlotly(d); renderTables(d); renderAlerts(d); renderInsights(d);
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
