const COLORS={a1:'#00e5ff',a2:'#8b5cf6',a3:'#10b981',a4:'#f59e0b',a5:'#f43f5e',t1:'#e8edf5',t2:'#8899b4',t3:'#3d5070'};

function tokenize(re){
  const t=[];
  for(let i=0;i<re.length;i++){
    const c=re[i];
    if('()*+?'.includes(c))t.push({type:'op',val:c});
    else t.push({type:'sym',val:c});
  }
  return t;
}
function addConcat(toks){
  const out=[];
  for(let i=0;i<toks.length;i++){
    const t=toks[i];out.push(t);
    if(i+1<toks.length){
      const n=toks[i+1];
      const lOk=t.val!=='('&&t.val!=='+';
      const rOk=n.val!==')'&&n.val!=='+'&&n.val!=='*'&&n.val!=='?';
      if(lOk&&rOk)out.push({type:'op',val:'.',implicit:true});
    }
  }
  return out;
}
function toPostfix(toks){
  const prec={'+':1,'.':2,'?':3,'*':3};
  const out=[],stk=[];
  for(const t of toks){
    if(t.type==='sym'){out.push(t);}
    else if(t.val==='('){stk.push(t);}
    else if(t.val===')'){
      while(stk.length&&stk[stk.length-1].val!=='(')out.push(stk.pop());
      stk.pop();
    } else {
      const p=prec[t.val]||0;
      while(stk.length&&stk[stk.length-1].val!=='('&&(prec[stk[stk.length-1].val]||0)>=p)out.push(stk.pop());
      stk.push(t);
    }
  }
  while(stk.length)out.push(stk.pop());
  return out;
}
let _sid=0;
function ns(acc=false){return{id:_sid++,accept:acc,trans:{}};}
function at(f,sym,t){if(!f.trans[sym])f.trans[sym]=[];f.trans[sym].push(t);}
function buildNFATracked(pf){
  _sid=0;const stk=[];const trace=[];
  for(const t of pf){
    if(t.type==='sym'){
      const s=ns(),e=ns(true);at(s,t.val,e);
      const frag={start:s,end:e};stk.push(frag);
      trace.push({tok:t.val,type:'symbol',desc:`Push fragment for symbol "${t.val}": create states q${s.id} and q${e.id}, add transition q${s.id} —${t.val}→ q${e.id}`,stackSize:stk.length,states:[s.id,e.id]});
    } else if(t.val==='.'){
      const b=stk.pop(),a=stk.pop();a.end.accept=false;at(a.end,'ε',b.start);
      const frag={start:a.start,end:b.end};stk.push(frag);
      trace.push({tok:'·',type:'concat',desc:`Pop two fragments (A and B). Connect A's accept state q${a.end.id} to B's start q${b.start.id} via ε. New fragment: q${a.start.id} → … → q${b.end.id}`,stackSize:stk.length});
    } else if(t.val==='+'){
      const b=stk.pop(),a=stk.pop();
      const s=ns(),e=ns(true);
      at(s,'ε',a.start);at(s,'ε',b.start);a.end.accept=false;b.end.accept=false;at(a.end,'ε',e);at(b.end,'ε',e);
      const frag={start:s,end:e};stk.push(frag);
      trace.push({tok:'+',type:'union',desc:`Pop two fragments (A, B). Create new start q${s.id} with ε to both. Create new accept q${e.id} receiving ε from both ends. Fragment: q${s.id} → q${e.id}`,stackSize:stk.length});
    } else if(t.val==='*'){
      const a=stk.pop();const s=ns(),e=ns(true);a.end.accept=false;
      at(s,'ε',a.start);at(s,'ε',e);at(a.end,'ε',a.start);at(a.end,'ε',e);
      const frag={start:s,end:e};stk.push(frag);
      trace.push({tok:'*',type:'star',desc:`Pop fragment A. Create new start q${s.id} and accept q${e.id}. q${s.id} ε→ A and q${s.id} ε→ q${e.id} (skip). A's end ε loops back and ε→ q${e.id}. Fragment: q${s.id} → q${e.id}`,stackSize:stk.length});
    } else if(t.val==='?'){
      const a=stk.pop();const s=ns(),e=ns(true);a.end.accept=false;
      at(s,'ε',a.start);at(s,'ε',e);at(a.end,'ε',e);
      const frag={start:s,end:e};stk.push(frag);
      trace.push({tok:'?',type:'opt',desc:`Pop fragment A. Create new start q${s.id} and accept q${e.id}. q${s.id} can ε-skip to q${e.id} or enter A. A's end ε→ q${e.id}.`,stackSize:stk.length});
    }
  }
  return{frag:stk[0],trace};
}
function collectStates(start){
  const map=new Map(),q=[start],seen=new Set();
  while(q.length){const s=q.shift();if(seen.has(s.id))continue;seen.add(s.id);map.set(s.id,s);for(const ts of Object.values(s.trans))for(const t of ts)if(!seen.has(t.id))q.push(t);}
  return map;
}

