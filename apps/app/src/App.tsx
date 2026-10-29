import { useEffect, useState } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  NotebookPen,
  Repeat,
  Settings,
  Sprout,
} from 'lucide-react';
import { APP_NAME } from '@farmhabit/core';
import { AppProvider } from './lib/app-context';
import { useApp } from './lib/use-app';
import { NavigationContext, type Section } from './lib/navigation';
import { allThemes, applyTheme, loadTheme, watchSystemTheme } from './lib/theme';
import {
  applyCloseToTray,
  DEFAULT_CLOSE_TO_TRAY,
  getFlag,
  isMobileApp,
  PREF_KEYS,
} from './lib/platform';
import { ReminderScheduler } from './lib/ReminderScheduler';
import { MobileReminderScheduler } from './lib/MobileReminderScheduler';
import { SyncProvider } from './lib/SyncProvider';
import { CalendarRefresher } from './lib/CalendarRefresher';
import { isDemo } from './lib/demo-data';
import { DemoBanner } from './components/DemoBanner';
import { cx } from './lib/cx';
import { TodayView } from './features/today/TodayView';
import { TasksView } from './features/tasks/TasksView';
import { CalendarView } from './features/calendar/CalendarView';
import { HabitsView } from './features/habits/HabitsView';
import { NotesView } from './features/notes/NotesView';
import { FarmView } from './features/farm/FarmView';
import { SettingsView } from './features/settings/SettingsView';

/** short: nombre en la barra inferior del móvil, donde hay menos sitio. */
const SECTIONS: { id: Section; name: string; short?: string; icon: typeof Sprout }[] = [
  { id: 'hoy', name: 'Hoy', icon: CalendarCheck },
  { id: 'tareas', name: 'Tareas', icon: CheckSquare },
  { id: 'calendario', name: 'Calendario', short: 'Agenda', icon: CalendarDays },
  { id: 'habitos', name: 'Hábitos', icon: Repeat },
  { id: 'notas', name: 'Notas', icon: NotebookPen },
  { id: 'granja', name: 'Granja', icon: Sprout },
  { id: 'ajustes', name: 'Ajustes', icon: Settings },
];

/** Sección inicial: `?section=granja` abre directamente esa sección (útil en la demo web). */
function initialSection(): Section {
  const wanted = new URLSearchParams(location.search).get('section');
  return SECTIONS.find((s) => s.id === wanted)?.id ?? 'hoy';
}

export function App() {
  return (
    <AppProvider>
      <SyncProvider>
        <Shell />
      </SyncProvider>
    </AppProvider>
  );
}

function Shell() {
  const { db, data, farm } = useApp();
  const [section, setSection] = useState<Section>(initialSection);

  useEffect(() => {
    void getFlag(db, PREF_KEYS.closeToTray, DEFAULT_CLOSE_TO_TRAY).then(applyCloseToTray);
  }, [db]);

  // Tema: se vuelve a aplicar si llegan temas personalizados de otro dispositivo
  // y si el tema es "sistema" y el sistema cambia de claro a oscuro.
  useEffect(() => {
    const themes = allThemes(data.settings);
    let choice = 'oscuro';
    void loadTheme(db).then((c) => {
      choice = c;
      applyTheme(c, themes);
    });
    return watchSystemTheme(
      () => choice,
      () => themes,
    );
  }, [db, data.settings]);

  const alerts = farm.deathWarning || farm.sick;

  return (
    <NavigationContext.Provider value={{ section, go: setSection }}>
      {isMobileApp ? <MobileReminderScheduler /> : <ReminderScheduler />}
      <CalendarRefresher />
      {/* Móvil: barra de navegación abajo. Escritorio (md+): barra lateral. */}
      <div className="flex h-full flex-col md:flex-row">
        <nav
          aria-label="Secciones"
          className="order-last flex border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)] md:order-first md:w-60 md:flex-col md:gap-1 md:border-t-0 md:border-r md:p-3"
        >
          <div className="hidden items-center gap-2 px-3 pt-2 pb-5 md:flex">
            <span className="grid size-8 place-items-center rounded-lg bg-acento-suave text-lg">
              🐔
            </span>
            <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
          </div>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.id === section;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition md:flex-none md:flex-row md:gap-3 md:rounded-xl md:px-3 md:py-2.5 md:text-sm',
                  active
                    ? 'text-acento md:bg-acento-suave'
                    : 'text-texto-suave hover:text-texto md:hover:bg-elevado',
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                <span className="md:hidden">{s.short ?? s.name}</span>
                <span className="hidden md:inline">{s.name}</span>
                {s.id === 'granja' && alerts && (
                  <span
                    className="absolute top-1.5 right-[calc(50%-16px)] size-2 rounded-full bg-peligro md:static md:ml-auto"
                    aria-label="Tu granja necesita atención"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto">
          {isDemo && <DemoBanner />}
          <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-8 md:py-8">
            {section === 'hoy' && <TodayView />}
            {section === 'tareas' && <TasksView />}
            {section === 'calendario' && <CalendarView />}
            {section === 'habitos' && <HabitsView />}
            {section === 'notas' && <NotesView />}
            {section === 'granja' && <FarmView />}
            {section === 'ajustes' && <SettingsView />}
          </div>
        </main>
      </div>
    </NavigationContext.Provider>
  );
}
