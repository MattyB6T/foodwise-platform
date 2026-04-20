import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import StripeSDK from "stripe";
import type { Stripe } from "stripe";
import { Subscription, SubscriptionPlan, PLAN_LIMITS } from "@leantable/shared";
import { docClient } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE!;

const ssmClient = new SSMClient({});
let stripe: Stripe | null = null;

async function getStripe(): Promise<Stripe> {
  if (stripe) return stripe;
  const result = await ssmClient.send(
    new GetParameterCommand({
      Name: "/foodwise/stripe-secret-key",
      WithDecryption: true,
    })
  );
  if (!result.Parameter?.Value) {
    throw new Error("Stripe secret key not found in SSM");
  }
  stripe = new StripeSDK(result.Parameter.Value);
  return stripe;
}

const PRICE_IDS: Record<Exclude<SubscriptionPlan, "free">, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || "price_starter",
  pro: process.env.STRIPE_PRICE_PRO || "price_pro",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "price_enterprise",
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.path || "";

  // Stripe webhook — no auth required
  if (path.endsWith("/billing/webhook") && method === "POST") {
    return handleWebhook(event);
  }

  try {
    const claims = getUserClaims(event);
    const ownerId = claims.sub;

    // GET /billing — get current subscription
    if (method === "GET" && path.endsWith("/billing")) {
      return getSubscription(ownerId);
    }

    // POST /billing/checkout — create checkout session
    if (method === "POST" && path.endsWith("/billing/checkout")) {
      return createCheckout(ownerId, claims.email, event);
    }

    // POST /billing/portal — create customer portal session
    if (method === "POST" && path.endsWith("/billing/portal")) {
      return createPortal(ownerId);
    }

    return error("Billing route not found", 404, "NOT_FOUND");
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return error("Unauthorized", 401, "UNAUTHORIZED");
    }
    console.error("Billing error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};

async function getSubscription(
  ownerId: string
): Promise<APIGatewayProxyResult> {
  const result = await docClient.send(
    new GetCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Key: { ownerId },
    })
  );

  if (!result.Item) {
    // Return default free plan
    const freeSub: Partial<Subscription> = {
      ownerId,
      plan: "free",
      status: "active",
      maxStores: PLAN_LIMITS.free.maxStores,
    };
    return success(freeSub);
  }

  return success(result.Item);
}