function opColor(op){
  if(op==='symbol')return COLORS.a1;
  if(op==='union')return COLORS.a2;
  if(op==='concat')return COLORS.a4;
  if(op==='star')return COLORS.a3;
  return COLORS.t2;
}

function render(){
  const re=localStorage.getItem('pipeline_regex')||'(a+b)*abb';
  document.getElementById('regexDisplay').textContent=re;

  // Tokenize
  const rawToks=tokenize(re);
  const withConcat=addConcat(rawToks);
  const pf=toPostfix(withConcat);
  const{frag,trace}=buildNFATracked(pf);
  const smap=collectStates(frag.start);

  // Token table
  let tt=`<table class="stable"><thead><tr><th>#</th><th>Character</th><th>Type</th><th>Description</th></tr></thead><tbody>`;
  rawToks.forEach((t,i)=>{
    const isOp=t.type==='op';
    const desc=t.val==='*'?'Kleene star — zero or more':t.val==='+'?'Union — either/or':t.val==='('?'Open group':t.val===')'?'Close group':t.val==='?'?'Optional — zero or one':`Input symbol "${t.val}"`;
    tt+=`<tr><td style="color:var(--t3)">${i+1}</td><td class="${isOp?'hl':'hl2'}" style="font-size:1.1rem">${t.val}</td><td style="color:${isOp?COLORS.a2:COLORS.a1}">${isOp?'Operator':'Symbol'}</td><td style="color:var(--t2)">${desc}</td></tr>`;
  });
  tt+=`</tbody></table>`;
  document.getElementById('tokenTable').innerHTML=tt;

  // Concat flow
  let cf=`<div class="postfix-flow">`;
  withConcat.forEach(t=>{
    if(t.implicit){cf+=`<span class="pf-tok pf-op" title="Implicit concatenation inserted here">·</span><span class="pf-arr">⟵ inserted</span>`;}
    else{cf+=`<span class="pf-tok ${t.type==='op'?'pf-op':'pf-sym'}">${t.val}</span>`;}
  });
  cf+=`</div>`;
  document.getElementById('concatFlow').innerHTML=cf;

  // Postfix
  let pff=`<div class="postfix-flow">`;
  pf.forEach((t,i)=>{pff+=`<span class="pf-tok ${t.type==='op'?'pf-op':'pf-sym'}">${t.val}</span>${i<pf.length-1?'<span class="pf-arr">·</span>':''}`});
  pff+=`</div>`;
  document.getElementById('postfixFlow').innerHTML=pff;

  // Stack trace
  let st=`<div class="steps-list">`;
  trace.forEach(step=>{
    const c=opColor(step.type);
    st+=`<div class="step-item"><p><strong style="color:${c}">[${step.tok}] ${step.type.toUpperCase()}</strong> — ${step.desc}<br/><span style="color:var(--t3);font-size:.78rem">Stack depth after: ${step.stackSize}</span></p></div>`;
  });
  st+=`</div>`;
  document.getElementById('stackTrace').innerHTML=st;

  // NFA table
  const allSyms=new Set();
  for(const s of smap.values())for(const sym of Object.keys(s.trans))allSyms.add(sym);
  const syms=[...allSyms].sort((a,b)=>a==='ε'?-1:b==='ε'?1:a.localeCompare(b));
  let nt=`<div class="state-table-wrap"><table class="stable"><thead><tr><th>State</th><th>Role</th>`;
  for(const s of syms)nt+=`<th>${s}</th>`;
  nt+=`</tr></thead><tbody>`;
  for(const s of smap.values()){
    const isStart=s.id===frag.start.id;
    const role=isStart&&s.accept?'Start & Accept':isStart?'Start State':s.accept?'Accept State':'Intermediate';
    const roleColor=isStart&&s.accept?COLORS.a3:isStart?COLORS.a1:s.accept?COLORS.a4:COLORS.t2;
    nt+=`<tr><td><span class="nfa-state-badge ${s.accept?'accept':''}">q${s.id}</span></td><td style="color:${roleColor};font-size:.82rem;font-family:var(--font-body)">${role}</td>`;
    for(const sym of syms){
      const ts=s.trans[sym];
      if(ts&&ts.length){nt+=`<td style="color:var(--t1)">${ts.map(t=>`q${t.id}`).join(', ')}</td>`;}
      else{nt+=`<td style="color:var(--t3)">—</td>`;}
    }
    nt+=`</tr>`;
  }
  nt+=`</tbody></table></div>`;
  document.getElementById('nfaTable').innerHTML=nt;
}
render();
