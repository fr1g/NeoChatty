import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const pkg = {
  dependencies: {
    "axios": "^1.15.0",
    "socket.io-client": "^4.8.3"
  }
};

export default [
  // ESM build
  {
    input: 'index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    external: Object.keys(pkg.dependencies),
    plugins: [
      resolve({
        browser: true,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
      }),
      terser({
        compress: {
          dead_code: true,
          drop_console: false,
        },
        output: {
          comments: false,
        },
      }),
    ],
  },
  // Dev build (unminified)
  {
    input: 'index.ts',
    output: {
      file: 'dist/index.js',
      format: 'esm',
      sourcemap: true,
    },
    external: Object.keys(pkg.dependencies),
    plugins: [
      resolve({
        browser: true,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
      }),
    ],
  },
];
