# FoodWise Platform — Security Posture

## Authentication & Authorization

- **Cognito User Pool** with Advanced Security (ENFORCED mode)
  - Brute-force protection and adaptive authentication enabled
  - Self sign-up disabled; admin-created accounts only
  - Password policy: 12+ chars, upper/lower/digit/symbol required
  - Temp passwords expire in 3 days
  - `preventUserExistenceErrors: true` on app client
- **Token validity**: 1 hour access/ID tokens, 30-day refresh tokens
- **RBAC**: Four roles (owner > manager > staff > readonly) enforced server-side
- **Kiosk auth**: Device API key + device ID header validation

## API Security

- **Rate limiting**: Stage-level throttle (100 RPS, 200 burst) on API Gateway
- **Webhook rate limiting**: Separate usage plan for POS webhooks (100 RPS, 100K/day)
- **CORS**: Restricted to `foodwise.io`, `*.foodwise.io`, and `localhost` dev origins
- **Security headers** on all responses:
  - `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy: no-referrer`
  - `Cache-Control: no-store` (prevents caching of sensitive data)
- **Gateway responses** (4xx/5xx) include security headers
- **Request timestamp validation**: Rejects requests >5 min old (replay prevention)
- **Body size limits**: 1MB default, 5MB for CSV uploads

## Input Validation

- **Zod schema validation** on all kiosk endpoints (register, lookup, clock-in)
- Common validated schemas: UUIDs, emails, PINs, coordinates, safe strings
- HTML/script tag stripping on text inputs
- CSV injection prevention (leading formula character stripping)

## Data Security

- **S3**: SSL enforced, versioning enabled, lifecycle rules (90-day photo cleanup, 7-day temp cleanup)
- **DynamoDB**: Encryption at rest (AWS managed), TTL on security events (1 year) and raw POS data
- **IAM**: Least-privilege grants per Lambda; wildcard only on store sub-router (IAM policy size constraint, documented)

## Monitoring & Alerting

- **API Gateway access logging** to CloudWatch (JSON format, 90-day retention)
- **CloudWatch Alarms**:
  - High 4xx rate (>100 in 5 min) — potential brute force/scanning
  - High 5xx rate (>20 in 5 min) — application errors
  - High request volume (>1000/min) — potential DoS
  - Lambda error alarms on critical functions (Kiosk, StoreSubRouter, Assistant)
- **Security Events Table**: All security-relevant events logged to DynamoDB
  - Failed PIN attempts, invalid device tokens, suspicious clock-ins
  - Indexed by eventType+timestamp and storeId+timestamp for querying

## Mobile Security

- **Session timeout**: 30-minute idle timeout, auto-logout
- **Request timestamp**: Every API request includes `X-Request-Timestamp` header
- **Auto-logout on 401**: Token expiry triggers immediate logout
- **Deep link validation**: Only allowed URL prefixes accepted
- **Input sanitization**: Sensitive keys stripped before local storage

## Known Limitations

- Store sub-router Lambda uses wildcard DynamoDB permissions due to IAM policy size limits
- CORS currently includes `*` in Lambda response headers (Gateway CORS handles enforcement)
- Certificate pinning requires native module integration (placeholder documented)
- Screenshot prevention requires `expo-screen-capture` (placeholder documented)

## Reporting Vulnerabilities

If you discover a security vulnerability, please email security@foodwise.io.
Do not open public issues for security concerns.
