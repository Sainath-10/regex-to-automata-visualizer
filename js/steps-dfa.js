function tokenize(re){const t=[];for(let i=0;i<re.length;i++){const c=re[i];if('()*+?'.includes(c))t.push({type:'op',val:c});else t.push({type:'sym',val:c});}return t;}
function addConcat(toks){const out=[];for(let i=0;i<toks.length;i++){const t=toks[i];out.push(t);if(i+1<toks.length){const n=toks[i+1];const lOk=t.val!=='('&&t.val!=='+';const rOk=n.val!==')'&&n.val!=='+'&&n.val!=='*'&&n.val!=='?';if(lOk&&rOk)out.push({type:'op',val:'.'});}}return out;}
function toPostfix(toks){const prec={'+':1,'.':2,'?':3,'*':3};const out=[],stk=[];for(const t of toks){if(t.type==='sym'){out.push(t);}else if(t.val==='('){stk.push(t);}else if(t.val===')'){while(stk.length&&stk[stk.length-1].val!=='(')out.push(stk.pop());stk.pop();}else{const p=prec[t.val]||0;while(stk.length&&stk[stk.length-1].val!=='('&&(prec[stk[stk.length-1].val]||0)>=p)out.push(stk.pop());stk.push(t);}}while(stk.length)out.push(stk.pop());return out;}
let _sid=0;
function ns(acc=false){return{id:_sid++,accept:acc,trans:{}};}
function at(f,sym,t){if(!f.trans[sym])f.trans[sym]=[];f.trans[sym].push(t);}
function buildNFA(pf){_sid=0;const stk=[];for(const t of pf){if(t.type==='sym'){const s=ns(),e=ns(true);at(s,t.val,e);stk.push({start:s,end:e});}else if(t.val==='.'){const b=stk.pop(),a=stk.pop();a.end.accept=false;at(a.end,'ε',b.start);stk.push({start:a.start,end:b.end});}else if(t.val==='+'){const b=stk.pop(),a=stk.pop();const s=ns(),e=ns(true);at(s,'ε',a.start);at(s,'ε',b.start);a.end.accept=false;b.end.accept=false;at(a.end,'ε',e);at(b.end,'ε',e);stk.push({start:s,end:e});}else if(t.val==='*'){const a=stk.pop();const s=ns(),e=ns(true);a.end.accept=false;at(s,'ε',a.start);at(s,'ε',e);at(a.end,'ε',a.start);at(a.end,'ε',e);stk.push({start:s,end:e});}else if(t.val==='?'){const a=stk.pop();const s=ns(),e=ns(true);a.end.accept=false;at(s,'ε',a.start);at(s,'ε',e);at(a.end,'ε',e);stk.push({start:s,end:e});}}return stk[0];}
function collectStates(start){const map=new Map(),q=[start],seen=new Set();while(q.length){const s=q.shift();if(seen.has(s.id))continue;seen.add(s.id);map.set(s.id,s);for(const ts of Object.values(s.trans))for(const t of ts)if(!seen.has(t.id))q.push(t);}return map;}
function epsClosure(ids,map){const c=new Set(ids),stk=[...ids];while(stk.length){const id=stk.pop();const s=map.get(id);if(!s)continue;for(const t of(s.trans['ε']||[]))if(!c.has(t.id)){c.add(t.id);stk.push(t.id);}}return c;}
function moveSet(ids,sym,map){const r=new Set();for(const id of ids){const s=map.get(id);if(!s)continue;for(const t of(s.trans[sym]||[]))r.add(t.id);}return r;}

function buildDFATracked(nfa,alpha,smap){
  const sc=epsClosure([nfa.start.id],smap);
  const sk=[...sc].sort((a,b)=>a-b).join(',');
  const states=new Map();let did=0;
  states.set(sk,{id:did++,nfaStates:sc,trans:{},accept:false,key:sk});
  const q=[sc];const steps=[];
  while(q.length){
    const cur=q.shift();
    const ck=[...cur].sort((a,b)=>a-b).join(',');
    const cs=states.get(ck);
    for(const id of cur)if(smap.get(id)?.accept){cs.accept=true;break;}
    const stepTransitions={};
    for(const sym of alpha){
      const mv=moveSet(cur,sym,smap);
      const mvArr=[...mv].sort((a,b)=>a-b);
      if(!mv.size){stepTransitions[sym]={move:[],closure:[],dfaState:null,isNew:false};continue;}
      const cl=epsClosure([...mv],smap);
      const key=[...cl].sort((a,b)=>a-b).join(',');
      let isNew=false;
      if(!states.has(key)){states.set(key,{id:did++,nfaStates:cl,trans:{},accept:false,key});q.push(cl);isNew=true;}
      cs.trans[sym]=states.get(key).id;
      stepTransitions[sym]={move:mvArr,closure:[...cl].sort((a,b)=>a-b),dfaState:states.get(key).id,isNew};
    }
    steps.push({dfaState:cs,nfaSet:[...cur].sort((a,b)=>a-b),transitions:stepTransitions});
  }
  return{states,startKey:sk,alpha,steps};
}

