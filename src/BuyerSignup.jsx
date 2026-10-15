import { useState } from 'react'

// Public page at /join — buyers fill in their own buy box. No login, no CRM data shown.
// Link options (built in Buyers & Dispo → Sign-up link): ?by=Business%20Name&m=Duval,Clay&src=Facebook
const C = { ink:'#081019', navy:'#0b1826', panel:'#102434', line:'#1d3a4a', cream:'#f4f1ea', orange:'#ff6b1a', muted:'#88a0b4', green:'#3fd08a', red:'#e5573f' }
const TYPES = ['Flipper','Landlord / BRRRR','Builder','Wholetailer','Fund / institutional','Other']
const PROPS = ['Single family','Multi-family','Condo / townhouse','Land','Mobile home']
const REHAB = [['Light','Paint, carpet, cosmetic'],['Medium','Kitchen / bath, some systems'],['Heavy','Roof, foundation, full gut'],['Teardown','Land value / new build']]
const FIN = ['Cash','Hard money','Private money','Conventional']
const DEALS = ['0','1-2','3-5','6-10','10+']
const CLOSE = [[7,'7 days'],[14,'14 days'],[21,'21 days'],[30,'30 days'],[45,'45+ days']]
const PRICE = [50000,75000,100000,150000,200000,250000,300000,400000,500000,750000,1000000]
const k = n => n>=1000000 ? '$'+(n/1000000)+'M' : '$'+(n/1000)+'k'

