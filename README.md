# VATSIM Companion

Four separate pages: homepage, flight input, radio script, and getting started, with a worldwide airport lookup API.

## Run

Requires Node.js 22 or later. No package installation or API key is needed.

Run `node server.mjs`, then open http://127.0.0.1:4317. The homepage Start button opens the input page.

The API requires the included server; opening the HTML file directly will not provide airport searches.

## Airport API

- `GET /api/airports?q=EGL`: up to eight airports whose ICAO code starts with the query. Major airports appear first.
- `GET /api/airports/EGLL`: one airport, including name, location, elevation, IATA code, coordinates and runway details.

Data comes from the public-domain OurAirports airports, countries and runway datasets: https://ourairports.com/data/. Only airports with an explicit four-letter ICAO code are included. Closed airports and runways are excluded according to the source. Missing values are labelled as missing; no runway data is invented.

The server retrieves source data on first start, caches it locally in `.cache/airports.json`, and refreshes it when accessed after 24 hours. If a refresh fails, the API continues with the previous dataset and reports `stale: true`. If no dataset is available, it returns a 503 error and the input page shows a retry message. The retrieval date is shown on the page; it is not an AIRAC validity date. This is airport reference information, not live ATC, NOTAM or active-runway data.

Flight details are saved only to session storage in the current browser tab. Airport choices are checked against the API again when restoring a saved setup. The radio script has nine controller stages, manual ATIS and ATC instruction fields, and per-flight notes saved in the current browser tab. ATC text is illustrative, not live clearances.

## Checks

With the server running, run `node --test --test-isolation=none test/*.test.mjs`.

## Hosting

The input page now needs a Node.js server. The old `.openai/hosting.json` identifies the previously registered, unpublished static Site and is retained as historical identity only; it is not a working deployment configuration for this API. Do not deploy only `dist/` without adding the API to the chosen host.


