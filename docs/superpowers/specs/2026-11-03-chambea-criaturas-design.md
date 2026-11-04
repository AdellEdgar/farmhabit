> Las pesetas y la tienda de esta spec se quitaron después: las recompensas van en XP de entrenador (ver CLAUDE.md).

# ¡Chambea!: criaturas en lugar de la granja

Fecha: 2026-11-03 · Estado: pendiente de aprobación

## Objetivo

Sustituir la granja por **criaturas**: cada hábito tiene la suya, que nace de un huevo, crece cuando lo haces y retrocede si lo descuidas. La idea es que el efecto de cada hábito se vea en "su" criatura, con algo que te dé pena descuidar, sin el castigo definitivo de la muerte. La app pasa a llamarse **¡Chambea!**.

Éxito = el usuario elige una criatura para cada hábito, la ve evolucionar día a día y tiene en qué gastar lo que gana; el estado es idéntico en todos sus dispositivos y no se puede trucar.

## Decisiones tomadas

| Tema         | Decisión                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Castigo      | La criatura pierde XP y puede **retroceder** de etapa; **nunca muere**                                                                                              |
| Evolución    | Por **XP acumulada** de cada criatura                                                                                                                               |
| Elección     | El usuario **elige la especie** al crear el hábito y le pone nombre                                                                                                 |
| Catálogo     | **16 especies × 4 etapas + huevo común** (65 imágenes)                                                                                                              |
| Personajes   | Mezcla de figuras históricas o mitológicas de dominio público y criaturas originales. Nada de personas fallecidas hace menos de un siglo ni personajes con derechos |
| Global       | **Nivel de entrenador** + **pesetas** (monedas) + comodines + fondos y auras + logros + vacaciones                                                                  |
| Estilo       | Pegatina **chibi vectorial**, fondo transparente                                                                                                                    |
| Icono        | El **panda luchador sin máscara**                                                                                                                                   |
| Nombre       | **¡Chambea!** en la interfaz; **Chambea** como nombre técnico. El identificador `io.github.adelledgar.farmhabit` **no cambia** (datos y actualizaciones)            |
| Arquitectura | Motor nuevo, calculado desde el historial (como la granja). Los datos de la granja se quedan en la BD sin usarse                                                    |

## Catálogo

Se desbloquean por nivel de entrenador: 6 de inicio y 2 más por nivel (todas en el nivel 6).

| id           | Especie                    | Nivel | Bebé                                      | Joven                              | Adulto                                     | Leyenda                                                            |
| ------------ | -------------------------- | ----- | ----------------------------------------- | ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `panda`      | Panda luchador             | 1     | Pandita con mini máscara de lucha libre   | Máscara y capa corta               | Musculoso, cinturón de campeón             | Campeón con cinturón de oro y capa brillante                       |
| `tortuga`    | Tortuga lectora con flow   | 1     | Tortuguita con un libro diminuto          | Auriculares y gorra hacia atrás    | Gafas de sol, cadena con un libro colgando | En un trono de libros con corona                                   |
| `rottweiler` | Rottweiler atlético        | 1     | Cachorro con zapatillas enormes           | Cinta en la frente, corriendo      | Cachas y guapo, medalla al cuello          | Campeón con antorcha y laurel                                      |
| `yorkshire`  | Yorkshire con cara de malo | 1     | Cachorro con lazo y ceño fruncido         | Chupa de cuero                     | Gafas de sol y escoba (el orden)           | "Jefe" adorable con sombrero y abrigo largo                        |
| `napoleon`   | Napoleón                   | 1     | Bebé con un bicornio que le tapa los ojos | Cadete de artillería               | General con la mano en el chaleco          | Emperador con corona de laurel y capa de armiño                    |
| `cervantes`  | Cervantes                  | 1     | Bebé con una pluma gigante                | Joven soldado con gorguera         | Escritor con gorguera y libro              | Rodeado de páginas volando y un molino de viento al fondo          |
| `leonidas`   | Leónidas                   | 2     | Bebé con casco espartano enorme           | Joven con escudo redondo           | Cachas con capa roja y lanza               | Armadura dorada, gritando de guerra                                |
| `cesar`      | Julio César                | 2     | Bebé con toga y mini laurel               | Legionario                         | General con capa roja                      | Armadura y laurel dorados                                          |
| `medusa`     | Medusa                     | 3     | Bebé con serpientes-pelo dormidas         | Gafas de sol "para no petrificar"  | Elegante, serpientes con personalidad      | Reina gorgona con corona y serpientes doradas                      |
| `poseidon`   | Poseidón                   | 3     | Bebé con tridente de juguete y flotador   | Surfero                            | Guapo y cachas con tridente                | Sobre una ola, con corona de coral                                 |
| `blas`       | Blas de Lezo               | 4     | Bebé marinero                             | Guardiamarina con parche en el ojo | Almirante con pata de palo                 | En la proa, catalejo y casaca dorada, invencible                   |
| `rana`       | Rana ninja callejera       | 4     | Renacuajo con cinta en la frente          | Con monopatín                      | Ninja con bastón bo                        | Maestra ninja meditando con aura                                   |
| `pulpo`      | Pulpo pirata               | 5     | Pulpito con parche                        | Pañuelo y una moneda               | Capitán con tricornio y garfio             | Sobre un cofre del tesoro con corona                               |
| `balon`      | Monstruo-balón futbolista  | 5     | Balón con ojitos                          | Con botas de tacos                 | Camiseta y brazalete de capitán            | Levantando un trofeo dorado genérico                               |
| `perezoso`   | Perezoso dormilón          | 6     | Bebé con chupete y antifaz de dormir      | En pijama                          | En una hamaca, antifaz en la frente        | En una nube con almohada dorada                                    |
| `mimo`       | Mimo de cine mudo          | 6     | Bebé con boina                            | Haciendo la "pared invisible"      | Tirantes y un cartelito                    | En un escenario con focos, en blanco y negro con un toque de color |

