const https = require("https");
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

const BASE = "https://l6ayozti46.execute-api.us-east-1.amazonaws.com/v1";
const STORE_ID = "2c51e75b-6026-407a-ab2a-8e7d9d556bff";
const CLIENT_ID = "2ub76h3h848ngbpk22fmlljsp8";
const USERNAME = "admin@foodwise.io";
const PASSWORD = "FoodWise2026A";

const cognito = new CognitoIdentityProviderClient({ region: "us-east-1" });

async function getToken() {
  const resp = await cognito.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME, PASSWORD },
    })
  );
  return resp.AuthenticationResult.IdToken;
}

function apiCall(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          ...(data && { "Content-Length": Buffer.byteLength(data) }),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log("Getting auth token...");
  let token = await getToken();
  console.log("Token acquired (" + token.length + " chars)");

  // Get recipes
  const recipesRes = await apiCall("GET", "/recipes", token);
  const allRecipes = recipesRes.data.recipes;
  const targetNames = [
    "6-inch Chicken Sub",
    "Footlong Turkey Sub",
    "Meatball Marinara",
    "Tuna Sub",
    "Steak and Cheese",
  ];
  const recipes = allRecipes.filter((r) => targetNames.includes(r.name));
  console.log("\nUsing " + recipes.length + " recipes:");
  recipes.forEach((r) => console.log("  - " + r.name + " ($" + r.sellingPrice + ")"));

  if (recipes.length === 0) {
    console.log("ERROR: No matching recipes found!");
    return;
  }

  const weights = [35, 25, 20, 12, 8];
  const dayVolume = { 0: 45, 1: 38, 2: 40, 3: 42, 4: 50, 5: 65, 6: 60 };

  function pickRecipe() {
    const rand = Math.floor(Math.random() * 100) + 1;
    let cum = 0;
    for (let i = 0; i < Math.min(weights.length, recipes.length); i++) {
      cum += weights[i];
      if (rand <= cum) return recipes[i];
    }
    return recipes[0];
  }

  console.log("\n=== LOADING 90 DAYS OF TRANSACTIONS ===\n");

  const now = Date.now();
  let total = 0;
  let errors = 0;
  let tokenAge = Date.now();

  for (let d = 89; d >= 0; d--) {
    // Refresh token every 45 minutes
    if (Date.now() - tokenAge > 45 * 60 * 1000) {
      console.log("  Refreshing token...");
      token = await getToken();
      tokenAge = Date.now();
    }

    const date = new Date(now - d * 86400000);
    const dow = date.getDay();
    const txCount = dayVolume[dow] + Math.floor(Math.random() * 15) - 5;

    // Batch requests in groups of 10
    const batch = [];
    for (let t = 0; t < txCount; t++) {
      const recipe = pickRecipe();
      const qty = Math.random() > 0.8 ? 2 : 1;
      const price = +(
        recipe.sellingPrice *
        (1 + (Math.random() * 0.1 - 0.05))
      ).toFixed(2);

      // Backdate the timestamp to the simulated day + random hour
      const txDate = new Date(date);
      txDate.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
      const timestamp = txDate.toISOString();

      batch.push(
        apiCall("POST", "/stores/" + STORE_ID + "/transactions", token, {
          lineItems: [{ recipeId: recipe.recipeId, quantity: qty, price }],
          timestamp,
        })
      );

      if (batch.length >= 10) {
        const results = await Promise.all(batch);
        results.forEach((r) => {
          if (r.status === 201) total++;
          else errors++;
        });
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      const results = await Promise.all(batch);
      results.forEach((r) => {
        if (r.status === 201) total++;
        else errors++;
      });
    }

    if (d % 15 === 0 || d === 89) {
      console.log(
        "  Day " + (90 - d) + "/90 done - " + total + " transactions loaded" +
        (errors ? " (" + errors + " errors)" : "")
      );
    }
  }

  console.log("\nDone! Loaded " + total + " transactions, " + errors + " errors.");
}

run().catch(console.error);
