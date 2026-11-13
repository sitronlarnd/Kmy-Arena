"use client";

export function YazdirDugmesi() {
  return <button className="dugme" onClick={() => window.print()}>PDF olarak kaydet</button>;
}
