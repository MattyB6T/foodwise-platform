import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { QueryCommand, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  Store,
  InventoryItem,
  Transaction,
  WasteLog,
  PurchaseOrder,
} from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

const bedrock = new BedrockRuntimeClient({});
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-20250514-v1:0";

interface AssistantBody {
  question: string;
  storeId: string;
}

interface DataContext {
  store?: Store;
  inventory?: InventoryItem[];
  recentTransactions?: { count: number; totalRevenue: number; totalFoodCost: number; foodCostPercentage: number };
  prevTransactions?: { count: number; totalRevenue: number; totalFoodCost: number; foodCostPercentage: number };
  wasteRecent?: { totalCost: number; count: number; byReason: Record<string, number>; byIngredient: { name: string; cost: number }[] };
  forecasts?: { recipeKey: string; predicted: number; actual?: number }[];
  openPurchaseOrders?: { orderId: string; supplierName: string; status: string; totalCost: number; expectedDeliveryDate: string }[];
  peerStores?: { storeId: string; name: string; foodCostPercentage: number; wastePercentage: number }[];
}

function classifyQuestion(question: string): string[] {
  const q = question.toLowerCase();
  const topics: string[] = [];

  if (q.includes("food cost") || q.includes("cost") || q.includes("margin") || q.includes("expensive")) {
    topics.push("food_cost");
  }
  if (q.includes("waste") || q.includes("spoil") || q.includes("expire") || q.includes("thrown") || q.includes("trash")) {
    topics.push("waste");
  }
  if (q.includes("order") || q.includes("purchase") || q.includes("buy") || q.includes("restock") || q.includes("next week")) {
    topics.push("ordering");
  }
  if (q.includes("inventory") || q.includes("stock") || q.includes("low") || q.includes("out of")) {
    topics.push("inventory");
  }
  if (q.includes("forecast") || q.includes("predict") || q.includes("demand") || q.includes("expect")) {
    topics.push("forecast");
  }
  if (q.includes("compare") || q.includes("other store") || q.includes("peer") || q.includes("versus") || q.includes("vs")) {
    topics.push("comparison");
  }
  if (q.includes("trend") || q.includes("getting better") || q.includes("getting worse") || q.includes("over time")) {
    topics.push("trends");
  }
  if (q.includes("sales") || q.includes("revenue") || q.includes("busy")) {
    topics.push("sales");
  }

  // Default: fetch core data
  if (topics.length === 0) {
    topics.push("food_cost", "inventory", "waste");
  }

  return topics;
}

