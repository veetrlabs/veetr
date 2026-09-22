import { useState } from "react";
import { t } from "./i18n";
export function DeleteAction({onDelete, description}: {onDelete: () => Promise<void>; description: string}) {
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 return open ? <div className="delete-confirmation" role="group" aria-label={t("Confirm deletion")}>
 <p>{description}</p><p className="help">{t("This cannot be undone.")}</p>
 {error && <p role="alert">{t(error)}</p>}
 <div className="confirmation-actions"><button type="button" className="delete-action" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await onDelete();setOpen(false);}catch(e){setError(String((e as Error).message));}finally{setBusy(false);}}}>{t(busy?"Deleting…":"Delete permanently")}</button>
 <button type="button" disabled={busy} onClick={()=>{setOpen(false);setError("");}}>{t("Cancel")}</button>
 </div></div> : <button type="button" className="delete-action" onClick={()=>setOpen(true)}>{t("Delete")}</button>;
}

export function DeleteSection(props: {onDelete: () => Promise<void>; description: string}) {
 return <details className="entity-delete-options">
  <summary>{t("More options")}</summary>
  <div className="entity-delete-content"><DeleteAction {...props} /></div>
 </details>;
}
