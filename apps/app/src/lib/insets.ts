// Huecos de las barras del sistema en Android (barra de estado arriba,
// botones de navegación abajo). La app se dibuja por detrás de ellas, así que
// el diseño deja ese hueco con las variables CSS --fh-inset-*.
// Por defecto valen env(safe-area-inset-*) (styles.css); en Android las
// medidas reales las da MainActivity.kt con window.FarmHabitInsets.

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

declare global {
  interface Window {
    FarmHabitInsets?: { get(): string };
  }
}

function apply(): void {
  const bridge = window.FarmHabitInsets;
  if (!bridge) return;
  try {
    const insets = JSON.parse(bridge.get()) as Partial<Insets>;
    const style = document.documentElement.style;
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const value = insets[side];
      // Aún sin medir ("{}"): se quedan las de env(safe-area-inset-*).
      if (typeof value === 'number') style.setProperty(`--fh-inset-${side}`, `${value}px`);
    }
  } catch {
    // Sin medidas: se quedan las de env(safe-area-inset-*).
  }
}

export function watchSystemInsets(): void {
  if (!window.FarmHabitInsets) return;
  apply();
  window.addEventListener('farmhabit:insets', apply);
  window.addEventListener('resize', apply);
}
