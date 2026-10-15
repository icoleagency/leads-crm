import { money } from './leadModel'
import { payoff, cashNet, BLANK_DEBT, BLANK_CREATIVE, STEPS, DECISIONS } from './creative'
import { LIGHT } from './dealMath'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', muted:'#88a0b4', green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff', purple:'#a78bfa'
}
const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0}
const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'8px 10px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'inherit'}
const lab = {color:C.muted,fontSize:11.5}
const chip = (on,col=C.orange) => ({background:on?col:'transparent',color:on?C.ink:C.muted,border:'1px solid '+(on?col:C.line),borderRadius:14,padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer'})
const sgn = v => (v<0?'−':'')+money(Math.abs(v))


export function StepBar({step,setStep,status,isMobile}){
  return (
    <div style={{display:'flex',gap:6,marginTop:16,overflowX:'auto',paddingBottom:2}}>
      {STEPS.map(([k,l],i)=>{
        const on = step===k, st = status[k]   // 'done' | 'warn' | undefined
        const col = st==='done' ? C.green : st==='warn' ? C.amber : C.muted
        return (
          <button key={k} onClick={()=>setStep(k)} style={{flex:isMobile?'0 0 auto':1,minWidth:isMobile?120:0,display:'flex',alignItems:'center',gap:8,background:on?C.panel:'transparent',border:'1px solid '+(on?C.orange:C.line),borderRadius:12,padding:'9px 11px',cursor:'pointer',textAlign:'left'}}>
            <span style={{width:22,height:22,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11.5,fontWeight:800,background:st==='done'?C.green:on?C.orange:C.ink,color:st==='done'||on?C.ink:col,border:'1px solid '+(st==='done'?C.green:on?C.orange:C.line)}}>{st==='done'?'✓':i+1}</span>
            <span style={{fontSize:12.5,fontWeight:700,color:on?C.cream:st?col:C.muted,whiteSpace:'nowrap'}}>{l}</span>
          </button>
        )
      })}
    </div>
  )
}

// What a step still needs before you move on.
export function StepNotes({items}){
  if(!items.length) return null
  return <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:5}}>
    {items.map(([s,t],i)=><div key={i} style={{fontSize:12.5,color:s==='red'?C.red:s==='amber'?C.amber:C.green,display:'flex',gap:7}}><span>{s==='green'?'✓':'!'}</span><span>{t}</span></div>)}
  </div>
}
export function StepNav({prev,next,nextLabel}){
  return <div style={{display:'flex',justifyContent:'space-between',gap:10,marginTop:16}}>
    {prev ? <button onClick={prev} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:10,padding:'10px 18px',fontSize:13,cursor:'pointer'}}>← Back</button> : <span/>}
    {next && <button onClick={next} style={{background:C.orange,border:'none',color:C.ink,borderRadius:10,padding:'10px 22px',fontSize:13,fontWeight:800,cursor:'pointer'}}>{nextLabel||'Next →'}</button>}
  </div>
}

