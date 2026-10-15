import { useState } from 'react'
import { money } from './leadModel'
import { lockCheck, stressed, tolerance, floorProfit, targetProfit, LIGHT } from './dealMath'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', muted:'#88a0b4', green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0}
const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'8px 10px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'inherit'}
const num = v => { const n = Number(String(v??'').replace(/[$,\s]/g,'')); return isFinite(n) ? n : 0 }
const Dot = ({s}) => <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:LIGHT[s],flexShrink:0,marginTop:4}}/>

// The checklist itself (used in the analyzer, the pipeline pop-up and the call log).
export function LockChecks({res,compact}){
  const col = LIGHT[res.overall]
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,background:col+'18',border:'1px solid '+col+'66',borderRadius:10,padding:compact?'7px 10px':'10px 12px'}}>
        <Dot s={res.overall}/><b style={{color:col,fontSize:compact?13:14.5}}>{res.title}</b>
      </div>
      <div style={{marginTop:8}}>
        {res.checks.map(c=>(
          <div key={c.key} style={{display:'flex',gap:9,padding:compact?'4px 0':'6px 0',borderBottom:'1px solid '+C.line}}>
            <Dot s={c.status}/>
            <div style={{fontSize:compact?12:12.5,lineHeight:1.45}}><b style={{color:C.cream}}>{c.label}.</b> <span style={{color:c.status==='green'?C.muted:C.cream}}>{c.text}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Analyzer card: test any price against the analysis.
export function LockCard({r, price, setPrice, contract, isMobile}){
  const res = lockCheck(r, num(price))
  return (
    <div style={{...card,marginTop:14,borderColor:LIGHT[res.overall]+'88'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap',marginBottom:10}}>
        <div>
          <div style={{fontWeight:700,fontSize:15}}>Lock check</div>
          <div style={{color:C.muted,fontSize:12,marginTop:2}}>Run this before you sign. The same check pops up when a deal moves to Under contract.</div>
        </div>
        <label style={{color:C.muted,fontSize:11.5,width:isMobile?'100%':230}}>Price you'd sign with the seller
          <input value={price} onChange={e=>setPrice(e.target.value)} inputMode="numeric" placeholder={r.exit ? String((r.creative&&r.creative.price)||'') : r.walk?String(r.walk):''} style={{...inp,marginTop:4,fontSize:15,fontWeight:700}}/>
        </label>
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
        {(r.exit ? [['Your '+(r.exit==='subto'?'subject-to':'seller-finance')+' price',r.creative&&r.creative.price]] : [['Opening',r.open],['Target',r.target],['Walk-away',r.walk]]).concat(contract?[['Contract',contract]]:[]).filter(x=>x[1]>0).map(([l,v])=>(
          <button key={l} onClick={()=>setPrice(String(v))} style={{background:num(price)===v?C.orange:'transparent',color:num(price)===v?C.ink:C.muted,border:'1px solid '+(num(price)===v?C.orange:C.line),borderRadius:14,padding:'4px 10px',fontSize:11.5,fontWeight:600,cursor:'pointer'}}>{l} {money(v)}</button>
        ))}
      </div>
      <LockChecks res={res}/>
    </div>
  )
}

// What cash buyers actually paid near this house.
export function InvestorCard({stats, history, buyerPrice, months, setMonths, hasData}){
  const s = stats
  const bar = s.n ? Math.max(s.max, buyerPrice||0) : 0
  const x = v => bar ? Math.min(100, Math.max(0, v/bar*100)) : 0
  const pos = !s.n || !buyerPrice ? null : buyerPrice<=s.median ? 'green' : buyerPrice<=s.p75 ? 'amber' : 'red'
  return (
    <div style={card}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
        <div style={{fontWeight:700,fontSize:14}}>What investors actually paid</div>
        <div style={{display:'flex',gap:4}}>
          {[12,24].map(m=><button key={m} onClick={()=>setMonths(m)} style={{background:months===m?C.orange:'transparent',color:months===m?C.ink:C.muted,border:'1px solid '+(months===m?C.orange:C.line),borderRadius:12,padding:'2px 9px',fontSize:11,fontWeight:600,cursor:'pointer'}}>{m} mo</button>)}
        </div>
      </div>
      {!s.n ? <div style={{color:C.muted,fontSize:12.5,marginTop:8,lineHeight:1.55}}>
        {hasData ? 'No verified cash purchases near this house yet.' : 'No investor purchase data on file yet.'} Load a PropStream / PropWire cash-buyer export for this area in <b style={{color:C.cream}}>Buyers & Dispo → Find cash buyers</b> — every purchase in it becomes a price check here.
      </div> : <>
        <div style={{color:C.muted,fontSize:12,marginTop:3}}>{s.n} cash purchase{s.n===1?'':'s'} in {s.scope==='zip'?'zip ':''}{s.label}{s.scope==='county'?' County':''} · last {s.months} months</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:10}}>
          {[['Low quarter',s.p25],['Median',s.median],['High quarter',s.p75]].map(([l,v])=>(
            <div key={l} style={{background:C.ink,borderRadius:10,padding:'8px 10px'}}><div style={{color:C.muted,fontSize:10.5}}>{l}</div><div style={{fontWeight:800,fontSize:16,fontFamily:'Georgia,serif'}}>{money(v)}</div></div>
          ))}
        </div>
        <div style={{position:'relative',height:34,marginTop:14}}>
          <div style={{position:'absolute',left:0,right:0,top:12,height:8,background:C.ink,borderRadius:6}}/>
          <div style={{position:'absolute',left:x(s.p25)+'%',width:Math.max(1,x(s.p75)-x(s.p25))+'%',top:12,height:8,background:C.blue+'88',borderRadius:6}}/>
          <div style={{position:'absolute',left:x(s.median)+'%',top:8,width:2,height:16,background:C.blue}}/>
          {buyerPrice>0 && <div title="Your price to buyers" style={{position:'absolute',left:'calc('+x(buyerPrice)+'% - 7px)',top:4,width:14,height:14,borderRadius:'50%',background:LIGHT[pos],border:'2px solid '+C.panel}}/>}
          <div style={{position:'absolute',left:0,top:24,fontSize:10,color:C.muted}}>{money(s.min)}</div>
          <div style={{position:'absolute',right:0,top:24,fontSize:10,color:C.muted}}>{money(Math.max(s.max,buyerPrice||0))}</div>
        </div>
        {buyerPrice>0 && <div style={{fontSize:12.5,marginTop:8,color:LIGHT[pos],lineHeight:1.5}}>
          Your price to buyers: <b>{money(buyerPrice)}</b> — {pos==='green'?'at or under what most investors paid here. ':pos==='amber'?'above the median; only nicer houses sold this high. ':'higher than 3 of 4 investor purchases here. '}
        </div>}
        <div style={{maxHeight:150,overflowY:'auto',marginTop:8,borderTop:'1px solid '+C.line}}>
          {s.list.map((p,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:11.5,padding:'4px 0',borderBottom:'1px solid '+C.line}}>
            <span style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.address}{p.buyer?<span style={{color:C.muted}}> · {p.buyer}</span>:null}</span>
            <span style={{whiteSpace:'nowrap'}}><b>{money(p.price)}</b> <span style={{color:C.muted}}>{p.date||''}</span></span>
          </div>)}
        </div>
        <div style={{color:C.muted,fontSize:11,marginTop:6}}>These are as-is cash prices — mixed conditions. Compare to houses in similar shape.</div>
      </>}
      {history && (history.paid.length>0 || history.offers.length>0) && <div style={{marginTop:12,background:C.ink,borderRadius:10,padding:'9px 11px',fontSize:12,lineHeight:1.6}}>
        <b>Your own buyers nearby:</b>
        {history.paid.map((p,i)=><div key={'p'+i}>Paid you <b style={{color:C.green}}>{money(p.price)}</b> for {p.address}{p.contract?<span style={{color:C.muted}}> (you contracted at {money(p.contract)})</span>:null}</div>)}
        {history.offers.slice(0,5).map((o,i)=><div key={'o'+i} style={{color:C.muted}}>Offered {money(o.price)} on {o.address}</div>)}
      </div>}
    </div>
  )
}

// Stress test: what if the ARV is lower, rehab runs over, it takes longer?
export function StressCard({p}){
  const [arvDrop,setArvDrop] = useState(7)
  const [rehabOver,setRehabOver] = useState(20)
  const [extra,setExtra] = useState(2)
  if(!p.arv || !p.buyerPrice) return <div style={card}><div style={{fontWeight:700,fontSize:14}}>Stress test</div><div style={{color:C.muted,fontSize:12.5,marginTop:8}}>Needs an ARV and a price.</div></div>
  const t = tolerance(p)
  const base = stressed(p,{}), hit = stressed(p,{ arvDrop, rehabOver, extraMonths:extra })
  const hitArv = p.arv*(1-arvDrop/100)
  const status = v => v>=targetProfit(p.arv) ? 'green' : v>=floorProfit(p.arv) ? 'amber' : 'red'
  const slider = (label, v, set, max, step, unit) => (
    <label style={{display:'block',fontSize:12,color:C.muted,marginTop:8}}>
      <div style={{display:'flex',justifyContent:'space-between'}}><span>{label}</span><b style={{color:C.cream}}>{unit==='mo'?'+'+v+' mo':(unit==='-'?'−':'+')+v+'%'}</b></div>
      <input type="range" min={0} max={max} step={step} value={v} onChange={e=>set(Number(e.target.value))} style={{width:'100%',accentColor:C.orange}}/>
    </label>
  )
  const grid = [0,5,10].map(a=>[0,20,40].map(r=>({ a, r, v:stressed(p,{ arvDrop:a, rehabOver:r }) })))
  return (
    <div style={card}>
      <div style={{fontWeight:700,fontSize:14}}>Stress test</div>
      <div style={{fontSize:13,marginTop:6,lineHeight:1.5,color:t.broken?C.red:t.arvDrop>=7?C.green:C.amber,fontWeight:600}}>
        {t.broken ? 'No room for surprises — the buyer is already under a safe profit.' : 'Still sells if the ARV comes in up to '+t.arvDrop+'% low, or rehab runs up to '+t.rehabOver+'% over.'}
      </div>
      {slider('ARV comes in lower', arvDrop, setArvDrop, 20, 1, '-')}
      {slider('Rehab runs over', rehabOver, setRehabOver, 60, 5, '+')}
      {slider('Takes longer to sell', extra, setExtra, 6, 1, 'mo')}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
        <div style={{background:C.ink,borderRadius:10,padding:'8px 10px'}}><div style={{color:C.muted,fontSize:10.5}}>Buyer profit as planned</div><div style={{fontWeight:800,color:LIGHT[status(base)]}}>{money(base)}</div></div>
        <div style={{background:C.ink,borderRadius:10,padding:'8px 10px'}}><div style={{color:C.muted,fontSize:10.5}}>If all of that happens</div><div style={{fontWeight:800,color:hit>=floorProfit(hitArv)?(hit>=targetProfit(hitArv)?C.green:C.amber):C.red}}>{hit<0?'−':''}{money(Math.abs(hit))}</div></div>
      </div>
      <div style={{marginTop:12,fontSize:11,color:C.muted}}>Buyer profit — ARV down (rows) × rehab over (columns)</div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11.5,marginTop:4}}>
        <thead><tr><th/>{[0,20,40].map(r=><th key={r} style={{color:C.muted,fontWeight:600,padding:4,textAlign:'right'}}>rehab +{r}%</th>)}</tr></thead>
        <tbody>{grid.map(row=><tr key={row[0].a}><td style={{color:C.muted,padding:4}}>ARV −{row[0].a}%</td>{row.map(c=><td key={c.r} style={{textAlign:'right',padding:4,fontWeight:700,color:LIGHT[status(c.v)]}}>{c.v<0?'−':''}{money(Math.abs(c.v))}</td>)}</tr>)}</tbody>
      </table>
      <div style={{color:C.muted,fontSize:11,marginTop:6}}>Green = flipper's target ($25k / 10%+). Amber = thin. Red = most buyers pass.</div>
    </div>
  )
}

