'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
export default function NewBuilding(){
 const router=useRouter(); const [name,setName]=useState('');const [address,setAddress]=useState('');const [pending,setPending]=useState(false);const [error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setPending(true);setError('');try{const r=await fetch('/api/buildings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,address})});if(!r.ok)throw Error('Objekt se nepodařilo uložit.');setName('');setAddress('');router.refresh();}catch(e){setError(e instanceof Error?e.message:'Neznámá chyba');}finally{setPending(false)}}
 return <form onSubmit={submit}><input aria-label="Název objektu" placeholder="Název objektu" value={name} onChange={e=>setName(e.target.value)} required maxLength={120}/><input aria-label="Adresa" placeholder="Adresa" value={address} onChange={e=>setAddress(e.target.value)} required maxLength={250}/><button disabled={pending}>{pending?'Ukládám…':'Přidat objekt'}</button>{error&&<p className="error" role="alert">{error}</p>}</form>;
}
