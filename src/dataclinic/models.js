'use strict';

function resetFeatures(){
  const target=$('modelTarget').value;
  const eligible=roles.map((setting,i)=>({i,label:data.headers[i],role:setting.role})).filter(f=>{
    if(String(f.i)===target)return false;
    if(f.role==='measure')return true;
    return f.role==='group' && new Set(data.rows.map(r=>r[f.i].trim())).size<=30;
  }).sort((a,b)=>Number(b.role==='measure')-Number(a.role==='measure'));
  for(const set of ['A','B']){
    const box=$('features'+set);box.replaceChildren();
    eligible.forEach((feature,pos)=>{
      const label=el('label'),input=el('input');
      input.type='checkbox';input.value=feature.i;input.checked=pos<(set==='A'?1:2);
      label.append(input,document.createTextNode(feature.label));box.append(label);
    });
    if(!eligible.length)box.textContent='선택 가능한 입력 변수가 없습니다.';
  }
  clearModel();
}

function clearModel(){
  $('modelResult').replaceChildren();$('modelNotice').textContent='';
  $('modelRun').disabled=$('modelTarget').value==='';
}

function foldAssignments(size){
  const order=Array.from({length:size},(_,i)=>i),folds=new Array(size);
  let seed=42;
  for(let i=size-1;i>0;i--){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const k=Math.floor((seed/4294967296)*(i+1));
    [order[i],order[k]]=[order[k],order[i]];
  }
  order.forEach((idx,i)=>{folds[idx]=i%5;});return folds;
}

function makeEncoder(train,features){
  const columns=[];
  for(const i of features){
    if(roles[i].role==='measure'){
      const values=train.filter(r=>!missing(r[i])).map(r=>Number(r[i]));
      if(!values.length)continue;
      const mean=values.reduce((a,v)=>a+v/values.length,0);
      const sd=Math.sqrt(values.reduce((a,v)=>a+(v-mean)**2/values.length,0));
      if(sd>0)columns.push(r=>missing(r[i])?0:(Number(r[i])-mean)/sd);
    }else{
      const levels=new Set(train.map(r=>r[i].trim()));
      for(const level of levels)columns.push(r=>Number(r[i].trim()===level));
    }
  }
  if(columns.length>80)throw Error('범주를 펼친 입력 열이 80개를 넘습니다. 변수 조합을 줄여 주세요.');
  return row=>[1,...columns.map(column=>column(row))];
}

// 표준화한 연속형 입력과 원-핫 범주로 릿지 회귀를 적합한다. 절편에는 벌점을 주지 않는다.
function fitFold(train,target,features){
  const encode=makeEncoder(train,features);
  const dim=encode(train[0]).length;
  const matrix=Array.from({length:dim},()=>new Float64Array(dim));
  const rhs=new Float64Array(dim);
  for(let i=1;i<dim;i++)matrix[i][i]=1;
  for(const row of train){
    const x=encode(row), y=Number(row[target]);
    for(let i=0;i<dim;i++){
      if(!x[i])continue;
      rhs[i]+=x[i]*y;
      for(let j=0;j<=i;j++)matrix[i][j]+=x[i]*x[j];
    }
  }
  // Cholesky 분해 후 전진·후진 대입
  for(let i=0;i<dim;i++){
    for(let j=0;j<=i;j++){
      let value=matrix[i][j];
      for(let k=0;k<j;k++)value-=matrix[i][k]*matrix[j][k];
      matrix[i][j]=i===j?Math.sqrt(value):value/matrix[j][j];
    }
    for(let j=0;j<i;j++)rhs[i]-=matrix[i][j]*rhs[j];
    rhs[i]/=matrix[i][i];
  }
  for(let i=dim-1;i>=0;i--){
    for(let j=i+1;j<dim;j++)rhs[i]-=matrix[j][i]*rhs[j];
    rhs[i]/=matrix[i][i];
  }
  return row=>encode(row).reduce((s,v,i)=>s+v*rhs[i],0);
}

function compareModels(){
  clearModel();
  const target=+$('modelTarget').value;
  const records=data.rows.filter(r=>!missing(r[target]));
  if(records.length<5){$('modelNotice').textContent='5겹 검증에는 목표값이 기록된 행이 5개 이상 필요합니다.';return;}
  const choices=['A','B'].map(set=>[...$('features'+set).querySelectorAll('input:checked')].map(input=>Number(input.value)));
  const sets=[[],...choices], totals=[0,0,0], folds=foldAssignments(records.length);
  try{
    for(let fold=0;fold<5;fold++){
      const train=records.filter((_,i)=>folds[i]!==fold),test=records.filter((_,i)=>folds[i]===fold);
      sets.forEach((features,k)=>{
        const predict=fitFold(train,target,features);
        for(const row of test) totals[k]+=Math.abs(predict(row)-Number(row[target]));
      });
    }
    const errors=totals.map(n=>n/records.length);
    if(!errors.every(Number.isFinite))throw Error('입력 범위에서 안정적으로 계산할 수 없습니다.');
    table('modelResult',['모델','사용한 입력 변수','평균 절대오차 (MAE)','같은 평가 행 수'],sets.map((set,i)=>[
      ['기준','조합 A','조합 B'][i],set.map(j=>data.headers[j]).join(', ')||'입력 없음 · 학습 평균',format(errors[i]),records.length]));
    const delta=errors[2]-errors[1];
    const diff=new Intl.NumberFormat('ko-KR',{maximumSignificantDigits:3}).format(Math.abs(delta));
    $('modelNotice').textContent='목표는 '+data.headers[target]+'입니다. '+(Math.abs(delta)<1e-10?'두 조합의 평균 절대오차가 같습니다.':'조합 B의 오차가 A보다 '+diff+'만큼 '+(delta>0?'큽니다.':'작습니다.'))+' 목표값이 없는 '+(data.rows.length-records.length)+'행은 평가에서 제외했습니다.';
  }catch(err){$('modelNotice').textContent=err.message;}
}

