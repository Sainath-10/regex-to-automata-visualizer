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
function buildDFA(nfa,alpha,smap){const sc=epsClosure([nfa.start.id],smap);const sk=[...sc].sort((a,b)=>a-b).join(',');const states=new Map();let did=0;states.set(sk,{id:did++,nfaStates:sc,trans:{},accept:false});const q=[sc];while(q.length){const cur=q.shift();const ck=[...cur].sort((a,b)=>a-b).join(',');const cs=states.get(ck);for(const id of cur)if(smap.get(id)?.accept){cs.accept=true;break;}for(const sym of alpha){const mv=moveSet(cur,sym,smap);if(!mv.size)continue;const cl=epsClosure([...mv],smap);const key=[...cl].sort((a,b)=>a-b).join(',');if(!states.has(key)){states.set(key,{id:did++,nfaStates:cl,trans:{},accept:false});q.push(cl);}cs.trans[sym]=states.get(key).id;}}return{states,startKey:sk,alpha};}

function minimizeDFATracked(dfa){
  const arr=[...dfa.states.values()];const n=arr.length;
  const idx=new Map(arr.map((s,i)=>[s.id,i]));
  const dist=Array.from({length:n},()=>new Array(n).fill(false));
  const reasons=Array.from({length:n},()=>new Array(n).fill(''));

  // Initial: accept vs non-accept
  const initPairs=[];
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    if(arr[i].accept!==arr[j].accept){
      dist[i][j]=dist[j][i]=true;
      reasons[i][j]=reasons[j][i]=`Base: one is accept (D${arr[i].accept?arr[i].id:arr[j].id}), one is not (D${arr[i].accept?arr[j].id:arr[i].id})`;
      initPairs.push({i,j,di:arr[i].id,dj:arr[j].id});
    }
  }

  // Iterative marking
  const iterations=[];
  let changed=true,iter=0;
  while(changed){
    changed=false;iter++;
    const iterMarked=[];
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      if(dist[i][j])continue;
      for(const sym of dfa.alpha){
        const ti=arr[i].trans[sym],tj=arr[j].trans[sym];
        if(ti===undefined&&tj===undefined)continue;
        if(ti===undefined||tj===undefined){
          dist[i][j]=dist[j][i]=true;changed=true;
          reasons[i][j]=reasons[j][i]=`On '${sym}': D${arr[i].id} has no transition, D${arr[j].id} goes to D${ti!==undefined?ti:tj}`;
          iterMarked.push({i,j,di:arr[i].id,dj:arr[j].id,sym,reason:reasons[i][j]});break;
        }
        const ii=idx.get(ti),ij=idx.get(tj);
        if(ii!==ij&&dist[ii][ij]){
          dist[i][j]=dist[j][i]=true;changed=true;
          reasons[i][j]=reasons[j][i]=`On '${sym}': D${arr[i].id}→D${ti}, D${arr[j].id}→D${tj}, and (D${ti},D${tj}) is already distinguished`;
          iterMarked.push({i,j,di:arr[i].id,dj:arr[j].id,sym,reason:reasons[i][j]});break;
        }
      }
    }
    if(iterMarked.length)iterations.push({iter,pairs:iterMarked});
    if(!changed)break;
  }

  // Groups
  const group=new Array(n).fill(-1);let gid=0;
  for(let i=0;i<n;i++){if(group[i]!==-1)continue;group[i]=gid;for(let j=i+1;j<n;j++)if(!dist[i][j])group[j]=gid;gid++;}
  const ms=new Map();
  for(let i=0;i<n;i++){
    const g=group[i];
    if(!ms.has(g))ms.set(g,{id:g,members:[],trans:{},accept:false,nfaStates:new Set()});
    const m=ms.get(g);m.members.push(arr[i].id);
    if(arr[i].accept)m.accept=true;
    for(const s of arr[i].nfaStates)m.nfaStates.add(s);
  }
  for(const[,m]of ms){
    const rep=arr[group.indexOf(m.id)];
    for(const sym of dfa.alpha){
      if(rep.trans[sym]!==undefined){const ti=idx.get(rep.trans[sym]);m.trans[sym]=group[ti];}
    }
  }
  const startS=dfa.states.get(dfa.startKey);
  return{states:ms,startGroup:group[idx.get(startS.id)],alpha:dfa.alpha,orig:n,dist,arr,idx,group,initPairs,iterations,reasons};
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
  const dfa=buildDFA(nfaFrag,alpha,smap);
  const startDFA=dfa.states.get(dfa.startKey);
  const{states:ms,startGroup,dist,arr,group,initPairs,iterations,reasons}=minimizeDFATracked(dfa);
  const n=arr.length;

  // Input DFA table
  let idt=`<div style="overflow-x:auto;"><table class="stable"><thead><tr><th>State</th><th>Type</th>`;
  for(const a of alpha)idt+=`<th>On '${a}'</th>`;
  idt+=`</tr></thead><tbody>`;
  for(const s of dfa.states.values()){
    const isSt=s.id===startDFA.id,isAc=s.accept;
    let typeLabel='';
    if(isSt&&isAc)typeLabel=`<span style="color:var(--a3);font-weight:700">Start &amp; Final</span>`;
    else if(isSt)typeLabel=`<span style="color:var(--a1);font-weight:700">Start State</span>`;
    else if(isAc)typeLabel=`<span style="color:var(--a4);font-weight:700">Final State</span>`;
    else typeLabel=`<span style="color:var(--t2)">Intermediate</span>`;
    idt+=`<tr><td class="hl-dfa">D${s.id}</td><td>${typeLabel}</td>`;
    for(const a of alpha){const t=s.trans[a];idt+=t!==undefined?`<td>D${t}</td>`:`<td class="hl-dead">No transition</td>`;}
    idt+=`</tr>`;
  }
  idt+=`</tbody></table></div>`;
  document.getElementById('inputDfaTable').innerHTML=idt;

  // Initial partition
  const acceptIds=arr.filter(s=>s.accept).map(s=>s.id);
  const nonAcceptIds=arr.filter(s=>!s.accept).map(s=>s.id);
  let ip=`<div style="display:flex;gap:14px;flex-wrap:wrap;margin:14px 0;">
    <div style="flex:1;min-width:200px;padding:14px 18px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:10px;">
      <div style="font-family:var(--font-mono);font-size:.95rem;color:var(--a4);font-weight:600;margin-bottom:8px;">Final (Accept) States</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${acceptIds.map(id=>`<span class="dfa-badge" style="background:rgba(245,158,11,.1);color:var(--a4);border-color:rgba(245,158,11,.3)">D${id}</span>`).join('')}</div>
    </div>
    <div style="flex:1;min-width:200px;padding:14px 18px;background:rgba(0,229,255,.04);border:1px solid rgba(0,229,255,.15);border-radius:10px;">
      <div style="font-family:var(--font-mono);font-size:.95rem;color:var(--a1);font-weight:600;margin-bottom:8px;">Non-Final States</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${nonAcceptIds.map(id=>`<span class="dfa-badge">D${id}</span>`).join('')}</div>
    </div>
  </div>`;
  ip+=`<p style="margin-top:8px;font-size:.85rem;">Immediately marked as distinguishable: <strong>${initPairs.length} pair${initPairs.length!==1?'s':''}</strong></p>`;
  if(initPairs.length){
    ip+=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${initPairs.map(p=>`<span style="padding:3px 10px;border-radius:10px;background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.2);color:var(--a5);font-family:var(--font-mono);font-size:.75rem">(D${p.di}, D${p.dj})</span>`).join('')}</div>`;
  }
  document.getElementById('initialPartition').innerHTML=ip;

  // Iteration steps
  let its='';
  if(iterations.length===0){
    its=`<div class="callout info"><span class="callout-icon">ℹ</span><p>No additional pairs found beyond the initial accept/non-accept split. All remaining pairs are indistinguishable.</p></div>`;
  } else {
    iterations.forEach(({iter,pairs})=>{
      its+=`<div class="iter-item"><div class="iter-head">Iteration ${iter} — ${pairs.length} new pair${pairs.length!==1?'s':''} marked</div><div class="iter-body">`;
      pairs.forEach(p=>{
        its+=`<div style="margin:4px 0;">Mark (D${p.di}, D${p.dj}) as distinguished — ${p.reason}</div>`;
      });
      its+=`</div></div>`;
    });
  }
  document.getElementById('iterationSteps').innerHTML=its;

  // Distinguishability matrix
  let mx=`<table class="matrix-table"><thead><tr><th></th>`;
  for(let j=0;j<n;j++)mx+=`<th>D${arr[j].id}</th>`;
  mx+=`</tr></thead><tbody>`;
  for(let i=0;i<n;i++){
    mx+=`<tr><th>D${arr[i].id}</th>`;
    for(let j=0;j<n;j++){
      if(i===j){mx+=`<td class="self">─</td>`;}
      else if(dist[i][j]){mx+=`<td class="marked" title="${reasons[i][j]}">✗</td>`;}
      else{mx+=`<td class="equiv">≡</td>`;}
    }
    mx+=`</tr>`;
  }
  mx+=`</tbody></table>`;
  document.getElementById('distMatrix').innerHTML=mx;

  // Equivalence classes
  const classMap=new Map();
  for(let i=0;i<n;i++){
    const g=group[i];
    if(!classMap.has(g))classMap.set(g,[]);
    classMap.get(g).push(arr[i].id);
  }
  let ec=`<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">`;
  for(const[g,members]of classMap){
    const mState=ms.get(g);
    const isMerged=members.length>1;
    ec+=`<div style="padding:14px 18px;background:var(--bg2);border:1px solid ${isMerged?'rgba(16,185,129,.3)':'var(--border)'};border-radius:10px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <span class="group-badge">M${g}</span>
      <span style="color:var(--t2);font-size:.82rem;">←</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${members.map(id=>`<span class="dfa-badge">D${id}</span>`).join(isMerged?`<span style="color:var(--a3);font-size:.8rem;align-self:center">+</span>`:'')}</div>
      ${isMerged?`<span style="padding:2px 10px;border-radius:10px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);color:var(--a3);font-size:.72rem;font-family:var(--font-mono)">merged</span>`:''}
      ${mState.accept?`<span style="padding:2px 10px;border-radius:10px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:var(--a4);font-size:.72rem;font-family:var(--font-mono)">final state</span>`:''}
    </div>`;
  }
  ec+=`</div>`;
  document.getElementById('equivClasses').innerHTML=ec;

  // Min-DFA table
  let mdt=`<div style="overflow-x:auto;"><table class="stable"><thead><tr><th>Min State</th><th>Original DFA States</th><th>Type</th>`;
  for(const a of alpha)mdt+=`<th>On '${a}'</th>`;
  mdt+=`</tr></thead><tbody>`;
  for(const s of ms.values()){
    const isSt=s.id===startGroup,isAc=s.accept;
    let typeLabel='';
    if(isSt&&isAc)typeLabel=`<span style="color:var(--a3);font-weight:700">Start &amp; Final</span>`;
    else if(isSt)typeLabel=`<span style="color:var(--a1);font-weight:700">Start State</span>`;
    else if(isAc)typeLabel=`<span style="color:var(--a4);font-weight:700">Final State</span>`;
    else typeLabel=`<span style="color:var(--t2)">Intermediate</span>`;
    mdt+=`<tr><td class="hl">M${s.id}</td><td style="color:var(--t2)">${s.members.map(id=>`<span class="dfa-badge" style="font-size:.7rem">D${id}</span>`).join(' ')}</td><td>${typeLabel}</td>`;
    for(const a of alpha){const t=s.trans[a];mdt+=t!==undefined?`<td style="color:var(--t1)">M${t}</td>`:`<td class="hl-dead">No transition</td>`;}
    mdt+=`</tr>`;
  }
  mdt+=`</tbody></table></div>`;
  document.getElementById('minDfaTable').innerHTML=mdt;

  // Summary
  const removed=n-ms.size;
  document.getElementById('minSummary').innerHTML=`<div style="display:flex;gap:12px;flex-wrap:wrap;">
    <div style="padding:12px 18px;background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);border-radius:10px;font-family:var(--font-mono);font-size:.85rem;color:var(--a1)">DFA states: <strong>${n}</strong></div>
    <div style="padding:12px 18px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:10px;font-family:var(--font-mono);font-size:.85rem;color:var(--a3)">Min-DFA states: <strong>${ms.size}</strong></div>
    <div style="padding:12px 18px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:10px;font-family:var(--font-mono);font-size:.85rem;color:var(--a4)">States removed: <strong>${removed}</strong></div>
  </div>`;
}
render();
