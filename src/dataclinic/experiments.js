'use strict';

const roleLabels = {measure:'측정값', group:'집단', id:'식별자', date:'날짜', other:'기타'};
const schoolCsv = [
  '학생번호,반,학습시간,시험점수',
  '001,A,8,98','002,A,7,92','003,A,6,90','004,A,8,94','005,A,4,결시','006,A,5,결시',
  '007,B,3,80','008,B,4,82','009,B,5,84','010,B,6,86','011,B,7,88','012,B,8,90'
].join('\n');
let rawSource, roles = [], setupConfirmed = true, currentExperiment = 'clean';

function suggestRole(header, values) {
  if (/(^id$|[_ -]id$|번호|식별|아이디|환자키)/i.test(header)) return 'id';
  if (/날짜|일자|date/i.test(header) || (values.length && values.every(v=>/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(v)))) return 'date';
  if (/코드|code|group|집단|유형|형태|연령대|성별|학년|^반$/i.test(header)) return 'group';
  if (values.some(v=>/^0\d+$/.test(v))) return 'id';
  if (values.length && values.every(numeric)) return 'measure';
  if (values.length && new Set(values).size <= 30) return 'group';
  return 'other';
}

function configureSource(parsed, uploaded) {
  rawSource = parsed;
  roles = parsed.headers.map((header,i)=>{
    const values = parsed.rows.map(row=>row[i].trim()).filter(Boolean);
    const tokens = [...new Set(values.filter(v=>/^(na|n\/a|null|결시|미응시)$/i.test(v)))];
    return {role:suggestRole(header, values.filter(v=>!tokens.includes(v))), tokens};
  });
  setupConfirmed = !uploaded;
  const editor = $('schemaRows');
  editor.replaceChildren();
  roles.forEach(({role,tokens},i)=>{
    const line=el('div');line.className='schemaLine';
    const title=el('strong',parsed.headers[i]);
    const preview=[...new Set(parsed.rows.slice(0,40).map(r=>r[i]).filter(Boolean))].slice(0,3);
    title.append(el('small',preview.join(' · ')));
    const menu=el('select');menu.setAttribute('aria-label',parsed.headers[i]+' 역할');
    for(const [key,label] of Object.entries(roleLabels))menu.add(new Option(label,key));
    menu.value=role;
    const input=el('input');input.type='text';input.value=tokens.join(', ');input.placeholder='예: NA, 미응시';
    input.setAttribute('aria-label',parsed.headers[i]+' 결측 표기');
    line.append(title,menu,input);editor.append(line);
  });
  $('schema').open=uploaded;
  $('schemaMessage').textContent=uploaded?'열 역할과 결측 표기를 확인한 뒤 적용하세요.':'예시의 열 설정을 적용했습니다.';
}

function normalizedSource() {
  const tokens=roles.map(s=>new Set(s.tokens));
  return {headers:rawSource.headers,rows:rawSource.rows.map(row=>row.map((v,i)=>tokens[i].has(v.trim())?'':v))};
}

function commitSchema() {
  const proposed=[...$('schemaRows').children].map(line=>({
    role:line.querySelector('select').value,
    tokens:[...new Set(line.querySelector('input').value.split(',').map(v=>v.trim()).filter(Boolean))]
  }));
  for(const [i,setting] of proposed.entries()) {
    if(setting.role!=='measure')continue;
    const invalid=rawSource.rows.map(r=>r[i].trim()).find(v=>v && !setting.tokens.includes(v) && !numeric(v));
    if(invalid!==undefined){
      $('schemaMessage').textContent='‘'+rawSource.headers[i]+'’에 숫자로 읽을 수 없는 ‘'+invalid+'’이 있습니다. 결측 표기 또는 역할을 확인하세요.';return;
    }
  }
  roles=proposed;setupConfirmed=true;
  $('schemaMessage').textContent='열 역할과 결측 표기를 적용했습니다.';
  refreshSource();
  $('schema').open=false;
}

