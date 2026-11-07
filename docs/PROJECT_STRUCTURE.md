# Project structure

```
k-tvs-connect/
  App.tsx                root component: status bar, error boundary, navigator
  index.ts               expo entry point
  app.json               expo config, app name, bundle ids, permissions
  babel.config.js        nativewind + path aliases (module-resolver)
  metro.config.js        metro bundler config
  tailwind.config.js     nativewind preset, spacing and radius scale
  eslint.config.js       flat config, typescript + react + react-native
  tsconfig.json          strict typescript with the same aliases
  eas.json               eas build profiles
  AGENTS.md              project conventions, read before editing
  docs/                  setup, structure, API contract, RE notes
  mcp/                   MCP server config for the AI client
  tools/                 reverse engineering scripts
  src/
    assets/images/       app icons and splash
    components/          reusable presentational components
    config/              theme tokens, envs, i18n bootstrap
    constants/           shared constant values
    hooks/               reusable hooks
    locales/             i18n json files
    navigation/          navigators, param lists
    screens/             screen components
    services/            api clients and data access
    stores/              zustand stores
    types/               shared TypeScript types
    utils/               pure helpers
```

## Boundaries

- `src/services` owns HTTP. Screens never call axios directly.
- `src/stores` owns client state. A store has one writer.
- `src/config/envs.ts` owns environment values and is not committed.
- `src/config/theme.ts` owns colors, spacing and radii. No literals in components.
