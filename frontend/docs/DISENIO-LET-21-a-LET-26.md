# Diseño — LET-21 a LET-26 (pantallas de autenticación)

Épicas: LET-34 (Registro), LET-35 (Inicio y cierre de sesión), LET-36 (Recuperación).
Autor: sesión front-letrados. Fecha: 2026-09-11.

Documento de decisiones antes de codear, como pide la forma de trabajo. La
mayoría de las decisiones ya vienen cerradas en el mensaje del integrador; acá
sólo se registran las que hubo que interpretar o que no estaban.

---

## 1. Contexto de sesión (LET-21)

`ProveedorSesion` guarda `{ usuario, cargando }` en estado y expone
`entrar(token, usuario)` / `salir()`. Al montar: si hay token, llama
`GET /auth/yo`; si no, `cargando` arranca en `false` sin pedir nada.

**Interpretación de "si no hay token, redirige" en `RutaProtegida` sin leer el
token directo.** El contexto expone `{ usuario, cargando, entrar, salir }` —
sin un campo de token. La regla que implementé usa sólo `usuario` y `cargando`:

- `cargando` → no renderiza nada (contenedor vacío).
- `!cargando && !usuario` → redirige a `/login`.
- `!cargando && usuario` → renderiza los hijos.

Por qué alcanza sin exponer el token: si no hay token, `cargando` arranca en
`false` y `usuario` nunca se completa → redirige (igual que antes). Si hay
token y `/auth/yo` responde 401 → se borra el token y `usuario` queda en
`null` → redirige (sesión inválida, correcto). Si hay token pero el pedido
falla por otro motivo (503, 501 de hoy, sin red) → **el token no se borra**,
pero `usuario` tampoco se completa, así que la ruta protegida igual redirige
en *esta* carga. La diferencia con "sesión inválida" es que el token sigue
ahí: la próxima vez que el servidor responda, un login nuevo no hace falta —
alcanza con recargar. No hacía falta inventar un campo nuevo en el contexto
para esto.

`entrar(token, usuario)` guarda el token con `guardarToken` y pone `usuario`
en memoria — no vuelve a pedir `/auth/yo`. `salir()` borra el token y limpia
`usuario`.

---

## 2. Patrón común de formulario en las pantallas

Las cuatro pantallas con formulario (Login, Registro, Recuperar, Contraseña
nueva) repiten la misma forma:

- Estado local por campo con `useState` (`valor`, y un mapa `erroresCampo` para
  los que vengan de `DATOS_INVALIDOS`).
- Estado `enviando` (bool) para la `Pastilla` (`estado="cargando"` mientras
  está en `true`).
- Estado `errorGeneral` (string | null) para el aviso arriba del formulario.
- Al enviar: `preventDefault`, limpiar errores previos, `enviando = true`,
  `try { await enviar(...) } catch (e) { ...mapear... } finally { enviando = false }`.
- Mapeo de `ErrorApi`:
  - `codigo === 'DATOS_INVALIDOS'` (400) → `e.detalles` es `{ campo, mensaje }[]`;
    se vuelca a `erroresCampo` y **no** se muestra `errorGeneral` (los avisos
    quedan en cada `Campo`).
  - Cualquier otro código (incluido `HTTP_501` de hoy, `SIN_RED`,
    `RESPUESTA_NO_JSON`) → `errorGeneral = e.mensaje`, sin marcar campos. El 501
    no se trata distinto: usa el mismo camino genérico, como pidió el
    integrador.
  - Las pantallas con una regla de negocio específica sobre un código (login:
    401 `CREDENCIALES_INVALIDAS` nunca marca campo, sólo `errorGeneral`;
    registro: 409 `EMAIL_DUPLICADO` sí marca el campo correo) la aplican antes
    de caer al genérico.

Formulario en un `<form onSubmit={...}>` real (no sólo el botón), para que
Enter también envíe — no estaba escrito pero es el comportamiento esperado de
cualquier formulario HTML y no contradice nada. Los `<input>` llevan
`required` por semántica/accesibilidad aunque el `<form>` use `noValidate`
(la validación de formato la maneja el backend vía `DATOS_INVALIDOS`, no el
navegador — así los mensajes de error son siempre los del sistema de diseño).