// Pop-up when a deal moves to Under contract.
export function LockGate({lead, onConfirm, onCancel, onAnalyze}){
  const d = lead.details||{}, r = (d.comp && d.comp.result) || {}
  const [price,setPrice] = useState(String((d.deal&&d.deal.contract_price)||''))
  const [why,setWhy] = useState('')
  const [busy,setBusy] = useState(false)
  const res = lockCheck(r, num(price))
  const needWhy = res.overall==='red'
  const ok = num(price)>0 && (!needWhy || why.trim().length>=5)
  return (
    <div onClick={onCancel} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,zIndex:70}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:22,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',boxSizing:'border-box'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10}}>
          <div>
            <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:600}}>Lock check</div>
            <div style={{color:C.muted,fontSize:12.5,marginTop:2}}>{lead.name} · {[lead.address,lead.city].filter(Boolean).join(', ')}</div>
          </div>
          <button onClick={onCancel} aria-label="Close" style={{background:'transparent',border:'none',color:C.muted,fontSize:18,cursor:'pointer'}}>✕</button>
        </div>
        <label style={{display:'block',color:C.muted,fontSize:12,marginTop:12}}>Contract price (what you're paying the seller)
          <input autoFocus value={price} onChange={e=>setPrice(e.target.value)} inputMode="numeric" placeholder={r.walk?'your walk-away is '+money(r.walk):''} style={{...inp,marginTop:4,fontSize:16,fontWeight:700}}/>
        </label>
        <div style={{marginTop:12}}><LockChecks res={res} compact/></div>
        {needWhy && <label style={{display:'block',color:C.red,fontSize:12,marginTop:12}}>Locking anyway? Write why (saved on the deal)
          <input value={why} onChange={e=>setWhy(e.target.value)} placeholder="e.g. buyer already committed at $X / seller will take less after inspection" style={{...inp,marginTop:4,borderColor:C.red+'77'}}/>
        </label>}
        <div style={{display:'flex',gap:8,marginTop:16,flexWrap:'wrap'}}>
          <button disabled={!ok||busy} onClick={async()=>{ setBusy(true); try{ await onConfirm(num(price), needWhy?why.trim():null, res) }finally{ setBusy(false) } }}
            style={{background:needWhy?C.red:C.orange,color:C.ink,border:'none',borderRadius:10,padding:'11px 20px',fontWeight:800,fontSize:13,cursor:ok?'pointer':'default',opacity:ok&&!busy?1:0.5}}>
            {busy?'Saving…':needWhy?'Lock anyway':'Lock it — move to Under contract'}</button>
          {onAnalyze && <button onClick={onAnalyze} style={{background:'transparent',border:'1px solid '+C.line,color:C.cream,borderRadius:10,padding:'11px 16px',fontSize:13,cursor:'pointer'}}>Open Deal Analyzer</button>}
          <button onClick={onCancel} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:10,padding:'11px 16px',fontSize:13,cursor:'pointer'}}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