// ---------- Step 4: debt & liens ----------
export function DebtStep({debt,setDebt,walk,isMobile}){
  const d = { ...BLANK_DEBT, ...(debt||{}) }
  const set = (k,v) => setDebt({ ...d, [k]:v })
  const po = payoff(d), cn = cashNet(walk, d)
  const f = (k,l,ph) => <label style={lab}>{l}<input value={d[k]} onChange={e=>set(k,e.target.value)} placeholder={ph||''} inputMode="decimal" style={{...inp,marginTop:4}} disabled={d.free && ['loan','rate','payment','behind','arrears'].includes(k)}/></label>
  return (
    <div style={{...card,marginTop:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div>
          <div style={{fontWeight:700,fontSize:14}}>Debt & liens</div>
          <div style={{color:C.muted,fontSize:12,marginTop:2}}>What has to be paid off at closing — and what a creative buyer would take over. Ask for a mortgage statement.</div>
        </div>
        <label style={{display:'flex',gap:7,alignItems:'center',fontSize:13,cursor:'pointer',color:d.free?C.green:C.cream}}><input type="checkbox" checked={d.free} onChange={e=>set('free',e.target.checked)}/>Free & clear (no mortgage)</label>
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(5,1fr)',gap:10,marginTop:12}}>
        {f('loan','Mortgage balance $','e.g. 112000')}
        {f('rate','Interest rate %','e.g. 3.25')}
        {f('payment','Monthly payment (PITI) $','e.g. 980')}
        {f('behind','Months behind','0')}
        {f('arrears','Amount behind $','e.g. 5900')}
        {f('taxes','Back taxes $','0')}
        {f('liens','Other liens / judgments $','0')}
        {f('hoa','HOA owed $','0')}
        {f('cash_need','Cash seller needs $','e.g. 5000')}
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:12,marginTop:14}}>
        <div style={{background:C.ink,borderRadius:10,padding:'10px 12px',fontSize:12.5}}>
          {po.items.filter(x=>x[1]>0).map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',padding:'2px 0'}}><span style={{color:C.muted}}>{l}</span><span>{money(v)}</span></div>)}
          <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid '+C.line,marginTop:4,paddingTop:5,fontWeight:800}}><span>Total to pay off</span><span>{money(po.total)}</span></div>
        </div>
        <div style={{background:C.ink,borderRadius:10,padding:'10px 12px',fontSize:12.5,lineHeight:1.55}}>
          {walk>0 ? <>
            <div style={{color:C.muted}}>At your cash max of <b style={{color:C.cream}}>{money(walk)}</b> the seller walks away with</div>
            <div style={{fontSize:22,fontFamily:'Georgia,serif',fontWeight:800,color:cn.net<0?C.red:cn.works?C.green:C.amber}}>{sgn(cn.net)}</div>
            <div style={{color:cn.net<0?C.red:cn.works?C.muted:C.amber}}>{cn.net<0 ? 'Cash won\'t close — they owe more than your max. Look at subject-to in the next step.' : !cn.works ? 'Less than the '+money(d.cash_need)+' they need — expect pushback, or go creative.' : 'A cash deal can close cleanly.'}</div>
          </> : <div style={{color:C.muted}}>Finish comps and rehab to see what the seller nets at your cash max.</div>}
        </div>
      </div>
      <label style={{display:'flex',gap:7,alignItems:'center',fontSize:12.5,marginTop:12,cursor:'pointer',color:d.verified?C.green:C.amber}}><input type="checkbox" checked={d.verified} onChange={e=>set('verified',e.target.checked)}/>{d.verified?'Verified from a mortgage statement / title search':'Not verified yet — these are the seller\'s numbers'}</label>
      <textarea rows={2} value={d.notes} onChange={e=>set('notes',e.target.value)} placeholder="Notes — lender, loan type (FHA/VA/conventional), escrow, who's on title…" style={{...inp,marginTop:8,resize:'vertical'}}/>
    </div>
  )
}

// ---------- Step 5: creative exit ----------
export function CreativeCard({c,setC,m,verdict,isMobile}){
  const v = { ...BLANK_CREATIVE, ...(c||{}) }
  const set = (k,x) => setC({ ...v, [k]:x })
  const f = (k,l,ph) => <label style={lab}>{l}<input value={v[k]} onChange={e=>set(k,e.target.value)} placeholder={ph||''} inputMode="decimal" style={{...inp,marginTop:4}}/></label>
  const tile = (l,val,col,sub) => <div style={{background:C.ink,borderRadius:10,padding:'8px 10px'}}><div style={{color:C.muted,fontSize:10.5}}>{l}</div><div style={{fontWeight:800,fontSize:15,color:col||C.cream}}>{val}</div>{sub&&<div style={{color:C.muted,fontSize:10.5}}>{sub}</div>}</div>
  return (
    <div style={{...card,borderColor:C.purple+'77'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <div style={{fontWeight:700,fontSize:14}}>Creative exit</div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>set('kind','subto')} style={chip(v.kind==='subto',C.purple)}>Subject-to</button>
          <button onClick={()=>set('kind','sellerfi')} style={chip(v.kind==='sellerfi',C.purple)}>Seller finance</button>
        </div>
      </div>
      <div style={{color:C.muted,fontSize:12,marginTop:4,lineHeight:1.5}}>{v.kind==='subto' ? 'The buyer takes over the seller\'s existing loan and payments. Uses the loan from Debt & liens.' : 'The seller carries the note: the buyer pays them monthly instead of a bank.'}</div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)',gap:10,marginTop:12}}>
        {f('rent','Market rent $/mo','e.g. 1650')}
        {f('expPct','Vacancy + repairs + mgmt %','25')}
        {v.kind==='subto' ? f('cashToSeller','Cash to seller $','5000') : f('sfPrice','Purchase price $','e.g. 150000')}
        {v.kind==='sellerfi' && f('sfDown','Down payment $','e.g. 10000')}
        {v.kind==='sellerfi' && f('sfRate','Interest rate %','4')}
        {v.kind==='sellerfi' && f('sfYears','Amortized over (years)','30')}
        {v.kind==='sellerfi' && f('sfBalloon','Balloon after (years)','7')}
        {v.kind==='sellerfi' && f('taxIns','Taxes + insurance $/mo','e.g. 260')}
        {f('closing','Closing costs $','3000')}
        {f('fee','Your assignment fee $','15000')}
      </div>
      <label style={{display:'flex',gap:7,alignItems:'center',fontSize:12,marginTop:10,cursor:'pointer',color:C.muted}}><input type="checkbox" checked={!!v.includeRehab} onChange={e=>set('includeRehab',e.target.checked)}/>Buyer pays for the rehab up front (add it to their entry cost)</label>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(5,1fr)',gap:8,marginTop:12}}>
        {tile('Price on paper', money(m.price))}
        {tile('Buyer\'s entry fee', money(m.entry), null, 'cash in to take it over')}
        {tile('Monthly payment', money(m.payment), null, m.kind==='subto'?'existing loan':'to the seller')}
        {tile('Cash flow / mo', sgn(m.cashflow), m.cashflow>=250?C.green:m.cashflow>=100?C.amber:C.red, 'after '+money(m.exp)+' expenses')}
        {tile('Cash-on-cash', Math.round(m.coc*100)+'%', m.coc>=0.12?C.green:m.coc>=0.06?C.amber:C.red)}
      </div>
      <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:10,fontSize:12.5}}>
        <span>Equity after repairs: <b style={{color:m.equity>=0?C.green:C.red}}>{sgn(m.equity)}</b></span>
        {m.kind==='sellerfi' && m.balloon>0 && <span style={{color:C.muted}}>Balloon due: <b style={{color:C.cream}}>{money(m.balloon)}</b> after {v.sfBalloon} yrs</span>}
        {m.kind==='sellerfi' && m.downShort>0 && <span style={{color:C.amber}}>Seller still owes {money(m.owedAtClose)} — the down payment is {money(m.downShort)} short of paying it off (only works as a wrap).</span>}
      </div>
      <div style={{marginTop:12,display:'flex',alignItems:'center',gap:8,background:LIGHT[verdict.s]+'18',border:'1px solid '+LIGHT[verdict.s]+'66',borderRadius:10,padding:'8px 11px',fontSize:13,fontWeight:700,color:LIGHT[verdict.s]}}>
        {verdict.t}
      </div>
      <div style={{color:C.muted,fontSize:11,marginTop:6}}>Creative buyers usually want $250+/mo cash flow, 12%+ cash-on-cash, and equity on day one.</div>
    </div>
  )
}

