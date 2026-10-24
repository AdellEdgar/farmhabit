import { createContext, useContext } from 'react';

export type Section = 'hoy' | 'tareas' | 'habitos' | 'notas' | 'granja' | 'ajustes';

export interface NavigationValue {
  section: Section;
  go: (section: Section) => void;
}

export const NavigationContext = createContext<NavigationValue>({
  section: 'hoy',
  go: () => {},
});

export function useNavigation(): NavigationValue {
  return useContext(NavigationContext);
}
