import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as path from "path";
import { Construct } from "constructs";
import { FoodwiseCoreStack } from "./core-stack";

export interface FoodwisePosStackProps extends cdk.NestedStackProps {
  core: FoodwiseCoreStack;
}

export class FoodwisePosStack extends cdk.NestedStack {
  public readonly toastWebhookFn: NodejsFunction;
  public readonly squarePollerFn: NodejsFunction;
  public readonly csvImportFn: NodejsFunction;
  public readonly forecastAccuracyFn: NodejsFunction;

  constructor(scope: Construct, id: string, props: FoodwisePosStackProps) {
    super(scope, id, props);

    const core = props.core;

    const handlersPath = path.join(__dirname, "../../api/src/handlers");

    const posLambdaEnvironment: Record<string, string> = {
      SSM_TABLE_NAMES_PATH: "/foodwise/table-names",
      REPORTS_BUCKET: core.reportsBucket.bucketName,
    };

    const nodejsFnProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: posLambdaEnvironment,
      bundling: {
        externalModules: [] as string[],
      },
    };

    // --- Lambda Functions ---

    this.toastWebhookFn = new NodejsFunction(this, "ToastWebhookFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "toastWebhook.ts"),
      timeout: cdk.Duration.seconds(30),
    });

    this.squarePollerFn = new NodejsFunction(this, "SquarePollerFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "squarePoller.ts"),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    this.csvImportFn = new NodejsFunction(this, "CsvImportFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "csvImport.ts"),
      handler: "s3Handler",
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    this.forecastAccuracyFn = new NodejsFunction(this, "ForecastAccuracyFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "forecastAccuracy.ts"),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    // --- SSM Parameter read access ---
    for (const fn of [this.toastWebhookFn, this.squarePollerFn, this.csvImportFn, this.forecastAccuracyFn]) {
      core.tableNamesParam.grantRead(fn);
    }

    // --- DynamoDB Permissions ---

    core.posConnectionsTable.grantReadWriteData(this.toastWebhookFn);
    core.posTransactionsRawTable.grantReadWriteData(this.toastWebhookFn);
    core.ingredientMappingsTable.grantReadData(this.toastWebhookFn);
    core.transactionsTable.grantReadWriteData(this.toastWebhookFn);
    core.inventoryTable.grantReadWriteData(this.toastWebhookFn);
    core.auditTrailTable.grantReadWriteData(this.toastWebhookFn);

    core.posConnectionsTable.grantReadWriteData(this.squarePollerFn);
    core.posTransactionsRawTable.grantReadWriteData(this.squarePollerFn);
    core.ingredientMappingsTable.grantReadData(this.squarePollerFn);
    core.transactionsTable.grantReadWriteData(this.squarePollerFn);
    core.inventoryTable.grantReadWriteData(this.squarePollerFn);
    core.auditTrailTable.grantReadWriteData(this.squarePollerFn);

    core.posTransactionsRawTable.grantReadWriteData(this.csvImportFn);
    core.ingredientMappingsTable.grantReadData(this.csvImportFn);
    core.transactionsTable.grantReadWriteData(this.csvImportFn);
    core.inventoryTable.grantReadWriteData(this.csvImportFn);
    core.auditTrailTable.grantReadWriteData(this.csvImportFn);
    core.reportsBucket.grantRead(this.csvImportFn);

    core.storesTable.grantReadData(this.forecastAccuracyFn);
    core.forecastsTable.grantReadData(this.forecastAccuracyFn);
    core.transactionsTable.grantReadData(this.forecastAccuracyFn);
    core.forecastAccuracyTable.grantReadWriteData(this.forecastAccuracyFn);

    // --- EventBridge: Square polling every 15 minutes ---
    new events.Rule(this, "SquarePollingRule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      targets: [new targets.LambdaFunction(this.squarePollerFn)],
    });

    // --- EventBridge: Weekly forecast accuracy check (Sundays at 3 AM UTC) ---
    new events.Rule(this, "ForecastAccuracyRule", {
      schedule: events.Schedule.cron({ minute: "0", hour: "3", weekDay: "SUN" }),
      targets: [new targets.LambdaFunction(this.forecastAccuracyFn)],
    });
  }
}
