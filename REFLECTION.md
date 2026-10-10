
# Implementation Reflection

## 1. Project Overview

I built a REST API wrapper using Node.js and Express.js around the Urja Meter Ops portal. The API exposes endpoints for listing and searching meters, retrieving individual meter details, and fetching energy consumption readings.

The objective was to provide a clean, consistent API interface while handling upstream authentication, data transformation, and errors.

## 2. Challenges Faced

### Upstream Authentication

The upstream portal requires login credentials and maintains an authenticated session using cookies. I implemented a server-side client with cookie-jar support so that the session could be reused across requests without exposing credentials or session cookies to API consumers.

### Understanding Upstream Responses

The upstream portal returns meter information, geographic coordinates, and energy readings through separate requests. I had to understand these response structures and combine the relevant information into a consistent response for the meter-details endpoint.

### Extracting Meter Hierarchy

I did not identify a separate documented hierarchy endpoint. Instead, I inspected the SvelteKit page-data response and implemented a parser that resolves references within its serialized data structure.

This worked for the meter tested during development, but the approach is fragile because the internal page-data format may change.

### Error Handling

I implemented input validation and centralized error handling to distinguish invalid requests, nonexistent meters, upstream failures, timeouts, and unexpected server errors.

## 3. Design Decisions

- **Separation of concerns:** Express routes handle request validation and HTTP responses, while the upstream client handles authentication and portal requests.
- **API versioning:** The `/api/v1` prefix makes future API changes easier to manage.
- **Session management:** Cookies are maintained server-side instead of being exposed to API consumers.
- **Data normalization:** Numeric consumption readings are converted to JSON numbers when possible.
- **Consistent errors:** Error responses use `error` and `message` fields.
- **Optional enrichment:** Location and hierarchy are included in meter details when the upstream data is available and can be parsed.
- **Timestamp preservation:** Upstream timestamps are preserved as strings because their timezone semantics have not been confirmed.

## 4. Testing and Validation

I manually tested the API using `curl`.

The following cases were verified:

- Health check returned `200 OK`.
- Meter listing returned a paginated response containing 20 records per page.
- Searching for `J100005` returned the matching meter.
- Pagination with `page=2` returned the next page of results.
- Meter details for `J100000` returned metadata, location, and hierarchy.
- Consumption retrieval for `J100000` returned 337 readings.
- Requesting `J999999` returned `404 METER_NOT_FOUND`.
- An invalid meter ID returned `400 VALIDATION_ERROR`.
- An unknown route returned `404 NOT_FOUND`.
- An invalid page parameter returned `400 VALIDATION_ERROR`.

These results demonstrate that the tested endpoints and error cases behaved as expected during manual testing. They do not replace an automated regression test suite.

## 5. Trade-offs and Limitations

- **Dependence on the upstream portal:** Changes to internal endpoints or response formats may break the wrapper.
- **Multiple requests for meter details:** Retrieving metadata, location, and hierarchy requires multiple upstream requests, which can increase latency.
- **Fragile hierarchy extraction:** Parsing SvelteKit page data is less reliable than using a documented, stable API.
- **Strict meter ID validation:** The current validator assumes IDs follow the `J` plus six digits format.
- **No caching:** Requests depend on the upstream service, which may increase response times and upstream traffic.
- **No comprehensive automated tests:** Verification was performed manually with `curl`.
- **No production infrastructure:** Caching, rate limiting, monitoring, and deployment configuration were not implemented as part of this version.

## 6. Future Improvements

1. Add automated unit and integration tests with mocked upstream responses.
2. Validate the OpenAPI specification and optionally provide Swagger UI.
3. Add structured logging and request IDs while ensuring credentials and session cookies are never logged.
4. Make timeout and retry behavior configurable.
5. Confirm the upstream timestamp timezone before introducing timestamp conversion.
6. Replace the hierarchy parser if a stable, documented upstream endpoint becomes available.
7. Add caching and rate limiting based on expected traffic and data freshness requirements.
8. Add monitoring and distinguish API liveness from upstream service availability.

## 7. Key Learnings

This project helped me understand the practical challenges of integrating with an existing web portal that does not provide a clearly documented API contract.

I learned the importance of session management, separation of concerns, response normalization, input validation, and consistent error handling. I also learned that reverse-engineering internal response formats can be useful, but such integrations should be isolated and treated as potential maintenance risks.

My main priority for the next iteration would be automated testing, followed by improving the resilience of the upstream integration.
