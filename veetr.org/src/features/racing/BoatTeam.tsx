import React, {useEffect, useState} from 'react';
import {supabase, type TeamMember} from './api';
import {t} from './i18n';
type Member = Omit<TeamMember, 'role'> & {role: 'owner' | 'editor' | 'crew'};
export function BoatTeam({boatId}: {boatId: string}) {
 const [members,setMembers] = useState<Member[]>([]), [error,setError] = useState(''), [busy,setBusy] = useState(false);
 const refresh = async () => {
  const {data,error} = await supabase!.rpc('boat_team', {boat_id: boatId});
  if (error) throw error;
  return data as unknown as Member[];
 };
 useEffect(() => {let alive=true;void refresh().then(rows=>{if(alive)setMembers(rows);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[boatId]);
 const save = async (email: string, role: 'editor' | 'remove') => {
  setBusy(true);setError('');
  try {
   const {error} = await supabase!.rpc('set_boat_member',{boat_id:boatId,member_email:email,member_role:role});
   if(error)throw error;
   setMembers(await refresh());
  } catch(e){setError((e as Error).message);} finally{setBusy(false);}
 };
 return <details><summary>{t('Boat team')}</summary>
  <p>{t('Editors can update this boat. Only its owner can manage access or delete it. Sharing a boat does not grant access to private series.')}</p>
  <ul className="team-list">{members.map(m=><li key={m.id}><div><strong>{m.email}</strong><small>{t(m.role === 'owner' ? 'Owner' : m.role === 'editor' ? 'Editor' : 'Crew')}</small></div>{m.role !== 'owner' && <button disabled={busy} onClick={()=>void save(m.email,'remove')}>{t('Remove')}</button>}</li>)}</ul>
  <form onSubmit={e=>{e.preventDefault();void save(String(new FormData(e.currentTarget).get('email')),'editor');}}>
   <label>{t('Teammate’s email')}<input name="email" type="email" required autoComplete="off" /></label>
   <p>{t('Teammates must sign in once before you can add them. This saves access immediately; it does not send an invitation email.')}</p>
   <button disabled={busy}>{t('Add editor')}</button>
  </form>
  {error && <p role="alert">{t(error)}</p>}
 </details>;
}
