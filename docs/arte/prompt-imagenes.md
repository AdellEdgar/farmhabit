# Prompt para generar las imágenes de ¡Chambea!

Cómo usarlo con ChatGPT (o cualquier generador de imágenes):

1. Abre **una sola conversación** para todo el set: así mantiene el estilo entre imágenes.
2. Pega primero el bloque **"Guía de estilo"** entero.
3. Después pide las imágenes **de una en una**, con el texto de cada línea de las tablas ("Imagen: …"). Pide siempre el **nombre de archivo** indicado y descárgala con ese nombre.
4. Si una sale con otro estilo, dile: _"Repítela respetando la guía de estilo: misma línea, mismos colores planos, fondo transparente"_.
5. Empieza por el **huevo** y por las 4 etapas del **panda**: si te gustan, usa esas imágenes como referencia ("con el mismo estilo que el panda") para las demás.
6. Mete todos los archivos en la carpeta `art/criaturas/` del proyecto, sin subcarpetas.

## Guía de estilo (pegar al principio)

```
Vamos a crear un set de ilustraciones para una app de hábitos llamada ¡Chambea!. Cada hábito tiene una criatura que evoluciona en 4 etapas. Necesito que TODAS las imágenes sigan exactamente esta guía:

- Estilo: pegatina chibi vectorial. Cabeza grande (aprox. 45 % del cuerpo), ojos grandes y expresivos, cuerpo pequeño y redondeado. Adorable y gracioso, nunca agresivo ni realista.
- Línea: contorno exterior grueso y uniforme de color marrón muy oscuro (#2B2118), líneas interiores más finas.
- Color: colores planos y saturados con UN solo nivel de sombra suave y un brillo pequeño. Sin degradados complejos, sin texturas, sin ruido.
- Composición: personaje entero, centrado, de frente o en 3/4, ocupando aprox. el 80 % del lienzo, con un pequeño margen. Sin suelo, sin sombra proyectada, sin texto, sin marcos, sin firma.
- Fondo: TRANSPARENTE (PNG con canal alfa). Si no puedes, fondo blanco puro #FFFFFF liso.
- Tamaño: 1024 × 1024 px, formato cuadrado.
- Debe leerse bien muy pequeño (64 px) y sobre fondo claro y oscuro.
- Coherencia de evolución: las 4 etapas de una misma criatura comparten paleta, rasgos y "firma" visual; cada etapa es más grande, más detallada y más épica que la anterior. Bebé: muy redondito y tierno. Joven: algo más alto y con actitud. Adulto: seguro de sí mismo. Leyenda: épico, con detalles dorados.
- Son caricaturas amables y originales. No copies personajes existentes de películas, series, anime ni videojuegos.

Confirma que lo has entendido y espera a que te pida cada imagen.
```

## Imágenes de las criaturas (65)

### Huevo común

| Archivo     | Imagen                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `huevo.png` | Imagen: un huevo mágico con manchas de colores suaves (verde menta, amarillo y lila) y una pequeña grieta brillante en la parte de arriba, con estilo chibi. |

### Etapas

Para cada fila, pide: _"Imagen: [descripción]. Etapa [n] de 4. Archivo: [nombre]"_.

