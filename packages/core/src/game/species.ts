import { fnv1a } from '../util/hash';

// Catálogo de criaturas. Cada hábito tiene una; evoluciona en 4 etapas
// (más el huevo). Las imágenes viven en la app: aquí solo los datos.

export type SpeciesId =
  | 'panda'
  | 'tortuga'
  | 'rottweiler'
  | 'yorkshire'
  | 'napoleon'
  | 'cervantes'
  | 'leonidas'
  | 'cesar'
  | 'medusa'
  | 'poseidon'
  | 'blas'
  | 'rana'
  | 'pulpo'
  | 'balon'
  | 'perezoso'
  | 'mimo';

export interface SpeciesInfo {
  id: SpeciesId;
  name: string;
  /** Título de cada etapa: bebé, joven, adulto, leyenda. */
  stageNames: [string, string, string, string];
  /** Marcador mientras no hay imagen. */
  emoji: string;
  /** Palabras del nombre del hábito que hacen sugerir esta especie. */
  keywords: string[];
}

export const SPECIES: readonly SpeciesInfo[] = [
  {
    id: 'panda',
    name: 'Panda luchador',
    stageNames: ['Pandita', 'Luchador', 'Campeón', 'Leyenda del ring'],
    emoji: '🐼',
    keywords: ['entren', 'boxeo', 'lucha', 'pesas', 'flexion', 'abdominal'],
  },
  {
    id: 'tortuga',
    name: 'Tortuga lectora',
    stageNames: ['Tortuguita', 'Lectora con flow', 'Sabia', 'Reina de los libros'],
    emoji: '🐢',
    keywords: ['leer', 'libro', 'lectura', 'pagina'],
  },
  {
    id: 'rottweiler',
    name: 'Rottweiler atlético',
    stageNames: ['Cachorro', 'Corredor', 'Atleta', 'Campeón'],
    emoji: '🐕',
    keywords: ['correr', 'running', 'cardio', 'caminar', 'pasos', 'bici'],
  },
  {
    id: 'yorkshire',
    name: 'Yorkshire con cara de malo',
    stageNames: ['Cachorro gruñón', 'Rebelde', 'El que manda', 'El jefe'],
    emoji: '🐶',
    keywords: ['casa', 'limpi', 'orden', 'cocina', 'cocinar', 'fregar', 'cama'],
  },
  {
    id: 'napoleon',
    name: 'Napoleón',
    stageNames: ['Napoleoncito', 'Cadete', 'General', 'Emperador'],
    emoji: '🎖️',
    keywords: ['estudi', 'trabaj', 'proyecto', 'productiv', 'tarea'],
  },
  {
    id: 'cervantes',
    name: 'Cervantes',
    stageNames: ['Miguelito', 'Soldado', 'Escritor', 'Príncipe de los ingenios'],
    emoji: '🪶',
    keywords: ['escrib', 'diario', 'journal', 'redact'],
  },
  {
    id: 'leonidas',
    name: 'Leónidas',
    stageNames: ['Espartanito', 'Hoplita', 'Rey', 'Leyenda de Esparta'],
    emoji: '🛡️',
    keywords: ['gimnasio', 'gym', 'fuerza', 'muscul'],
  },
  {
    id: 'cesar',
    name: 'Julio César',
    stageNames: ['Cesarín', 'Legionario', 'General', 'Dictador perpetuo'],
    emoji: '🏛️',
    keywords: ['organiz', 'planific', 'agenda', 'disciplina', 'madrug'],
  },
  {
    id: 'medusa',
    name: 'Medusa',
    stageNames: ['Gorgonita', 'Gorgona', 'Dama de las serpientes', 'Reina gorgona'],
    emoji: '🐍',
    keywords: ['piel', 'cuidado', 'skincare', 'belleza', 'dientes', 'ducha'],
  },
  {
    id: 'poseidon',
    name: 'Poseidón',
    stageNames: ['Poseidoncito', 'Surfero', 'Dios del mar', 'Señor de los océanos'],
    emoji: '🔱',
    keywords: ['agua', 'beber', 'hidrat', 'nadar', 'piscina'],
  },
  {
    id: 'blas',
    name: 'Blas de Lezo',
    stageNames: ['Marinerito', 'Guardiamarina', 'Almirante', 'Medio hombre, leyenda entera'],
    emoji: '⚓',
    keywords: ['dejar', 'sin ', 'no fumar', 'constan', 'reto'],
  },
  {
    id: 'rana',
    name: 'Rana ninja',
    stageNames: ['Renacuajo', 'Ninja callejera', 'Ninja', 'Gran maestra'],
    emoji: '🐸',
    keywords: ['medit', 'respir', 'yoga', 'concentr', 'mindful'],
  },
  {
    id: 'pulpo',
    name: 'Pulpo pirata',
    stageNames: ['Pulpito', 'Grumete', 'Capitán', 'Rey de los mares'],
    emoji: '🐙',
    keywords: ['ahorr', 'gasto', 'dinero', 'finanz', 'invert'],
  },
  {
    id: 'balon',
    name: 'Monstruo-balón',
    stageNames: ['Balón con ojitos', 'Promesa', 'Capitán', 'Balón de oro'],
    emoji: '⚽',
    keywords: ['futbol', 'baloncesto', 'padel', 'tenis', 'partido', 'deporte'],
  },
  {
    id: 'perezoso',
    name: 'Perezoso dormilón',
    stageNames: ['Perezosito', 'Dormilón', 'Maestro de la siesta', 'Rey del descanso'],
    emoji: '🦥',
    keywords: ['dormir', 'sueño', 'acostar', 'descans', 'siesta'],
  },
  {
    id: 'mimo',
    name: 'Mimo de cine mudo',
    stageNames: ['Mimito', 'Aprendiz', 'Artista', 'Estrella del cine mudo'],
    emoji: '🎭',
    keywords: ['movil', 'pantalla', 'redes', 'desconect', 'reir'],
  },
];

const BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

export function speciesById(id: string): SpeciesInfo | undefined {
  return BY_ID.get(id as SpeciesId);
}

/** Minúsculas y sin tildes, para comparar nombres. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Las que puede recibir un hábito sin especie. No cambiar la lista ni su orden:
 * esos hábitos cambiarían de criatura.
 */
const DEFAULT_SPECIES: readonly SpeciesId[] = [
  'panda',
  'tortuga',
  'rottweiler',
  'yorkshire',
  'napoleon',
  'cervantes',
];

/** Especie elegida de forma estable a partir de un texto (id del hábito). */
export function defaultSpecies(seed: string): SpeciesId {
  return DEFAULT_SPECIES[fnv1a(seed) % DEFAULT_SPECIES.length]!;
}

/** Primera especie cuyas palabras clave aparecen en el nombre del hábito. */
export function suggestSpecies(habitName: string): SpeciesId {
  const name = normalize(habitName);
  for (const s of SPECIES) {
    if (s.keywords.some((k) => name.includes(normalize(k)))) return s.id;
  }
  return defaultSpecies(name);
}
