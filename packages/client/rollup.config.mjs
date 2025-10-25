import path from "path";
import nodeResolve from "@rollup/plugin-node-resolve";
import esbuild from 'rollup-plugin-esbuild'
import dotenv from "rollup-plugin-dotenv"
import dts from "rollup-plugin-dts";

import pkg from "./package.json" with { type: "json" };

const input = "src/index.ts"; // Main entry point for the library

const bundles = [
  {
    input: input,
    outputFile: pkg.module,
    format: "esm",
  },
  {
    input: input,
    outputFile: pkg.main,
    format: "cjs",
  }
];

// Get dependencies to mark them as external
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

const bundlesConfig = [];

bundles.forEach((bundle, index) => {
  bundlesConfig.push({
    input: bundle.input,
    output: {
      file: bundle.outputFile, // Output file for ESM
      format: bundle.format,
      sourcemap: true,
    },
    plugins: [
      nodeResolve({
        extensions: [".mjs", ".js", ".json", ".node", ".ts", ".tsx"],
      }),
      esbuild({
        include: [
          "src/**/*.{ts,tsx,js,jsx}",
          // Include workspace sources:
          "../**/src/**/*.{ts,tsx,js,jsx}",
          "../../packages/**/src/**/*.{ts,tsx,js,jsx}",
        ],
        sourceMap: true,
        target: "es2019",
        tsconfig: "./tsconfig.json",
      }),
    ],
    external,
  });

  // Dotenv injection for each bundle
  bundlesConfig.push({
    input: bundle.outputFile,
    output: {
      dir: path.dirname(bundle.outputFile),
    },
    plugins: [dotenv()],
    external,
  });
});

const typesBundleConfig = {
  input: input,
  output: {
    file: pkg.types,
    format: "esm",
  },
  plugins: [
    nodeResolve({
      extensions: [".mjs", ".js", ".json", ".node", ".ts", ".tsx"],
    }),
    dts(),
  ],
  external,
};

export default [
  ...bundlesConfig, 
  typesBundleConfig
];