Límites de estilo para evitar parecidos con personajes protegidos: el panda sin estética de _Kung Fu Panda_; la tortuga sin cintas en los ojos ni artes marciales; la rana con cinta en la frente (no antifaz) y sin caparazón; el mimo sin bombín, bastón ni bigote; el trofeo del balón genérico (no la Copa del Mundo).

**Huevo común** (etapa 0) para todas las especies. **Fondos** de la tienda (8): coliseo, barco pirata, biblioteca, playa, dojo, estadio, templo griego, escenario de cine mudo.

## Reglas del juego

Todos los números en `packages/core/src/game/creature-rules.ts`.

### XP de cada criatura

- Hábito hecho: `10 + 5 × esfuerzo` (15–35). Cantidades: proporcional. Bonus de racha: +5 % por semana seguida, hasta +50 %.
- Fallado (día programado y cerrado sin hacer): `−5 × (6 − esfuerzo)` (−25 a −5).
- Neutros: saltado, no programado, vacaciones, día protegido con comodín.
- Frecuencias flexibles: suma cada vez; lo que falte del objetivo resta al cerrar la semana o el mes.
- Hoy suma al momento y nunca resta; los días anteriores están cerrados (como el motor actual).
- La XP nunca baja de 0. Se mantiene: solo se registra hoy y ayer; cambiar el esfuerzo afecta desde el cambio.

### Etapas

| Etapa     | XP    |
| --------- | ----- |
| 0 Huevo   | 0     |
| 1 Bebé    | 50    |
| 2 Joven   | 500   |
| 3 Adulto  | 1.500 |
| 4 Leyenda | 4.000 |

Sube al alcanzar el umbral. **Baja** solo si la XP cae por debajo del **80 %** del umbral de su etapa actual.

### Ánimo

Con los últimos 7 días programados y cerrados (sin contar neutros): ≥ 80 % hechos **feliz**, 50–79 % **normal**, 20–49 % **cansada**, < 20 % **triste**. Con menos de 3 días de historial, **normal**. "Triste" indica que va camino de retroceder.

### Entrenador, pesetas, comodines

- **XP de entrenador** = suma de la XP **ganada** por todas las criaturas (nunca baja). Nivel `n` desde `100·n·(n−1)`.
- **Pesetas:** hábito hecho = esfuerzo (1–5); tarea completada = 3 / 2 / 1 según prioridad alta / media / baja, solo si se creó un día antes o más, con tope de 15 al día por tareas; logros = premio fijo. Fallar no quita pesetas. Gastos: compras. Nunca por debajo de 0.
- **Comodín** (50 pesetas, máximo 2 guardados): se consume solo el primer día cerrado, posterior a la compra, en el que se falle algún hábito. Ese día pasa a ser neutro para todas las criaturas (ni XP negativa ni ruptura de racha).
- **Fondos** (150 pesetas cada uno, los 8 de la lista) y **auras** (200 cada una: dorada, confeti, llamas, estrellas): cosméticos, se compran una vez y se eligen por criatura.

### Logros (calculados, con premio en pesetas)

Primera eclosión, primer Joven, primer Adulto, primera Leyenda, tres Leyendas, racha de 7 / 30 / 100 días, 10 / 100 tareas, colección completa (las 16 especies vistas en alguna etapa), ahorrador (500 pesetas a la vez).

### Vacaciones

Mismas reglas que ahora: solo protegen días posteriores a su creación; esos días son neutros para todas las criaturas.

## Datos

Migración 3 (SQL congelado nuevo, como las anteriores):

