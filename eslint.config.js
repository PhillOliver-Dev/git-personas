import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Clean code
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/consistent-type-exports": "error",

      // Style
      "eqeqeq": "error",
      "no-console": "warn",
      "curly": ["error", "multi-line"],
      "no-multiple-empty-lines": ["error", { max: 1 }],
      "object-curly-spacing": ["error", "always"],
    },
  },
  {
    files: ["src/hooks/**"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["src/cli.tsx"],
    rules: {
      "no-console": "off",
    },
  },
);
