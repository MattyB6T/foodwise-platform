# FoodWise Platform - Claude Code Context

## What This Is

FoodWise is a food service management platform for restaurant/store operators. It handles inventory tracking, waste logging, purchase orders, staff scheduling, time clock, AI assistant, POS integrations, security cameras, and more. The mobile app runs on iOS, Android, and web via Expo.

## Architecture

Monorepo with 4 packages + mobile app:

| Package | Tech | Purpose |
|---------|------|---------|
| `packages/api/` | TypeScript, Node.js 20 | Lambda handlers (78 files) |
| `packages/infrastructure/` | AWS CDK, TypeScript | Nested stacks (5 files) |
| `packages/shared/` | TypeScript | Shared types |
| `packages/models/` | Python 3.12, Docker | ML forecast Lambda |
| `packages/mobile/` | React Native, Expo | Mobile/web app (24 screens) |

## Nested Stack Structure

```
FoodwiseStack (root) - packages/infrastructure/lib/foodwise-stack.ts
  |-- CoreStack       - DynamoDB tables (25+), Cognito User Pool, S3 buckets
  |-- PosStack        - Toast webhook, Square poller, CSV import, forecast accuracy
  |-- ApiStack        - API Gateway REST API, 14+ Lambda functions, CloudWatch alarms
  |-- SchedulerStack  - EventBridge rules (forecast, weekly report)
```

Total CloudFormation resources: ~324 (Root=5, Core=42, Api=255, POS=17, Scheduler=5)

## API Lambda Handlers

Most routes use a "mega router" pattern to stay under CloudFormation resource limits. Each router Lambda handles multiple HTTP methods/paths internally.

