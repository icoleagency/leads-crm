import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}

const PHASES = [
  { id:'p1', ph:'Phase 1', title:'Foundation & Setup', items:[
    ['p1a','Form your LLC & open a business bank account'],
    ['p1b','Start your cash buyers list (aim for 5 to start)'],
    ['p1c','Learn ARV basics & your target market'],
    ['p1d','Understand contracts: assignment vs double-close'],
  ]},
  { id:'p2', ph:'Phase 2', title:'Finding Deals', items:[
    ['p2a','Pull lead lists (county, PropStream, Prime Tracers)'],
    ['p2b','Skip-trace to get owner contact info'],
    ['p2c','Set up your dialer & call scripts'],
    ['p2d','Define your VA workflow — what to hand off'],
  ]},
  { id:'p3', ph:'Phase 3', title:'Talking to Sellers', items:[
    ['p3a','Learn the 4-pillar seller call framework'],
    ['p3b','Build rapport & uncover motivation'],
    ['p3c','Lock in the appointment'],
    ['p3d','Make the verbal offer'],
  ]},
  { id:'p4', ph:'Phase 4', title:'Analyzing & Offering', items:[
    ['p4a','Run comps like an appraiser'],
    ['p4b','Apply the 70% rule (MAO formula)'],
    ['p4c','Write and send the contract'],
    ['p4d','Handle price objections'],
  ]},
  { id:'p5', ph:'Phase 5', title:'Disposition & Closing', items:[
    ['p5a','Market the deal to your buyers list'],
    ['p5b','Assign the contract'],
    ['p5c','Work with the title company'],
    ['p5d','Collect your assignment fee'],
  ]},
]

const ALL_IDS = PHASES.flatMap(p=>p.items.map(([id])=>id))
const ROW_ID = 'default'

export default function AcademyPage({isMobile}){
  const [done,setDone] = useState({})
  const [loading,setLoading] = useState(true)

  useEffect(()=>{ loadProgress() },[])
  async function loadProgress(){
    setLoading(true)
    const { data } = await supabase.from('academy_progress').select('*').eq('id',ROW_ID).maybeSingle()
    setDone((data && data.completed) ? data.completed : {})
    setLoading(false)
  }
  async function toggle(itemId){
    const next = {...done, [itemId]: !done[itemId]}
    setDone(next)
    await supabase.from('academy_progress').upsert({ id:ROW_ID, completed:next })
  }

  const completedCount = ALL_IDS.filter(id=>done[id]).length
  const pct = Math.round((completedCount/ALL_IDS.length)*100)

  return (
    <div>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}}>The Academy</h1>
      <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:640}}>Your guided path from zero to your first assignment fee. Check items off as you go — your progress saves automatically.</p>

      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,padding:20,margin:'18px 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <span style={{fontWeight:700,fontSize:14}}>Your progress</span>
          <span style={{color:C.orange,fontWeight:800,fontSize:16}}>{pct}%</span>
        </div>
        <div style={{height:10,background:C.ink,borderRadius:20,overflow:'hidden'}}>
          <div style={{width:`${pct}%`,height:'100%',background:`linear-gradient(90deg,${C.orange},${C.orangeSoft})`,transition:'width .4s'}}/>
        </div>
        <div style={{color:C.muted,fontSize:12,marginTop:8}}>{completedCount} of {ALL_IDS.length} steps complete</div>
      </div>

      {loading ? <p style={{color:C.muted}}>Loading…</p> :
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {PHASES.map(p=>{
          const phaseDone = p.items.every(([id])=>done[id])
          const phaseStarted = p.items.some(([id])=>done[id])
          return (
            <div key={p.id} style={{background:C.panel,border:`1px solid ${phaseDone?C.green:phaseStarted?C.orange:C.line}`,borderRadius:16,padding:20}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                <div style={{width:34,height:34,borderRadius:10,background:phaseDone?C.green:phaseStarted?C.orange:C.ink,color:phaseDone||phaseStarted?C.ink:C.muted,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,flexShrink:0}}>{phaseDone?'✓':p.ph.split(' ')[1]}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>{p.ph}</div>
                  <div style={{fontSize:16,fontWeight:700,fontFamily:'Georgia,serif'}}>{p.title}</div>
                </div>
                {phaseDone && <span style={{background:C.green+'22',color:C.green,border:`1px solid ${C.green}55`,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700}}>Complete</span>}
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:8}}>
                {p.items.map(([id,label])=>(
                  <div key={id} onClick={()=>toggle(id)} style={{display:'flex',gap:10,alignItems:'center',background:C.ink,borderRadius:8,padding:'11px 12px',cursor:'pointer'}}>
                    <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${done[id]?C.green:C.muted}`,background:done[id]?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:C.ink,flexShrink:0}}>{done[id]?'✓':''}</div>
                    <span style={{fontSize:13,color:done[id]?C.muted:C.cream,textDecoration:done[id]?'line-through':'none'}}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>}
    </div>
  )
}