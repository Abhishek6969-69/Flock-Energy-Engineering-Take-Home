
# Flock Energy API

A REST API wrapper around the legacy Urja Meter Ops portal that provides a simplified interface for retrieving meter information, geographic coordinates, hierarchy details, and energy consumption readings.

The wrapper is built using **Node.js and Express.js** and communicates with the upstream portal through HTTP requests.

## Features

- List meters with pagination.
- Search meters using a query parameter.
- Retrieve meter details, including geographic coordinates and hierarchy.
- Retrieve energy consumption readings.
- Validate request parameters and meter IDs.
- Handle upstream authentication using session cookies.
- Return consistent HTTP error responses.
- Configure credentials and server settings through environment variables.

## Tech Stack

- Node.js
- Express.js
- Axios
- `axios-cookiejar-support`
- `tough-cookie`
- dotenv

## Project Structure

```text
flock-energy-api/
├── src/
│   ├── routes/
│   │   └── meter.routes.js
│   ├── server.js
│   └── ...
├── .env
├── .gitignore
├── package.json
├── openapi.json
├── PROTOCOL.md
├── REFLECTION.md
└── README.md
```

The exact source structure may vary slightly depending on the final implementation.

## Prerequisites

- Node.js and npm installed.
- Access to the upstream Urja Meter Ops portal.
- Valid upstream login credentials.

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Abhishek6969-69/Flock-Energy-Engineering-Take-Home.git

cd Flock-Energy-Engineering-Take-Home
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3000
URJA_BASE_URL=https://urja-ops.flockenergy.tech
URJA_USERNAME=your_upstream_username
URJA_PASSWORD=your_upstream_password
REQUEST_TIMEOUT_MS=10000
```

Replace the placeholder credentials with valid values.

Ensure `.env` is included in `.gitignore`. Never commit credentials or session cookies to version control.

**Note:** The variable names above must match those referenced by the application's configuration and authentication code.

### 4. Start the development server

```bash
npm run dev
```

The API should be available at:

```text
http://localhost:3000
```

## API Endpoints

All application endpoints, except `/health`, use the `/api/v1/meters` base path.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Check API health |
| GET | `/api/v1/meters` | List meters |
| GET | `/api/v1/meters?q=J100005` | Search meters |
| GET | `/api/v1/meters/:id` | Retrieve meter details |
| GET | `/api/v1/meters/:id/consumption` | Retrieve energy readings |

### 1. Health Check

```http
GET /health
```

Example response:

```json
{
  "status": "ok",
  "message": "Flock Energy API is running"
}
```

### 2. List Meters

```http
GET /api/v1/meters
```

Optional query parameters:

| Parameter | Description | Default |
|---|---|---|
| `q` | Search query | Empty string |
| `page` | Positive page number | `1` |

Example:

```bash
curl "http://localhost:3000/api/v1/meters?page=1"
```

Search example:

```bash
curl "http://localhost:3000/api/v1/meters?q=J100005"
```

The response includes meter records and pagination metadata obtained from the upstream portal.

### 3. Retrieve Meter Details

```http
GET /api/v1/meters/:id
```

Example:

```bash
curl "http://localhost:3000/api/v1/meters/J100000"
```

The response combines available meter metadata, geographic coordinates, and hierarchy information.

The hierarchy can include:

- Zone
- Circle
- Division
- Subdivision
- Substation
- Feeder
- Distribution transformer

The availability of individual hierarchy fields depends on the upstream response.

### 4. Retrieve Energy Consumption

```http
GET /api/v1/meters/:id/consumption
```

Example:

```bash
curl "http://localhost:3000/api/v1/meters/J100000/consumption"
```

The response contains energy readings such as:

- Timestamp
- Energy in kWh
- Energy in kVAh
- R-phase voltage

Numeric readings are normalized into JSON numbers where conversion is possible. Invalid or unavailable numeric values may be represented as `null`.

## Error Handling

The API uses HTTP status codes and structured error responses to distinguish validation failures, missing meters, and upstream failures.

| HTTP status | Meaning |
|---|---|
| `400` | Invalid request parameters |
| `404` | Meter or API route not found |
| `500` | Unexpected internal server error |
| `502` | Upstream service failure |
| `504` | Upstream request timeout |

Example validation error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid meter ID"
  }
}
```

