/**
 * LeanTable Seed Script — Revenue Sources & Entries for Bar + Cafe
 *
 * Seeds ancillary revenue data for:
 *   - store-003 (The Copper Rail, bar)
 *   - store-004 (Maple Street Coffee, cafe)
 *
 * Run: node scripts/seed-revenue.mjs
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { randomUUID } from "crypto";

const client = new DynamoDBClient({
  region: "us-east-1",
  credentials: fromIni({ profile: "foodwise" }),
});
const doc = DynamoDBDocumentClient.from(client);

const P = "FoodwiseStack-CoreStackNestedStackCoreStackNestedStackResource06DFB247-ME86T0DHUM3I";
const T = {
  REVENUE_SOURCES: `${P}-RevenueSourcesTable1F5217F0-9WGYGXPP0BGO`,
  REVENUE_ENTRIES: `${P}-RevenueEntriesTableF3F0AD31-IZNWJD59IOKV`,
};

async function batchWrite(table, items) {
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25).map((item) => ({ PutRequest: { Item: item } }));
    await doc.send(new BatchWriteCommand({ RequestItems: { [table]: batch } }));
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dateStr(daysAgo) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0];
}

const now = new Date().toISOString();

// ── Bar Sources (store-003) ──
const barSources = [
  { sourceId: "src-bar-pool", name: "Pool Tables", type: "pool_tables" },
  { sourceId: "src-bar-darts", name: "Dart Boards", type: "darts" },
  { sourceId: "src-bar-cover", name: "Cover Charge", type: "cover_charge" },
  { sourceId: "src-bar-music", name: "Live Music Night", type: "live_music" },
  { sourceId: "src-bar-trivia", name: "Tuesday Trivia", type: "trivia" },
  { sourceId: "src-bar-events", name: "Private Events", type: "private_events" },
].map((s) => ({ storeId: "store-003", ...s, isActive: true, createdAt: now }));

// ── Cafe Sources (store-004) ──
const cafeSources = [
  { sourceId: "src-cafe-catering", name: "Catering Orders", type: "catering" },
  { sourceId: "src-cafe-merch", name: "Merchandise & Bags", type: "merchandise" },
  { sourceId: "src-cafe-events", name: "Private Events", type: "private_events" },
].map((s) => ({ storeId: "store-004", ...s, isActive: true, createdAt: now }));

// ── Generate 30 days of entries ──
const barEntries = [];
const cafeEntries = [];

for (let d = 0; d < 30; d++) {
  const date = dateStr(d);
  const dow = new Date(Date.now() - d * 86400000).getDay(); // 0=Sun, 5=Fri, 6=Sat
  const isWeekend = dow === 5 || dow === 6;
  const isFriSat = dow === 5 || dow === 6;

  // Bar: pool tables daily, darts most days, cover on Fri/Sat, live music Fri, trivia Tue, events occasionally
  barEntries.push({
    storeId: "store-003", entryId: randomUUID(), sourceId: "src-bar-pool",
    amount: randomInt(4000, 12000), // $40-120
    date, createdBy: "seed", createdAt: now,
  });

  if (Math.random() > 0.2) {
    barEntries.push({
      storeId: "store-003", entryId: randomUUID(), sourceId: "src-bar-darts",
      amount: randomInt(1500, 5000), // $15-50
      date, createdBy: "seed", createdAt: now,
    });
  }

  if (isFriSat) {
    barEntries.push({
      storeId: "store-003", entryId: randomUUID(), sourceId: "src-bar-cover",
      amount: randomInt(15000, 40000), // $150-400
      date, createdBy: "seed", createdAt: now,
    });
  }

  if (dow === 5) { // Friday live music
    barEntries.push({
      storeId: "store-003", entryId: randomUUID(), sourceId: "src-bar-music",
      amount: randomInt(20000, 50000), // $200-500
      date, createdBy: "seed", createdAt: now,
    });
  }

  if (dow === 2) { // Tuesday trivia
    barEntries.push({
      storeId: "store-003", entryId: randomUUID(), sourceId: "src-bar-trivia",
      amount: randomInt(5000, 15000), // $50-150
      date, createdBy: "seed", createdAt: now,
    });
  }

  if (isWeekend && Math.random() > 0.7) {
    barEntries.push({
      storeId: "store-003", entryId: randomUUID(), sourceId: "src-bar-events",
      amount: randomInt(50000, 150000), // $500-1500
      date, createdBy: "seed", createdAt: now,
    });
  }

  // Cafe: catering most weekdays, merchandise daily, events occasionally
  if (dow >= 1 && dow <= 5 && Math.random() > 0.3) {
    cafeEntries.push({
      storeId: "store-004", entryId: randomUUID(), sourceId: "src-cafe-catering",
      amount: randomInt(8000, 35000), // $80-350
      date, createdBy: "seed", createdAt: now,
    });
  }

  cafeEntries.push({
    storeId: "store-004", entryId: randomUUID(), sourceId: "src-cafe-merch",
    amount: randomInt(1000, 5000), // $10-50
    date, createdBy: "seed", createdAt: now,
  });

  if (isWeekend && Math.random() > 0.8) {
    cafeEntries.push({
      storeId: "store-004", entryId: randomUUID(), sourceId: "src-cafe-events",
      amount: randomInt(30000, 80000), // $300-800
      date, createdBy: "seed", createdAt: now,
    });
  }
}

// ── Write ──
console.log(`Seeding ${barSources.length} bar sources + ${cafeSources.length} cafe sources...`);
await batchWrite(T.REVENUE_SOURCES, [...barSources, ...cafeSources]);

console.log(`Seeding ${barEntries.length} bar entries + ${cafeEntries.length} cafe entries...`);
await batchWrite(T.REVENUE_ENTRIES, [...barEntries, ...cafeEntries]);

console.log("Done!");