## 3.1 `PantallaAuth.css`

Layout compartido por las cuatro pantallas con formulario (Entrar, Crear
cuenta, Recuperar/Enlace enviado, Contraseña nueva): franja de color pleno,
grid a dos columnas, orbes decorativos, alerta genérica, pie con enlaces.
Vive en `frontend/src/paginas/PantallaAuth.css` con nombres de clase
`.pantalla-auth*`.

**Por qué un archivo por página y no un componente `<PantallaAuth>`:** las
seis tareas salen de cuatro ramas de épica que hoy no comparten historia
(`LET-34`, `LET-35`, `LET-36` más la que ya existía). Un componente
compartido creado en una rama no aparece en las otras hasta que el
integrador las una. La salida más simple es que cada rama que lo necesite
cree el mismo archivo `PantallaAuth.css` con el mismo contenido (no un
`.css` por pantalla): si el contenido es idéntico, un merge futuro no
tiene por qué generar conflicto, y ya queda todo en un solo lugar para
cuando las ramas se junten. Cada página sólo pone su propio `background`
(el pleno) inline.

---

## 3. Layout de pantalla (compartido por Login/Registro/Recuperar/Nueva)

Estructura de las maquetas *Pleno\**: una franja de color pleno de pantalla
completa, grid a dos columnas (lema a la izquierda, `Tarjeta` a la derecha,
424px), con tres círculos ("orbes") decorativos de fondo. No hay un componente
`Marco`/`PantallaAuth` compartido todavía (ninguna épica lo pidió) — cada
página arma su propio `<main>` con esa estructura y su propio `.css`, copiando
los valores exactos de la hoja de sistema. Si en la próxima tarea se repite
una tercera vez, vale la pena extraerlo — no antes (no anticipar de más).

Valores tomados de las maquetas: `padding: 52px 56px`, `grid-template-columns:
1fr 424px`, `gap: 52px`, orbes `border: 2px solid rgba(.., .12-.13)` en 3
tamaños con posiciones fijas por pantalla. El responsive fino (breakpoints
860/480) es LET-28, fuera de alcance — pero como el `Tarjeta` y el `Lema` ya
son responsive por sí mismos (LET-20), no hace falta nada extra para que no
rompan; el `marco`/grid de cada página sí queda fijo a desktop por ahora.

---

## 4. LET-23 — Login

- Campos: `email` (Correo), `contrasena` (Contraseña). Sin toggle de
  mostrar/ocultar (ver aviso al integrador — no está en el contrato escrito y
  el componente `Campo` no lo soporta hoy).
- `enviar('/auth/login', { email, contrasena })`.
- Éxito → `entrar(token, usuario)` + `navigate('/')`.
- Error: sigue el patrón general del punto 2 — `DATOS_INVALIDOS` (400) sí
  mapea `detalles` a cada `Campo` (es una validación de formato, no filtra si
  la cuenta existe). Para **cualquier otro código** (sobre todo
  `CREDENCIALES_INVALIDAS`, 401) va **un solo mensaje genérico** arriba del
  formulario con `e.mensaje`, y ningún `Campo` se marca — ni con `error`, ni
  con texto. Es la decisión de seguridad del integrador: decir cuál de los dos
  campos falló (correo inexistente vs. contraseña incorrecta) le confirma a un
  desconocido qué cuentas existen.
- Pie: enlaces a `/recuperar` y a `/registro`.

## 5. LET-27 — Home

- `useSesion()` para `usuario` y `salir`.
- Mientras no haya `usuario` (todavía cargando, o el backend está caído y
  nunca se resolvió): la pantalla igual se renderiza porque `RutaProtegida` ya
  filtró — pero por las dudas, el nombre usa `usuario?.nombre` con una reserva
  neutra si faltara.
- Botón "Cerrar sesión" → `salir()` + `navigate('/login')`.
- Lista de "lo que viene" copiada de `PlenoHome.dc.html` (los 4 pasos del
  proyecto), pleno verde.