Example meter-not-found error:

```json
{
  "error": {
    "code": "METER_NOT_FOUND",
    "message": "Meter not found"
  }
}
```

The exact message and response envelope depend on the error handler implementation.

## Authentication and Upstream Communication

The wrapper communicates with the upstream portal at:

```text
https://urja-ops.flockenergy.tech
```

The upstream portal uses a login flow that establishes an authenticated session through cookies.

The wrapper maintains these cookies using a cookie jar and reuses the authenticated session for subsequent requests. Authentication and upstream communication are handled server-side so that upstream credentials are not exposed through the public API.

For the endpoint paths, observed response structures, and hierarchy extraction details, see [PROTOCOL.md](./PROTOCOL.md).

## Assumptions and Design Decisions

### 1. REST API abstraction

The upstream portal is treated as the data source, while Express provides a simpler interface for consumers. This separates client applications from the upstream portal's request format and session-management details.

### 2. Server-side authentication

Upstream credentials and session cookies remain on the server. API consumers do not need to authenticate directly with the legacy portal.

### 3. Input validation

Meter IDs and pagination parameters are validated before making upstream requests. This avoids unnecessary upstream calls for malformed requests.

### 4. Consistent error handling

Upstream failures, timeouts, validation errors, and missing resources are mapped to appropriate HTTP status codes.

### 5. Data normalization

Numeric consumption measurements are converted to JSON numbers where possible. Timestamps remain strings because their timezone semantics have not been verified.

### 6. Hierarchy extraction

No separate documented hierarchy endpoint was confirmed during implementation. Hierarchy information is extracted from the SvelteKit page-data response.

This approach works for the tested response but depends on an internal frontend serialization format. It is therefore less stable than a documented upstream API.

## Limitations and Trade-offs

- The wrapper depends on the upstream portal's authentication flow and session behavior.
- Upstream endpoints may change without notice.
- Hierarchy parsing depends on the internal SvelteKit response structure.
- Retrieving meter details requires multiple upstream requests, increasing latency.
- The upstream timestamp timezone has not been confirmed.
- No caching layer or database is introduced; data is retrieved from the upstream portal.
- Automated test coverage and production deployment hardening remain areas for improvement.

## Testing

The implementation was manually validated using `curl` requests.

The checks performed included:

- Health endpoint returns HTTP `200`.
- Meter listing returns records and pagination metadata.
- Searching for `J100005` returns the matching record in the tested environment.
- Pagination returns the requested page.
- Meter details return metadata, location, and hierarchy for the tested meter.
- Consumption endpoint returns energy readings.
- A nonexistent meter returns HTTP `404`.
- An invalid meter ID returns HTTP `400`.
- An unknown route returns HTTP `404`.
- An invalid page value returns HTTP `400`.

These are manual test results, not a claim that an automated test suite has been implemented.

## Documentation

- [OpenAPI specification](./openapi.json) — API paths, parameters, schemas, and responses.
- [Upstream protocol documentation](./PROTOCOL.md) — Authentication, upstream endpoints, response formats, and hierarchy extraction.
- [Implementation reflection](./REFLECTION.md) — Challenges, trade-offs, lessons learned, and possible improvements.

## Future Improvements

1. Add automated unit and integration tests using mocked upstream responses.
2. Add structured logging and request correlation IDs.
3. Improve resilience to upstream authentication failures and session expiry.
4. Test hierarchy extraction against a broader range of meters.
5. Investigate a stable, documented upstream hierarchy endpoint.
6. Add caching for meter metadata if the data freshness requirements allow it.
7. Add rate limiting and other production security controls where appropriate.
8. Add CI checks and API documentation rendering, such as Swagger UI.

## Author

**Abhishek Yadav**

GitHub: [Abhishek6969-69](https://github.com/Abhishek6969-69)
