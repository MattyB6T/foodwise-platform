import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import { Construct } from "constructs";

export class FoodwiseStack extends cdk.Stack {
  public readonly storesTable: dynamodb.Table;
  public readonly inventoryTable: dynamodb.Table;
  public readonly transactionsTable: dynamodb.Table;
  public readonly recipesTable: dynamodb.Table;
  public readonly forecastsTable: dynamodb.Table;
  public readonly suppliersTable: dynamodb.Table;
  public readonly purchaseOrdersTable: dynamodb.Table;
  public readonly receivingLogsTable: dynamodb.Table;
  public readonly wasteLogsTable: dynamodb.Table;
  public readonly camerasTable: dynamodb.Table;
  public readonly incidentsTable: dynamodb.Table;
  public readonly inventoryCountsTable: dynamodb.Table;
  public readonly notificationsTable: dynamodb.Table;
  public readonly staffTable: dynamodb.Table;
  public readonly schedulesTable: dynamodb.Table;
  public readonly timeClockTable: dynamodb.Table;
  public readonly kioskDevicesTable: dynamodb.Table;
  public readonly tempLogsTable: dynamodb.Table;
  public readonly priceHistoryTable: dynamodb.Table;
  public readonly prepListsTable: dynamodb.Table;
  public readonly auditTrailTable: dynamodb.Table;
  public readonly userPool: cognito.UserPool;
  public readonly reportsBucket: s3.Bucket;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- DynamoDB Tables ---

