import { useState } from 'react';
import { APP_NAME } from '@farmhabit/core';

type Seccion = 'hoy' | 'tareas' | 'habitos' | 'notas' | 'granja' | 'ajustes';

const SECCIONES: { id: Seccion; nombre: string; icono: string }[] = [
  { id: 'hoy', nombre: 'Hoy', icono: '☀️' },
  { id: 'tareas', nombre: 'Tareas', icono: '✅' },
  { id: 'habitos', nombre: 'Hábitos', icono: '🔁' },
  { id: 'notas', nombre: 'Notas', icono: '📝' },
  { id: 'granja', nombre: 'Granja', icono: '🐔' },
  { id: 'ajustes', nombre: 'Ajustes', icono: '⚙️' },
];

export function App() {
  const [seccion, setSeccion] = useState<Seccion>('hoy');
  const actual = SECCIONES.find((s) => s.id === seccion) ?? SECCIONES[0]!;

  return (
    // Móvil: barra de navegación abajo. Escritorio (md+): barra lateral.
    <div className="flex h-full flex-col md:flex-row">
      <nav
        aria-label="Secciones"
        className="order-last flex border-t border-borde bg-superficie md:order-first md:w-56 md:flex-col md:border-t-0 md:border-r md:p-3"
      >
        <div className="hidden px-3 py-4 text-lg font-bold text-acento md:block">{APP_NAME}</div>
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSeccion(s.id)}
            aria-current={s.id === seccion ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs md:flex-none md:flex-row md:gap-3 md:rounded-lg md:px-3 md:text-sm ${
              s.id === seccion ? 'text-acento md:bg-fondo' : 'text-texto-suave hover:text-texto'
            }`}
          >
            <span aria-hidden="true" className="text-lg md:text-base">
              {s.icono}
            </span>
            {s.nombre}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <h1 className="text-2xl font-bold">{actual.nombre}</h1>
        <p className="mt-2 text-texto-suave">Próximamente.</p>
      </main>
    </div>
  );
}
