# Arrival time estimate

The app shows an arrival time on the map. It starts from the router's own
estimate and then learns from the times this rider actually took on the same
route.

## The formula

```
R  = the router duration for the current route, in seconds
D  = the route length, in meters, measured from the encoded shape

for every stored observation i of this route:
    r_i = observed_seconds_i / router_seconds_i      the rider's time over the router's time
    w_i = confidence_i * 0.5^(age_in_days_i / 90)    the recency weight

n      = sum(w_i)                                    the effective number of observations
G      = exp( sum(w_i * ln r_i) / n )                the weighted geometric mean of the ratios
lambda = n / (n + 2)                                 the weight on the rider's history
F      = clamp(G^lambda, 0.5, 2.0)                   the learned factor

duration = R * F
minutes  = max(1, round(duration / 60))
arrival  = now + minutes
```

The blend is geometric on purpose. `F -> 1` when there is no history, so the
router's answer is the limit, and the router never loses its say completely.
The learned quantity is a ratio, so it survives the route length changing
between sessions.

The history outweighs the router after the third clean trip on the same route.
One trip moves the estimate at most a third of the way, so a single bad day
cannot swing it.

## What is stored

| Table | What |
| --- | --- |
| `route_origins` | the clusters of start points, 300 m apart |
| `route_contexts` | every route the app computed, with the router answer of that day |
| `route_observations` | one row per trip the rider took on a route |

The destination key is a cell of about 111 m around the destination, and the
origin is the nearest anchor within 300 m. The same commute scatters by a
driveway, not by a kilometre.

## What is rejected

A trip is stored only when it looks like the route it was measured against:

| Check | Band | Why |
| --- | --- | --- |
| time ratio | 0.40 to 2.00 | below is a truncated trip, above is a different trip |
| distance ratio | 0.85 to 1.20 | the odometer and the routed path agree within a couple of percent |
| route length | 0.80 to 1.25 | a route that changed length is a different route |
| age | 180 days | after a season the road works and the traffic are different |

A trip that fails is not stored. It never becomes evidence.

## The time of day

The router estimate has no traffic model, so a commute at rush hour and a ride
at midday are two different quantities. The observations are bucketed into four
bands, early, day, evening and night. The band of the current hour is used when
it holds at least two observations, otherwise all of them are used.

## Where it is explained

The map sheet shows the arrival time. The route details screen shows the
sentence behind it:

- "Still mostly the map's estimate, nudged by your 2 recorded trips."
- "Based on your last 5 trips on this route."

## The limits

| Rule | Value |
| --- | --- |
| the estimate never goes below | half the router's answer |
| the estimate never goes above | twice the router's answer |
| the router answer must be | between 60 s and 4 h |
| the implied speed must be | between 3 and 90 km/h |
| the estimate is rounded | to the nearest minute |
