import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const noUserFacingLiterals = {
  meta: {
    type: "problem",
    docs: {
      description: "require visible JSX copy to use localization resources",
    },
    messages: { literal: "Move user-visible text to a localization resource." },
    schema: [],
  },
  create(context) {
    const looksVisible = (value) =>
      value.trim().length > 1 && /[A-Za-z\u3400-\u9fff]/u.test(value);
    return {
      JSXText(node) {
        if (looksVisible(node.value)) {
          context.report({ node, messageId: "literal" });
        }
      },
      JSXAttribute(node) {
        if (
          ["aria-label", "placeholder", "title"].includes(node.name.name) &&
          node.value?.type === "Literal" &&
          typeof node.value.value === "string" &&
          looksVisible(node.value.value)
        ) {
          context.report({ node, messageId: "literal" });
        }
      },
    };
  },
};

export default tseslint.config(
  { ignores: ["dist"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["*.config.{js,ts}", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "sidequest-i18n": {
        rules: { "no-user-facing-literals": noUserFacingLiterals },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "sidequest-i18n/no-user-facing-literals": "error",
    },
  },
  {
    files: ["src/**/*.test.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    rules: { "sidequest-i18n/no-user-facing-literals": "off" },
  },
  {
    files: ["src/app/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@base-ui/react", "@base-ui/react/*"],
              message: "Import Base UI through shared/ui primitives.",
            },
            {
              group: ["@tauri-apps/*"],
              message:
                "Import native capabilities through shared/tauri wrappers.",
            },
          ],
        },
      ],
    },
  },
);
