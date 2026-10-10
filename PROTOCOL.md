
# Upstream Protocol Documentation

## 1. Overview

This document describes how the REST API wrapper communicates with the upstream Urja Meter Ops portal.

**Base URL:** `https://urja-ops.flockenergy.tech`

The wrapper uses the upstream portal to authenticate, retrieve meter records, obtain geographic coordinates, fetch energy consumption readings, and extract meter hierarchy information.

The upstream endpoints described below were identified during implementation and manual testing. They are internal portal endpoints, not necessarily a formally supported public API.

## 2. Authentication

### Login endpoint

- **Method:** `POST`
- **Path:** `/login`
- **Content-Type:** `application/x-www-form-urlencoded`

The login request submits the configured email and password as form fields:

- `email`
- `password`

The upstream portal establishes an authenticated session using cookies.

### Session handling

The wrapper uses `axios`, `axios-cookiejar-support`, and `tough-cookie` to maintain the session.

The intended request flow is:

1. Submit login credentials.
2. Store cookies received from the upstream portal.
3. Reuse the cookie jar for subsequent upstream requests.
4. Keep credentials and session cookies on the server rather than returning them to API consumers.

Authentication failures should be reported as upstream errors rather than exposing credentials or cookie values.

## 3. Upstream Endpoints

### 3.1 Search and list meters

- **Method:** `GET`
- **Path:** `/portal/meters/search`
- **Query parameters:**
  - `q`: Search query; an empty string retrieves the default listing.
  - `page`: Page number, starting at `1`.

Example:

```http
GET /portal/meters/search?q=&page=1
```

Observed response structure:

```json
{
  "data": [
    {
      "meterId": 1,
      "serialNo": "J100000",
      "make": "Example Make",
      "phaseType": "Three Phase",
      "installStatus": "Installed",
      "dtCode": "DT-001"
    }
  ],
  "total": 403,
  "page": 1,
  "pageSize": 20
}
```

The values above illustrate the response structure; actual values depend on the upstream data.

The wrapper uses this endpoint to support meter listing, searching, pagination, and lookup of a specific meter.

### 3.2 Retrieve meter geographic coordinates

- **Method:** `GET`
- **Path:** `/portal/meters/{meterId}/geo`

Example:

```http
GET /portal/meters/J100000/geo
```

The response contains geographic information under its `data` property, including latitude and longitude.

The wrapper exposes these coordinates as the meter's `location`.

### 3.3 Retrieve energy consumption readings

- **Method:** `GET`
- **Path:** `/portal/meters/{meterId}/energy`

Example:

```http
GET /portal/meters/J100000/energy
```

The response contains a `data` array of readings. The observed fields include:

- `timestamp`
- `kwh`
- `kvah`
- `voltR`

The upstream response represents readings and numeric measurements as strings in the tested responses. The wrapper converts numeric values into JSON numbers when possible and uses `null` when a value cannot be converted.

The timestamp is preserved as a string because its timezone semantics have not been confirmed.

### 3.4 Retrieve meter page data and hierarchy

- **Method:** `GET`
- **Path:** `/meters/{serialNo}/__data.json?x-sveltekit-invalidated=001`

Example:

```http
GET /meters/J100000/__data.json?x-sveltekit-invalidated=001
```

The response uses SvelteKit's serialized page-data format rather than a simple JSON object.

The tested response contains nodes with types such as `data` and `skip`. Objects and arrays can reference other entries by numeric index. The hierarchy information must therefore be resolved from the serialized structure.

For meter `J100000`, the extracted hierarchy included:

- Zone: Jaipur Zone 1 (Z-01)
- Circle: Circle 1 (C-01)
- Division: Division 1 (D-01)
- Subdivision: Subdivision 1 (SD-01)
- Sub Station: Substation 1 (SS-01)
- Feeder: Feeder 1 (F-001)
- DT: Malviya Nagar DT 1 (DT-001)

No separate, documented hierarchy endpoint was confirmed during implementation. The wrapper extracts hierarchy information from the page-data response instead.

**Limitation:** SvelteKit's serialized response is an internal frontend format. Changes to the page-data structure can break hierarchy extraction, so this parsing logic should be isolated and tested against representative responses.

## 4. Wrapper Request Flow

### Meter listing

1. Validate the optional search query and page number.
2. Ensure the upstream session is available.
3. Request `/portal/meters/search`.
4. Return the meter records and pagination metadata.

### Meter details

1. Validate the meter ID.
2. Find the exact meter in the upstream listing.
3. Request its geographic information.
4. Fetch and parse its SvelteKit page-data response.
5. Combine the available metadata, location, and hierarchy into one response.

This approach requires multiple upstream requests and may have higher latency than a single documented meter-details endpoint.

### Meter consumption

1. Validate the meter ID.
2. Request `/portal/meters/{meterId}/energy`.
3. Normalize the readings.
4. Return the consumption data.

## 5. Error Handling

The wrapper distinguishes client-side validation errors from upstream and server failures.

| Situation | Expected HTTP status | Error code |
|---|---:|---|
| Invalid meter ID | 400 | `VALIDATION_ERROR` |
| Invalid page parameter | 400 | `VALIDATION_ERROR` |
| Meter not found | 404 | `METER_NOT_FOUND` |
| Unknown wrapper route | 404 | `NOT_FOUND` |
| Upstream service failure | 502 | `UPSTREAM_SERVICE_ERROR` |
| Upstream request timeout | 504 | `UPSTREAM_TIMEOUT` |
| Unexpected internal failure | 500 | `INTERNAL_SERVER_ERROR` |

These statuses describe the wrapper's intended error contract. Confirm them against the current error middleware if its implementation changes.

## 6. Configuration and Security

The upstream base URL, credentials, port, and request timeout should be configured through environment variables rather than hard-coded in source files.

Do not commit `.env` files, passwords, authentication cookies, or other secrets to version control.

Additional production safeguards should include:

- Redacting sensitive headers and credentials from logs.
- Using HTTPS for external communication.
- Applying appropriate request timeouts.
- Avoiding the disclosure of raw upstream error bodies to API consumers.

## 7. Known Limitations

- The upstream portal does not provide a confirmed, documented public API contract for the endpoints used here.
- The wrapper depends on the upstream login flow and session-cookie behavior.
- Meter hierarchy extraction depends on an internal SvelteKit response format.
- Meter details require multiple upstream requests.
- Timestamp timezone semantics remain unverified.
- Upstream changes may require adjustments to request paths, response parsing, or data normalization.

## 8. Recommended Future Improvements

1. Add automated tests using saved or mocked upstream responses.
2. Validate hierarchy parsing against multiple meters and missing hierarchy fields.
3. Investigate whether the upstream provider offers a stable, documented hierarchy endpoint.
4. Add structured logging, request correlation IDs, and monitoring.
5. Consider caching meter metadata when appropriate.
6. Add integration tests for authentication failures, timeouts, and upstream response changes.
