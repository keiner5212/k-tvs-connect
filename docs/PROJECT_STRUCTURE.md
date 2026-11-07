# K Tvs Connect

A personal React Native companion for your own scooter. It talks to the bike over
Bluetooth LE using the protocol recovered from the original app, and it uses free
map services. There is no account, no server of our own, and no TVS backend is
ever contacted.

```
k-tvs-connect/
  App.tsx                root: opens the database, loads the garage, renders the navigator
  index.ts               expo entry point
  app.json               expo config, app name, bundle ids, permissions, plugins
  app.config.js          env overrides for the service urls
  babel.config.js        nativewind + path aliases (module-resolver)
  metro.config.js        metro bundler config
  tailwind.config.js     nativewind spacing and radius scale
  eslint.config.js       flat config, typescript + react + react-native
  tsconfig.json          strict typescript with the same aliases
  eas.json               eas build profiles
  AGENTS.md              project conventions, read before editing
  docs/                  setup, structure, protocol, free services, reverse engineering
  mcp/                   MCP server config for the AI client
  plugins/               config plugins: backup policy, ble permissions
  tools/                 reverse engineering scripts and the bundle check
  docker/                apk build image and the local routing service
  src/
    assets/images/       app icons and splash
    ble/                 the bluetooth protocol and the connection controller
    components/          controls, feedback, garage, dashboard, map, settings
    config/              theme tokens, i18n bootstrap
    constants/           shared constant values
    hooks/               reusable hooks
    locales/             i18n json files
    navigation/          navigators and param lists
    screens/             screen components
    services/            database, http client, geocoding, routing, pin
    stores/              zustand stores
    types/               shared TypeScript types
    utils/               helpers, polyline, logger
```

## Boundaries

- `src/ble` owns the bluetooth link and the protocol. Nothing else imports
  `react-native-ble-plx`.
- `src/services/db` owns the local database. It is encrypted with SQLCipher and the
  key lives in the android keystore through `expo-secure-store`.
- `src/services/http.service.ts` is the only network entry point. It refuses
  plain http outside the local network, refuses redirects, refuses a list of TVS
  hosts and spaces the requests per host.
- `src/utils/logger.ts` is the only module that writes to the console. It drops
  every field that is not on a short allow list, so coordinates, frame numbers,
  bluetooth addresses and urls never reach a log.
- Live telemetry stays in memory. Only ride summaries reach the disk.
- `src/stores` owns the client state, one writer per value.
- `src/config/theme.ts` owns colors, spacing and radii. No literals in components.
