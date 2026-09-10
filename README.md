# Letrados

Plataforma web de intercambio y donación de libros. Taller de Ingeniería de Software.

El ciclo 1 entrega el **módulo de autenticación**: registro, inicio y cierre de sesión y recuperación de contraseña.

## Tecnologías

JavaScript · React · Node/Express · PostgreSQL (Neon) · Vitest · JSDoc + OpenAPI

## Estructura

Es un monorepo con workspaces de npm. Se instala una sola vez desde la raíz y se despliega como una sola pieza: Express sirve la API en `/api` y los estáticos que compila Vite.

```
letrados/
├── backend/
│   ├── src/
│   │   ├── data/          consultas SQL, sin reglas de negocio
│   │   ├── domain/        reglas de negocio, orquesta data
│   │   ├── api/           rutas, controladores y middlewares
│   │   ├── infra/         conexión, jwt, hash, correo
│   │   └── app.js
│   ├── migraciones/
│   └── pruebas/
└── frontend/
    └── src/
        ├── paginas/
        ├── componentes/
        ├── servicios/     cliente HTTP
        └── contexto/      estado de sesión
```

Dos reglas de arquitectura que no se negocian: **`data` no tiene reglas de negocio** y **`domain` no sabe de HTTP**.

## Cómo arrancar

Hace falta Node 20.12 o superior.

```bash
git clone git@github.com:sosa-marcelo/letrados.git
cd letrados
npm install                 # instala los dos workspaces de una vez
cp .env.example .env        # y completar los valores
npm run migrar              # crea las tablas
npm run dev                 # levanta los dos proyectos
```

`npm run dev` arranca la API en http://localhost:3000 y la interfaz en
http://localhost:5173, las dos en la misma terminal y con recarga automática.
Vite redirige `/api` al backend, así que en desarrollo no hace falta CORS.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta backend y frontend juntos, con recarga automática. Es el modo de trabajo. |
| `npm start` | Compila el frontend y lo sirve desde Express, todo en un proceso y un puerto. Es como corre en producción. |
| `npm run build` | Solo compila el frontend a `frontend/dist`. |
| `npm run servir` | Sirve sin compilar. Solo si ya compilaste antes. |
| `npm test` | Pruebas de los dos workspaces, con cobertura. |
| `npm run migrar` | Aplica las migraciones pendientes. Antes de tocar nada avisa a qué base va a aplicar. |

**`npm run dev` y `npm start` no son lo mismo.** En `dev` el frontend lo sirve
Vite; en `start` lo sirve Express desde el build, que es el único modo que
ejercita el orden de montaje de la API, los estáticos y el comodín de la SPA.
Conviene correr `npm start` antes de dar algo por terminado.

## Sobre el archivo `.env`

`dev`, `start` y `migrar` leen el `.env` de la raíz si existe. Las variables que
ya estén en el entorno **le ganan** al archivo, así que en el servidor mandan las
del hosting y el archivo no molesta.

`npm test` **no** lo lee, a propósito: las pruebas usan una base en memoria y no
deben poder tocar una base real por accidente.

## Variables de entorno

Están todas en `.env.example`. El archivo `.env` **nunca** se sube al repositorio.

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL. En Neon, endpoint `-pooler` y `sslmode=require`. |
| `JWT_SECRETO` | Firma de los tokens de sesión. |
| `JWT_VENCIMIENTO` | Cuánto dura la sesión. Por defecto `24h`. |
| `CORREO_PROVEEDOR` | `consola` en desarrollo, el proveedor real en producción. |
| `CORREO_API_KEY` | Clave del proveedor de correo. |
| `URL_FRONTEND` | Para armar el enlace de recuperación que va en el correo. |

## Cómo trabajamos

Las convenciones de ramas, commits y merges están en [CONTRIBUTING.md](CONTRIBUTING.md).

El tablero de tareas y la documentación del ciclo viven en Notion.
