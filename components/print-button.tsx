"use client";
export function PrintButton() {
  return <button className="btn" onClick={() => window.print()}>Imprimer / enregistrer en PDF</button>;
}