export default function BuyerSignup(){
  const q = new URLSearchParams(window.location.search)
  const brand = (q.get('by')||'').slice(0,60)
  const suggest = (q.get('m')||'').split(',').map(s=>s.trim()).filter(Boolean).slice(0,12)
  const src = (q.get('src')||'').slice(0,40)
  const [f,setF] = useState({ name:'', company:'', phone:'', email:'', buyer_type:'', markets:[], marketText:'', property_types:[], rehab:[], min_price:'', max_price:'', financing:'Cash', deals:'', close_days:'', pof:false, sms_ok:true, notes:'', website:'' })
  const [busy,setBusy] = useState(false)
  const [err,setErr] = useState('')
  const [done,setDone] = useState(null)
  const set = (key,v) => { setErr(''); setF(x=>({...x,[key]:v})) }
  const tog = (key,v) => setF(x=>({...x,[key]:x[key].includes(v)?x[key].filter(y=>y!==v):[...x[key],v]}))

  async function submit(e){
    e.preventDefault(); setErr('')
    const markets = [...f.markets, ...f.marketText.split(',').map(s=>s.trim()).filter(Boolean)]
    if(f.name.trim().length<2) return setErr('Please add your name.')
    if(!f.phone.trim() && !f.email.trim()) return setErr('Add a phone number or email so we can send you deals.')
    if(!markets.length) return setErr('Tell us at least one area you buy in.')
    setBusy(true)
    try{
      const r = await fetch('/.netlify/functions/buyer-signup', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ ...f, markets, src }) })
      const j = await r.json().catch(()=>({ ok:false, error:'Something went wrong — please try again.' }))
      if(!j.ok) throw new Error(j.error||'Something went wrong')
      setDone(j)
    }catch(er){ setErr(er.message) }
    setBusy(false)
  }

  const page = { minHeight:'100vh', background:C.navy, color:C.cream, fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', padding:'28px 16px 60px', boxSizing:'border-box' }
  const wrap = { maxWidth:640, margin:'0 auto' }
  const card = { background:C.panel, border:'1px solid '+C.line, borderRadius:16, padding:'18px 18px 20px', marginTop:14 }
  const lab = { display:'block', color:C.muted, fontSize:12.5, marginTop:10 }
  const inp = { display:'block', width:'100%', boxSizing:'border-box', background:C.ink, border:'1px solid '+C.line, borderRadius:10, padding:'11px 12px', color:C.cream, fontSize:15, outline:'none', marginTop:5, fontFamily:'inherit' }
  const chip = on => ({ background:on?C.orange:'transparent', color:on?C.ink:C.cream, border:'1px solid '+(on?C.orange:C.line), borderRadius:20, padding:'8px 13px', fontSize:13.5, fontWeight:600, cursor:'pointer' })
  const h = { fontSize:15, fontWeight:700, margin:0 }

  if(done) return (
    <div style={page}><div style={{...wrap,textAlign:'center',paddingTop:60}}>
      <div style={{fontSize:44}}>✓</div>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:28,margin:'10px 0 6px'}}>{done.updated?'Your buy box is updated':'You’re on the list'}</h1>
      <p style={{color:C.muted,fontSize:15,lineHeight:1.6}}>We'll send you off-market deals that match what you buy{f.markets.length?' in '+f.markets.slice(0,3).join(', '):''}. Buyers who close fast and have proof of funds get first look.</p>
      {f.pof && <p style={{color:C.muted,fontSize:14}}>Reply to our first message with your proof of funds to get VIP access.</p>}
    </div></div>
  )
  return (
    <div style={page}>
      <form onSubmit={submit} style={wrap}>
        <div style={{color:C.orange,fontSize:12,fontWeight:800,letterSpacing:1.5,textTransform:'uppercase'}}>{brand||'Off-market deals'}</div>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:30,margin:'6px 0 6px',lineHeight:1.15}}>Join our cash buyers list</h1>
        <p style={{color:C.muted,fontSize:15,margin:0,lineHeight:1.55}}>Tell us what you buy and we'll send you off-market deals that fit — before they go anywhere else. Takes about a minute.</p>

        <div style={card}>
          <p style={h}>About you</p>
          <label style={lab}>Your name *<input value={f.name} onChange={e=>set('name',e.target.value)} autoComplete="name" style={inp}/></label>
          <label style={lab}>Company (optional)<input value={f.company} onChange={e=>set('company',e.target.value)} autoComplete="organization" style={inp}/></label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'0 12px'}}>
            <label style={lab}>Cell phone<input value={f.phone} onChange={e=>set('phone',e.target.value)} type="tel" autoComplete="tel" inputMode="tel" style={inp}/></label>
            <label style={lab}>Email<input value={f.email} onChange={e=>set('email',e.target.value)} type="email" autoComplete="email" style={inp}/></label>
          </div>
          <label style={{display:'flex',gap:8,alignItems:'center',color:C.muted,fontSize:13,marginTop:10,cursor:'pointer'}}><input type="checkbox" checked={f.sms_ok} onChange={e=>set('sms_ok',e.target.checked)}/>OK to text me deals</label>
          <input value={f.website} onChange={e=>set('website',e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{position:'absolute',left:-9999,width:1,height:1,opacity:0}}/>
        </div>

        <div style={card}>
          <p style={h}>What you buy</p>
          <div style={lab}>Areas you buy in *</div>
          {suggest.length>0 && <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:6}}>{suggest.map(m=><button type="button" key={m} onClick={()=>tog('markets',m)} style={chip(f.markets.includes(m))}>{m}</button>)}</div>}
          <input value={f.marketText} onChange={e=>set('marketText',e.target.value)} placeholder={suggest.length?'Other counties, cities or zips (comma separated)':'Counties, cities or zips — e.g. Duval, Jacksonville, 32210'} style={inp}/>
          <div style={lab}>Property types</div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:6}}>{PROPS.map(t=><button type="button" key={t} onClick={()=>tog('property_types',t)} style={chip(f.property_types.includes(t))}>{t}</button>)}</div>
          <div style={lab}>Rehab you'll take on</div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:6}}>{REHAB.map(([t,d])=><button type="button" key={t} title={d} onClick={()=>tog('rehab',t)} style={chip(f.rehab.includes(t))}>{t}</button>)}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <label style={lab}>Min price<select value={f.min_price} onChange={e=>set('min_price',e.target.value)} style={inp}><option value="">No minimum</option>{PRICE.map(p=><option key={p} value={p}>{k(p)}</option>)}</select></label>
            <label style={lab}>Max price<select value={f.max_price} onChange={e=>set('max_price',e.target.value)} style={inp}><option value="">No maximum</option>{PRICE.map(p=><option key={p} value={p}>{k(p)}</option>)}</select></label>
          </div>
        </div>

        <div style={card}>
          <p style={h}>How you buy</p>
          <label style={lab}>You are a…<select value={f.buyer_type} onChange={e=>set('buyer_type',e.target.value)} style={inp}><option value="">Choose one</option>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
          <div style={lab}>How you pay</div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:6}}>{FIN.map(t=><button type="button" key={t} onClick={()=>set('financing',t)} style={chip(f.financing===t)}>{t}</button>)}</div>
          <div style={lab}>Deals you've bought in the last 12 months</div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:6}}>{DEALS.map(t=><button type="button" key={t} onClick={()=>set('deals',t)} style={chip(f.deals===t)}>{t}</button>)}</div>
          <div style={lab}>How fast can you close?</div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:6}}>{CLOSE.map(([v,t])=><button type="button" key={v} onClick={()=>set('close_days',v)} style={chip(f.close_days===v)}>{t}</button>)}</div>
          <label style={{display:'flex',gap:8,alignItems:'center',color:C.cream,fontSize:14,marginTop:14,cursor:'pointer'}}><input type="checkbox" checked={f.pof} onChange={e=>set('pof',e.target.checked)} style={{width:18,height:18}}/>I can send proof of funds</label>
          <label style={lab}>Anything else? (optional)<textarea rows={3} value={f.notes} onChange={e=>set('notes',e.target.value)} placeholder="e.g. only 3/2s built after 1970, no flood zones, love duplexes" style={{...inp,resize:'vertical'}}/></label>
        </div>

        {err && <div style={{color:C.red,fontSize:14,marginTop:14}}>{err}</div>}
        <button type="submit" disabled={busy} style={{marginTop:16,width:'100%',background:C.orange,color:C.ink,border:'none',borderRadius:12,padding:'15px',fontSize:16,fontWeight:800,cursor:'pointer',opacity:busy?0.7:1}}>{busy?'Sending…':'Send me deals'}</button>
        <p style={{color:C.muted,fontSize:12,textAlign:'center',marginTop:12,lineHeight:1.5}}>We only use your info to send you properties. Reply STOP anytime to opt out.</p>
      </form>
    </div>
  )
}