### Router Lambdas (in api-stack.ts)
- `storeOpsRouterFn` - POST/GET /stores
- `storeSubRouterFn` - /stores/{storeId}/{proxy+} (routes to 15+ sub-handlers)
- `recipeRouterFn` - POST/GET /recipes
- `supplyChainRouterFn` - POST/GET /suppliers, vendor price history
- `analyticsRouterFn` - GET /dashboard, /owner-dashboard, /store-comparison, etc.
- `assistantFn` - POST /assistant (uses AWS Bedrock with Claude)
- `kioskRouterFn` - /kiosk/* (employee time clock kiosk)
- `notificationRouterFn` - /notifications/*
- `staffScheduleRouterFn` - /staff, /schedule, /timesheet/*
- `cameraIncidentRouterFn` - /cameras, /incidents
- `wasteRouterFn` - /waste/*
- `countRouterFn` - /counts/*

### Handler Files (packages/api/src/handlers/)
78 handler files total. Key ones:
- `storeSubRouter.ts` - Central mega router, handles inventory, transactions, receiving, expiration, temp logs, etc.
- `assistant.ts` - AI assistant using Bedrock (us.anthropic.claude-sonnet-4-20250514-v1:0)
- `posProcessor.ts` - Central POS transaction normalization + dedup + inventory deduction
- `toastWebhook.ts` - Toast POS HMAC-SHA256 webhook receiver
- `squarePoller.ts` - Square POS OAuth + EventBridge polling
- `csvImport.ts` - S3 trigger for CSV POS imports
- `forecastAccuracy.ts` - Weekly forecast accuracy tracking

### Shared Utilities (packages/api/src/utils/)
- `response.ts` - `success()` and `error()` helpers with CORS headers
- `auth.ts` - `getUserClaims()` extracts Cognito JWT claims
- `dynamo.ts` - `docClient` singleton and `TABLES` object (reads env vars)
- `levenshtein.ts` - Fuzzy string matching for POS item mapping

## DynamoDB Tables

25 tables total, all PAY_PER_REQUEST billing. Tables have NO explicit `tableName` -- CloudFormation auto-generates names. Table names passed to Lambdas via environment variables.

Critical tables (PITR enabled): transactions, inventory, staff, timeclock

Key tables and access patterns:
- **Stores** - PK: storeId
- **Inventory** - PK: storeId, SK: itemId
- **Transactions** - PK: storeId, SK: transactionId, GSI: timestamp-index
- **Recipes** - PK: recipeId
- **WasteLogs** - PK: wasteId, GSI: storeId-timestamp-index
- **PurchaseOrders** - PK: orderId, GSI: storeId-index
- **ReceivingLogs** - PK: receivingId, GSI: storeId-index
- **Staff** - PK: staffId, GSI: storeId-index
- **TimeClock** - PK: entryId, GSI: storeId-clockInTime-index
- **Forecasts** - PK: forecastId, SK: storeRecipeKey
- **POS tables**: pos-connections, pos-transactions-raw, ingredient-mappings, forecast-accuracy

## Mobile App (packages/mobile/)

### Navigation
- `App.tsx` - Root navigator with auth flow, onboarding, kiosk mode, and tab navigator
- Bottom tabs: Dashboard, Scanner, Inventory, Waste, Orders, Security, Assistant, Settings
- Stack screens for detail views (StoreDetail, TransactionDetail, TimeEntryDetail, etc.)
- Kiosk mode: separate employee time clock UI, toggled via AsyncStorage

### 24 Screens (packages/mobile/src/screens/)
Dashboard, Login, ModeSelection, Onboarding, Kiosk, BarcodeScanner, Count, WasteLog, OrderReview, Reports, Expiration, TempLog, Forecast, Schedule, Timesheet, TimeEntryDetail, LiveStaff, Security, TransactionDetail, StoreDetail, Assistant, Settings, Integrations, Mapping

### Contexts
- `AuthContext` - Cognito authentication state
- `StoreContext` - Active store selection
- `ThemeContext` - Light/dark mode

### Utilities
- `api.ts` - API client with auth headers
- `theme.ts` - Color schemes, spacing, font sizes
- `security.ts` - Security helpers
- `offlineStorage.ts` - Offline data caching
- `config.ts` - Environment config

## POS Integration Layer

Three POS systems supported:
1. **Toast** - HMAC-SHA256 webhook at POST /webhooks/toast/{storeId}
2. **Square** - OAuth + 15-min EventBridge polling
3. **CSV Upload** - S3 trigger (pos-imports/{storeId}/*.csv) + direct API upload

Processing pipeline:
- Fuzzy matching via Levenshtein distance (85% auto-map, 60% needs-review thresholds)
- `posProcessor.ts` normalizes transactions, deduplicates, deducts inventory
- Forecast accuracy checked weekly (Sundays 3 AM UTC)

## AWS Resources

- **Region**: us-east-1
- **Cognito User Pool**: us-east-1_Oc2LSrhWb
- **Cognito Client ID**: 585k9dd1v7gir4ul3g3k06a5k2
- **API Gateway**: l0mnegjjp2 (https://l0mnegjjp2.execute-api.us-east-1.amazonaws.com/v1/)
- **AI Model**: Bedrock inference profile us.anthropic.claude-sonnet-4-20250514-v1:0
- **Test user**: matt@foodwise.io (owner sub: a4c8f448-1031-70dc-991e-a60bc878349d)

## Key Patterns and Conventions

- All Lambda responses use `success()` / `error()` from `utils/response.ts` for consistent CORS + security headers
- Auth via `getUserClaims()` (Cognito JWT) -- most endpoints require auth
- All 25+ table env vars set via `lambdaEnvironment` object in api-stack.ts
- Shared types exported from `@foodwise/shared`
- Mobile app uses `makeStyles(colors)` pattern for themed StyleSheet
- Navigation types defined in `src/navigation/types.ts`

## Known Technical Decisions

- CORS set to `Cors.ALL_ORIGINS` on API Gateway (Lambda responses also use `*`)
- Cognito User Pool on ESSENTIALS tier (not PLUS) -- no advanced security mode
- `signInCaseSensitive` is default (true) -- immutable after pool creation
- Bedrock IAM uses wildcard region (`arn:aws:bedrock:*::`) for cross-region inference profiles
- Marketplace permissions on assistant Lambda for Bedrock model access

## Deployment

```bash
npm install
cd packages/shared && npm run build
cd ../infrastructure && AWS_PROFILE=foodwise npx cdk deploy --all --require-approval never
```

## Seed Data

```bash
node scripts/seed-demo.mjs          # Seed Subway demo data
node scripts/cleanup-old-seed.mjs   # Clean old format data
```

## Areas Worth Reviewing

- **Security**: Input validation on Lambda handlers, auth enforcement consistency, IAM least-privilege
- **Error handling**: Some handlers may lack proper try/catch or return generic errors
- **DynamoDB**: Query efficiency, missing GSIs, scan operations that should be queries
- **Type safety**: Heavy use of `any` in navigation types and some handlers
- **Code duplication**: Router Lambdas may have repeated patterns that could be shared
- **Mobile**: Offline handling, error states, loading states consistency
- **POS integration**: Edge cases in fuzzy matching, webhook replay/idempotency
