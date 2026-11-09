# K Routes

A personal route planner for the phone. It plans a route for a scooter, it
avoids the photo detection cameras the authority published and the points the
rider marked as unwanted, and it follows the ride on the map with the position
of the phone. There is no account, no server of our own, and no vendor
backend is ever contacted.

```
k-routes/
  App.tsx                root: opens the database, loads the settings, renders the navigator
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
  docs/                  setup, structure, free services, cameras, arrival estimate
  plugins/               config plugins: backup policy, shared locations
  tools/                 the bundle check, the icon generator
  docker/                apk build image and the local routing service
  src/
    assets/images/       app icons and splash
    components/          controls, feedback, map, cameras, settings
    config/              theme tokens, i18n bootstrap
    constants/           shared constant values
    hooks/               reusable hooks
    locales/             i18n json files
    navigation/          navigators and param lists
    screens/             screen components
    services/            database, http client, geocoding, routing, tiles, pin
    stores/              zustand stores
    types/               shared TypeScript types
    utils/               helpers, polyline, logger
```

## Boundaries

- `src/services/db` owns the local database. It is encrypted with SQLCipher and the
  key lives in the android keystore through `expo-secure-store`.
- `src/services/http.service.ts` is the only network entry point. It refuses
  plain http outside the local network, refuses redirects, refuses a list of
  vendor hosts and spaces the requests per host.
- `src/utils/logger.ts` is the only module that writes to the console. It drops
  every field that is not on a short allow list, so coordinates and urls never
  reach a log.
- `src/stores` owns the client state, one writer per value.
- `src/config/theme.ts` owns colors, spacing and radii. No literals in components.
- The camera list is fetched once and stored on the device; the route is the
  only thing that leaves it, and only when the rider asks for it.
