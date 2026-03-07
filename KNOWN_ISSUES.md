# Known Issues

## Critical
None.

## High

### AI Assistant returns 503
- **What**: POST /assistant returns "AI assistant model access is not configured"
- **Why**: AWS Bedrock model access (Claude Sonnet) not enabled in the account
- **Fix**: Enable Claude model access in AWS Bedrock console > Model access > Request access
- **Impact**: AI assistant screen shows error; all other features work

### Dashboard slow on cold start
- **What**: GET /dashboard takes 3-4 seconds on cold Lambda start
- **Why**: Multi-store aggregate queries (5 parallel DynamoDB queries per store)
- **Workaround**: Lambda stays warm after first call. Consider provisioned concurrency for production.

## Medium

### OnboardingScreen is orphaned
- **What**: `packages/mobile/src/screens/OnboardingScreen.tsx` exists but is never navigated to
- **Why**: Was built early but never wired into the navigation flow
- **Fix**: Either wire it into the post-registration flow or remove the file

### Transactions endpoint returns large payloads
- **What**: GET /stores/{storeId}/transactions returns all 30 days (~3000 items, 102KB)
- **Why**: No pagination implemented on this endpoint
- **Fix**: Add cursor-based pagination using DynamoDB LastEvaluatedKey

### Hardcoded colors in mobile screens
- **What**: 130 instances of hardcoded hex colors across 22 screen files
- **Why**: Most are `#fff` on buttons (acceptable) or brand colors on standalone screens
- **Impact**: Minor dark mode inconsistencies possible. LoginScreen and ModeSelectionScreen are fully hardcoded by design.

## Low

### Missing EventBridge scheduled tasks
The following scheduled tasks mentioned in design docs are not yet implemented:
- Daily summary notifications (6 AM)
- Temperature log reminders (every 4 hours)
- Security monitor (hourly)

These are nice-to-have automation features, not blocking for MVP.

### No PITR on DynamoDB tables
Point-in-time recovery is not enabled on any table. Should be enabled on critical tables (transactions, inventory, staff, timeclock) before handling real customer data.

### Recipes and Suppliers have no dedicated mobile screens
These are managed through seed data and the API. A dedicated recipe management screen would be needed for self-serve onboarding.

## Technical Debt

- `storeSubRouterFn` has wildcard DynamoDB permissions (necessary due to routing to 15+ sub-handlers accessing different tables)
- Scans on stores, recipes, suppliers tables (acceptable at current scale, should add GSIs if >100 items)
- No automated tests (unit or integration)
- No CI/CD pipeline
- Mobile app uses `any` types extensively in API calls instead of shared types
