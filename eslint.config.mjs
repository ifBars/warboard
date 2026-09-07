import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";
import hooks from "eslint-plugin-react-hooks";
import refresh from "eslint-plugin-react-refresh";
import deSlopUi from "./.de-slop-ui/eslint.flat-config.mjs";

export default ts.config(
  { ignores: ["dist", "work", ".de-slop-ui", "node_modules"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": hooks, "react-refresh": refresh },
    rules: {
      ...hooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["useEffect", "useLayoutEffect"],
              message:
                "Use derived state, events, loaders, or a dedicated lifecycle adapter.",
            },
          ],
        },
      ],
    },
  },
  ...deSlopUi,
  { files: ['**/*.css'], rules: { '@typescript-eslint/no-unused-vars': 'off' } },
);
