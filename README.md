# FarmHabit

App de productividad personal **local-first** para Windows, Linux y Android:

- **Tareas** con prioridad, etiquetas, fechas, recurrencias y varios avisos.
- **Hábitos** con frecuencias flexibles y cantidades. Cada hábito mantiene viva tu **granja**: si los cumples, crece; si los descuidas, tus animales enferman… y pueden morir.
- **Notas** con carpetas, etiquetas y buscador, y notas privadas cifradas.
- **Tus datos son tuyos:** todo se guarda en tu dispositivo, sin cuentas ni servidores. Para sincronizar entre dispositivos se usa un archivo cifrado (Argon2id + XChaCha20-Poly1305).

> 🚧 En desarrollo (Fase 0). La interfaz está en español.

## Desarrollo

Requisitos: Node 22.13 o superior, pnpm 10, Rust (rustup) y, en Windows, las Build Tools de C++ de Visual Studio.

```bash
pnpm install
pnpm dev
```

La arquitectura, el formato de archivo y las reglas de seguridad y del juego están en [CLAUDE.md](CLAUDE.md).

## Licencia

[MIT](LICENSE)