| Archivo            | Descripción                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `panda-1.png`      | Panda luchador bebé, muy redondito, con una mini máscara de lucha libre mexicana roja y dorada                                          |
| `panda-2.png`      | Panda luchador joven con máscara de lucha libre roja y dorada y una capa corta, en pose de lucha                                        |
| `panda-3.png`      | Panda luchador adulto musculoso con máscara roja y dorada y un cinturón de campeón, sacando bíceps                                      |
| `panda-4.png`      | Panda luchador leyenda, campeón con máscara roja y dorada, cinturón de oro enorme y capa brillante, levantando el puño                  |
| `tortuga-1.png`    | Tortuguita bebé verde abrazando un libro diminuto                                                                                       |
| `tortuga-2.png`    | Tortuga joven con auriculares y gorra puesta hacia atrás, leyendo un libro con actitud                                                  |
| `tortuga-3.png`    | Tortuga adulta con mucho flow: gafas de sol, cadena dorada con un libro colgando, leyendo relajada                                      |
| `tortuga-4.png`    | Tortuga leyenda sentada en un trono hecho de libros, con corona dorada y gafas de sol                                                   |
| `rottweiler-1.png` | Cachorro de rottweiler bebé con unas zapatillas de correr enormes                                                                       |
| `rottweiler-2.png` | Rottweiler joven atlético con cinta en la frente, corriendo                                                                             |
| `rottweiler-3.png` | Rottweiler adulto grandote, guapo y musculoso, con una medalla al cuello                                                                |
| `rottweiler-4.png` | Rottweiler leyenda, campeón con corona de laurel dorada, levantando una antorcha encendida                                              |
| `yorkshire-1.png`  | Cachorro de yorkshire terrier bebé muy mono con un lacito y el ceño fruncido, cara de malo adorable                                     |
| `yorkshire-2.png`  | Yorkshire joven con chupa de cuero y cara de malo                                                                                       |
| `yorkshire-3.png`  | Yorkshire adulto con gafas de sol y una escoba, cara de "aquí mando yo"                                                                 |
| `yorkshire-4.png`  | Yorkshire leyenda, "jefe" adorable con sombrero de ala, abrigo largo y anillo dorado                                                    |
| `napoleon-1.png`   | Caricatura de Napoleón Bonaparte bebé con un bicornio tan grande que le tapa los ojos                                                   |
| `napoleon-2.png`   | Caricatura de Napoleón joven, cadete de artillería con uniforme azul                                                                    |
| `napoleon-3.png`   | Caricatura de Napoleón adulto, general con bicornio y la mano metida en el chaleco                                                      |
| `napoleon-4.png`   | Caricatura de Napoleón leyenda, emperador con corona de laurel dorada y capa de armiño                                                  |
| `cervantes-1.png`  | Caricatura de Miguel de Cervantes bebé abrazando una pluma de escribir gigante                                                          |
| `cervantes-2.png`  | Caricatura de Cervantes joven, soldado del siglo XVI con gorguera                                                                       |
| `cervantes-3.png`  | Caricatura de Cervantes adulto escritor con gorguera, perilla y un libro abierto                                                        |
| `cervantes-4.png`  | Caricatura de Cervantes leyenda rodeado de páginas volando, con un pequeño molino de viento a su lado y detalles dorados                |
| `leonidas-1.png`   | Caricatura de Leónidas, rey de Esparta, bebé con un casco espartano enorme                                                              |
| `leonidas-2.png`   | Caricatura de Leónidas joven con un escudo redondo de bronce                                                                            |
| `leonidas-3.png`   | Caricatura de Leónidas adulto cachas con capa roja, casco y lanza                                                                       |
| `leonidas-4.png`   | Caricatura de Leónidas leyenda con armadura dorada, gritando de guerra                                                                  |
| `cesar-1.png`      | Caricatura de Julio César bebé con toga blanca y una mini corona de laurel                                                              |
| `cesar-2.png`      | Caricatura de Julio César joven vestido de legionario romano                                                                            |
| `cesar-3.png`      | Caricatura de Julio César adulto, general romano con capa roja                                                                          |
| `cesar-4.png`      | Caricatura de Julio César leyenda con armadura dorada y corona de laurel dorada                                                         |
| `medusa-1.png`     | Medusa (mitología griega) bebé con un pelo de serpientes bebé dormidas, adorable                                                        |
| `medusa-2.png`     | Medusa joven con gafas de sol para no petrificar a nadie, serpientes-pelo curiosas                                                      |
| `medusa-3.png`     | Medusa adulta elegante, cada serpiente de su pelo con una expresión distinta                                                            |
| `medusa-4.png`     | Medusa leyenda, reina gorgona con corona y serpientes doradas                                                                           |
| `poseidon-1.png`   | Poseidón (mitología griega) bebé con un tridente de juguete y un flotador                                                               |
| `poseidon-2.png`   | Poseidón joven surfero con su tabla y el tridente a la espalda                                                                          |
| `poseidon-3.png`   | Poseidón adulto guapo y musculoso con barba azul y tridente                                                                             |
| `poseidon-4.png`   | Poseidón leyenda sobre una ola, con corona de coral y tridente dorado                                                                   |
| `blas-1.png`       | Caricatura del almirante español Blas de Lezo bebé vestido de marinerito                                                                |
| `blas-2.png`       | Caricatura de Blas de Lezo joven guardiamarina con un parche en un ojo                                                                  |
| `blas-3.png`       | Caricatura de Blas de Lezo adulto, almirante del siglo XVIII con parche en el ojo, una pata de palo y casaca azul, valiente y orgulloso |
| `blas-4.png`       | Caricatura de Blas de Lezo leyenda en la proa de un barco, con catalejo, parche, pata de palo y casaca con bordados dorados, invencible |
| `rana-1.png`       | Renacuajo ninja bebé con una cinta roja atada en la frente                                                                              |
| `rana-2.png`       | Rana ninja joven callejera y gamberra, con cinta roja en la frente y un monopatín                                                       |
| `rana-3.png`       | Rana ninja adulta con cinta roja en la frente y un bastón bo, en pose de combate                                                        |
| `rana-4.png`       | Rana ninja leyenda, gran maestra meditando en el aire con un aura dorada y la cinta en la frente                                        |
| `pulpo-1.png`      | Pulpito pirata bebé con un parche en el ojo                                                                                             |
| `pulpo-2.png`      | Pulpo pirata joven con un pañuelo en la cabeza y una moneda de oro                                                                      |
| `pulpo-3.png`      | Pulpo pirata adulto, capitán con sombrero tricornio y un garfio en un tentáculo                                                         |
| `pulpo-4.png`      | Pulpo pirata leyenda sentado sobre un cofre del tesoro abierto lleno de oro, con corona                                                 |
| `balon-1.png`      | Monstruito bebé que es un balón de fútbol con ojitos y bracitos                                                                         |
| `balon-2.png`      | Monstruo-balón joven con botas de tacos, dando un toque                                                                                 |
| `balon-3.png`      | Monstruo-balón adulto con camiseta deportiva y brazalete de capitán                                                                     |
| `balon-4.png`      | Monstruo-balón leyenda levantando un trofeo dorado genérico (no un trofeo real conocido)                                                |
| `perezoso-1.png`   | Perezoso bebé con chupete y un antifaz de dormir                                                                                        |
| `perezoso-2.png`   | Perezoso joven en pijama de rayas abrazando una almohada                                                                                |
| `perezoso-3.png`   | Perezoso adulto tumbado en una hamaca con el antifaz subido a la frente                                                                 |
| `perezoso-4.png`   | Perezoso leyenda durmiendo sobre una nube con una almohada dorada                                                                       |
| `mimo-1.png`       | Mimo de cine mudo bebé, cara pintada de blanco y boina negra, en tonos blanco y negro                                                   |
| `mimo-2.png`       | Mimo joven haciendo el gesto de la "pared invisible", blanco y negro                                                                    |
| `mimo-3.png`       | Mimo adulto con tirantes y camiseta de rayas sujetando un cartelito en blanco, blanco y negro                                           |
| `mimo-4.png`       | Mimo leyenda haciendo una reverencia bajo un foco, en blanco y negro con un único toque de color rojo (una flor)                        |