- `habits`: columnas `creature_species` (TEXT, id del catálogo), `creature_name` (TEXT), `creature_background` y `creature_aura` (TEXT o NULL).
- Tabla nueva **`purchases`** (sincronizable, con `id`, `created_at`, `updated_at`, `deleted_at`): `item` (`freeze`, `background:<id>`, `aura:<id>`), `date` (día de la compra), `price`.
- Hábitos existentes sin especie: el motor les asigna una por defecto determinista (hash del id) hasta que el usuario elija; se muestra un aviso para elegir.
- `animals` se queda en la BD y en el formato de copia, sin usarse.
- Local (`meta`): `creatures:seen:<habitId>` = última etapa celebrada en este dispositivo.

Copias `.agx` y sincronización: `purchases` se añade a las colecciones (el formato va por nombre, no rompe nada). La fusión es la misma.

## Motor

`packages/core/src/game/creatures.ts`: `computeCreatures({habits, logs, tasks, purchases, vacations, today})` → por hábito `{xp, stage, mood, streak, history}`, más `{trainerXp, level, pesetas, freezes, usedFreezes, unlockedSpecies, achievements}`. Recorre los días como `computeFarm`, reutilizando sus piezas (programación, cierre de periodos flexibles, vacaciones). Puro y determinista: el resultado no depende del orden de los datos. `history` lista eclosión, evoluciones y retrocesos con su fecha.

Se elimina `computeFarm` y su UI; `game-rules.ts` se sustituye por `creature-rules.ts`.

## Interfaz

- Menú: **Granja → Criaturas**.
- **Criaturas**, con pestañas:
  - **Equipo:** tarjeta de entrenador (nivel, XP, pesetas, comodines) y una tarjeta por criatura (imagen de su etapa, nombre, especie, hábito, barra hasta la siguiente etapa, ánimo). Plegado: **Descansando** (hábitos archivados, XP congelada).
  - **Colección:** las 16 especies × 4 etapas; vistas en color, no vistas en silueta, bloqueadas con candado y nivel.
  - **Tienda:** comodines, fondos y auras.
  - **Logros** y **Vacaciones**.
- **Ficha de criatura:** imagen grande con fondo y aura, nombre editable, progreso, historia, ánimo y últimos 7 días, cambiar fondo / aura / especie, enlace a estadísticas.
- **Celebración** a pantalla completa al eclosionar o evolucionar (una vez por dispositivo); aviso discreto al retroceder; "+XP" flotante y saltito al marcar un hábito.
- **Hoy:** la tarjeta de la granja pasa a "Tu equipo" (caritas con ánimo, nivel y pesetas).
- **Hábitos:** la carita de la criatura sustituye al emoji; el editor tiene selector de especie (solo desbloqueadas, con sugerencia según el nombre) y nombre.
- **Aviso de las 20:00:** criaturas tristes que retrocederán si no se hace su hábito.
- **Ánimo:** con CSS (saltos, brillo, gris, nubecita), sin imágenes extra.

## Imágenes e iconos

- Las genera el usuario con ChatGPT a partir de un prompt que preparo; nombres de archivo fijos (`<id>-<etapa>.png`, `huevo.png`, `fondo-<id>.png`, `icono.png`), PNG con fondo transparente (los fondos, opacos).
- Un script (`scripts/criaturas.mjs`, con `sharp` como dependencia de desarrollo) las recorta, las redimensiona (512 px y 128 px) y las pasa a WebP en `apps/app/src/assets/criaturas/`. Se cargan bajo demanda.
- Iconos: `tauri icon icono.png` genera los de escritorio; los de Android se copian en CI tras `tauri android init`, igual que `MainActivity.kt`.
- Mientras no estén las imágenes, se usa un marcador (emoji de la especie) para poder desarrollar y probar.

## Cambio de nombre

`productName` "Chambea", títulos de ventana, textos de la interfaz, notificaciones, instaladores, README, docs y demo. No cambian el identificador, la clave de firma ni la URL de actualizaciones (el repositorio sigue siendo `farmhabit`; renombrarlo es opcional y aparte).

## Pruebas

- Motor (Vitest + fast-check): XP por hecho y por fallo, flexibles, neutros, umbral y retroceso con margen del 80 %, ánimo, nivel, pesetas y tope de tareas, consumo de comodines, vacaciones, independencia del orden de los datos, XP ≥ 0.
- Migración 3 sobre una BD con datos de la granja.
- Fusión y copias con `purchases`.
- Revisión visual en `pnpm dev:web` (escritorio y móvil) con datos de ejemplo actualizados.

## Fuera de alcance

Accesorios encajados en cada criatura (sombreros…), pack de imágenes personal, combates o intercambio entre usuarios, renombrar el repositorio.