// ---------- Step 6: sign-off ----------
export function SignOff({uw,setUw,exits,lead,onSave,saving,isMobile}){
  const u = uw || {}
  return (
    <div style={{...card,marginTop:14,borderColor:C.orange+'77'}}>
      <div style={{fontWeight:700,fontSize:15}}>Underwriting sign-off</div>
      <div style={{color:C.muted,fontSize:12,marginTop:2}}>Pick the exit you're offering on, record your decision, and save it to the lead.</div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat('+exits.length+',1fr)',gap:10,marginTop:12}}>
        {exits.map(x=>(
          <button key={x.k} onClick={()=>setUw({ ...u, exit:x.k })} style={{textAlign:'left',background:u.exit===x.k?C.panel2:C.ink,border:'2px solid '+(u.exit===x.k?C.orange:C.line),borderRadius:12,padding:'11px 13px',cursor:'pointer',color:C.cream}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:8}}><b style={{fontSize:13}}>{x.label}</b><span style={{width:10,height:10,borderRadius:'50%',background:LIGHT[x.s],marginTop:4}}/></div>
            <div style={{fontSize:12,color:C.muted,marginTop:4,lineHeight:1.45}}>{x.line}</div>
            <div style={{fontSize:12,marginTop:4,color:LIGHT[x.s]}}>{x.verdict}</div>
          </button>
        ))}
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:14}}>
        {DECISIONS.map(([k,l,col])=><button key={k} onClick={()=>setUw({ ...u, status:k })} style={chip(u.status===k,col)}>{l}</button>)}
      </div>
      <textarea rows={2} value={u.note||''} onChange={e=>setUw({ ...u, note:e.target.value })} placeholder="Why — e.g. ARV solid, roof needs replacing, seller flexible on price, verify loan with statement…" style={{...inp,marginTop:10,resize:'vertical'}}/>
      <div style={{display:'flex',gap:10,alignItems:'center',marginTop:12,flexWrap:'wrap'}}>
        <button onClick={onSave} disabled={!lead||saving||!u.exit||!u.status} style={{background:C.orange,color:C.ink,border:'none',borderRadius:10,padding:'12px 22px',fontWeight:800,fontSize:13,cursor:'pointer',opacity:(!lead||saving||!u.exit||!u.status)?0.5:1}}>{saving?'Saving…':'Save underwriting to lead'}</button>
        <span style={{color:C.muted,fontSize:12}}>{!lead?'Pick a lead at the top to save.':!u.exit?'Pick the exit you\'re offering on.':!u.status?'Pick a decision.':'Saves the numbers, the exit and your decision. The Pipeline lock check uses them.'}</span>
      </div>
    </div>
  )
}
