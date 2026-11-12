import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registrar } from '../src/domain/auth.js';
import { agregarLibro } from '../src/domain/libros.js';
import { publicar, subirFoto } from '../src/domain/publicaciones.js';
import { solicitar, aceptar, confirmar, flaguearVencidas } from '../src/domain/solicitudes.js';
import { reportar } from '../src/domain/reportes.js';
import { valorar } from '../src/domain/valoraciones.js';
import { segundosDePlazo } from '../src/domain/plazo.js';
import { validarLibro, validarRegistro } from '../src/api/validacion.js';
import { buscarUsuarioPorEmail } from '../src/data/usuarios.js';
import { consultar, cerrarPool } from '../src/infra/bd.js';

/**
 * Datos de demostracion para la entrega final (LET-173). Siembra tres cuentas,
 * seis libros, cinco publicaciones con foto y un intercambio en cada estado
 * que muestra la presentacion: completado y valorado, flagueado con un
 * reporte, y pendiente.
 *
 * Usa las funciones del dominio, asi los datos pasan por las mismas reglas que
 * la API. El unico SQL directo es promover a la administradora, el mismo
 * camino que documenta el README. La contrasena llega por `DEMO_CONTRASENA`:
 * no vive en el repositorio. Diseño en la epica LET-117 de Notion.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Las tres cuentas. Si alguna ya existe, el sembrado no corre. */
export const CUENTAS = {
  mariana: { nombre: 'Mariana Aquino', email: 'mariana@ejemplo.com' },
  diego: { nombre: 'Diego Duarte', email: 'diego@ejemplo.com' },
  admin: { nombre: 'Administración Letrados', email: 'admin@ejemplo.com' },
};

/** Libros de cada cuenta. `tapa` es el PNG de `scripts/demo/` que se publica como foto. */
const LIBROS = {
  mariana: [
    {
      clave: 'rayuela',
      tapa: 'rayuela.png',
      nota: 'Lo entrego en el centro de Asunción, cerca de la plaza Uruguaya.',
      datos: {
        titulo: 'Rayuela',
        autor: 'Julio Cortázar',
        cantidad: 2,
        editorial: 'Cátedra',
        anio: 1984,
        edicion: 'Letras Hispánicas',
        isbn: '9788437604572',
        estadoConservacion: 'bueno',
        descripcion: 'Tapa blanda, algunas hojas subrayadas en lápiz.',
      },
    },
    {
      clave: 'cienAnios',
      tapa: 'cien-anios.png',
      nota: 'Prefiero cambiarlo por algo de Rulfo o de Roa Bastos.',
      datos: {
        titulo: 'Cien años de soledad',
        autor: 'Gabriel García Márquez',
        cantidad: 1,
        editorial: 'Sudamericana',
        anio: 1967,
        estadoConservacion: 'muy_bueno',
      },
    },
    {
      clave: 'hijoDeHombre',
      datos: { titulo: 'Hijo de hombre', autor: 'Augusto Roa Bastos', cantidad: 1, estadoConservacion: 'gastado' },
    },
  ],
  diego: [
    {
      clave: 'ficciones',
      tapa: 'ficciones.png',
      nota: 'Edición vieja, pero completa.',
      datos: {
        titulo: 'Ficciones',
        autor: 'Jorge Luis Borges',
        cantidad: 1,
        editorial: 'Emecé',
        anio: 1944,
        estadoConservacion: 'gastado',
      },
    },
    {
      clave: 'elTunel',
      tapa: 'el-tunel.png',
      nota: null,
      datos: { titulo: 'El túnel', autor: 'Ernesto Sabato', cantidad: 1, estadoConservacion: 'bueno' },
    },
    {
      clave: 'pedroParamo',
      tapa: 'pedro-paramo.png',
      nota: 'Lo tengo repetido.',
      datos: {
        titulo: 'Pedro Páramo',
        autor: 'Juan Rulfo',
        cantidad: 1,
        editorial: 'Fondo de Cultura Económica',
        anio: 1955,
        estadoConservacion: 'nuevo',
      },
    },
  ],
};

/**
 * Siembra los datos de demostracion.
 *
 * @param {object} opciones
 * @param {string} opciones.contrasena - la de las tres cuentas.
 * @param {import('../src/data/usuarios.js').Ejecutor} [opciones.ejecutar] - sin el, el pool real.
 * @param {(mensaje: string) => void} [opciones.informar]
 * @returns {Promise<{ cuentas: Record<string, string>, solicitudes: Record<string, string> } | null>}
 *   los ids creados, o `null` si ya estaba sembrado.
 */
