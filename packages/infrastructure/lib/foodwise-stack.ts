import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { FoodwiseCoreStack } from "./core-stack";
import { FoodwiseApiStack } from "./api-stack";
import { FoodwisePosStack } from "./pos-stack";
import { FoodwiseSchedulerStack } from "./scheduler-stack";

export class FoodwiseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Core: DynamoDB tables, Cognito, S3
    const core = new FoodwiseCoreStack(this, "CoreStack");

    // POS: Lambda functions + EventBridge rules (depends only on Core)
    const pos = new FoodwisePosStack(this, "PosStack", { core });

    // API: Lambda functions, API Gateway, permissions + POS webhook routes
    const api = new FoodwiseApiStack(this, "ApiStack", {
      core,
      toastWebhookFn: pos.toastWebhookFn,
      squarePollerFn: pos.squarePollerFn,
    });

    // Scheduler: EventBridge rules
    new FoodwiseSchedulerStack(this, "SchedulerStack", {
      forecastFn: api.forecastFn,
      generateWeeklyReportFn: api.generateWeeklyReportFn,
    });

    // --- Stack Outputs ---

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.api.url,
      description: "API Gateway URL",
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: core.userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: core.userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });

    new cdk.CfnOutput(this, "ReportsBucketName", {
      value: core.reportsBucket.bucketName,
      description: "S3 Reports Bucket Name",
    });
  }
}
