# Cómo trabajamos

## Ramas

Cuatro niveles. Cada uno sale del de arriba y vuelve a él.

```
main ────────────────●───────────────●──────  releases
                     ↑               ↑
develop ──●──────●───┴───────●───────┴──────  integración
          ↑      ↑           ↑
feature/ ─┴──────┴───────────┴───────────────  una épica
   └── tareas ────────────────────────────────  una tarea
```

| Rama | Nombre | Sale de | Vuelve a |
|---|---|---|---|
| Principal | `main` | — | — |
| Integración | `develop` | `main` | `main` (release) |
| Épica | `feature/LET-33-entorno-y-base-del-proyecto` | `develop` | `develop` |
| Tarea | `LET-1-inicializar-el-repositorio` | su épica | su épica |

**`main` no se toca.** Solo recibe releases desde `develop`.

El nombre de la rama es `[ticket]-[titulo-en-minusculas-con-guiones]`. El ticket sale del tablero.

## Commits

Un commit describe **qué cambió**, en presente y en español, con el ticket adelante:

```
LET-1: agrega el esqueleto del monorepo con workspaces
LET-4: crea las tablas usuarios y tokens_recuperacion
```

Commits chicos y que compilen. Nada de `wip`, `fix` ni `cambios`.

Los commits van firmados **solo por la cuenta de quien trabaja**. No se agregan líneas de coautoría.

## Pull requests

**Nada se mergea localmente.** Los tres saltos del flujo pasan por un Pull Request en GitHub.

| Qué entra | Rama del PR | Base del PR |
|---|---|---|
| Una tarea a su épica | `[ticket]-[titulo]` | `feature/[ticket]-[titulo]` |
| Una épica a integración | `feature/[ticket]-[titulo]` | `develop` |
| Un release | `develop` | `main` |

El PR es donde el trabajo se revisa y queda registrado. Un `git merge` desde la máquina de alguien se saltea la revisión y no deja rastro de quién aprobó qué.

Antes de mergear: `npm test` en verde y el criterio de «Listo cuando» del ticket cumplido.

La **descripción** del PR es una sola línea con lo que se hizo. La especificación técnica vive en el ticket, no en el PR.

## Qué nunca se sube

Credenciales, archivos `.env`, `node_modules/`, `dist/` y volcados de la base. El `.gitignore` ya los cubre; si algo se te escapó, avisá antes de seguir.
