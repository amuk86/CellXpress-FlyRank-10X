import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Header from '../components/Header.js';
import { useAuth } from '../components/AuthProvider.js';
import { waLink } from '../lib/messages.js';
const URGENT_AFTER_MS = 48 * 60 * 60 * 1000;
function elapsed(ms) {
  if (ms == null) return 'Time unknown';
  const hrs = Math.max(0, Math.floor((Date.now() - ms) / 3600000));
  return hrs < 1 ? 'Under 1h' : hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}
function Ticket({ job, onUpdate, onReport, busy }) {
  const urgent = job.status === 'in_progress' && job.createdAt != null && Date.now() - job.createdAt > URGENT_AFTER_MS;
  const wa = waLink(job);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ diagnosis: job.diagnosis || '', workDone: job.workDone || '', fee: job.fee ?? '' });
  return <article className={`ticket${urgent ? ' urgent' : ''}`}><div className="ticket-head"><span>CX-{job.id.slice(-5).toUpperCase()}</span><span>{elapsed(job.createdAt)}</span></div><div className="ticket-tear" /><div className="ticket-body"><p className="name">{job.customerName}</p><p className="device">{job.deviceModel}</p><p className="fault">{job.faultDescription}</p><div className="ticket-badges"><span className={`badge ${job.paymentStatus === 'unpaid' ? 'amber' : 'green'}`}>{job.paymentStatus || 'unpaid'}</span>{urgent && <span className="badge red">Over 48h</span>}</div>
    {editing && <form className="job-editor" onSubmit={async e=>{e.preventDefault();if(await onUpdate(job.id,{...draft,fee:draft.fee === '' ? null : Number(draft.fee)})) setEditing(false);}}><label>Diagnosis<textarea value={draft.diagnosis} onChange={e=>setDraft({...draft,diagnosis:e.target.value})} maxLength={2000} /></label><label>Work done<textarea value={draft.workDone} onChange={e=>setDraft({...draft,workDone:e.target.value})} maxLength={2000} /></label><label>Fee (ZAR)<input type="number" min="0" max="1000000" step="0.01" value={draft.fee} onChange={e=>setDraft({...draft,fee:e.target.value})} /></label><button className="btn" disabled={busy}>Save details</button><button type="button" className="text-btn" onClick={()=>setEditing(false)}>Cancel</button></form>}
    {!editing && job.workDone && <p className="fault">Work: {job.workDone}</p>}
  </div><div className="ticket-foot"><span className="fee">{job.fee == null ? 'Fee pending' : `R${Number(job.fee).toFixed(2)}`}</span>{job.status === 'in_progress' && <button className="btn" disabled={busy} onClick={()=>onUpdate(job.id,{status:'ready_for_pickup'})}>Mark ready</button>}{job.status === 'ready_for_pickup' && <button className="btn" disabled={busy || job.paymentStatus === 'unpaid'} onClick={()=>onUpdate(job.id,{status:'completed'})}>Mark collected</button>}{job.status === 'completed' && <span className="badge green">Collected</span>}</div><div className="ticket-actions">{job.status !== 'completed' && <><button className="text-btn" disabled={busy} onClick={()=>setEditing(!editing)}>Edit details</button><label className="payment-select">Payment<select aria-label={`Payment for ${job.customerName}`} value={job.paymentStatus || 'unpaid'} disabled={busy} onChange={e=>onUpdate(job.id,{paymentStatus:e.target.value})}><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="waived">Waived</option></select></label></>}<button className="text-btn" disabled={busy} onClick={()=>onReport(job)}>Download PDF</button>{wa && <a className="wa-link" href={wa} target="_blank" rel="noreferrer">Review WhatsApp message ↗</a>}</div></article>;
}
export default function Dashboard() {
  const { apiFetch } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    try { const res=await apiFetch('/api/jobs');const data=await res.json();if(!res.ok)throw new Error(data.error);setJobs(data.jobs);setError(''); }
    catch(err){setError(err.message);} finally{setLoading(false);}
  }, []);
  useEffect(()=>{load();const interval=setInterval(load,15000);return ()=>clearInterval(interval);},[load]);
  async function update(id, fields) {
    setBusy(id);setError('');
    try { const res=await apiFetch(`/api/jobs/${id}/status`,{method:'PATCH',body:JSON.stringify(fields)});const data=await res.json();if(!res.ok)throw new Error(data.error);setJobs(prev=>prev.map(j=>j.id===id?data.job:j));return true; }
    catch(err){setError(err.message);return false;} finally{setBusy('');}
  }
  async function report(job) {
    setBusy(job.id);
    try {const res=await apiFetch(`/api/jobs/${job.id}/report`);if(!res.ok)throw new Error((await res.json()).error);const url=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=url;a.download=`CellXpress-${job.id}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch(err){setError(err.message);}finally{setBusy('');}
  }
  const overdue = jobs.filter(j=>j.status==='in_progress' && j.createdAt != null && Date.now()-j.createdAt>URGENT_AFTER_MS).length;
  const columns=[['in_progress','In progress','01'],['ready_for_pickup','Ready for pickup','02'],['completed','Collected','03']];
  return <main className="page"><Header /><div className="page-heading"><div><div className="eyebrow">THE REPAIR BENCH</div><h1>Repair Operations Dashboard</h1><p className="muted">A clear view of every job, from intake to collection.</p></div><Link className="btn" href="/intake">+ Create repair job</Link></div><div className="stats"><div><span>Active repairs</span><strong>{jobs.filter(j=>j.status==='in_progress').length.toString().padStart(2,'0')}</strong></div><div><span>Ready for collection</span><strong>{jobs.filter(j=>j.status==='ready_for_pickup').length.toString().padStart(2,'0')}</strong></div><div><span>Open over 48 hours</span><strong className={overdue?'attention':''}>{overdue.toString().padStart(2,'0')}</strong></div></div><div className="board-toolbar"><label className="search-label" htmlFor="search">Find a repair<input id="search" type="search" placeholder="Customer, device or job reference…" value={query} onChange={e=>setQuery(e.target.value)} /></label><button className="text-btn" onClick={load}>Refresh board ↻</button></div>{error&&<p role="alert" className="status-line error">{error}</p>}{loading?<p role="status">Loading repairs…</p>:<div className="columns">{columns.map(([status,label,num])=>{const matches=jobs.filter(j=>j.status===status&&`${j.customerName} ${j.deviceModel} CX-${j.id.slice(-5)}`.toLowerCase().includes(query.toLowerCase()));return <section key={status}><div className="column-heading"><span><small>{num}</small> {label}</span><span>{matches.length}</span></div>{matches.length?matches.map(j=><Ticket key={j.id} job={j} onUpdate={update} onReport={report} busy={busy===j.id}/>):<div className="empty">{query?'No matching repairs.':status==='in_progress'?'The bench is clear. Create a job to get started.':status==='ready_for_pickup'?'Completed repairs will appear here.':'Collected devices will appear here.'}</div>}</section>;})}</div>}<footer className="board-footer">CELLXPRESS / STAFF OPERATIONS <span>Latest 200 repairs · Refreshes every 15 seconds</span></footer></main>;
}
