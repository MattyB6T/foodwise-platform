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
      STORES_TABLE: core.storesTable.tableName,
      INVENTORY_TABLE: core.inventoryTable.tableName,
      TRANSACTIONS_TABLE: core.transactionsTable.tableName,
      RECIPES_TABLE: core.recipesTable.tableName,
      FORECASTS_TABLE: core.forecastsTable.tableName,
      SUPPLIERS_TABLE: core.suppliersTable.tableName,
      PURCHASE_ORDERS_TABLE: core.purchaseOrdersTable.tableName,
      RECEIVING_LOGS_TABLE: core.receivingLogsTable.tableName,
      WASTE_LOGS_TABLE: core.wasteLogsTable.tableName,
      CAMERAS_TABLE: core.camerasTable.tableName,
      INCIDENTS_TABLE: core.incidentsTable.tableName,
      INVENTORY_COUNTS_TABLE: core.inventoryCountsTable.tableName,
      NOTIFICATIONS_TABLE: core.notificationsTable.tableName,
      STAFF_TABLE: core.staffTable.tableName,
      SCHEDULES_TABLE: core.schedulesTable.tableName,
      TIME_CLOCK_TABLE: core.timeClockTable.tableName,
      KIOSK_DEVICES_TABLE: core.kioskDevicesTable.tableName,
      TEMP_LOGS_TABLE: core.tempLogsTable.tableName,
      PRICE_HISTORY_TABLE: core.priceHistoryTable.tableName,
      PREP_LISTS_TABLE: core.prepListsTable.tableName,
      AUDIT_TRAIL_TABLE: core.auditTrailTable.tableName,
      POS_CONNECTIONS_TABLE: core.posConnectionsTable.tableName,
      POS_TRANSACTIONS_RAW_TABLE: core.posTransactionsRawTable.tableName,
      INGREDIENT_MAPPINGS_TABLE: core.ingredientMappingsTable.tableName,
      FORECAST_ACCURACY_TABLE: core.forecastAccuracyTable.tableName,
      REPORTS_BUCKET: core.reportsBucket.bucketName,
    };

    const nodejsFnProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
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
