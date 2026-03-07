# FoodWise Platform

AI-powered food service management platform for restaurant owners and multi-unit operators. Tracks inventory, waste, food cost, staff scheduling, and uses AI to forecast demand and reduce waste.

## Features

- **Multi-store dashboard** with health scores and store comparison
- **Inventory management** with low stock alerts and add-item forms
- **Recipe and food cost tracking** with automatic COGS calculation
- **Waste tracking and analytics** with anomaly detection and AI recommendations
- **Purchase orders** with barcode receiving and vendor email
- **AI demand forecasting** using Facebook Prophet (7-day predictions)
- **Staff scheduling and timesheets** with kiosk clock-in/out
- **Temperature logs** for HACCP compliance
- **Menu engineering** with Star/Plow Horse/Puzzle/Dog matrix
- **AI assistant** powered by Claude via AWS Bedrock
- **Security cameras** with incident management
- **POS integration** (Toast, Square, CSV import)
- **Reports** (P&L, food cost trend, waste summary, inventory valuation)
- **Expiration tracking** with FIFO alerts
- **Audit trail** for complete activity logging

## Architecture

```
React Native (Expo) Mobile App
        |
  API Gateway (REST, Cognito auth)
        |
  Lambda (Node.js 20) - Router pattern
        |
  DynamoDB (28 tables, PAY_PER_REQUEST)
        |
  EventBridge -> Forecast (Python/Docker)
               -> Weekly Report (SES)
               -> Square Poller (15 min)
```

## Project Structure

```
foodwise-platform/
  packages/
    api/              77 Lambda handlers (TypeScript)
    infrastructure/   4 CDK nested stacks
    shared/           Shared types (TypeScript)
    models/           ML forecast (Python, Docker)
    mobile/           24-screen React Native app (Expo)
  scripts/
    seed-demo.mjs     Subway demo data seeder
```

## Getting Started

### Prerequisites

- Node.js >= 20, Python >= 3.12
- AWS CLI v2, AWS CDK CLI (`npm install -g aws-cdk`)

### Install and Deploy

```bash
npm install
cd packages/shared && npm run build && cd ../..
cd packages/infrastructure && npx cdk deploy --profile foodwise
```

### Run Mobile App

```bash
cd packages/mobile && npx expo start
```

### Seed Demo Data

```bash
node scripts/seed-demo.mjs
```

## Live Environment

- API: https://l0mnegjjp2.execute-api.us-east-1.amazonaws.com/v1/
- User Pool: us-east-1_Oc2LSrhWb
- Test user: matt@foodwise.io
