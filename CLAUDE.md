# FoodWise Platform - Claude Code Context

## Architecture

Monorepo with 4 packages + mobile app:
- `packages/api/` - Lambda handlers (TypeScript, Node.js 20)
- `packages/infrastructure/` - CDK nested stacks (TypeScript)
- `packages/shared/` - Shared types (TypeScript)
- `packages/models/` - ML forecast service (Python 3.12, Docker)
- `packages/mobile/` - React Native app (Expo)

## Nested Stack Structure

```
FoodwiseStack (root)
  ├── CoreStack       - 28 DynamoDB tables, Cognito, S3
  ├── PosStack        - Toast webhook, Square poller, CSV import, forecast accuracy
  ├── ApiStack        - API Gateway, 14 Lambda functions, CloudWatch alarms
  └── SchedulerStack  - EventBridge rules (forecast, weekly report)
```

## Router Lambda Pattern

Most API routes go through a "mega router" pattern to stay under CloudFormation resource limits:

```
POST/GET /stores              -> storeOpsRouterFn
/stores/{storeId}/{proxy+}    -> storeSubRouterFn (routes to 15+ sub-handlers)
POST/GET /recipes             -> recipeRouterFn
POST/GET /suppliers           -> supplyChainRouterFn
GET /dashboard                -> analyticsRouterFn
POST /assistant               -> assistantFn
/kiosk/*                      -> kioskRouterFn
/notifications/*              -> notificationRouterFn
```

## DynamoDB Tables

All tables use PAY_PER_REQUEST billing. Key tables:
- Stores (PK: storeId)
- Inventory (PK: storeId, SK: itemId)
- Transactions (PK: storeId, SK: transactionId, GSI: timestamp-index)
- Recipes (PK: recipeId)
- WasteLogs (PK: wasteId, GSI: storeId-timestamp-index)
- PurchaseOrders (PK: orderId, GSI: storeId-index)
- ReceivingLogs (PK: receivingId, GSI: storeId-index)
- Staff (PK: staffId, GSI: storeId-index)
- TimeClock (PK: entryId, GSI: storeId-clockInTime-index)
- Forecasts (PK: forecastId, SK: storeRecipeKey)
- + 18 more supporting tables

## AWS Resources

- Region: us-east-1
- User Pool: us-east-1_Oc2LSrhWb
- Client ID: 585k9dd1v7gir4ul3g3k06a5k2
- API Gateway: l0mnegjjp2 (https://l0mnegjjp2.execute-api.us-east-1.amazonaws.com/v1/)
- Test user: matt@foodwise.io
- Owner sub: a4c8f448-1031-70dc-991e-a60bc878349d

## Key Patterns

- All handlers use `success()` and `error()` from `utils/response.ts` for consistent CORS/security headers
- Auth via `getUserClaims()` from `utils/auth.ts` (extracts Cognito JWT claims)
- DynamoDB access via `docClient` and `TABLES` from `utils/dynamo.ts`
- All 34 table env vars set via `lambdaEnvironment` object in api-stack.ts
- Shared types exported from `@foodwise/shared`

## Deployment

```bash
npm install
cd packages/shared && npm run build
cd ../infrastructure && npx cdk deploy --profile foodwise
```

## Seed Data

```bash
node scripts/seed-demo.mjs     # Seed Subway demo data
node scripts/cleanup-old-seed.mjs  # Clean old format data
```
