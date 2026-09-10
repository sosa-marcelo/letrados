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

Hace falta Node 20 o superior.

```bash
git clone git@github.com:sosa-marcelo/letrados.git
cd letrados
npm install                 # instala los dos workspaces de una vez
cp .env.example .env        # y completar los valores
npm run migrar              # crea las tablas
```

Después, en dos terminales:

```bash
npm run dev:backend         # API en http://localhost:3000
npm run dev:frontend        # interfaz en http://localhost:5173
```

Vite redirige `/api` al backend, así que en desarrollo no hace falta CORS.

Otros comandos:

```bash
npm test                    # pruebas de los dos workspaces
npm run build               # compila el frontend
npm start                   # sirve API y estáticos en un solo proceso
```

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
