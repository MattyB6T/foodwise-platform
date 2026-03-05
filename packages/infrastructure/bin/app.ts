#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { FoodwiseStack } from "../lib/foodwise-stack";

const app = new cdk.App();

new FoodwiseStack(app, "FoodwiseStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
  },
});