async function fetchContextData(
  storeId: string,
  topics: string[]
): Promise<DataContext> {
  const ctx: DataContext = {};
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Always fetch store info
  const storeRes = await docClient.send(
    new GetCommand({ TableName: TABLES.STORES, Key: { storeId } })
  );
  ctx.store = storeRes.Item as Store | undefined;

  const fetches: Promise<void>[] = [];

  // Inventory
  if (topics.includes("inventory") || topics.includes("ordering") || topics.includes("food_cost")) {
    fetches.push(
      docClient
        .send(
          new QueryCommand({
            TableName: TABLES.INVENTORY,
            KeyConditionExpression: "storeId = :s",
            ExpressionAttributeValues: { ":s": storeId },
          })
        )
        .then((res) => {
          ctx.inventory = (res.Items || []) as InventoryItem[];
        })
    );
  }

  // Recent transactions (last 30d)
  if (topics.includes("food_cost") || topics.includes("sales") || topics.includes("trends")) {
    fetches.push(
      docClient
        .send(
          new QueryCommand({
            TableName: TABLES.TRANSACTIONS,
            IndexName: "timestamp-index",
            KeyConditionExpression: "storeId = :s AND #ts >= :since",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: { ":s": storeId, ":since": thirtyDaysAgo },
          })
        )
        .then((res) => {
          const txs = (res.Items || []) as Transaction[];
          const totalRevenue = txs.reduce((s, tx) => s + tx.totalAmount, 0);
          const totalFoodCost = txs.reduce((s, tx) => s + (tx.foodCost || 0), 0);
          ctx.recentTransactions = {
            count: txs.length,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalFoodCost: Math.round(totalFoodCost * 100) / 100,
            foodCostPercentage: totalRevenue > 0 ? Math.round((totalFoodCost / totalRevenue) * 10000) / 100 : 0,
          };
        })
    );
  }

  // Previous period transactions (30-60d ago) for trends
  if (topics.includes("trends") || topics.includes("food_cost")) {
    fetches.push(
      docClient
        .send(
          new QueryCommand({
            TableName: TABLES.TRANSACTIONS,
            IndexName: "timestamp-index",
            KeyConditionExpression: "storeId = :s AND #ts BETWEEN :start AND :end",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: { ":s": storeId, ":start": sixtyDaysAgo, ":end": thirtyDaysAgo },
          })
        )
        .then((res) => {
          const txs = (res.Items || []) as Transaction[];
          const totalRevenue = txs.reduce((s, tx) => s + tx.totalAmount, 0);
          const totalFoodCost = txs.reduce((s, tx) => s + (tx.foodCost || 0), 0);
          ctx.prevTransactions = {
            count: txs.length,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalFoodCost: Math.round(totalFoodCost * 100) / 100,
            foodCostPercentage: totalRevenue > 0 ? Math.round((totalFoodCost / totalRevenue) * 10000) / 100 : 0,
          };
        })
    );
  }

  // Waste data
  if (topics.includes("waste") || topics.includes("trends")) {
    fetches.push(
      docClient
        .send(
          new QueryCommand({
            TableName: TABLES.WASTE_LOGS,
            IndexName: "storeId-timestamp-index",
            KeyConditionExpression: "storeId = :s AND #ts >= :since",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: { ":s": storeId, ":since": thirtyDaysAgo },
          })
        )
        .then((res) => {
          const logs = (res.Items || []) as WasteLog[];
          const byReason: Record<string, number> = {};
          const byIngMap = new Map<string, { name: string; cost: number }>();

          for (const w of logs) {
            byReason[w.reason] = (byReason[w.reason] || 0) + w.totalCost;
            const existing = byIngMap.get(w.ingredientId);
            if (existing) existing.cost += w.totalCost;
            else byIngMap.set(w.ingredientId, { name: w.ingredientName, cost: w.totalCost });
          }

          ctx.wasteRecent = {
            totalCost: Math.round(logs.reduce((s, w) => s + w.totalCost, 0) * 100) / 100,
            count: logs.length,
            byReason: Object.fromEntries(
              Object.entries(byReason).map(([k, v]) => [k, Math.round(v * 100) / 100])
            ),
            byIngredient: Array.from(byIngMap.values())
              .sort((a, b) => b.cost - a.cost)
              .slice(0, 10)
              .map((i) => ({ name: i.name, cost: Math.round(i.cost * 100) / 100 })),
          };
        })
    );
  }

  // Forecasts
  if (topics.includes("forecast") || topics.includes("ordering")) {
    fetches.push(
      docClient
        .send(
          new QueryCommand({
            TableName: TABLES.FORECASTS,
            KeyConditionExpression: "forecastId = :fid",
            ExpressionAttributeValues: { ":fid": `latest-${storeId}` },
            Limit: 50,
          })
        )
        .then((res) => {
          ctx.forecasts = (res.Items || []).map((f) => ({
            recipeKey: f.storeRecipeKey as string,
            predicted: f.predicted as number,
            actual: f.actual as number | undefined,
          }));
        })
    );
  }

  // Open purchase orders
  if (topics.includes("ordering")) {
    fetches.push(
      docClient
        .send(
          new QueryCommand({
            TableName: TABLES.PURCHASE_ORDERS,
            IndexName: "storeId-index",
            KeyConditionExpression: "storeId = :s",
            FilterExpression: "#st IN (:d, :sub, :p)",
            ExpressionAttributeNames: { "#st": "status" },
            ExpressionAttributeValues: {
              ":s": storeId,
              ":d": "draft",
              ":sub": "submitted",
              ":p": "partial",
            },
          })
        )
        .then((res) => {
          ctx.openPurchaseOrders = ((res.Items || []) as PurchaseOrder[]).map((po) => ({
            orderId: po.orderId,
            supplierName: po.supplierName,
            status: po.status,
            totalCost: po.totalCost,
            expectedDeliveryDate: po.expectedDeliveryDate,
          }));
        })
    );
  }

  // Peer store comparison
  if (topics.includes("comparison")) {
    fetches.push(
      (async () => {
        const storesRes = await docClient.send(
          new ScanCommand({ TableName: TABLES.STORES })
        );
        const stores = (storesRes.Items || []) as Store[];
        const peers: DataContext["peerStores"] = [];

        for (const s of stores) {
          if (s.storeId === storeId) continue;
          const [txRes, wasteRes] = await Promise.all([
            docClient.send(
              new QueryCommand({
                TableName: TABLES.TRANSACTIONS,
                IndexName: "timestamp-index",
                KeyConditionExpression: "storeId = :s AND #ts >= :since",
                ExpressionAttributeNames: { "#ts": "timestamp" },
                ExpressionAttributeValues: { ":s": s.storeId, ":since": thirtyDaysAgo },
              })
            ),
            docClient.send(
              new QueryCommand({
                TableName: TABLES.WASTE_LOGS,
                IndexName: "storeId-timestamp-index",
                KeyConditionExpression: "storeId = :s AND #ts >= :since",
                ExpressionAttributeNames: { "#ts": "timestamp" },
                ExpressionAttributeValues: { ":s": s.storeId, ":since": thirtyDaysAgo },
              })
            ),
          ]);

          const txs = (txRes.Items || []) as Transaction[];
          const rev = txs.reduce((sum, tx) => sum + tx.totalAmount, 0);
          const fc = txs.reduce((sum, tx) => sum + (tx.foodCost || 0), 0);
          const wasteCost = ((wasteRes.Items || []) as WasteLog[]).reduce(
            (sum, w) => sum + w.totalCost,
            0
          );

          peers.push({
            storeId: s.storeId,
            name: s.name,
            foodCostPercentage: rev > 0 ? Math.round((fc / rev) * 10000) / 100 : 0,
            wastePercentage: fc > 0 ? Math.round((wasteCost / fc) * 10000) / 100 : 0,
          });
        }

        ctx.peerStores = peers;
      })()
    );
  }

  await Promise.all(fetches);
  return ctx;
}