export async function sembrarDemo({ contrasena, ejecutar, informar = console.log }) {
  const op = { ejecutar };

  for (const { email } of Object.values(CUENTAS)) {
    if (await buscarUsuarioPorEmail(email, ejecutar)) {
      informar(`Ya existe ${email}: la demo ya está sembrada. No se escribió nada.`);
      return null;
    }
  }

  const ids = {};
  for (const [clave, cuenta] of Object.entries(CUENTAS)) {
    const datos = validarRegistro({ ...cuenta, contrasena });
    ids[clave] = (await registrar(datos, op)).usuario.id;
  }
  await (ejecutar ?? consultar)(`UPDATE usuarios SET rol = 'administrador' WHERE id = $1`, [ids.admin]);
  informar(`+ cuentas: ${Object.values(CUENTAS).map((c) => c.email).join(', ')}`);

  const libros = {};
  const publicaciones = {};
  for (const [duenio, lista] of Object.entries(LIBROS)) {
    for (const { clave, datos, tapa, nota } of lista) {
      libros[clave] = (await agregarLibro(ids[duenio], validarLibro(datos), op)).id;
      if (!tapa) continue;
      publicaciones[clave] = (await publicar(ids[duenio], { libroId: libros[clave], nota }, op)).id;
      const bytes = await readFile(join(__dirname, 'demo', tapa));
      await subirFoto(ids[duenio], publicaciones[clave], { tipo: 'image/png', bytes }, op);
    }
  }
  informar(`+ ${Object.keys(libros).length} libros y ${Object.keys(publicaciones).length} publicaciones con foto`);

  // Completado y valorado: Mariana pide El tunel y ofrece Hijo de hombre.
  const completada = (
    await solicitar(ids.mariana, { publicacionId: publicaciones.elTunel, libroOfrecidoId: libros.hijoDeHombre }, op)
  ).id;
  await aceptar(ids.diego, completada, op);
  await confirmar(ids.diego, completada, op);
  await confirmar(ids.mariana, completada, op);
  await valorar(ids.mariana, completada, { puntaje: 5, comentario: 'Muy puntual y el libro estaba como lo describió.' }, op);
  await valorar(ids.diego, completada, { puntaje: 4, comentario: 'Todo bien. El libro tenía más marcas de las que esperaba.' }, op);

  // Flagueado con reporte: Mariana pide Ficciones y ofrece Rayuela. Se acepta
  // con un `ahora` corrido hacia atras, asi el plazo vencio hace una hora sin
  // tocar el parametro global de produccion.
  const flagueada = (
    await solicitar(ids.mariana, { publicacionId: publicaciones.ficciones, libroOfrecidoId: libros.rayuela }, op)
  ).id;
  const plazo = await segundosDePlazo(op);
  await aceptar(ids.diego, flagueada, { ...op, ahora: new Date(Date.now() - (plazo + 3600) * 1000) });
  await flaguearVencidas(op);
  await reportar(
    ids.mariana,
    flagueada,
    { descripcion: 'Quedamos el martes en la plaza y no vino. Le escribí dos veces y no contestó.' },
    op,
  );

  // Pendiente: Diego pide Cien años de soledad y ofrece Pedro Paramo.
  const pendiente = (
    await solicitar(ids.diego, { publicacionId: publicaciones.cienAnios, libroOfrecidoId: libros.pedroParamo }, op)
  ).id;
  informar('+ intercambios: uno completado y valorado, uno flagueado con reporte y uno pendiente');

  return { cuentas: ids, solicitudes: { completada, flagueada, pendiente } };
}

/** Lo que corre `npm run sembrar:demo`. */
async function principal() {
  const contrasena = process.env.DEMO_CONTRASENA;
  if (!contrasena) {
    throw new Error('Falta DEMO_CONTRASENA: la contraseña de las cuentas de demostración.');
  }
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
  console.log(`Sembrando la demo en ${new URL(process.env.DATABASE_URL).host}`);
  try {
    await sembrarDemo({ contrasena });
  } finally {
    await cerrarPool();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  principal().catch((error) => {
    console.error(error.message);
    for (const { campo, mensaje } of error.detalles ?? []) console.error(`- ${campo}: ${mensaje}`);
    process.exit(1);
  });
}