function switchExperiment(name) {
  currentExperiment=name;
  for(const key of ['clean','rank','model']){
    $('view-'+key).setAttribute('aria-pressed',String(name===key));
    $('section-'+key).hidden=!setupConfirmed || name!==key;
  }
  $('action').hidden=!setupConfirmed || name!=='clean' || $('lab').hidden;
  $('experimentNav').hidden=!setupConfirmed;
  $('generalChart').hidden=!setupConfirmed || name!=='clean';
  $('introTitle').textContent={clean:'정제 의사결정 실험실',rank:'집단별 평균과 순위',model:'예측 변수 비교'}[name];
  $('introText').textContent={clean:'결측치를 처리하기 전에 세 가지 방법의 영향을 예측해 보세요.',rank:'처리 기준을 바꾸면 어느 집단의 순위가 달라지는지 확인하세요.',model:'같은 평가 행에서 입력 변수를 바꾸며 예측 오차를 비교하세요.'}[name];
  document.dispatchEvent(new Event('summarychange'));
}

function prepareExperiments(){
  const measures=[],groups=[];
  roles.forEach(({role},i)=>{
    if(role==='measure' && data.rows.some(r=>!missing(r[i]))) measures.push([i,data.headers[i]]);
    if(role==='group')groups.push([i,data.headers[i]]);
  });
  options('rankValue',measures);options('rankGroup',groups);options('modelTarget',measures);
  const last=measures.at(-1);
  if(last){$('rankValue').value=String(last[0]);$('modelTarget').value=String(last[0]);}
  $('rankPolicy').value='mean';
  $('rankResult').replaceChildren();$('rankMessage').textContent='';
  updateRank();resetFeatures();switchExperiment(currentExperiment);
}

function ranked(items, field){
  const sorted=items.filter(x=>x[field]!==null).slice().sort((a,b)=>b[field]-a[field]);
  let previous, rank=0; const result=new Map();
  sorted.forEach((item,i)=>{
    if(i===0 || Math.abs(previous-item[field])>1e-12*Math.max(1,Math.abs(item[field]),Math.abs(previous))){
      rank=i+1;previous=item[field];
    }
    result.set(item.key,rank);
  });
  return result;
}

function updateRank(){
  $('rankResult').replaceChildren();
  if($('rankValue').value==='' || $('rankGroup').value===''){
    $('rankMessage').textContent='측정값 열과 집단 열을 각각 하나 이상 지정하세요.';return;
  }
  const col=+$('rankValue').value,g=+$('rankGroup').value,policy=$('rankPolicy').value;
  const baseline=describe(data.rows,col), fill=policy==='zero'?0:baseline[policy];
  const groups=new Map();
  for(const row of data.rows){
    const key=row[g].trim()||null;
    if(!groups.has(key))groups.set(key,{key,n:0,known:0,sum:0});
    const r=groups.get(key);r.n++;
    if(!missing(row[col])){r.known++;r.sum+=Number(row[col]);}
  }
  const details=[...groups.values()];
  for(const r of details){r.before=r.known?r.sum/r.known:null;r.after=(r.sum+(r.n-r.known)*fill)/r.n;}
  const original=ranked(details,'before'),changed=ranked(details,'after');
  const changedGroups=details.filter(r=>original.get(r.key)!==changed.get(r.key));
  table('rankResult',['집단','원본값 / 전체','결측 제외 평균','기존 순위','처리 후 평균','처리 후 순위'],
    details.sort((a,b)=>changed.get(a.key)-changed.get(b.key)).map(r=>[r.key??'(집단 미기록)',r.known+' / '+r.n,format(r.before),original.get(r.key)??'산출 불가',format(r.after),changed.get(r.key)]));
  const top=map=>details.filter(r=>map.get(r.key)===1).map(r=>r.key??'(집단 미기록)').join(' · ');
  $('rankMessage').textContent='결측 제외 기준 1위는 '+top(original)+', 선택 기준 1위는 '+top(changed)+'입니다. '+(changedGroups.length?'순위가 달라지거나 새로 산출된 집단은 '+changedGroups.length+'개입니다.':'순위가 유지됩니다.')+' 대체에 사용한 값은 '+format(fill)+'입니다.';
}

function cleanedOutput(col,method){
  const rows=[],headers=[...rawSource.headers];
  let flag=headers[col]+'_값출처';while(headers.includes(flag))flag+='_';headers.push(flag);
  rawSource.rows.forEach((raw,i)=>{
    const absent=missing(data.rows[i][col]);if(absent && method==='drop')return;
    const row=raw.slice();if(absent)row[col]=String(base[method]);
    rows.push([...row,absent?names[method]:'원본값']);
  });
  return {headers,rows};
}

function exportCleaned(){
  if(!committed)return;
  const {headers,rows}=committed;
  save(filename+'_정제.csv','\uFEFF'+csv(headers,rows),'text/csv;charset=utf-8');
}

