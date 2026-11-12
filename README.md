# Letrados

Plataforma web de intercambio y donación de libros. Taller de Ingeniería de Software.

Producción: https://letrados-dusky.vercel.app

| Ciclo | Entrega | Requisitos |
|---|---|---|
| 1 (v0.1.0) | Módulo 1 · Autenticación: registro, inicio y cierre de sesión, recuperación de contraseña | RF-01 a RF-04 |
| 2 (v0.2.0) | Módulo 2 · Usuarios y roles: sesiones revocables, perfil propio y público, administración de cuentas, baja | RF-05 a RF-09 |
| 2 (v0.2.0) | Módulo 3 · Catálogo de libros: alta, modificación, retiro y consulta | RF-10 a RF-13 |
| 3 (v1.0.0) | Módulo 4 · Publicaciones e intercambios: publicar con foto, explorar, solicitar, aceptar o rechazar, cancelar y confirmar | RF-14 a RF-21 |
| 3 (v1.0.0) | Módulo 5 · Plazo, reportes y valoraciones: vencimiento y flagueo, reportes, panel del administrador, valoraciones y reputación | RF-22 a RF-27 |

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
| `npm run sembrar:demo` | Carga los datos de demostración de la entrega final. Ver «Datos de demostración». |
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

## Recorrido de demostración (ciclo 3)

Con dos cuentas comunes, A y B, y una administradora. Antes de empezar, bajar
el plazo a 10 segundos (ver «Bajar el plazo de confirmación para la demo») y
volverlo a 24 horas al terminar.

1. **Publicar con foto (RF-14).** Con A, en *Mis libros*, agregar un libro con los datos nuevos (editorial, año, ISBN, estado de conservación) y *Publicar*, eligiendo una foto. Un PDF o una imagen de más de 2 MB se rechazan.
2. **Explorar (RF-15, RF-16).** Sin sesión, *Explorar* muestra la publicación con su foto y la encuentra por parte del título. Con A, la propia figura «Tuya» y no ofrece solicitarla.
3. **Solicitar y aceptar (RF-17 a RF-20).** Con B, abrir la publicación y *Solicitar intercambio* ofreciendo un libro propio. Con A, en *Solicitudes → Recibidas*, *Aceptar*: la publicación sale de Explorar y aparece la fecha límite. Cualquiera de las dos puede *Cancelar* mientras no esté completada.
4. **Confirmar y valorar (RF-21, RF-25 a RF-27).** Las dos cuentas hacen *Confirmar entrega* antes de que venza el plazo: pasa a «Completada». Cada una valora a la otra, una sola vez, y la valoración aparece en el perfil público de la valorada.
5. **Flaguear y reportar (RF-22 a RF-24).** Repetir el paso 3 con otro libro y no confirmar: a los 10 segundos, al recargar, figura «Flagueada». Con B, *Reportar un inconveniente*.
6. **Administración (RF-23, RF-24).** Con la administradora, *Flagueados* (`/admin/flagueados`) lista el intercambio con las dos partes, los dos libros y el reporte. Con una cuenta común, la ruta no está disponible.

Con los datos de demostración (ver abajo) los estados de los pasos 4 y 5 ya
están cargados, así que se muestran sin esperar el plazo.

## Crear el primer administrador

Toda cuenta nueva nace con el rol `usuario` (RF-06) y no hay pantalla para
promover cuentas, porque ningún requisito la pide. El primer administrador se
crea una sola vez, contra la base, después de registrarse normalmente:

```sql
UPDATE usuarios SET rol = 'administrador' WHERE lower(email) = lower('correo@ejemplo.com');
```

El cambio vale al instante, sin volver a iniciar sesión: el rol se lee de la
base en cada petición, no del token.

## Datos de demostración

`npm run sembrar:demo` carga en la base de `DATABASE_URL` lo que muestra la
presentación de la entrega final:

- **Cuentas:** dos comunes (`mariana@ejemplo.com` y `diego@ejemplo.com`) y una administradora (`admin@ejemplo.com`).
- **Libros y publicaciones:** seis libros con los datos nuevos y cinco publicaciones con foto.
- **Intercambios:** uno completado y valorado, uno flagueado con un reporte y uno pendiente.

La contraseña de las tres cuentas no vive en el repositorio: se pasa al correrlo.

```bash
DEMO_CONTRASENA='…' npm run sembrar:demo
```

Pasa por las mismas reglas que la API, porque usa las funciones del dominio. No
cambia el plazo de confirmación: el flagueado se acepta con una fecha corrida
hacia atrás. Si alguna de las tres cuentas ya existe, se detiene sin escribir
nada. Las tapas son imágenes generadas, en `backend/scripts/demo/`.

## Bajar el plazo de confirmación para la demo

Un intercambio aceptado tiene 24 horas para que las dos partes confirmen la
entrega (RF-22); si vence, se flaguea (RF-23). El plazo vive en la base, en la
tabla `parametros`, así que se cambia sin desplegar ni reiniciar. Para la
demostración se baja a 10 segundos:

```sql
UPDATE parametros SET valor = '10', actualizado_en = now()
 WHERE clave = 'plazo_confirmacion_segundos';
```

Y se vuelve a las 24 horas al terminar:

```sql
UPDATE parametros SET valor = '86400', actualizado_en = now()
 WHERE clave = 'plazo_confirmacion_segundos';
```

El plazo nuevo vale para lo que se acepte desde ese momento: un intercambio ya
aceptado conserva su fecha límite. No hace falta esperar a ningún proceso: la
API flaguea los vencidos cada vez que alguien lista, ve o actúa sobre una
solicitud, y cuando el administrador abre `/admin/flagueados`.

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
