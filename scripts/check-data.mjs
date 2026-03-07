import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import https from "https";

const cognito = new CognitoIdentityProviderClient({ region: "us-east-1" });

// Get token
const authRes = await cognito.send(new InitiateAuthCommand({
  AuthFlow: "USER_PASSWORD_AUTH",
  ClientId: "585k9dd1v7gir4ul3g3k06a5k2",
  AuthParameters: {
    USERNAME: "matt@foodwise.io",
    PASSWORD: process.env.FOODWISE_PASSWORD || "NEED_PASSWORD",
  },
}));
const token = authRes.AuthenticationResult.IdToken;

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const url = `https://l0mnegjjp2.execute-api.us-east-1.amazonaws.com/v1${path}`;
    https.get(url, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    }).on("error", reject);
  });
}

console.log("=== DASHBOARD ===");
const dashboard = await apiGet("/dashboard");
console.log(JSON.stringify(dashboard, null, 2));

// Get storeId from dashboard
const storeId = dashboard?.data?.stores?.[0]?.storeId;
if (storeId) {
  console.log("\n=== HEALTH SCORE ===");
  const health = await apiGet(`/stores/${storeId}/health-score`);
  console.log(JSON.stringify(health, null, 2));

  console.log("\n=== OWNER DASHBOARD ===");
  const owner = await apiGet("/owner-dashboard");
  console.log(JSON.stringify(owner, null, 2));
}
