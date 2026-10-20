"use client";

// Sélecteur de poste avec la couleur de chaque machine affichée à côté de
// son nom (comme dans la légende) — un <select> natif ne permet pas de
// colorer ses <option> de façon fiable sur tous les navigateurs.
export default function MachineSelect({
  machines,
  value,
  onChange,
  placeholder = "Non affecté",
  disabled = false,
  className = "",
}: {
  machines: { id: string; name: string; color_hex: string }[];
  value: string;
  onChange: (machineId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const selected = machines.find((m) => m.id === value);

  function pick(id: string, el: HTMLElement) {
    onChange(id);
    const details = el.closest("details") as HTMLDetailsElement | null;
    if (details) details.open = false;
  }

  return (
    <details className={`relative ${disabled ? "pointer-events-none opacity-50" : ""} ${className}`}>
      <summary className="input text-xs py-1.5 cursor-pointer list-none flex items-center gap-1.5 select-none marker:content-['']">
        {selected ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color_hex }} />
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-slate-400 truncate">{placeholder}</span>
        )}
      </summary>
      <div className="absolute z-20 mt-1 min-w-full w-max bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto">
        <button
          type="button"
          className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 text-slate-400 whitespace-nowrap"
          onClick={(e) => pick("", e.currentTarget)}
        >
          {placeholder}
        </button>
        {machines.map((m) => (
          <button
            key={m.id}
            type="button"
            className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
            onClick={(e) => pick(m.id, e.currentTarget)}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color_hex }} />
            {m.name}
          </button>
        ))}
      </div>
    </details>
  );
}