function buildPrompt(question: string, ctx: DataContext): string {
  const sections: string[] = [];

  sections.push(
    `You are the FoodWise AI operations assistant for a food service restaurant (Subway-style). ` +
      `You help managers understand their store's performance and make data-driven decisions. ` +
      `Be specific, use numbers from the data, and give actionable recommendations. ` +
      `Keep responses concise but thorough. Use bullet points for lists.`
  );

  if (ctx.store) {
    sections.push(`\n## Store: ${ctx.store.name} (ID: ${ctx.store.storeId})`);
  }

  if (ctx.inventory) {
    const lowStock = ctx.inventory.filter(
      (i) => i.lowStockThreshold > 0 && i.quantity <= i.lowStockThreshold
    );
    const zeroStock = ctx.inventory.filter((i) => i.quantity <= 0);
    const totalValue = ctx.inventory.reduce(
      (s, i) => s + i.quantity * i.costPerUnit,
      0
    );

    sections.push(
      `\n## Inventory (${ctx.inventory.length} items, total value: $${totalValue.toFixed(2)})\n` +
        `- Low stock items (${lowStock.length}): ${lowStock.map((i) => `${i.name} (${i.quantity} ${i.unit}, threshold: ${i.lowStockThreshold})`).join(", ") || "none"}\n` +
        `- Out of stock (${zeroStock.length}): ${zeroStock.map((i) => i.name).join(", ") || "none"}\n` +
        `- Top items by value: ${ctx.inventory
          .sort((a, b) => b.quantity * b.costPerUnit - a.quantity * a.costPerUnit)
          .slice(0, 5)
          .map((i) => `${i.name}: ${i.quantity} ${i.unit} ($${(i.quantity * i.costPerUnit).toFixed(2)})`)
          .join(", ")}`
    );
  }

  if (ctx.recentTransactions) {
    const rt = ctx.recentTransactions;
    sections.push(
      `\n## Sales & Food Cost (Last 30 Days)\n` +
        `- Transactions: ${rt.count}\n` +
        `- Revenue: $${rt.totalRevenue.toFixed(2)}\n` +
        `- Food cost: $${rt.totalFoodCost.toFixed(2)} (${rt.foodCostPercentage}%)\n` +
        `- Industry target: 25-30% food cost`
    );
  }

  if (ctx.prevTransactions) {
    const pt = ctx.prevTransactions;
    sections.push(
      `\n## Previous Period (30-60 Days Ago)\n` +
        `- Revenue: $${pt.totalRevenue.toFixed(2)}\n` +
        `- Food cost: ${pt.foodCostPercentage}%`
    );
  }

  if (ctx.wasteRecent) {
    const w = ctx.wasteRecent;
    sections.push(
      `\n## Waste (Last 30 Days)\n` +
        `- Total waste cost: $${w.totalCost.toFixed(2)} (${w.count} entries)\n` +
        `- By reason: ${Object.entries(w.byReason)
          .sort((a, b) => b[1] - a[1])
          .map(([r, c]) => `${r}: $${c.toFixed(2)}`)
          .join(", ")}\n` +
        `- Top wasted ingredients: ${w.byIngredient.map((i) => `${i.name}: $${i.cost.toFixed(2)}`).join(", ")}\n` +
        `- Industry benchmark: waste should be under 4% of food cost`
    );
  }

  if (ctx.forecasts && ctx.forecasts.length > 0) {
    sections.push(
      `\n## Demand Forecasts\n` +
        ctx.forecasts
          .slice(0, 10)
          .map(
            (f) =>
              `- ${f.recipeKey}: predicted ${f.predicted}${f.actual !== undefined ? `, actual ${f.actual}` : ""}`
          )
          .join("\n")
    );
  }

  if (ctx.openPurchaseOrders && ctx.openPurchaseOrders.length > 0) {
    sections.push(
      `\n## Open Purchase Orders (${ctx.openPurchaseOrders.length})\n` +
        ctx.openPurchaseOrders
          .map(
            (po) =>
              `- ${po.supplierName}: $${po.totalCost.toFixed(2)} (${po.status}, expected ${po.expectedDeliveryDate})`
          )
          .join("\n")
    );
  }

  if (ctx.peerStores && ctx.peerStores.length > 0) {
    sections.push(
      `\n## Peer Store Comparison\n` +
        ctx.peerStores
          .map(
            (p) =>
              `- ${p.name}: food cost ${p.foodCostPercentage}%, waste ${p.wastePercentage}%`
          )
          .join("\n")
    );
  }

  sections.push(`\n## Manager's Question\n${question}`);

  return sections.join("\n");
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserClaims(event);

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: AssistantBody = JSON.parse(event.body);

    if (!body.question || !body.storeId) {
      return error("question and storeId are required", 400);
    }

    if (body.question.length > 1000) {
      return error("Question must be under 1000 characters", 400);
    }

    // Classify the question to determine what data to fetch
    const topics = classifyQuestion(body.question);

    // Fetch relevant data based on question topics
    const ctx = await fetchContextData(body.storeId, topics);

    if (!ctx.store) {
      return error("Store not found", 404, "STORE_NOT_FOUND");
    }

    // Build the prompt with context
    const prompt = buildPrompt(body.question, ctx);

    // Call Bedrock with Claude
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const answer = responseBody.content?.[0]?.text || "I was unable to generate a response.";

    return success({
      question: body.question,
      storeId: body.storeId,
      answer,
      topicsAnalyzed: topics,
      askedBy: user.email,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    const errName = (err as any)?.name || "";
    if (errName === "ThrottlingException") {
      return error("AI assistant is temporarily unavailable due to high usage. Please try again later.", 429, "THROTTLED");
    }
    if (errName === "AccessDeniedException") {
      return error("AI assistant model access is not configured. Please contact support.", 503, "MODEL_ACCESS_DENIED");
    }
    console.error("Assistant error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
