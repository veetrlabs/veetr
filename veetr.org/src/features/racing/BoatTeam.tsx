import {useEffect, useState} from 'react';
import {supabase, type TeamMember} from './api';
import {emailInvitation} from './boatAccessApi';
import {t} from './i18n';
type Member = Omit<TeamMember, 'role'> & {role: string};
type Invite = {id:string; email:string; role:string; status:string; sent:boolean; handover?:boolean};
export function BoatTeam({boatId}: {boatId: string}) {
 const [members,setMembers] = useState<Member[]>([]), [invites,setInvites] = useState<Invite[]>([]);
 const [responsibility,setResponsibility]=useState<{claimed:boolean;canTransfer:boolean}|null>(null);
 const [handover,setHandover]=useState(false);
 const [allowed,setAllowed] = useState<boolean | null>(null);
 const [error,setError] = useState(''), [message,setMessage] = useState(''), [busy,setBusy] = useState(false), [retry,setRetry] = useState('');
 useEffect(() => {let active=true; void (async()=>{
  const permission = await supabase!.rpc('can_manage_boat',{boat_id:boatId});
  if(permission.error)throw permission.error;
  if(active)setAllowed(Boolean(permission.data));
 })().catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[boatId]);
 const fetchRoster = async () => {
  const [team,invitations,status]=await Promise.all([supabase!.rpc('boat_team',{boat_id:boatId}),supabase!.rpc('boat_team_invitations',{bid:boatId}),supabase!.rpc('boat_responsibility',{bid:boatId})]);
  if(team.error)throw team.error;if(invitations.error)throw invitations.error;if(status.error)throw status.error;
  return {responsibility:status.data as {claimed:boolean;canTransfer:boolean},members:team.data as unknown as Member[],invites:(invitations.data as unknown as Invite[]).filter(i=>i.status==='pending')};
 };
 const refresh=async()=>{if(!allowed)return;const rows=await fetchRoster();setMembers(rows.members);setInvites(rows.invites);setResponsibility(rows.responsibility);};
 useEffect(()=>{let active=true;setMembers([]);setInvites([]);if(allowed)void fetchRoster().then(rows=>{if(active){setMembers(rows.members);setInvites(rows.invites);setResponsibility(rows.responsibility);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[allowed,boatId]);
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await action();await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const send=async(id:string)=>{setRetry(id);try{await emailInvitation(id);setRetry('');}catch{throw new Error('Access saved, but email delivery failed. Retry the email notification.');}};
 return <div className="boat-access-manager">
  <h2>{t('Manage boat access')}</h2>
  <p>{t('Existing verified accounts receive access immediately and an email notification. New people receive an invitation to verify their email and accept.')}</p>
  {allowed===null ? <p>{t('Loading…')}</p> : !allowed ? <p>{t('Only the boat owner, a skipper or an administrator can manage this boat’s team.')}</p> : <>
   <p>{t('Skippers manage the boat profile and crew. Skippers and crew can track the boat in every race it enters. Add each person once for all races.')}</p>
   {responsibility&&!responsibility.claimed&&<p className="notice">{t('This boat is awaiting a responsible skipper. Its creator can hand it over by invitation. Signing in alone does not claim it.')}</p>}
   <ul className="team-list">{members.map(m=><li key={m.id}><div><strong>{m.email}</strong><small>{t(m.role==='creator'?'Created by · awaiting handover':m.role==='owner'?'Responsible skipper':m.role==='manager'?'Skipper':m.role==='skipper'?'Skipper':m.role==='editor'?'Editor':'Crew')}</small></div>{!['owner','creator'].includes(m.role)&&<button disabled={busy} onClick={()=>void run(async()=>{
    const result=await supabase!.rpc('set_boat_member',{boat_id:boatId,member_email:m.email,member_role:'remove'});if(result.error)throw result.error;
   })}>{t('Remove access')}</button>}</li>)}</ul>
   {invites.length>0&&<><h3>{t('Pending invitations')}</h3><ul className="team-list">{invites.map(i=><li key={i.id}><div><strong>{i.email}</strong><small>{t(i.handover?'Boat handover':i.role==='manager'?'Skipper':i.role==='crew'?'Crew':'Skipper')} · {t('Pending invitation')}</small></div><button disabled={busy} onClick={()=>void run(async()=>{
    const result=await supabase!.rpc('revoke_boat_team_invitation',{invitation_id:i.id});if(result.error)throw result.error;
   })}>{t('Revoke invitation')}</button><button disabled={busy} onClick={()=>void run(()=>send(i.id))}>{t('Send email')}</button></li>)}</ul></>}
   <form className="boat-access-form" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void run(async()=>{
    const result=handover ? await supabase!.rpc('request_boat_handover',{bid:boatId,recipient:String(data.get('email'))}) : await supabase!.rpc('grant_or_invite_boat_access',{bid:boatId,recipient:String(data.get('email')),member_role:String(data.get('role'))});
    if(result.error)throw result.error;
    const saved=result.data as {id:string;status:string};await refresh();await send(saved.id);
    setMessage(t(saved.status==='granted'?'Access granted and notification sent.':'Invitation sent.'));
   });}}>
    <label>{t('Email')}<input name="email" type="email" required autoComplete="off" disabled={busy}/></label>
    {responsibility?.canTransfer&&<label className="boat-handover-choice"><input type="checkbox" checked={handover} disabled={busy} onChange={e=>setHandover(e.target.checked)}/>{t('Hand over responsibility for this boat')}</label>}
    {handover&&<p>{t('The recipient must verify their email and explicitly accept. Until then, access stays unchanged. After acceptance, the previous custodian loses boat access; series permissions stay unchanged.')}</p>}
    {!handover&&<label>{t('Role')}<select name="role" disabled={busy}><option value="crew">{t('Crew')}</option><option value="manager">{t('Skipper')}</option></select></label>}
    <button disabled={busy}>{t(handover?'Send handover invitation':'Grant access or invite')}</button>
   </form>
  </>}
  {error&&<p role="alert">{t(error)}</p>}{message&&<p role="status">{message}</p>}
  {retry&&<button disabled={busy} onClick={()=>void run(async()=>{await send(retry);setMessage(t('Email sent.'));})}>{t('Retry email notification')}</button>}
 </div>;
}
