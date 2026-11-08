# Free map, search and routing

Everything the map needs runs without an account, without an api key and without a
card. The three service urls are settings, so you can move from the public
instances to your own Docker instance without touching the code.

## Map tiles and styles

The map is rendered with `@maplibre/maplibre-react-native`, which has no Google
dependency. The project stays on the legacy architecture, so the version is pinned
to `10.4.2`, the last release that supports it.

Two tile providers, and the app uses the first one that answers.

**Google Map Tiles API**, the google map. The key lives in the gitignored
`.env.local` as `EXPO_PUBLIC_GOOGLE_TILES_API_KEY`. It is a **second key**, on
purpose:

| | search key | tiles key |
| --- | --- | --- |
| api restriction | Geocoding API, Places API (New) | Map Tiles API |
| application restriction | Android apps, package plus certificate | none |
| where it is used | the requests the app makes in javascript | the tiles the maplibre native loader fetches |

The tiles key has no application restriction because the tiles are fetched
outside javascript, by the native maplibre loader, and that loader cannot send
the `X-Android-Package` and `X-Android-Cert` headers an android restriction
needs. The protection is the api restriction, the daily quota of **3.225**
requests (100.000 per month divided by 31, google's own recipe) and a budget
alert at one dollar. The key can only buy tiles, it cannot touch the search.

Every tile request needs a session token, created with
`POST https://tile.googleapis.com/v1/createSession`, valid for two weeks. The
app keeps it in the secure store, renews it a day before it expires, and caps
the session requests at five a day. The style is assembled in memory with the
key and the token in the tile url, so neither of them reaches the settings
table or the exported data. The map shows the google mark and the data
attribution, and it falls back to OpenFreeMap with one line when google does
not answer.

**OpenFreeMap**, the fallback and the default. It serves the whole planet from
the OpenMapTiles schema with no key, no registration and no published request
limit.

| Style | Url |
| --- | --- |
| Liberty | `https://tiles.openfreemap.org/styles/liberty` |
| Bright | `https://tiles.openfreemap.org/styles/bright` |
| Positron | `https://tiles.openfreemap.org/styles/positron` |

The tiles still need a unique user agent, the app sends `K-Tvs-Connect/0.1`.

## Place search

The search goes to Google Maps Platform, with a key that is restricted on the
google side to the apis it may call, to the package name of the app and to the
certificate that signs the apk. The key lives in the gitignored `.env.local` as
`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, never in the repository.

The key has to allow **both** apis below. With only the geocoding api allowed
the search answers for street addresses but not for a category, and the answer
for "gasolinera" is the country and not a station.

Two apis answer, in this order:

- **Places API (New) text search**, `POST https://places.googleapis.com/v1/places:searchText`.
  This is the one that finds a business or a category, so "gasolinera" returns
  the stations around the rider. It needs a `locationBias` circle around the
  rider, otherwise the answer is for the wrong city.
- **Geocoding API**, `GET https://maps.googleapis.com/maps/api/geocode/json`.
  The fallback, and the one that answers for a plain street address.

Both calls carry `X-Android-Package` and `X-Android-Cert`. Google only accepts
a request that identifies the app, and a plain fetch from react native does not,
so a request without those headers comes back as `REQUEST_DENIED`.

What the free tier allows, per month: **10.000** geocoding requests (Essentials)
and **5.000** places text searches (Pro, because the answer carries the name, the
address and the position). The 1.000 requests of the "Compute Routes Enterprise"
sku are the two wheeler routing, and the app does not use google for routing.

Three things that cost quota, and how the app avoids them:

- **Every prefix of a typed text is a different request.** A 30 character
  address is up to 30 billed requests and no two share a cache entry. The app
  waits 600 ms and asks from 5 characters, and it stops after 100 requests in a
  day.
- **The same text asked again is free.** Every answer is kept in the encrypted
  database for 24 hours, keyed by the text, the country and the cell of the
  rider position, so a repeated search never leaves the phone. An answer with
  no matches is kept too, so a text that finds nothing is not asked again.
- **A denied request is not an answer.** Google answers a refusal with http
  200 and a status, so the app reads the status and never caches a refusal as
  "no places found".

Google allows the coordinates of an answer to be kept for 30 days and the place
id forever. The cache holds 24 hours. The saved routes keep the destination
coordinates with no expiry, which is the one place where the 30 day rule is not
met yet.

## Routing

Valhalla is the routing engine of OpenStreetMap. The app uses it for three
things that matter here:

- `motor_scooter` for the short route. It cuts through the barrio on secondary
  and tertiary streets. `use_distance` is `0.55` and `top_speed` is 70, so a
  50 km/h barrio avenue beats a 13 km/h alley, and a long highway is not worth
  it. Service roads, living streets and tracks are penalized. Hierarchy pruning
  stays off on this profile so a one-block camera dodge is visible. `auto` is
  the safe route, with hierarchy pruning left on and `use_highways` at 1.
  `use_highways` only nudges motorway and trunk, so a secondary avenue can
  still be the fastest path and match the short route. The safe request asks
  for two alternates and keeps one with at least 12 points more primary or
  trunk. A small gain stays within 1.7 times the length. A jump of 40 points
  may stretch to 2.5 times when the extra distance is under 5 km. It does not
  add barrio streets. `shortest`, and `use_distance` above 0.6, dive into residential
  streets, so they are not used.
- `exclude_polygons` at the root of the request, so a marked point is excluded
  by the engine itself. No polyline inspection and no detour waypoint needed on
  the client.
- `linear_cost_factors` for a camera that watches one direction. The shape is a
  piece of the route the rider would ride with the camera behind them, and the
  factor is `1000000`. The match follows that direction only, so the opposite
  direction of the same road stays open. A factor of `0` is clamped to `1` on
  the public server and changes nothing. A factor of `20` only nudges the route.

Request shape:

```json
{
  "locations": [{ "lat": 0, "lon": 0 }, { "lat": 0, "lon": 0 }],
  "language": "es-ES",
  "costing": "motor_scooter",
  "costing_options": { "motor_scooter": { "use_distance": 0.55, "top_speed": 70 } },
  "units": "kilometers",
  "exclude_polygons": [[[0, 0], [0, 0], [0, 0], [0, 0]]],
  "linear_cost_factors": [{ "shape": "encoded-polyline6", "factor": 1000000 }]
}
```

Three things the public instance does not tell you:

- **The summary length comes back in kilometres** whatever the `units` parameter
  says. The distance has to be measured from the encoded shape, which is always in
  metres, with `src/utils/polyline.ts`.
- **`exclude_polygons` takes plain rings of coordinates, not GeoJSON objects.** A
  GeoJSON polygon is refused with a parse error.
- **An exclusion removes every road that crosses the ring.** The ring is a
  circle of the radius of the point. Manual points use their own radius. A
  camera with no published sense uses 25 to 45 m, enough to reach the road and
  not the next street. The `exclude_locations` form is not sent: it removes the
  closest road entirely, even when the road is far from the point, and that is
  what made the route jump to another street. When a ring makes the destination
  unreachable the router answers "no path could be found". Manual points are
  then tried again with half of them and finally with none. A camera ban stays
  in the request. If that leaves no path, the app does not return a route that
  puts a camera behind the bike.

The FOSSGIS demo server `https://valhalla1.openstreetmap.de` is open to the public
with one request per second and asks published apps to send an `X-Client-Id`
header, which the app does.

## Running it locally

```sh
docker compose -f docker/docker-compose.valhalla.yml up -d
```

The first start downloads the region extract and builds the routing tiles, that
takes a while. After that set the routing url in Settings to
`http://127.0.0.1:8002` and the app never talks to the public instance again.

The same trick works for the tiles: point the map style url at a self hosted
tileserver-gl instance serving the same OpenMapTiles schema.

## What leaves the phone

The tile requests reveal the viewport. The search request reveals the text that
was typed and the approximate position of the rider, and it goes to Google Maps
Platform in the United States under the google terms. The routing request reveals
the origin, the destination and the avoid points. Nothing else is sent: the frame
number of the scooter, the bluetooth address and the live telemetry never leave
the device, and no TVS host is ever contacted. `tools/verify-bundle.sh` fails
the build if a TVS host or a foreign google key reappears in the bundle.
