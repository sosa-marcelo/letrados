import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // El backend no necesita DOM.
    environment: 'node',
    // Las pruebas viven en backend/pruebas/, con sufijo .prueba.js, replicando
    // la ruta de lo que prueban (pruebas/data/usuarios.prueba.js).
    include: ['pruebas/**/*.prueba.js'],
    coverage: {
      provider: 'v8',
      // Se reporta la cobertura de todo src/, pero el umbral solo se exige sobre
      // el dominio (RNF-06: 70% en la capa de reglas de negocio).
      include: ['src/**/*.js'],
      exclude: ['src/servidor.js'],
      reporter: ['text', 'html'],
      thresholds: {
        'src/domain/**/*.js': {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
      },
    },
  },
});
