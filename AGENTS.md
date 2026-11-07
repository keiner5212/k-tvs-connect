# Project conventions - k-tvs-connect

## Stack

Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript strict, legacy architecture.
Runs on a **development client**, not Expo Go: `npm start` uses `expo start --dev-client --clear`.
Android application id `com.ktvsconnect.app`, iOS bundle id `com.ktvsconnect.app`.

MapLibre React Native is pinned to `10.4.2`, the last release that supports the
legacy architecture. Moving to the new architecture means moving to `11.x`.

## Package manager

**npm only.** Never pnpm/yarn here, Expo breaks with them.
Use `package-lock.json`. Install with `npm install`.

## No TVS

The app never contacts a TVS host and never carries a TVS credential.
`tools/verify-bundle.sh` fails the build if `tvsmotor`, `bluconnect`, `aptener`,
`firebase`, `AIza` or `RSA_TOKEN` reappear in the bundle. Do not add a TVS base url,
a TVS login or a TVS analytics call.

## Module boundaries

- `src/ble` owns bluetooth. Only that folder imports `react-native-ble-plx`.
- `src/services/db` owns the local database. Everything else goes through a repository.
- `src/services/http.service.ts` is the only network entry point. No other module
  calls `fetch`.
- `src/utils/logger.ts` is the only module that calls `console`. `no-console` is an
  error everywhere else. The logger drops every field outside a short allow list.
- `src/stores` owns the client state, one writer per value.
- `src/config/theme.ts` owns colors, spacing and radii.

## Live data never touches the disk

Live speed, the ble gps stream and the raw frames stay in memory. Only ride
summaries are written, and only when the user asks for it.

## Path aliases

`@` (src), `@ble`, `@components`, `@hooks`, `@screens`, `@navigation`, `@config`,
`@stores`, `@locales`, `@utils`, `@services`, `@constants`, `@contexts`, `@typings`.
Declared in `babel.config.js` (module-resolver) and `tsconfig.json` (paths).
A new alias goes in both files.

## React Native styling

### Tailwind / NativeWind - only for simple boolean utilities

NativeWind is unreliable for sizes, spacing and positioning in React Native.
Keep it strictly for:

- Flex: `flex-1`, `flex-row`, `flex-col`
- Alignment: `items-center`, `items-start`, `items-end`, `justify-center`, `justify-between`, `justify-start`, `justify-end`
- Text alignment: `text-center`, `text-left`, `text-right`
- Overflow: `overflow-hidden`

### Use `StyleSheet.create()` or `style={{}}` for everything else

Mandatory for:

- **Sizes**: `width`, `height`, `maxWidth`, `minWidth`, `minHeight`, `maxHeight`
- **Spacing**: `padding`, `paddingHorizontal`, `paddingVertical`, `margin`, `gap` (any)
- **Positioning**: `position`, `top`, `right`, `bottom`, `left`, `zIndex`
- **Border radius**: use `radii.*` from `@config/theme`

Always use the theme spacing constants instead of raw numbers:

```ts
import { spacing, radii, layout } from '@config/theme';
// spacing.xs=4 sm=8 md=12 lg=16 xl=20 2xl=24 3xl=32 4xl=40 5xl=48 6xl=64
// radii.sm=6 md=8 lg=12 xl=16 2xl=20 full=9999
```

## Colors

Never hardcode color literals (`'#fff'`, `'rgba(0,0,0,0.5)'`) inside component style props.

**Always use the theme via `useTheme()` -> `colors.*`.**

| Need | Token |
|------|-------|
| White text on primary bg | `colors.primaryForeground` |
| White text on error bg | `colors.errorForeground` |
| Disabled/neutral background | `colors.muted` |
| Subtle hint text | `colors.mutedForeground` |
| Card/surface background | `colors.card` |
| Main brand color | `colors.primary` |
| Error/destructive | `colors.error` |
| Warning | `colors.warning` |
| Success | `colors.success` |
| Full-screen overlay | `colors.overlay` |
| Border | `colors.border` |

Use `rgba(colors.foreground, alpha)` through `src/utils/hexToRgb` for shadows and
overlays.

## Typography

`typography.metric` is the big live speed number, `typography.readout` is a tile
value. Both use tabular numerals so the digits do not jump.

## Accessibility

Every icon only control gets an `accessibilityLabel` and a 44 by 44 touch target.
No state is color only: the connection dot always sits next to a word. The
connection rail is the only live region, it announces on a state change and not on
every value.

## Local only files - do not commit

`src/config/envs.ts` is gone, the service urls live in the settings table instead.
Never commit a keystore, an api key or a `.env` file. The debug keystore that the
Docker build uses is public and must never sign anything else.

## Reverse engineering workspace

`.tmp/` holds the unpacked XAPK, the jadx and apktool output and the MobSF
reports. It is gitignored. The recovered protocol is in `docs/BLE_PROTOCOL.md`,
the free service stack in `docs/FREE_SERVICES.md`.

Do not copy proprietary code, artwork or resources from the original app into `src/`.
The replacement client must be clean room: own code, own assets.
