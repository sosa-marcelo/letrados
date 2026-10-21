# Letrados

Plataforma web de intercambio y donación de libros. Taller de Ingeniería de Software.

Producción: https://letrados-dusky.vercel.app

| Ciclo | Entrega | Requisitos |
|---|---|---|
| 1 (v0.1.0) | Módulo 1 · Autenticación: registro, inicio y cierre de sesión, recuperación de contraseña | RF-01 a RF-04 |
| 2 (v0.2.0) | Módulo 2 · Usuarios y roles: sesiones revocables, perfil propio y público, administración de cuentas, baja | RF-05 a RF-09 |
| 2 (v0.2.0) | Módulo 3 · Catálogo de libros: alta, modificación, retiro y consulta | RF-10 a RF-13 |

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
| `npm run docs` | Genera la documentación del código (JSDoc) y de la API (OpenAPI) en `frontend/public/documentacion/`. |

**`npm run dev` y `npm start` no son lo mismo.** En `dev` el frontend lo sirve
Vite; en `start` lo sirve Express desde el build, que es el único modo que
ejercita el orden de montaje de la API, los estáticos y el comodín de la SPA.
Conviene correr `npm start` antes de dar algo por terminado.

## Documentación del código

`npm run docs` genera dos documentos que se publican junto con la aplicación:

- **Código (JSDoc):** `/documentacion/index.html` — las cuatro capas del backend, a partir de los comentarios.
- **API (OpenAPI 3.1):** `/documentacion/api.html` — todos los endpoints, con cuerpos, respuestas y códigos de error.
  La fuente es `backend/docs/openapi.yaml`.

Después de cambiar comentarios o endpoints, regenerarla y subirla en el mismo PR.

## Recorrido de demostración (ciclo 2)

Con una cuenta administradora (ver abajo) y una cuenta común de prueba:

1. **Sesiones revocables (RF-02, RF-03).** Entrar con la cuenta común en dos navegadores. Salir en uno: el otro sigue adentro; volver atrás en el primero lleva al login.
2. **Catálogo (RF-10 a RF-13).** En *Mis libros*, agregar dos libros (probar cantidad 0: el formulario lo rechaza), buscar por parte del título o del autor, editar la cantidad y retirar uno.
3. **Perfil (RF-05, RF-08).** En *Perfil* se ve el correo (no editable) y *Ver cómo te ven* abre el perfil público, que no lo muestra.
4. **Administración (RF-06, RF-07).** Con la cuenta común, `/admin/cuentas` no está disponible. Con la administradora, buscar la cuenta común y bloquearla escribiendo su nombre: su sesión abierta se cierra y el login responde «Tu cuenta no está habilitada». Desbloquearla y volver a entrar.
5. **Baja (RF-09).** Con la cuenta común, *Perfil → Dar de baja*: pide la contraseña y escribir BAJA. Después, su perfil público figura como «Cuenta eliminada» y ya no puede entrar.

## Crear el primer administrador

Toda cuenta nueva nace con el rol `usuario` (RF-06) y no hay pantalla para
promover cuentas, porque ningún requisito la pide. El primer administrador se
crea una sola vez, contra la base, después de registrarse normalmente:

```sql
UPDATE usuarios SET rol = 'administrador' WHERE lower(email) = lower('correo@ejemplo.com');
```

El cambio vale al instante, sin volver a iniciar sesión: el rol se lee de la
base en cada petición, no del token.

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
