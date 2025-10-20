import path from "path";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import del from 'rollup-plugin-delete'
import dotenv from "rollup-plugin-dotenv"
import { dts } from "rollup-plugin-dts";

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

const bundleConfigs = [];

bundles.forEach((bundle, index) => {
  bundleConfigs.push({
    input: bundle.input,
    output: {
      file: bundle.outputFile, // Output file for ESM
      format: bundle.format,
      sourcemap: true,
    },
    plugins: [
      index == 0 &&
        del({
          targets: "dist/*",
          verbose: true,
        }),
      resolve(),
      typescript({
        tsconfig: "../../tsconfig.json",
        declaration: index == 0, // Only generate declarations once
        declarationDir: path.dirname(bundle.outputFile),
      }),
    ],
    external,
  });

  // Dotenv injection for each bundle
  bundleConfigs.push({
    input: bundle.outputFile,
    output: {
      dir: path.dirname(bundle.outputFile),
    },
    plugins: [
      dotenv()
    ],
    external,
  });
});

const typesBundleConfig = {
  input: pkg.module,
  output: {
    file: "dist/index.d.ts", // Output file for the declaration file
    format: "esm",
  },
  plugins: [
    dts({
      include: ['src'],
    }),
    del({
      targets: "dist/esm/**/*.d.ts",
      verbose: true,
      hook: "buildEnd",
    }),
  ],
  external,
};

export default [...bundleConfigs, typesBundleConfig];