function render(){
  const re=localStorage.getItem('pipeline_regex')||'(a+b)*abb';
  document.getElementById('regexDisplay').textContent=re;

  let toks=tokenize(re);toks=addConcat(toks);
  const pf=toPostfix(toks);
  const nfaFrag=buildNFA(pf);
  const smap=collectStates(nfaFrag.start);
  const alphaSet=new Set();
  for(const s of smap.values())for(const sym of Object.keys(s.trans))if(sym!=='ε')alphaSet.add(sym);
  const alpha=[...alphaSet].sort();
  const{states:dfaStates,startKey,steps}=buildDFATracked(nfaFrag,alpha,smap);

  // ε-closure table for each NFA state
  let ect=`<div style="overflow-x:auto;margin-top:12px;"><table class="stable"><thead><tr><th>NFA State</th><th>ε-closure (all reachable via ε only)</th><th>Accept?</th></tr></thead><tbody>`;
  for(const [id,st] of smap){
    const cl=epsClosure([id],smap);
    const clArr=[...cl].sort((a,b)=>a-b);
    ect+=`<tr><td><span style="font-family:var(--font-mono);color:var(--a2);font-weight:700">q${id}</span></td><td>{ ${clArr.map(i=>`<span class="nfa-badge">q${i}</span>`).join(' ')} }</td><td style="color:${st.accept?'var(--a4)':'var(--t3)'};">${st.accept?'Yes — accept state':'No'}</td></tr>`;
  }
  ect+=`</tbody></table></div>`;
  document.getElementById('epsilonClosureTable').innerHTML=ect;

  // Alphabet
  document.getElementById('alphabetDisplay').innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">${alpha.map(a=>`<span style="padding:5px 16px;border-radius:20px;background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);color:var(--a1);font-family:var(--font-mono);font-weight:700;font-size:.9rem">${a}</span>`).join('')}</div><p style="margin-top:10px;font-size:.85rem;">Σ = { ${alpha.join(', ')} } &nbsp;·&nbsp; ${alpha.length} symbol${alpha.length!==1?'s':''}</p>`;

  // Worklist steps
  let wl='';
  steps.forEach((step,i)=>{
    const{dfaState,nfaSet,transitions}=step;
    wl+=`<div class="worklist-item">
      <div class="wl-head">Processing D${dfaState.id} = { ${nfaSet.map(id=>`q${id}`).join(', ')} } ${dfaState.accept?'<span style="margin-left:8px;padding:2px 8px;border-radius:10px;background:rgba(245,158,11,.1);color:var(--a4);font-size:.72rem;border:1px solid rgba(245,158,11,.3)">Accept State</span>':''}</div>
      <div class="wl-body">`;
    for(const sym of alpha){
      const t=transitions[sym];
      if(!t||t.dfaState===null){
        wl+=`<div style="margin:3px 0">On <code>${sym}</code>: move = ∅ &nbsp;→&nbsp; <span style="color:var(--t3)">No transition (dead)</span></div>`;
      } else {
        wl+=`<div style="margin:3px 0">On <code>${sym}</code>: move({ ${nfaSet.map(i=>`q${i}`).join(',')} }, ${sym}) = { ${t.move.map(i=>`q${i}`).join(', ')} } &nbsp;→&nbsp; ε-closure = { ${t.closure.map(i=>`q${i}`).join(', ')} } &nbsp;=&nbsp; <span style="color:${t.isNew?'var(--a3)':'var(--a1)'};font-weight:700">D${t.dfaState}</span>${t.isNew?' <span style="color:var(--a3);font-size:.72rem">[new state]</span>':''}</div>`;
      }
    }
    wl+=`</div></div>`;
  });
  document.getElementById('worklistSteps').innerHTML=wl;

  // Final DFA table
  const startState=dfaStates.get(startKey);
  let ft=`<div style="overflow-x:auto;"><table class="stable"><thead><tr><th>DFA State</th><th>NFA Subset</th><th>Type</th>`;
  for(const a of alpha)ft+=`<th>On '${a}'</th>`;
  ft+=`</tr></thead><tbody>`;
  for(const s of dfaStates.values()){
    const isSt=s.id===startState.id;
    const isAc=s.accept;
    const nfaArr=[...s.nfaStates].sort((a,b)=>a-b);
    let typeLabel='';
    if(isSt&&isAc)typeLabel=`<span style="color:var(--a3);font-weight:700">Start &amp; Final</span>`;
    else if(isSt)typeLabel=`<span style="color:var(--a1);font-weight:700">Start State</span>`;
    else if(isAc)typeLabel=`<span style="color:var(--a4);font-weight:700">Final State</span>`;
    else typeLabel=`<span style="color:var(--t2)">Intermediate</span>`;
    ft+=`<tr class="${isSt?'highlighted':''}"><td class="${isSt&&isAc?'new':isSt?'hl':isAc?'hl2':''}">D${s.id}</td><td>{ ${nfaArr.map(i=>`<span class="nfa-badge">q${i}</span>`).join(' ')} }</td><td>${typeLabel}</td>`;
    for(const a of alpha){
      const t=s.trans[a];
      ft+=t!==undefined?`<td style="color:var(--t1)">D${t}</td>`:`<td class="dead-td">No transition</td>`;
    }
    ft+=`</tr>`;
  }
  ft+=`</tbody></table></div>`;
  document.getElementById('dfaFinalTable').innerHTML=ft;
}
render();
