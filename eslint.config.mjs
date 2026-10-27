import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  // three.js objects (cameras, materials, textures, shared refs) are mutated imperatively in frame callbacks and effects:
  // that is how R3F works, so the compiler's immutability rules don't apply to the 3D code.
  {
    files: ["src/components/three/**", "src/components/home/scene/**"],
    rules: { "react-hooks/immutability": "off", "react-hooks/preserve-manual-memoization": "off" },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
