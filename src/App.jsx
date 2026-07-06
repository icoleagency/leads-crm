import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}

function scoreOf(l){
  const fresh = l.freshness
  const contact = Math.max(0, 100 - l.times_contacted*28)
  const mot = l.motivation
  const eq = l.arv>0 ? Math.min(100, Math.round((1 - l.owed/l.arv)*100)) : 0
  const skip = l.skiptraced ? 100 : 40
  return Math.round(fresh*0.25 + contact*0.25 + mot*0.2 + eq*0.15 + skip*0.15)
}
function grade(s){
  if(s>=80) return {g:'A',c:C.green}
  if(s>=65) return {g:'B',c:C.amber}
  if(s>=50) return {g:'C',c:C.orange}
  return {g:'D',c:C.red}
}
const money = n => '$'+Number(n||0).toLocaleString()

const BLANK = { name:'', address:'', city:'', state:'NJ', lead_type:'Lis Pendens',
  arv:'', owed:'', phone:'', freshness:100, times_contacted:0, motivation:50, skiptraced:false }

export default function App(){
  const [leads,setLeads] = useState([])
  const [form,setForm] = useState(BLANK)
  const [loading,setLoading] = useState(true)
  const [filter,setFilter] = useState('All')

  useEffect(()=>{ load() },[])
  async function load(){
    setLoading(true)
    const { data, error } = await supabase.from('leads').select('*')
    if(error){ alert('Load error: '+error.message) }
    setLeads(data||[])
    setLoading(false)
  }
  async function add(){
    if(!form.name.trim()){ alert('Add a name'); return }
    const payload = {...form, arv:Number(form.arv)||0, owed:Number(form.owed)||0}
    const { error } = await supabase.from('leads').insert([payload])
    if(error){ alert(error.message); return }
    setForm(BLANK); load()
  }
  async function remove(id){
    await supabase.from('leads').delete().eq('id',id); load()
  }

  const ranked = [...leads].sort((a,b)=>scoreOf(b)-scoreOf(a))
  const shown = ranked.filter(l=> filter==='All' || l.state===filter)
  const set = (k,v)=> setForm({...form,[k]:v})

  return (
    <div style={{minHeight:'100vh',background:C.navy,fontFamily:'Helvetica Neue,Arial',color:C.cream,padding:'32px'}}>
      <div style={{maxWidth:1100,margin:'0 auto'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:30,margin:0}}>WHOLESALE<span style={{color:C.orange}}>OS</span> · Leads</h1>
        <p style={{color:C.muted,marginTop:4}}>Auto-ranked by quality: freshness, contact history, motivation, equity & skip-trace.</p>

        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,padding:20,margin:'20px 0'}}>
          <div style={{fontWeight:700,marginBottom:14}}>Add a lead</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            <In ph="Owner name" v={form.name} on={v=>set('name',v)}/>
            <In ph="Phone" v={form.phone} on={v=>set('phone',v)}/>
            <In ph="Address" v={form.address} on={v=>set('address',v)}/>
            <In ph="City" v={form.city} on={v=>set('city',v)}/>
            <Sel v={form.state} on={v=>set('state',v)} opts={['NJ','FL','DE','PA','Other']}/>
            <Sel v={form.lead_type} on={v=>set('lead_type',v)} opts={['Lis Pendens','Pre-Foreclosure','Tax Delinquent','Vacant','Inherited','Divorce']}/>
            <In ph="ARV ($)" v={form.arv} on={v=>set('arv',v)} type="number"/>
            <In ph="Owed ($)" v={form.owed} on={v=>set('owed',v)} type="number"/>
            <div/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginTop:14,alignItems:'center'}}>
            <Slider label={`Freshness: ${form.freshness}`} v={form.freshness} on={v=>set('freshness',v)}/>
            <Slider label={`Motivation: ${form.motivation}`} v={form.motivation} on={v=>set('motivation',v)}/>
            <div>
              <label style={{fontSize:12,color:C.muted}}>Times called before: {form.times_contacted}</label>
              <input type="range" min="0" max="6" value={form.times_contacted} onChange={e=>set('times_contacted',+e.target.value)} style={{width:'100%',accentColor:C.orange}}/>
            </div>
          </div>
          <label style={{display:'flex',gap:8,alignItems:'center',marginTop:14,fontSize:13,color:C.muted}}>
            <input type="checkbox" checked={form.skiptraced} onChange={e=>set('skiptraced',e.target.checked)}/> Skip-trace confirmed
          </label>
          <button onClick={add} style={{marginTop:16,background:C.orange,color:C.ink,border:'none',borderRadius:10,padding:'11px 22px',fontWeight:800,cursor:'pointer'}}>+ Add Lead</button>
        </div>

        <div style={{display:'flex',gap:8,marginBottom:14}}>
          {['All','NJ','FL','DE','PA'].map(s=>(
            <button key={s} onClick={()=>setFilter(s)} style={{border:`1px solid ${filter===s?C.orange:C.line}`,background:filter===s?C.orange:'transparent',color:filter===s?C.ink:C.muted,borderRadius:20,padding:'7px 16px',fontWeight:600,cursor:'pointer'}}>{s}</button>
          ))}
        </div>

        {loading ? <p style={{color:C.muted}}>Loading…</p> :
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,overflow:'hidden'}}>
          {shown.length===0 && <div style={{padding:24,color:C.muted}}>No leads yet — add one above.</div>}
          {shown.map(l=>{
            const s=scoreOf(l); const g=grade(s)
            return (
              <div key={l.id} style={{display:'grid',gridTemplateColumns:'40px 1.4fr 1.6fr 1fr 1fr 40px',gap:12,padding:'14px 18px',borderBottom:`1px solid ${C.line}`,alignItems:'center'}}>
                <span style={{width:30,height:30,borderRadius:8,background:g.c+'22',color:g.c,border:`1px solid ${g.c}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800}}>{g.g}</span>
                <div><div style={{fontWeight:600}}>{l.name}</div><div style={{color:C.muted,fontSize:11}}>{l.phone}</div></div>
                <div><div style={{fontSize:13}}>{l.address}</div><div style={{color:C.muted,fontSize:11}}>{l.city}, {l.state} · {l.lead_type}</div></div>
                <div style={{fontSize:13}}>{money(l.arv)}<div style={{color:C.muted,fontSize:11}}>owed {money(l.owed)}</div></div>
                <div style={{fontSize:11,color:C.muted}}>
                  {l.times_contacted===0? <span style={{color:C.green}}>Never called</span> : <span style={{color:l.times_contacted<=1?C.amber:C.red}}>{l.times_contacted}x called</span>}
                  {l.skiptraced && <span style={{color:C.green}}> · ✓traced</span>}
                </div>
                <button onClick={()=>remove(l.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:18}}>×</button>
              </div>
            )
          })}
        </div>}
      </div>
    </div>
  )
}

function In({ph,v,on,type='text'}){return <input type={type} placeholder={ph} value={v} onChange={e=>on(e.target.value)} style={{background:C.ink,border:`1px solid ${C.line}`,borderRadius:8,padding:'10px 12px',color:C.cream,fontSize:13,outline:'none'}}/>}
function Sel({v,on,opts}){return <select value={v} onChange={e=>on(e.target.value)} style={{background:C.ink,border:`1px solid ${C.line}`,borderRadius:8,padding:'10px 12px',color:C.cream,fontSize:13}}>{opts.map(o=><option key={o}>{o}</option>)}</select>}
function Slider({label,v,on}){return <div><label style={{fontSize:12,color:C.muted}}>{label}</label><input type="range" min="0" max="100" value={v} onChange={e=>on(+e.target.value)} style={{width:'100%',accentColor:C.orange}}/></div>}