Detalles a respetar: la tortuga **sin** cintas en los ojos ni artes marciales; la rana con la cinta **en la frente** (no tapando los ojos) y sin caparazón; el mimo **sin** bombín, bastón ni bigote; el panda sin parecerse a ningún panda de película.

## Fondos de la tienda (8)

Estos **sí llevan fondo** (no transparentes), 1024 × 1024, mismo estilo vectorial plano y **sin personajes**, con colores algo apagados para que destaque la criatura delante.

| Archivo                | Imagen                                                      |
| ---------------------- | ----------------------------------------------------------- |
| `fondo-coliseo.png`    | Interior de un coliseo romano soleado                       |
| `fondo-barco.png`      | Cubierta de un barco pirata con velas y mar al fondo        |
| `fondo-biblioteca.png` | Biblioteca acogedora con estanterías llenas de libros       |
| `fondo-playa.png`      | Playa tropical con palmeras y olas                          |
| `fondo-dojo.png`       | Dojo japonés de madera con tatami                           |
| `fondo-estadio.png`    | Estadio de fútbol visto desde el césped, de noche con focos |
| `fondo-templo.png`     | Templo griego con columnas sobre el mar                     |
| `fondo-cine.png`       | Escenario de cine mudo con telón y foco, en blanco y negro  |

## Icono de la app (1)

| Archivo     | Imagen                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `icono.png` | Icono de app: la cabeza y los hombros del panda luchador **sin máscara**, sonriendo con confianza, centrado sobre un fondo liso de color verde intenso (#7CC46B), con un margen amplio alrededor (el panda ocupa aprox. el 60 % del lienzo). Sin texto. 1024 × 1024. |

En total: **65 criaturas + 8 fondos + 1 icono = 74 imágenes.**

## Después de generarlas

1. Copia todos los PNG en `art/criaturas/` (esta carpeta no se sube a GitHub).
2. Ejecuta `pnpm criaturas`. El script quita el fondo blanco si lo tienen, recorta el margen, las centra y las guarda en WebP (512 y 128 px) en `apps/app/src/assets/criaturas/`, que sí se sube. Avisa de las que faltan y de los nombres con erratas.
3. Para el icono: `pnpm --filter @farmhabit/app tauri icon ../../art/icono-1024.png` (ese PNG lo deja listo el paso anterior). Después, en `apps/app/src-tauri/icons/android/values/ic_launcher_background.xml`, cambia el color de fondo al verde del icono (`#4FA850`), porque Tauri lo vuelve a poner en blanco.

Mientras falte alguna imagen, la app muestra el emoji de la especie en su lugar.