async function createCheckout(
  ownerId: string,
  email: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || "{}");
  const plan = body.plan as SubscriptionPlan;

  if (!plan || plan === "free" || !PRICE_IDS[plan]) {
    return error("Invalid plan. Choose: starter, pro, or enterprise", 400);
  }

  const stripeClient = await getStripe();

  // Get or create Stripe customer
  let customerId: string;
  const existing = await docClient.send(
    new GetCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Key: { ownerId },
    })
  );

  if (existing.Item?.stripeCustomerId) {
    customerId = existing.Item.stripeCustomerId;
  } else {
    const customer = await stripeClient.customers.create({
      email,
      metadata: { ownerId },
    });
    customerId = customer.id;

    // Save customer ID
    const now = new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: SUBSCRIPTIONS_TABLE,
        Item: {
          ownerId,
          stripeCustomerId: customerId,
          plan: "free",
          status: "active",
          maxStores: PLAN_LIMITS.free.maxStores,
          createdAt: now,
          updatedAt: now,
        },
      })
    );
  }

  const origin = event.headers?.origin || event.headers?.Origin || "https://app.leantable.app";

  const session = await stripeClient.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${origin}/settings/billing?success=true`,
    cancel_url: `${origin}/settings/billing?canceled=true`,
    metadata: { ownerId, plan },
  });

  return success({ url: session.url });
}

async function createPortal(
  ownerId: string
): Promise<APIGatewayProxyResult> {
  const existing = await docClient.send(
    new GetCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Key: { ownerId },
    })
  );

  if (!existing.Item?.stripeCustomerId) {
    return error("No billing account found. Subscribe to a plan first.", 400);
  }

  const stripeClient = await getStripe();
  const session = await stripeClient.billingPortal.sessions.create({
    customer: existing.Item.stripeCustomerId,
    return_url: "https://app.leantable.app/settings/billing",
  });

  return success({ url: session.url });
}

async function handleWebhook(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const stripeClient = await getStripe();
  const sig = event.headers["Stripe-Signature"] || event.headers["stripe-signature"];

  if (!sig || !event.body) {
    return error("Missing signature or body", 400);
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return error("Webhook not configured", 500, "INTERNAL_ERROR");
  }

  let stripeEvent: any;
  try {
    stripeEvent = stripeClient.webhooks.constructEvent(event.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return error("Invalid signature", 400);
  }

  const now = new Date().toISOString();

  switch (stripeEvent.type) {
    case "checkout.session.completed": {
      const session = stripeEvent.data.object;
      const ownerId = session.metadata?.ownerId;
      const plan = (session.metadata?.plan || "starter") as SubscriptionPlan;
      if (!ownerId) break;

      await docClient.send(
        new UpdateCommand({
          TableName: SUBSCRIPTIONS_TABLE,
          Key: { ownerId },
          UpdateExpression:
            "SET #plan = :plan, #status = :status, stripeSubscriptionId = :subId, maxStores = :maxStores, updatedAt = :now",
          ExpressionAttributeNames: { "#plan": "plan", "#status": "status" },
          ExpressionAttributeValues: {
            ":plan": plan,
            ":status": "active",
            ":subId": session.subscription as string,
            ":maxStores": PLAN_LIMITS[plan].maxStores,
            ":now": now,
          },
        })
      );
      break;
    }

    case "customer.subscription.updated": {
      const subObj = stripeEvent.data.object;
      const customerId = subObj.customer as string;
      const sub = await findByCustomerId(customerId);
      if (!sub) break;

      const status = subObj.status === "active" ? "active"
        : subObj.status === "trialing" ? "trialing"
        : subObj.status === "past_due" ? "past_due"
        : subObj.status === "canceled" ? "canceled"
        : "unpaid";

      await docClient.send(
        new UpdateCommand({
          TableName: SUBSCRIPTIONS_TABLE,
          Key: { ownerId: sub.ownerId },
          UpdateExpression:
            "SET #status = :status, currentPeriodEnd = :periodEnd, cancelAtPeriodEnd = :cancel, updatedAt = :now",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": status,
            ":periodEnd": new Date(subObj.current_period_end * 1000).toISOString(),
            ":cancel": subObj.cancel_at_period_end,
            ":now": now,
          },
        })
      );
      break;
    }

    case "customer.subscription.deleted": {
      const subObj = stripeEvent.data.object;
      const customerId = subObj.customer as string;
      const sub = await findByCustomerId(customerId);
      if (!sub) break;

      await docClient.send(
        new UpdateCommand({
          TableName: SUBSCRIPTIONS_TABLE,
          Key: { ownerId: sub.ownerId },
          UpdateExpression:
            "SET #plan = :plan, #status = :status, maxStores = :maxStores, updatedAt = :now",
          ExpressionAttributeNames: { "#plan": "plan", "#status": "status" },
          ExpressionAttributeValues: {
            ":plan": "free",
            ":status": "canceled",
            ":maxStores": PLAN_LIMITS.free.maxStores,
            ":now": now,
          },
        })
      );
      break;
    }
  }

  return success({ received: true });
}

async function findByCustomerId(
  customerId: string
): Promise<{ ownerId: string } | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      IndexName: "stripeCustomerId-index",
      KeyConditionExpression: "stripeCustomerId = :cid",
      ExpressionAttributeValues: { ":cid": customerId },
      Limit: 1,
    })
  );
  return result.Items?.[0] as { ownerId: string } | null;
}
