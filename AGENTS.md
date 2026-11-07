# Project conventions - k-tvs-connect

## Stack

Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript strict.
Runs on a **development client**, not Expo Go: `npm start` uses `expo start --dev-client --clear`.
Android application id `com.ktvsconnect.app`, iOS bundle id `com.ktvsconnect.app`.

## Package manager

**npm only.** Never pnpm/yarn here, Expo breaks with them.
Use `package-lock.json`. Install with `npm install`.

## Layout

```
App.tsx              root: theme, error boundary, navigator
index.ts             entry point registered with expo
src/config/          theme tokens, envs, i18n setup
src/constants/       shared constants
src/hooks/           reusable hooks
src/navigation/      navigators and param lists
src/screens/         screens
src/components/      presentational components
src/services/        API clients and data access
src/stores/          zustand stores
src/types/           shared TypeScript types
src/utils/           pure helpers
src/locales/         i18n json
tools/               reverse engineering scripts (see README.md)
mcp/                 MCP server configs for the AI client
```

Path aliases: `@components`, `@hooks`, `@screens`, `@navigation`, `@config`, `@stores`,
`@locales`, `@utils`, `@services`, `@constants`, `@contexts`, `@typings`, `@`.
They are declared in `babel.config.js` (module-resolver) and `tsconfig.json` (paths).

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

Only use literal `rgba(...)` when building animated shadow or overlay values from
`hexToRgb(colors.foreground)`.

## Local-only files - do not commit

`src/config/envs.ts` changes during local testing (API URLs, keys, flags).
Git skips it with:

```sh
git update-index --skip-worktree src/config/envs.ts
```

Do not stage or commit `envs.ts` unless the change is intentional and tested.

## Reverse engineering workspace

`.tmp/` holds the unpacked XAPK, jadx and apktool output, and the MobSF reports.
It is gitignored. The tooling is documented in `README.md`, the recovered API contract
in `docs/API_CONTRACT.md`.

Do not copy proprietary code, artwork or resources from the original app into `src/`.
The replacement client must be clean room: own code, own assets, same public endpoints.