    this.storesTable = new dynamodb.Table(this, "StoresTable", {
      tableName: "stores",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.inventoryTable = new dynamodb.Table(this, "InventoryTable", {
      tableName: "inventory",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "itemId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.transactionsTable = new dynamodb.Table(this, "TransactionsTable", {
      tableName: "transactions",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "transactionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.transactionsTable.addGlobalSecondaryIndex({
      indexName: "timestamp-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.recipesTable = new dynamodb.Table(this, "RecipesTable", {
      tableName: "recipes",
      partitionKey: { name: "recipeId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.forecastsTable = new dynamodb.Table(this, "ForecastsTable", {
      tableName: "forecasts",
      partitionKey: { name: "forecastId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "storeRecipeKey", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.suppliersTable = new dynamodb.Table(this, "SuppliersTable", {
      tableName: "suppliers",
      partitionKey: { name: "supplierId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.purchaseOrdersTable = new dynamodb.Table(this, "PurchaseOrdersTable", {
      tableName: "purchase-orders",
      partitionKey: { name: "orderId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.purchaseOrdersTable.addGlobalSecondaryIndex({
      indexName: "storeId-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.receivingLogsTable = new dynamodb.Table(this, "ReceivingLogsTable", {
      tableName: "receiving-logs",
      partitionKey: { name: "receivingId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.receivingLogsTable.addGlobalSecondaryIndex({
      indexName: "storeId-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.wasteLogsTable = new dynamodb.Table(this, "WasteLogsTable", {
      tableName: "waste-logs",
      partitionKey: { name: "wasteId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.wasteLogsTable.addGlobalSecondaryIndex({
      indexName: "storeId-timestamp-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.camerasTable = new dynamodb.Table(this, "CamerasTable", {
      tableName: "cameras",
      partitionKey: { name: "cameraId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.camerasTable.addGlobalSecondaryIndex({
      indexName: "storeId-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.incidentsTable = new dynamodb.Table(this, "IncidentsTable", {
      tableName: "incidents",
      partitionKey: { name: "incidentId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.incidentsTable.addGlobalSecondaryIndex({
      indexName: "storeId-timestamp-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.inventoryCountsTable = new dynamodb.Table(this, "InventoryCountsTable", {
      tableName: "inventory-counts",
      partitionKey: { name: "countId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.inventoryCountsTable.addGlobalSecondaryIndex({
      indexName: "storeId-timestamp-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.notificationsTable = new dynamodb.Table(this, "NotificationsTable", {
      tableName: "notifications",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.notificationsTable.addGlobalSecondaryIndex({
      indexName: "storeId-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.staffTable = new dynamodb.Table(this, "StaffTable", {
      tableName: "staff",
      partitionKey: { name: "staffId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.staffTable.addGlobalSecondaryIndex({
      indexName: "storeId-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.schedulesTable = new dynamodb.Table(this, "SchedulesTable", {
      tableName: "schedules",
      partitionKey: { name: "shiftId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.schedulesTable.addGlobalSecondaryIndex({
      indexName: "storeId-date-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "date", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.timeClockTable = new dynamodb.Table(this, "TimeClockTable", {
      tableName: "time-clock",
      partitionKey: { name: "entryId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.timeClockTable.addGlobalSecondaryIndex({
      indexName: "storeId-clockInTime-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "clockInTime", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.kioskDevicesTable = new dynamodb.Table(this, "KioskDevicesTable", {
      tableName: "kiosk-devices",
      partitionKey: { name: "deviceId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.tempLogsTable = new dynamodb.Table(this, "TempLogsTable", {
      tableName: "temp-logs",
      partitionKey: { name: "logId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.tempLogsTable.addGlobalSecondaryIndex({
      indexName: "storeId-timestamp-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.priceHistoryTable = new dynamodb.Table(this, "PriceHistoryTable", {
      tableName: "price-history",
      partitionKey: { name: "priceId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.priceHistoryTable.addGlobalSecondaryIndex({
      indexName: "supplierId-timestamp-index",
      partitionKey: { name: "supplierId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.prepListsTable = new dynamodb.Table(this, "PrepListsTable", {
      tableName: "prep-lists",
      partitionKey: { name: "prepListId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.prepListsTable.addGlobalSecondaryIndex({
      indexName: "storeId-date-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "date", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.auditTrailTable = new dynamodb.Table(this, "AuditTrailTable", {
      tableName: "audit-trail",
      partitionKey: { name: "auditId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.auditTrailTable.addGlobalSecondaryIndex({
      indexName: "storeId-timestamp-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- Cognito User Pool ---

    this.userPool = new cognito.UserPool(this, "FoodwiseUserPool", {
      userPoolName: "foodwise-users",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = this.userPool.addClient("FoodwiseAppClient", {
      userPoolClientName: "foodwise-app-client",
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    new cognito.CfnUserPoolGroup(this, "OwnerGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "owner",
      description: "Store owners with full access",
    });

    new cognito.CfnUserPoolGroup(this, "ManagerGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "manager",
      description: "Store managers",
    });

    new cognito.CfnUserPoolGroup(this, "StaffGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "staff",
      description: "Store staff members",
    });

    new cognito.CfnUserPoolGroup(this, "ReadonlyGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "readonly",
      description: "Read-only access users",
    });

    // --- S3 Bucket ---

    this.reportsBucket = new s3.Bucket(this, "ReportsBucket", {
      bucketName: cdk.Fn.sub("foodwise-reports-${AWS::AccountId}"),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- Lambda Functions (Node.js with esbuild bundling) ---

    const lambdaEnvironment = {
      STORES_TABLE: this.storesTable.tableName,
      INVENTORY_TABLE: this.inventoryTable.tableName,
      TRANSACTIONS_TABLE: this.transactionsTable.tableName,
      RECIPES_TABLE: this.recipesTable.tableName,
      FORECASTS_TABLE: this.forecastsTable.tableName,
      SUPPLIERS_TABLE: this.suppliersTable.tableName,
      PURCHASE_ORDERS_TABLE: this.purchaseOrdersTable.tableName,
      RECEIVING_LOGS_TABLE: this.receivingLogsTable.tableName,
      WASTE_LOGS_TABLE: this.wasteLogsTable.tableName,
      CAMERAS_TABLE: this.camerasTable.tableName,
      INCIDENTS_TABLE: this.incidentsTable.tableName,
      INVENTORY_COUNTS_TABLE: this.inventoryCountsTable.tableName,
      NOTIFICATIONS_TABLE: this.notificationsTable.tableName,
      STAFF_TABLE: this.staffTable.tableName,
      SCHEDULES_TABLE: this.schedulesTable.tableName,
      TIME_CLOCK_TABLE: this.timeClockTable.tableName,
      KIOSK_DEVICES_TABLE: this.kioskDevicesTable.tableName,
      TEMP_LOGS_TABLE: this.tempLogsTable.tableName,
      PRICE_HISTORY_TABLE: this.priceHistoryTable.tableName,
      PREP_LISTS_TABLE: this.prepListsTable.tableName,
      AUDIT_TRAIL_TABLE: this.auditTrailTable.tableName,
    };

    const handlersPath = path.join(__dirname, "../../api/src/handlers");

    const nodejsFnProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: lambdaEnvironment,
      bundling: {
        externalModules: [],
      },
    };

    // Store operations router — consolidates createStore, listStores, getInventory, updateInventory, recordTransaction, listTransactions, getDashboard
    const storeOpsRouterFn = new NodejsFunction(this, "StoreOpsRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "storeOpsRouter.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    // Recipe router — consolidates createRecipe, listRecipes, getRecipe, upsertIngredient, recipeScaling
    const recipeRouterFn = new NodejsFunction(this, "RecipeRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "recipeRouter.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    // Supply chain router — consolidates createSupplier, listSuppliers, createPurchaseOrder, listPurchaseOrders, receiveShipment, listReceivingLogs, lookupBarcode
    const supplyChainRouterFn = new NodejsFunction(this, "SupplyChainRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "supplyChainRouter.ts"),
      timeout: cdk.Duration.seconds(30),
    });

    // Waste router — consolidates recordWaste, listWaste, getWasteAnalytics
    const wasteRouterFn = new NodejsFunction(this, "WasteRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "wasteRouter.ts"),
      timeout: cdk.Duration.seconds(30),
    });

    // Analytics router — consolidates getOwnerDashboard, getStoreComparison, getHealthScore, generateReport, menuEngineering
    const analyticsRouterFn = new NodejsFunction(this, "AnalyticsRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "analyticsRouter.ts"),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    });

    const generateWeeklyReportFn = new NodejsFunction(this, "GenerateWeeklyReportFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "generateWeeklyReport.ts"),
      timeout: cdk.Duration.minutes(3),
      memorySize: 512,
      environment: {
        ...lambdaEnvironment,
        REPORT_EMAIL: "admin@foodwise.io",
        FROM_EMAIL: "reports@foodwise.io",
      },
    });

    const assistantFn = new NodejsFunction(this, "AssistantFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "assistant.ts"),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        ...lambdaEnvironment,
        BEDROCK_MODEL_ID: "us.anthropic.claude-sonnet-4-20250514-v1:0",
      },
    });

    // Camera/Incident router — consolidates registerCamera, listCameras, getCameraFootage, createIncident, listIncidents
    const cameraIncidentRouterFn = new NodejsFunction(this, "CameraIncidentRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "cameraIncidentRouter.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    // Count router — consolidates createCount, saveCount, listCounts, getCountVariance
    const countRouterFn = new NodejsFunction(this, "CountRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "countRouter.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    // Notification router — consolidates registerPushToken, updateNotificationPrefs, getNotificationPrefs, sendNotification
    const notificationRouterFn = new NodejsFunction(this, "NotificationRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "notificationRouter.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const prepListsFn = new NodejsFunction(this, "PrepListsFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "prepLists.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const auditTrailFn = new NodejsFunction(this, "AuditTrailFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "auditTrail.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const photoUploadFn = new NodejsFunction(this, "PhotoUploadFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "photoUpload.ts"),
      timeout: cdk.Duration.seconds(15),
      environment: {
        ...lambdaEnvironment,
        REPORTS_BUCKET: this.reportsBucket.bucketName,
      },
    });

    const supplierPortalFn = new NodejsFunction(this, "SupplierPortalFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "supplierPortal.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const emailPurchaseOrderFn = new NodejsFunction(this, "EmailPurchaseOrderFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "emailPurchaseOrder.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const temperatureLogsFn = new NodejsFunction(this, "TemperatureLogsFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "temperatureLogs.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const vendorPriceHistoryFn = new NodejsFunction(this, "VendorPriceHistoryFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "vendorPriceHistory.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    // Staff/Schedule router — consolidates listStaff, manageStaff, manageSchedule
    const staffScheduleRouterFn = new NodejsFunction(this, "StaffScheduleRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "staffScheduleRouter.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    // Kiosk router — single Lambda handles all kiosk endpoints to stay under CFn 500-resource limit
    const kioskRouterFn = new NodejsFunction(this, "KioskRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "kioskRouter.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    // Timesheet management (Cognito auth)
    const timesheetManagementFn = new NodejsFunction(this, "TimesheetManagementFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "timesheetManagement.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    // Staff PIN management
    const staffPinFn = new NodejsFunction(this, "StaffPinFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "staffPin.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const setExpirationFn = new NodejsFunction(this, "SetExpirationFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "setExpiration.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const getExpirationAlertsFn = new NodejsFunction(this, "GetExpirationAlertsFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "getExpirationAlerts.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    // Bedrock permissions for assistant
    assistantFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          "arn:aws:bedrock:*::foundation-model/anthropic.*",
          "arn:aws:bedrock:*:*:inference-profile/us.anthropic.*",
        ],
      })
    );

    // SES permissions for weekly report
    generateWeeklyReportFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      })
    );

    // --- Forecast Lambda (Python, Docker Image) ---

    const modelsCodePath = path.join(__dirname, "../../models");

    const forecastFn = new lambda.DockerImageFunction(this, "ForecastFn", {
      code: lambda.DockerImageCode.fromImageAsset(modelsCodePath),
      environment: lambdaEnvironment,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
    });

    // Nightly forecast at 2 AM UTC
    new events.Rule(this, "NightlyForecastRule", {
      schedule: events.Schedule.cron({ minute: "0", hour: "2" }),
      targets: [new targets.LambdaFunction(forecastFn)],
    });

    // Weekly report every Monday at 6 AM UTC
    new events.Rule(this, "WeeklyReportRule", {
      schedule: events.Schedule.cron({ minute: "0", hour: "6", weekDay: "MON" }),
      targets: [new targets.LambdaFunction(generateWeeklyReportFn)],
    });

    // --- DynamoDB Permissions ---

    // Store operations router needs stores, inventory, transactions
    this.storesTable.grantReadWriteData(storeOpsRouterFn);
    this.inventoryTable.grantReadWriteData(storeOpsRouterFn);
    this.transactionsTable.grantReadWriteData(storeOpsRouterFn);
    this.recipesTable.grantReadData(storeOpsRouterFn);
    this.wasteLogsTable.grantReadData(storeOpsRouterFn);

    this.storesTable.grantReadData(forecastFn);
    this.inventoryTable.grantReadData(forecastFn);
    this.transactionsTable.grantReadData(forecastFn);
    this.recipesTable.grantReadData(forecastFn);
    this.forecastsTable.grantReadWriteData(forecastFn);

    // Recipe router needs recipes + inventory
    this.recipesTable.grantReadWriteData(recipeRouterFn);
    this.inventoryTable.grantReadData(recipeRouterFn);

    // Supply chain router needs suppliers, POs, receiving, inventory, barcode
    this.suppliersTable.grantReadWriteData(supplyChainRouterFn);
    this.purchaseOrdersTable.grantReadWriteData(supplyChainRouterFn);
    this.receivingLogsTable.grantReadWriteData(supplyChainRouterFn);
    this.inventoryTable.grantReadWriteData(supplyChainRouterFn);

    // Waste router needs waste logs, inventory, receiving logs
    this.wasteLogsTable.grantReadWriteData(wasteRouterFn);
    this.inventoryTable.grantReadData(wasteRouterFn);
    this.receivingLogsTable.grantReadData(wasteRouterFn);

    // Analytics router needs read on most tables (owner dashboard, comparison, health score, report, menu engineering)
    this.storesTable.grantReadData(analyticsRouterFn);
    this.inventoryTable.grantReadData(analyticsRouterFn);
    this.transactionsTable.grantReadData(analyticsRouterFn);
    this.wasteLogsTable.grantReadData(analyticsRouterFn);
    this.forecastsTable.grantReadData(analyticsRouterFn);
    this.receivingLogsTable.grantReadData(analyticsRouterFn);
    this.purchaseOrdersTable.grantReadData(analyticsRouterFn);
    this.recipesTable.grantReadData(analyticsRouterFn);

    // Weekly report also needs read on all tables
    this.storesTable.grantReadData(generateWeeklyReportFn);
    this.inventoryTable.grantReadData(generateWeeklyReportFn);
    this.transactionsTable.grantReadData(generateWeeklyReportFn);
    this.wasteLogsTable.grantReadData(generateWeeklyReportFn);
    this.forecastsTable.grantReadData(generateWeeklyReportFn);

    // Camera & Incident permissions
    this.camerasTable.grantReadWriteData(cameraIncidentRouterFn);
    this.incidentsTable.grantReadWriteData(cameraIncidentRouterFn);

    // Inventory Counts permissions
    this.inventoryCountsTable.grantReadWriteData(countRouterFn);
    this.inventoryTable.grantReadData(countRouterFn);

    // Notifications permissions
    this.notificationsTable.grantReadWriteData(notificationRouterFn);

    // Staff/Schedule router permissions
    this.staffTable.grantReadWriteData(staffScheduleRouterFn);
    this.schedulesTable.grantReadWriteData(staffScheduleRouterFn);

    // Kiosk permissions (single router Lambda)
    this.kioskDevicesTable.grantReadWriteData(kioskRouterFn);
    this.timeClockTable.grantReadWriteData(kioskRouterFn);
    this.staffTable.grantReadData(kioskRouterFn);
    this.auditTrailTable.grantReadWriteData(kioskRouterFn);

    // Timesheet management permissions
    this.timeClockTable.grantReadWriteData(timesheetManagementFn);
    this.auditTrailTable.grantReadWriteData(timesheetManagementFn);
    this.reportsBucket.grantRead(timesheetManagementFn);

    // Staff PIN permissions
    this.staffTable.grantReadWriteData(staffPinFn);

    // Expiration permissions
    this.inventoryTable.grantReadWriteData(setExpirationFn);
    this.inventoryTable.grantReadData(getExpirationAlertsFn);

    // Prep Lists permissions
    this.prepListsTable.grantReadWriteData(prepListsFn);
    this.recipesTable.grantReadData(prepListsFn);
    this.inventoryTable.grantReadData(prepListsFn);

    // Audit Trail permissions
    this.auditTrailTable.grantReadWriteData(auditTrailFn);

    // Photo Upload permissions
    this.reportsBucket.grantReadWrite(photoUploadFn);

    // Supplier Portal permissions
    this.suppliersTable.grantReadData(supplierPortalFn);
    this.purchaseOrdersTable.grantReadWriteData(supplierPortalFn);

    // Vendor Communication permissions
    this.purchaseOrdersTable.grantReadData(emailPurchaseOrderFn);
    this.suppliersTable.grantReadData(emailPurchaseOrderFn);

    // Temperature Log permissions
    this.tempLogsTable.grantReadWriteData(temperatureLogsFn);

    // Price History permissions
    this.priceHistoryTable.grantReadWriteData(vendorPriceHistoryFn);

    // Assistant needs read on all tables
    this.storesTable.grantReadData(assistantFn);
    this.inventoryTable.grantReadData(assistantFn);
    this.transactionsTable.grantReadData(assistantFn);
    this.wasteLogsTable.grantReadData(assistantFn);
    this.forecastsTable.grantReadData(assistantFn);
    this.purchaseOrdersTable.grantReadData(assistantFn);

    // --- API Gateway ---

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "FoodwiseAuthorizer",
      {
        cognitoUserPools: [this.userPool],
        identitySource: "method.request.header.Authorization",
      }
    );

    const authMethodOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    this.api = new apigateway.RestApi(this, "FoodwiseApi", {
      restApiName: "foodwise-api",
      description: "FoodWise Platform API",
      deployOptions: {
        stageName: "v1",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    // POST /stores & GET /stores
    const storesResource = this.api.root.addResource("stores");
    storesResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(storeOpsRouterFn),
      authMethodOptions
    );
    storesResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(storeOpsRouterFn),
      authMethodOptions
    );

    // /stores/{storeId}
    const singleStoreResource = storesResource.addResource("{storeId}");

    // GET /stores/{storeId}/inventory & POST /stores/{storeId}/inventory
    const inventoryResource = singleStoreResource.addResource("inventory");
    inventoryResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(storeOpsRouterFn),
      authMethodOptions
    );
    inventoryResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(storeOpsRouterFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/transactions
    const transactionsResource = singleStoreResource.addResource("transactions");
    transactionsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(storeOpsRouterFn),
      authMethodOptions
    );
    transactionsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(storeOpsRouterFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/dashboard
    const dashboardResource = singleStoreResource.addResource("dashboard");
    dashboardResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(storeOpsRouterFn),
      authMethodOptions
    );

    // POST /recipes & GET /recipes
    const recipesResource = this.api.root.addResource("recipes");
    recipesResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(recipeRouterFn),
      authMethodOptions
    );
    recipesResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(recipeRouterFn),
      authMethodOptions
    );

    // GET /recipes/{recipeId}
    const singleRecipeResource = recipesResource.addResource("{recipeId}");
    singleRecipeResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(recipeRouterFn),
      authMethodOptions
    );

    // POST /ingredients
    const ingredientsResource = this.api.root.addResource("ingredients");
    ingredientsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(recipeRouterFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/menu-engineering
    const menuEngResource = singleStoreResource.addResource("menu-engineering");
    menuEngResource.addMethod("GET", new apigateway.LambdaIntegration(analyticsRouterFn), authMethodOptions);

    // GET/POST /stores/{storeId}/prep-lists
    const prepListsResource = singleStoreResource.addResource("prep-lists");
    prepListsResource.addMethod("GET", new apigateway.LambdaIntegration(prepListsFn), authMethodOptions);
    prepListsResource.addMethod("POST", new apigateway.LambdaIntegration(prepListsFn), authMethodOptions);

    // GET /recipes/{recipeId}/scale
    const scaleResource = singleRecipeResource.addResource("scale");
    scaleResource.addMethod("GET", new apigateway.LambdaIntegration(recipeRouterFn), authMethodOptions);

    // GET/POST /stores/{storeId}/audit-trail
    const auditResource = singleStoreResource.addResource("audit-trail");
    auditResource.addMethod("GET", new apigateway.LambdaIntegration(auditTrailFn), authMethodOptions);
    auditResource.addMethod("POST", new apigateway.LambdaIntegration(auditTrailFn), authMethodOptions);

    // GET/POST /photos
    const photosResource = this.api.root.addResource("photos");
    photosResource.addMethod("GET", new apigateway.LambdaIntegration(photoUploadFn), authMethodOptions);
    photosResource.addMethod("POST", new apigateway.LambdaIntegration(photoUploadFn), authMethodOptions);

    // GET /supplier-portal/{supplierId} & GET /supplier-portal/{supplierId}/orders & PUT /supplier-portal/{supplierId}/orders/{orderId}
    const supplierPortalResource = this.api.root.addResource("supplier-portal");
    const singleSupplierPortalResource = supplierPortalResource.addResource("{supplierId}");
    singleSupplierPortalResource.addMethod("GET", new apigateway.LambdaIntegration(supplierPortalFn), authMethodOptions);
    const supplierOrdersResource = singleSupplierPortalResource.addResource("orders");
    supplierOrdersResource.addMethod("GET", new apigateway.LambdaIntegration(supplierPortalFn), authMethodOptions);
    const supplierSingleOrderResource = supplierOrdersResource.addResource("{orderId}");
    supplierSingleOrderResource.addMethod("PUT", new apigateway.LambdaIntegration(supplierPortalFn), authMethodOptions);

    // POST /forecasts (on-demand trigger)
    const forecastsResource = this.api.root.addResource("forecasts");
    forecastsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(forecastFn),
      authMethodOptions
    );

    // POST /suppliers & GET /suppliers
    const suppliersResource = this.api.root.addResource("suppliers");
    suppliersResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(supplyChainRouterFn),
      authMethodOptions
    );
    suppliersResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(supplyChainRouterFn),
      authMethodOptions
    );

    // POST /purchase-orders
    const purchaseOrdersResource = this.api.root.addResource("purchase-orders");
    purchaseOrdersResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(supplyChainRouterFn),
      authMethodOptions
    );

    // POST /purchase-orders/{orderId}/email
    const singlePOResource = purchaseOrdersResource.addResource("{orderId}");
    const emailPOResource = singlePOResource.addResource("email");
    emailPOResource.addMethod("POST", new apigateway.LambdaIntegration(emailPurchaseOrderFn), authMethodOptions);

    // GET/POST /stores/{storeId}/temp-logs
    const tempLogsResource = singleStoreResource.addResource("temp-logs");
    tempLogsResource.addMethod("GET", new apigateway.LambdaIntegration(temperatureLogsFn), authMethodOptions);
    tempLogsResource.addMethod("POST", new apigateway.LambdaIntegration(temperatureLogsFn), authMethodOptions);

    // GET/POST /price-history
    const priceHistoryResource = this.api.root.addResource("price-history");
    priceHistoryResource.addMethod("GET", new apigateway.LambdaIntegration(vendorPriceHistoryFn), authMethodOptions);
    priceHistoryResource.addMethod("POST", new apigateway.LambdaIntegration(vendorPriceHistoryFn), authMethodOptions);

    // GET /stores/{storeId}/purchase-orders
    const storePurchaseOrdersResource = singleStoreResource.addResource("purchase-orders");
    storePurchaseOrdersResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(supplyChainRouterFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/receive
    const receiveResource = singleStoreResource.addResource("receive");
    receiveResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(supplyChainRouterFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/receiving-logs
    const receivingLogsResource = singleStoreResource.addResource("receiving-logs");
    receivingLogsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(supplyChainRouterFn),
      authMethodOptions
    );

    // GET /barcode/{code}
    const barcodeResource = this.api.root.addResource("barcode");
    const barcodeLookupResource = barcodeResource.addResource("{code}");
    barcodeLookupResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(supplyChainRouterFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/waste & GET /stores/{storeId}/waste
    const wasteResource = singleStoreResource.addResource("waste");
    wasteResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(wasteRouterFn),
      authMethodOptions
    );
    wasteResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(wasteRouterFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/waste/analytics
    const wasteAnalyticsResource = wasteResource.addResource("analytics");
    wasteAnalyticsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(wasteRouterFn),
      authMethodOptions
    );

    // GET /dashboard (owner-level all-stores overview)
    const ownerDashboardResource = this.api.root.addResource("dashboard");
    ownerDashboardResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(analyticsRouterFn),
      authMethodOptions
    );

    // GET /dashboard/comparison
    const comparisonResource = ownerDashboardResource.addResource("comparison");
    comparisonResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(analyticsRouterFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/health-score
    const healthScoreResource = singleStoreResource.addResource("health-score");
    healthScoreResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(analyticsRouterFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/cameras & GET /stores/{storeId}/cameras
    const camerasResource = singleStoreResource.addResource("cameras");
    camerasResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(cameraIncidentRouterFn),
      authMethodOptions
    );
    camerasResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(cameraIncidentRouterFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/cameras/{cameraId}/footage
    const singleCameraResource = camerasResource.addResource("{cameraId}");
    const footageResource = singleCameraResource.addResource("footage");
    footageResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(cameraIncidentRouterFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/incidents & GET /stores/{storeId}/incidents
    const incidentsResource = singleStoreResource.addResource("incidents");
    incidentsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(cameraIncidentRouterFn),
      authMethodOptions
    );
    incidentsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(cameraIncidentRouterFn),
      authMethodOptions
    );

    // GET/POST /stores/{storeId}/schedule & DELETE /stores/{storeId}/schedule/{shiftId}
    const scheduleResource = singleStoreResource.addResource("schedule");
    scheduleResource.addMethod("GET", new apigateway.LambdaIntegration(staffScheduleRouterFn), authMethodOptions);
    scheduleResource.addMethod("POST", new apigateway.LambdaIntegration(staffScheduleRouterFn), authMethodOptions);
    const singleShiftResource = scheduleResource.addResource("{shiftId}");
    singleShiftResource.addMethod("DELETE", new apigateway.LambdaIntegration(staffScheduleRouterFn), authMethodOptions);

    // --- Kiosk API endpoints (no Cognito auth — use API key) ---
    const kioskResource = this.api.root.addResource("kiosk");

    // POST /kiosk/register (Cognito auth — manager sets up kiosk)
    const kioskRegisterResource = kioskResource.addResource("register");
    kioskRegisterResource.addMethod("POST", new apigateway.LambdaIntegration(kioskRouterFn), authMethodOptions);

    // POST /kiosk/lookup (no auth — kiosk device uses API key header)
    const kioskLookupResource = kioskResource.addResource("lookup");
    kioskLookupResource.addMethod("POST", new apigateway.LambdaIntegration(kioskRouterFn));

    // POST /kiosk/clockin
    const kioskClockInResource = kioskResource.addResource("clockin");
    kioskClockInResource.addMethod("POST", new apigateway.LambdaIntegration(kioskRouterFn));

    // POST /kiosk/clockout
    const kioskClockOutResource = kioskResource.addResource("clockout");
    kioskClockOutResource.addMethod("POST", new apigateway.LambdaIntegration(kioskRouterFn));

    // POST /kiosk/break/{action}
    const kioskBreakResource = kioskResource.addResource("break");
    const kioskBreakActionResource = kioskBreakResource.addResource("{action}");
    kioskBreakActionResource.addMethod("POST", new apigateway.LambdaIntegration(kioskRouterFn));

    // GET /kiosk/active?storeId=
    const kioskActiveResource = kioskResource.addResource("active");
    kioskActiveResource.addMethod("GET", new apigateway.LambdaIntegration(kioskRouterFn));

    // --- Timesheet management API (Cognito auth) ---
    const timeclockResource = singleStoreResource.addResource("timeclock");
    // GET /stores/{storeId}/timeclock
    timeclockResource.addMethod("GET", new apigateway.LambdaIntegration(timesheetManagementFn), authMethodOptions);

    // GET /stores/{storeId}/timeclock/live
    const timeclockLiveResource = timeclockResource.addResource("live");
    timeclockLiveResource.addMethod("GET", new apigateway.LambdaIntegration(timesheetManagementFn), authMethodOptions);

    // GET /stores/{storeId}/timeclock/export
    const timeclockExportResource = timeclockResource.addResource("export");
    timeclockExportResource.addMethod("GET", new apigateway.LambdaIntegration(timesheetManagementFn), authMethodOptions);

    // GET/PUT /stores/{storeId}/timeclock/{entryId}
    const timeclockEntryResource = timeclockResource.addResource("{entryId}");
    timeclockEntryResource.addMethod("GET", new apigateway.LambdaIntegration(timesheetManagementFn), authMethodOptions);
    timeclockEntryResource.addMethod("PUT", new apigateway.LambdaIntegration(timesheetManagementFn), authMethodOptions);

    // POST /stores/{storeId}/timeclock/{entryId}/approve
    const timeclockApproveResource = timeclockEntryResource.addResource("approve");
    timeclockApproveResource.addMethod("POST", new apigateway.LambdaIntegration(timesheetManagementFn), authMethodOptions);

    // GET /stores/{storeId}/timeclock/{entryId}/photo
    const timeclockPhotoResource = timeclockEntryResource.addResource("photo");
    timeclockPhotoResource.addMethod("GET", new apigateway.LambdaIntegration(timesheetManagementFn), authMethodOptions);

    // GET /stores/{storeId}/staff & POST /stores/{storeId}/staff
    const staffResource = singleStoreResource.addResource("staff");
    staffResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(staffScheduleRouterFn),
      authMethodOptions
    );
    staffResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(staffScheduleRouterFn),
      authMethodOptions
    );
    // PUT /stores/{storeId}/staff/{staffId} & DELETE
    const singleStaffResource = staffResource.addResource("{staffId}");
    singleStaffResource.addMethod(
      "PUT",
      new apigateway.LambdaIntegration(staffScheduleRouterFn),
      authMethodOptions
    );
    singleStaffResource.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(staffScheduleRouterFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/staff/{staffId}/pin
    const staffPinResource = singleStaffResource.addResource("pin");
    staffPinResource.addMethod("POST", new apigateway.LambdaIntegration(staffPinFn), authMethodOptions);

    // POST /stores/{storeId}/expiration & GET /stores/{storeId}/expiration/alerts
    const expirationResource = singleStoreResource.addResource("expiration");
    expirationResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(setExpirationFn),
      authMethodOptions
    );
    const expirationAlertsResource = expirationResource.addResource("alerts");
    expirationAlertsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getExpirationAlertsFn),
      authMethodOptions
    );

    // POST /reports
    const reportsResource = this.api.root.addResource("reports");
    reportsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(analyticsRouterFn),
      authMethodOptions
    );

    // POST /notifications/register & GET /notifications/preferences & PUT /notifications/preferences
    const notificationsResource = this.api.root.addResource("notifications");
    const registerResource = notificationsResource.addResource("register");
    registerResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(notificationRouterFn),
      authMethodOptions
    );
    const prefsResource = notificationsResource.addResource("preferences");
    prefsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(notificationRouterFn),
      authMethodOptions
    );
    prefsResource.addMethod(
      "PUT",
      new apigateway.LambdaIntegration(notificationRouterFn),
      authMethodOptions
    );
    const sendResource = notificationsResource.addResource("send");
    sendResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(notificationRouterFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/counts & GET /stores/{storeId}/counts
    const countsResource = singleStoreResource.addResource("counts");
    countsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(countRouterFn),
      authMethodOptions
    );
    countsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(countRouterFn),
      authMethodOptions
    );

    // PUT /stores/{storeId}/counts/{countId}
    const singleCountResource = countsResource.addResource("{countId}");
    singleCountResource.addMethod(
      "PUT",
      new apigateway.LambdaIntegration(countRouterFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/counts/{countId}/variance
    const countVarianceResource = singleCountResource.addResource("variance");
    countVarianceResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(countRouterFn),
      authMethodOptions
    );

    // POST /assistant
    const assistantResource = this.api.root.addResource("assistant");
    assistantResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(assistantFn),
      authMethodOptions
    );

    // --- Stack Outputs ---

    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.api.url,
      description: "API Gateway URL",
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });

    new cdk.CfnOutput(this, "ReportsBucketName", {
      value: this.reportsBucket.bucketName,
      description: "S3 Reports Bucket Name",
    });
  }
}
