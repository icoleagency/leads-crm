import { useState, useMemo } from 'react'
import { getCaller } from './activity'
import { stepsFor, scriptVars, fillParts, COMPANY } from './scriptContent'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', muted:'#88a0b4', green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0}
const chip = on => ({background:on?C.orange:'transparent',color:on?C.ink:C.muted,border:'1px solid '+(on?C.orange:C.line),borderRadius:18,padding:'6px 14px',fontSize:12.5,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'})

// Renders a script line with the lead's details highlighted (blanks in amber).
function Line({text,vars,size=15}){
  return <span style={{fontSize:size,lineHeight:1.6}}>{fillParts(text,vars).map((p,i)=>p.t!==undefined ? <span key={i}>{p.t}</span>
    : <span key={i} style={{color:p.blank?C.amber:C.orange,fontWeight:700,background:p.blank?C.amber+'14':'transparent',borderRadius:4,padding:p.blank?'0 3px':0}}>{p.v}</span>)}</span>
}

export default function ScriptsPage({leads=[],initialLeadId,lockedVa,isMobile}){
  const [role,setRole] = useState(lockedVa ? 'va' : 'va')
  const [leadId,setLeadId] = useState(initialLeadId ? String(initialLeadId) : '')
  const [q,setQ] = useState('')
  const [i,setI] = useState(0)
  const [openIf,setOpenIf] = useState(null)
  const lead = leads.find(l=>String(l.id)===leadId) || null
  const vars = useMemo(()=>scriptVars(lead, getCaller()),[lead])
  const steps = stepsFor(role)
  const idx = Math.min(i, steps.length-1)
  const s = steps[idx]
  const matches = q.trim() ? leads.filter(l=>[l.name,l.address,l.city].join(' ').toLowerCase().includes(q.trim().toLowerCase())).slice(0,8) : []
  const go = n => { setI(n); setOpenIf(null) }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}}>Scripts</h1>
          <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5}}>The {COMPANY} seller call, step by step. Pick a lead to fill in their name, address and repairs.</p>
        </div>
        {!lockedVa && <div style={{display:'flex',gap:6}}>
          <button onClick={()=>{ setRole('va'); go(0) }} style={chip(role==='va')}>VA script</button>
          <button onClick={()=>{ setRole('closer'); go(0) }} style={chip(role==='closer')}>Closer script</button>
        </div>}
      </div>

      <div style={{display:'flex',gap:6,marginTop:14,borderBottom:'1px solid '+C.line}}>
        <span style={{padding:'8px 4px',borderBottom:'2px solid '+C.orange,color:C.cream,fontWeight:700,fontSize:13.5}}>Call script</span>
        <span title="Coming next" style={{padding:'8px 12px',color:C.muted,fontSize:13.5,opacity:0.6}}>Objections — coming next</span>
      </div>

      {/* lead picker */}
      <div style={{...card,marginTop:14,padding:'12px 14px',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',position:'relative'}}>
        <span style={{color:C.muted,fontSize:12.5}}>Calling:</span>
        {lead ? <>
          <b style={{fontSize:14}}>{lead.name}</b><span style={{color:C.muted,fontSize:12.5}}>{[lead.address,lead.city].filter(Boolean).join(', ')}</span>
          <button onClick={()=>{ setLeadId(''); setQ('') }} style={{...chip(false),padding:'3px 10px',fontSize:11.5}}>Change</button>
        </> : <div style={{flex:1,minWidth:220,position:'relative'}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search a lead by name or address — or just read the script with blanks" style={{width:'100%',boxSizing:'border-box',background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'8px 11px',color:C.cream,fontSize:13,outline:'none'}}/>
          {matches.length>0 && <div style={{position:'absolute',left:0,right:0,top:'100%',marginTop:4,background:C.panel2,border:'1px solid '+C.line,borderRadius:10,zIndex:20,overflow:'hidden'}}>
            {matches.map(l=><div key={l.id} onClick={()=>{ setLeadId(String(l.id)); setQ('') }} style={{padding:'8px 12px',cursor:'pointer',fontSize:13,borderBottom:'1px solid '+C.line}}><b>{l.name}</b> <span style={{color:C.muted}}>· {[l.address,l.city].filter(Boolean).join(', ')}</span></div>)}
          </div>}
        </div>}
        {!vars.caller && <span style={{color:C.amber,fontSize:11.5}}>Tip: your name fills in once you've logged a call.</span>}
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'230px 1fr',gap:14,marginTop:14,alignItems:'start'}}>
        {/* step list */}
        <div style={isMobile?{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}:{...card,padding:10}}>
          {steps.map((st,n)=>(
            <button key={st.key} onClick={()=>go(n)} style={{display:'flex',alignItems:'center',gap:9,width:isMobile?'auto':'100%',flex:isMobile?'0 0 auto':'none',textAlign:'left',background:n===idx?C.orange:'transparent',color:n===idx?C.ink:n<idx?C.cream:C.muted,border:isMobile?'1px solid '+(n===idx?C.orange:C.line):'none',borderRadius:9,padding:'9px 11px',fontSize:13,fontWeight:700,cursor:'pointer',marginBottom:isMobile?0:2}}>
              <span style={{width:20,height:20,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,background:n===idx?C.ink:n<idx?C.green:C.ink,color:n===idx?C.orange:n<idx?C.ink:C.muted}}>{n<idx?'✓':n+1}</span>
              {st.title}
            </button>
          ))}
          {!isMobile && <div style={{color:C.muted,fontSize:11,padding:'10px 8px 4px',lineHeight:1.5}}>{role==='va'?'VAs stop at the hand-off — the closer makes the offer.':'Closer: use the lead\'s saved analysis for the offer.'}</div>}
        </div>

        {/* current step */}
        <div style={card}>
          <div style={{color:C.orange,fontSize:11.5,fontWeight:800,letterSpacing:1,textTransform:'uppercase'}}>Step {idx+1} of {steps.length}</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,marginTop:2}}>{s.title}</div>
          <div style={{color:C.muted,fontSize:13,marginTop:4,lineHeight:1.5}}><Line text={s.goal} vars={vars} size={13}/></div>

          <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:10}}>
            {s.say.map((t,n)=>(
              <div key={n} style={{background:C.ink,borderLeft:'3px solid '+C.orange,borderRadius:'0 10px 10px 0',padding:'12px 15px'}}>
                <span style={{color:C.orange,fontSize:18,fontFamily:'Georgia,serif',marginRight:4}}>“</span><Line text={t} vars={vars} size={isMobile?15:16}/><span style={{color:C.orange,fontSize:18,fontFamily:'Georgia,serif',marginLeft:2}}>”</span>
              </div>
            ))}
          </div>

          {s.if && <div style={{marginTop:16}}>
            <div style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>If they say…</div>
            {s.if.map(([when,resp],n)=>{ const open = openIf===n
              return (
                <div key={n} style={{border:'1px solid '+(open?C.blue+'88':C.line),borderRadius:10,marginBottom:6,overflow:'hidden'}}>
                  <button onClick={()=>setOpenIf(open?null:n)} style={{width:'100%',textAlign:'left',background:open?C.blue+'14':'transparent',border:'none',color:C.cream,padding:'9px 12px',fontSize:13.5,fontWeight:700,cursor:'pointer',display:'flex',justifyContent:'space-between',gap:8}}>
                    <span>{when}</span><span style={{color:C.muted}}>{open?'−':'+'}</span>
                  </button>
                  {open && <div style={{padding:'4px 14px 12px',color:C.cream}}><Line text={resp} vars={vars} size={14.5}/></div>}
                </div>
              ) })}
          </div>}

          {(s.listen || s.tip) && <div style={{display:'grid',gridTemplateColumns:isMobile||!s.listen||!s.tip?'1fr':'1fr 1fr',gap:10,marginTop:16}}>
            {s.listen && <div style={{background:C.green+'12',border:'1px solid '+C.green+'44',borderRadius:10,padding:'9px 12px',fontSize:12.5,lineHeight:1.5}}><b style={{color:C.green}}>Capture: </b><Line text={s.listen} vars={vars} size={12.5}/></div>}
            {s.tip && <div style={{background:C.amber+'10',border:'1px solid '+C.amber+'44',borderRadius:10,padding:'9px 12px',fontSize:12.5,lineHeight:1.5}}><b style={{color:C.amber}}>Tip: </b><Line text={s.tip} vars={vars} size={12.5}/></div>}
          </div>}

          <div style={{display:'flex',justifyContent:'space-between',gap:10,marginTop:18}}>
            {idx>0 ? <button onClick={()=>go(idx-1)} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:10,padding:'10px 18px',fontSize:13,cursor:'pointer'}}>← Back</button> : <span/>}
            {idx<steps.length-1 ? <button onClick={()=>go(idx+1)} style={{background:C.orange,border:'none',color:C.ink,borderRadius:10,padding:'10px 22px',fontSize:13,fontWeight:800,cursor:'pointer'}}>Next: {steps[idx+1].title} →</button>
              : <button onClick={()=>go(0)} style={{background:'transparent',border:'1px solid '+C.green,color:C.green,borderRadius:10,padding:'10px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>Start over for the next call</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
