import { useState } from 'react';
import { supabase } from './api';
import { integrated } from './routes';
import { t } from './i18n';

export function PasswordAuth({ recovery = false, onRecovered }: { recovery?: boolean; onRecovered: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const title = recovery ? 'Set new password' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in';
  return <>
    <h3>{t(title)}</h3>
    <form onSubmit={async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const values = new FormData(form);
      const email = String(values.get('email') ?? '').trim();
      const password = String(values.get('password') ?? '');
      if ((recovery || mode === 'signup') && password !== values.get('confirm')) {
        setMessage('Passwords do not match.'); return;
      }
      if (!supabase || busy) return;
      setBusy(true); setMessage('');
      let invite = new URLSearchParams(location.search).get('invite');
      try { invite ||= sessionStorage.getItem('veetr.boat-invite'); } catch {}
      const redirectTo = location.origin + (integrated ? '/account/' : '/?account') + (invite ? `${integrated ? '?' : '&'}invite=${encodeURIComponent(invite)}` : '');
      try {
        if (recovery) {
          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw error;
          form.reset(); onRecovered();
        } else if (mode === 'reset') {
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
          if (error) throw error;
          setMessage('If an account exists, a password reset link has been sent.');
        } else if (mode === 'signup') {
          const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
          if (error) throw error;
          form.reset();
          setMessage('Check your email to confirm your account before signing in.');
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          form.reset();
        }
      } catch (error) {
        setMessage((error as { message?: string }).message || 'Sign-in failed. Please try again.');
      } finally { setBusy(false); }
    }}>
      {!recovery && <label>{t('Email address')}<input name="email" type="email" autoComplete="email" required autoFocus disabled={busy}/></label>}
      {(recovery || mode !== 'reset') && <label>{t('Password')}<input name="password" type="password" autoComplete={recovery || mode === 'signup' ? 'new-password' : 'current-password'} minLength={recovery || mode === 'signup' ? 8 : undefined} required disabled={busy}/></label>}
      {(recovery || mode === 'signup') && <><p className="help">{t('Use at least 8 characters.')}</p><label>{t('Confirm password')}<input name="confirm" type="password" autoComplete="new-password" required disabled={busy}/></label></>}
      <button className="primary" disabled={busy}>{t(busy ? 'Please wait…' : title)}</button>
    </form>
    {!recovery && <div className="form-actions">{(['signin','signup','reset'] as const).filter(m=>m!==mode).map(m=><button key={m} type="button" disabled={busy} onClick={()=>{setMode(m);setMessage('');}}>{t(m==='signin'?'Sign in':m==='signup'?'Create account':'Forgot password?')}</button>)}</div>}
    {message && <p role="status" className="notice">{t(message)}</p>}
  </>;
}
