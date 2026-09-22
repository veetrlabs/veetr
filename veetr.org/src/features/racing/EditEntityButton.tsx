import React from "react";
import { Pencil } from "lucide-react";

export function EditEntityButton({label, onClick}: {label: string; onClick: () => void}) {
  return <button type="button" className="entity-edit-button" aria-label={label} title={label} onClick={onClick}>
    <Pencil size={20} aria-hidden="true" />
  </button>;
}
