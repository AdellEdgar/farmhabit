import { Download, RotateCcw } from 'lucide-react';
import { resetDemo } from '../lib/demo-data';

const RELEASES_URL = 'https://github.com/AdellEdgar/farmhabit/releases/latest';

/** Aviso de la demo web: los datos son de ejemplo y solo viven en este navegador. */
export function DemoBanner() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-borde bg-acento-suave px-4 py-2 text-center text-xs">
      <span>
        <b>Demo de FarmHabit:</b> datos de ejemplo, guardados solo en tu navegador. Sin avisos ni
        sincronización.
      </span>
      <a
        href={RELEASES_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-acento hover:underline"
      >
        <Download size={13} /> Descargar la app
      </a>
      <button
        type="button"
        onClick={resetDemo}
        className="inline-flex items-center gap-1 text-texto-suave hover:text-texto"
      >
        <RotateCcw size={13} /> Reiniciar la demo
      </button>
    </div>
  );
}
