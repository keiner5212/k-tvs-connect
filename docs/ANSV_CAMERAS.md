# Photo detection cameras

The app pulls the Colombian road safety agency list of authorised photo-detection
cameras and turns the operating ones into automatic avoid points.

## The data

| | |
| --- | --- |
| File | `https://fotodeteccion.ansv.gov.co/map/data/sast.json` |
| Size | about 4.5 MB, `Cache-Control: public, max-age=604800` |
| Auth | none, no key, no headers |
| Published by | Agencia Nacional de Seguridad Vial (ANSV) |
| Public map | `https://fotodeteccion.ansv.gov.co/map/ubicaciones-aprobadas.html` |

The file is the machine readable source behind the official map. The map itself only
renders the raw infraction codes, and no published legend for those codes was found
in the resolution, the criteria workbooks, the user manual or the map script. The
app therefore reports the codes verbatim and does not guess what they mean.

## Shape

```
{ "timestamp": <epoch seconds>, "results": [
  { "estado": "Aprobada", "departamento": "...", "municipio": "...",
    "ubicaciones": [
      { "codigo_unico": "CU000000000090", "tipo_tramo": "Nacional",
        "tipo_tecnologia": "Radar Doppler",
        "estado_operacion": "Operando",
        "latitud": 6.2433, "longitud": -75.6025,
        "direccion": "Calle 22 con Carrera 19",
        "velocidad_maxima_permitida": "50",
        "lista_infracciones": ["C14", "C24", "C35", "D02"],
        "senales": [ { "id": 442, "estado": "Instalada", "activo": true, ... } ] } ] } ] }
```

## Which cameras are active

`estado_operacion` decides it. Only the exact value `Operando` is operating:

| Value | Count | Treated as |
| --- | --- | --- |
| `Operando` | 374 | operating, becomes an avoid point |
| `Autorizada instalar` | 430 | authorised but not operating, not avoided |
| `Renovada - Expirada` | 292 | expired, not avoided |
| `Vencida` | 164 | expired, not avoided |
| `Prorrogada - Vencida` | 79 | expired, not avoided |
| `Autorizada - Desistida` | 3 | withdrawn, not avoided |

The `activo` flag on each `senal` is true for every signal in the file, so it does not
discriminate anything. An unknown `estado_operacion` is treated as not operating.

## What the app stores

| Table | What |
| --- | --- |
| `cameras` | one row per camera, keyed by `codigo_unico`, with the snapshot id |
| `camera_preferences` | the per camera on/off choice, so a refresh cannot resurrect a camera you turned off |
| `avoid_points` | only the points you drop yourself, never the cameras |

The import runs in one transaction: it upserts the rows of the new snapshot and then
deletes the rows of the older ones, so a camera that stops operating stops being
avoided. A failed or partial import keeps the previous snapshot.

The dataset is refreshed at most every 7 days, which is the freshness the server
publishes in its own cache header.

## How the avoid points work

Every operating camera becomes an exclusion with a 50 m radius. When a route is
computed, only the cameras near that route are sent to the routing service: those
within 150 m of the line between origin and destination, or within 1 km of either
end, capped at 40, nearest first. The map tells you how many cameras were sent and
how many nearby ones were left out of the request.

## What the app says about each camera

- The address the authority published, and the municipality and department.
- The maximum speed the authority published, in km/h. Most cameras have no speed
  published, and the app says "Speed not published" rather than guessing.
- The technology, in plain words, with the official term next to it.
- The infraction codes the authority declared for that camera, verbatim.
- The date the dataset was published.

The app never shows a fine amount and never presents the data as a live statement of
the law. The source is credited on every card:

> Source: Agencia Nacional de Seguridad Vial (ANSV). Data published 12 Mar 2025.

## House rules

- The dataset url is a compile time constant, never a settings value, so it cannot be
  pointed somewhere else.
- The request carries no query parameters, so no location, route or camera choice
  leaves the phone.
- Free text from the dataset is stripped of control characters and bidi overrides and
  capped before it is stored, and it is never used as a log field or in an export.
- The dataset is used on the device. It is not republished.
