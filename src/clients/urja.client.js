
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const BASE_URL =
  process.env.URJA_BASE_URL ||
  "https://urja-ops.flockenergy.tech";

const jar = new CookieJar();

const client = wrapper(
  axios.create({
    baseURL: BASE_URL,
    jar,
    timeout: Number(process.env.REQUEST_TIMEOUT_MS || 10000),
    headers: {
      Accept: "application/json",
    },
  })
);

let authenticated = false;
let loginPromise = null;

async function login() {
  if (loginPromise) return loginPromise;

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

    // Verify the session against the discovered protected endpoint.
    const check = await client.get("/portal/meters/search", {
      params: { q: "", page: 1 },
    });

    if (
      check.status !== 200 ||
      !check.data ||
      !Array.isArray(check.data.data)
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
      responseBody:
        typeof error.response?.data === "string"
          ? error.response.data.slice(0, 300)
          : undefined,
    });

    if (status !== 401 && status !== 403) {
      throw error;
    }

    // Retry only once after reauthentication.
    authenticated = false;
    await login();

    return client.request(config);
  }
}

async function getMeters({ q = "", page = 1 } = {}) {
  const response = await requestWithSession({
    method: "GET",
    url: "/portal/meters/search",
    params: { q, page },
  });

  return response.data;
}

module.exports = {
  login,
  getMeters,
};
