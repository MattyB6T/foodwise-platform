# FoodWise Platform

A monorepo for the FoodWise platform, containing API services, ML/AI models, shared utilities, and AWS infrastructure.

## Project Structure

```
foodwise-platform/
├── packages/
│   ├── api/              # AWS Lambda functions (Node.js + TypeScript)
│   ├── models/           # ML/AI services (Python)
│   ├── shared/           # Shared TypeScript types and utilities
│   └── infrastructure/   # AWS CDK (TypeScript)
├── package.json          # Root package.json (npm workspaces)
└── .gitignore
```

## Getting Started

### Prerequisites

- Node.js >= 18
- Python >= 3.10
- AWS CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)

### Installation

```bash
# Install Node.js dependencies (api, shared, infrastructure)
npm install

# Set up Python environment for ML models
cd packages/models
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Deploying

```bash
cd packages/infrastructure
npx cdk deploy
```