## 6. LET-24 — Registro

- Campos: `nombre` (pista "Hasta 80 caracteres", sin mínimo), `email`,
  `contrasena` con los tres requisitos en vivo (≥8, una letra, un número),
  evaluados en cliente con expresiones regulares simples mientras se escribe.
- `enviar('/auth/registro', { nombre, email, contrasena })`.
- Éxito (201) → `guardarToken(token)` directo de `servicios/token.js` (esta
  rama no tiene el contexto de LET-21) + `navigate('/')`.
- `EMAIL_DUPLICADO` (409) → error en el `Campo` de correo, con el enlace a
  `/login` como en la maqueta (el texto del error puede llevar el link inline).
- `DATOS_INVALIDOS` (400) → mapear `detalles` a cada campo.
- Otro código → `errorGeneral`.
- Pleno naranja.

## 7. LET-25 — Recuperar / enlace enviado

- Una sola pantalla con dos estados en memoria (`useState('pedir' | 'enviado')`),
  misma ruta `/recuperar`, sin cambios al enrutador.
- Estado `pedir`: pleno **tinta**, un campo `email`, `enviar('/auth/recuperacion', { email })`.
- Éxito → pasa a estado `enviado`, pleno **verde**, mensaje condicional fijo
  (no depende de la respuesta, que siempre es 200 con el mismo texto).
- El botón en reposo va en el complementario de tinta (naranja) — la maqueta
  de *Recuperar* está dibujada en estado cargando (hundido/gris), no es su
  reposo; ya lo sabíamos de LET-20.

## 8. LET-26 — Contraseña nueva

Resuelto por el integrador (2026-09-11): **dos campos**, como la maqueta.

- "Contraseña nueva" (con los tres requisitos en vivo) + "Repetila".
- Que coincidan es **validación sólo de cliente**: si no coinciden, no se
  llama a la API — error en el segundo campo, y listo. Si coinciden, se ve el
  indicador "Coinciden" de la maqueta.
- El cuerpo que se manda **no cambia**: `{ token, contrasena }`. La
  repetición nunca viaja a la API.
- El botón queda deshabilitado mientras no se cumplan los tres requisitos y
  las dos contraseñas no coincidan.

## 8.1 Los tres requisitos de contraseña (Registro y Contraseña nueva)

Las maquetas se contradicen entre sí (`PlenoRegistro`: tres pastillas; `PlenoNueva`:
dos, con "letra y número" juntas). Resuelto por el integrador: **van las tres,
con el texto de `PlenoRegistro`**, iguales en las dos pantallas:

- "Al menos 8 caracteres"
- "Una letra"
- "Un número"

Motivo: cada pastilla es una regla que el backend valida por separado; juntar
dos en un indicador no deja saber cuál falta.

## 8.2 El botón "Mostrar/Ocultar" contraseña

Resuelto por el integrador: va en *Entrar* y en *Contraseña nueva* (están en
esas maquetas), no en *Crear cuenta* (no está en la suya).

Se agrega a `componentes/Campo.jsx` una prop `conMostrar` (default `false`,
no cambia el aspecto de ningún campo existente): cuando está prendida, dibuja
el botón "Mostrar"/"Ocultar" en la fila de la etiqueta y alterna el `type` del
input entre `password` y `text`. `type="button"` (no envía el formulario), no
le roba el foco al input. Se implementa en LET-23 (primera pantalla con
contraseña); LET-26 la reusa si para cuando se codea ya está disponible en la
rama — si no, el campo queda sin el botón y se avisa (la integración de git la
resuelve el integrador).

---

## 9. Checklist

- [x] Documento de diseño
- [x] `git fetch` + verificar que las 4 ramas de épica están en `ed11678`
- [x] Pregunta al integrador (LET-26, contradicción de maquetas, botón Mostrar) — resuelta
- [x] LET-21 — contexto de sesión
- [x] LET-23 — login + `conMostrar` en `Campo`
- [x] LET-27 — home
- [ ] LET-24 — registro
- [ ] LET-25 — recuperar / enlace enviado
- [ ] LET-26 — contraseña nueva
