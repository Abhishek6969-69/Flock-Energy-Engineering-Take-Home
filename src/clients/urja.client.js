
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const BASE_URL = (
  process.env.URJA_BASE_URL ||
  "https://urja-ops.flockenergy.tech"
).replace(/\/+$/, "");

const jar = new CookieJar();

const client = wrapper(
  axios.create({
    baseURL: BASE_URL,
    jar,
    timeout: Number(process.env.REQUEST_TIMEOUT_MS || 10000),
    headers: {
      Accept: "application/json",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/login`,
    },
  })
);

let authenticated = false;
let loginPromise = null;

// --------------------------------------------------
// Authentication
// --------------------------------------------------

async function login() {
  if (loginPromise) {
    return loginPromise;
  }

  loginPromise = (async () => {
    const email = process.env.URJA_USERNAME;
    const password = process.env.URJA_PASSWORD;

    if (!email || !password) {
      throw new Error("Missing Urja portal credentials");
    }

    const body = new URLSearchParams({ email, password });

    await client.post("/login", body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    // Verify authentication using the protected meter endpoint.
    const check = await client.get("/portal/meters/search", {
      params: { q: "", page: 1 },
    });

    if (
      check.status !== 200 ||
      !Array.isArray(check.data?.data)
    ) {
      throw new Error(
        "Login verification failed: unexpected meter API response"
      );
    }

    authenticated = true;
  })();

  try {
    await loginPromise;
  } catch (error) {
    authenticated = false;

    console.error("Urja login/verification failed:", {
      message: error.message,
      status: error.response?.status,
      url: error.config?.url,
      responseBody:
        typeof error.response?.data === "string"
          ? error.response.data.slice(0, 300)
          : undefined,
    });

    throw error;
  } finally {
    loginPromise = null;
  }
}

// --------------------------------------------------
// Session-aware HTTP requests
// --------------------------------------------------

async function requestWithSession(config) {
  if (!authenticated) {
    await login();
  }

  try {
    return await client.request(config);
  } catch (error) {
    const status = error.response?.status;

    console.error("Urja request failed:", {
      message: error.message,
      status,
      url: error.config?.url,
    });

    if (status !== 401 && status !== 403) {
      throw error;
    }

    // Reauthenticate and retry only once.
    authenticated = false;
    await login();

    return client.request(config);
  }
}

// --------------------------------------------------
// List and search meters
// --------------------------------------------------

async function getMeters({ q = "", page = 1 } = {}) {
  const response = await requestWithSession({
    method: "GET",
    url: "/portal/meters/search",
    params: { q, page },
  });

  return response.data;
}

// --------------------------------------------------
// Decode hierarchy from SvelteKit serialized data
// --------------------------------------------------

function resolveSvelteValue(value, data) {
  if (typeof value === "number") {
    return data[value];
  }

  return value;
}

function getMeterHierarchy(payload) {
  const node = payload?.nodes?.find(
    (item) =>
      item.type === "data" &&
      Array.isArray(item.data)
  );

  if (!node) {
    return null;
  }

  const data = node.data;
  const root = data[0];
  const hierarchyIndex = root?.hierarchy;

  if (
    typeof hierarchyIndex !== "number" ||
    hierarchyIndex < 0 ||
    hierarchyIndex >= data.length
  ) {
    return null;
  }

  const hierarchy = data[hierarchyIndex];

  if (!hierarchy || typeof hierarchy !== "object") {
    return null;
  }

  const fields = {
    zone: "Zone",
    circle: "Circle",
    division: "Division",
    subdivision: "Subdivision",
    substation: "Sub Station",
    feeder: "Feeder",
    distributionTransformer: "DT",
  };

  return Object.fromEntries(
    Object.entries(fields).map(([key, label]) => [
      key,
      resolveSvelteValue(hierarchy[label], data) ?? null,
    ])
  );
}

// --------------------------------------------------
// Get meter details, location, and hierarchy
// --------------------------------------------------

async function getMeterDetails(meterId) {
  const result = await getMeters({
    q: meterId,
    page: 1,
  });

  const meter = result.data?.find(
    (item) => item.meterId === meterId
  );

  
if (!meter) {
  const error = new Error("Meter not found");
  error.statusCode = 404;
  error.code = "METER_NOT_FOUND";
  throw error;
}

  const encodedId = encodeURIComponent(meterId);

  const [geoResponse, pageResponse] = await Promise.all([
    requestWithSession({
      method: "GET",
      url: `/portal/meters/${encodedId}/geo`,
    }),

    requestWithSession({
      method: "GET",
      url: `/meters/${encodedId}/__data.json`,
      params: {
        "x-sveltekit-invalidated": "001",
      },
    }),
  ]);

  return {
    ...meter,
    location: geoResponse.data?.data ?? null,
    hierarchy: getMeterHierarchy(pageResponse.data),
  };
}

// --------------------------------------------------
// Parse numeric consumption readings
// --------------------------------------------------

function parseNumericReading(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

// --------------------------------------------------
// Get meter consumption history
// --------------------------------------------------

async function getMeterConsumption(meterId) {
  const response = await requestWithSession({
    method: "GET",
    url: `/portal/meters/${encodeURIComponent(meterId)}/energy`,
  });

  const records = response.data?.data;

  if (!Array.isArray(records)) {
    throw new Error("Unexpected energy response format");
  }

  return {
    meterId,
    data: records.map((record) => ({
      timestamp: record.timestamp,
      kwh: parseNumericReading(record.kwh),
      kvah: parseNumericReading(record.kvah),
      voltR: parseNumericReading(record.voltR),
    })),
    total: records.length,
  };
}

// --------------------------------------------------
// Exports
// --------------------------------------------------

module.exports = {
  login,
  getMeters,
  getMeterDetails,
  getMeterConsumption,
};
