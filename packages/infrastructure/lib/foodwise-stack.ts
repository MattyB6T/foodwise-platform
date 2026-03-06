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

    const createStoreFn = new NodejsFunction(this, "CreateStoreFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "createStore.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const listStoresFn = new NodejsFunction(this, "ListStoresFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "listStores.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const getInventoryFn = new NodejsFunction(this, "GetInventoryFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "getInventory.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const updateInventoryFn = new NodejsFunction(this, "UpdateInventoryFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "updateInventory.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const recordTransactionFn = new NodejsFunction(this, "RecordTransactionFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "recordTransaction.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const getDashboardFn = new NodejsFunction(this, "GetDashboardFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "getDashboard.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const createRecipeFn = new NodejsFunction(this, "CreateRecipeFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "createRecipe.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const listRecipesFn = new NodejsFunction(this, "ListRecipesFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "listRecipes.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const getRecipeFn = new NodejsFunction(this, "GetRecipeFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "getRecipe.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const upsertIngredientFn = new NodejsFunction(this, "UpsertIngredientFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "upsertIngredient.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const createSupplierFn = new NodejsFunction(this, "CreateSupplierFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "createSupplier.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const listSuppliersFn = new NodejsFunction(this, "ListSuppliersFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "listSuppliers.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const createPurchaseOrderFn = new NodejsFunction(this, "CreatePurchaseOrderFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "createPurchaseOrder.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const listPurchaseOrdersFn = new NodejsFunction(this, "ListPurchaseOrdersFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "listPurchaseOrders.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const receiveShipmentFn = new NodejsFunction(this, "ReceiveShipmentFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "receiveShipment.ts"),
      timeout: cdk.Duration.seconds(30),
    });

    const listReceivingLogsFn = new NodejsFunction(this, "ListReceivingLogsFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "listReceivingLogs.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const lookupBarcodeFn = new NodejsFunction(this, "LookupBarcodeFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "lookupBarcode.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const recordWasteFn = new NodejsFunction(this, "RecordWasteFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "recordWaste.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const listWasteFn = new NodejsFunction(this, "ListWasteFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "listWaste.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const getWasteAnalyticsFn = new NodejsFunction(this, "GetWasteAnalyticsFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "getWasteAnalytics.ts"),
      timeout: cdk.Duration.seconds(30),
    });

    const getOwnerDashboardFn = new NodejsFunction(this, "GetOwnerDashboardFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "getOwnerDashboard.ts"),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    });

    const getStoreComparisonFn = new NodejsFunction(this, "GetStoreComparisonFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "getStoreComparison.ts"),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    });

    const getHealthScoreFn = new NodejsFunction(this, "GetHealthScoreFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "getHealthScore.ts"),
      timeout: cdk.Duration.seconds(30),
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

    const registerCameraFn = new NodejsFunction(this, "RegisterCameraFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "registerCamera.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const listCamerasFn = new NodejsFunction(this, "ListCamerasFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "listCameras.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const getCameraFootageFn = new NodejsFunction(this, "GetCameraFootageFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "getCameraFootage.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const createIncidentFn = new NodejsFunction(this, "CreateIncidentFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "createIncident.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const listIncidentsFn = new NodejsFunction(this, "ListIncidentsFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "listIncidents.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const listTransactionsFn = new NodejsFunction(this, "ListTransactionsFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "listTransactions.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const createCountFn = new NodejsFunction(this, "CreateCountFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "createCount.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const saveCountFn = new NodejsFunction(this, "SaveCountFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "saveCount.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const listCountsFn = new NodejsFunction(this, "ListCountsFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "listCounts.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const getCountVarianceFn = new NodejsFunction(this, "GetCountVarianceFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "getCountVariance.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const registerPushTokenFn = new NodejsFunction(this, "RegisterPushTokenFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "registerPushToken.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const updateNotificationPrefsFn = new NodejsFunction(this, "UpdateNotificationPrefsFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "updateNotificationPrefs.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const getNotificationPrefsFn = new NodejsFunction(this, "GetNotificationPrefsFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "getNotificationPrefs.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const sendNotificationFn = new NodejsFunction(this, "SendNotificationFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "sendNotification.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const menuEngineeringFn = new NodejsFunction(this, "MenuEngineeringFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "menuEngineering.ts"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    const prepListsFn = new NodejsFunction(this, "PrepListsFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "prepLists.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const recipeScalingFn = new NodejsFunction(this, "RecipeScalingFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "recipeScaling.ts"),
      timeout: cdk.Duration.seconds(10),
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

    const generateReportFn = new NodejsFunction(this, "GenerateReportFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "generateReport.ts"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    const listStaffFn = new NodejsFunction(this, "ListStaffFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "listStaff.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const manageStaffFn = new NodejsFunction(this, "ManageStaffFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "manageStaff.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const manageScheduleFn = new NodejsFunction(this, "ManageScheduleFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "manageSchedule.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    // Kiosk endpoints (API key auth, no Cognito)
    const kioskRegisterFn = new NodejsFunction(this, "KioskRegisterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "kioskRegister.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const kioskLookupFn = new NodejsFunction(this, "KioskLookupFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "kioskLookup.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const kioskClockInFn = new NodejsFunction(this, "KioskClockInFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "kioskClockIn.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const kioskClockOutFn = new NodejsFunction(this, "KioskClockOutFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "kioskClockOut.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const kioskBreakFn = new NodejsFunction(this, "KioskBreakFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "kioskBreak.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const kioskActiveFn = new NodejsFunction(this, "KioskActiveFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "kioskActive.ts"),
      timeout: cdk.Duration.seconds(10),
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

    this.storesTable.grantReadWriteData(createStoreFn);
    this.storesTable.grantReadData(listStoresFn);
    this.storesTable.grantReadData(forecastFn);

    this.inventoryTable.grantReadData(getInventoryFn);
    this.inventoryTable.grantReadWriteData(updateInventoryFn);
    this.inventoryTable.grantReadWriteData(recordTransactionFn);
    this.inventoryTable.grantReadData(getDashboardFn);
    this.inventoryTable.grantReadData(getRecipeFn);
    this.inventoryTable.grantReadWriteData(upsertIngredientFn);
    this.inventoryTable.grantReadData(forecastFn);

    this.transactionsTable.grantReadWriteData(recordTransactionFn);
    this.transactionsTable.grantReadData(getDashboardFn);
    this.transactionsTable.grantReadData(forecastFn);

    this.recipesTable.grantReadData(recordTransactionFn);
    this.recipesTable.grantReadWriteData(createRecipeFn);
    this.recipesTable.grantReadData(listRecipesFn);
    this.recipesTable.grantReadData(getRecipeFn);
    this.recipesTable.grantReadData(forecastFn);

    this.forecastsTable.grantReadWriteData(forecastFn);

    this.suppliersTable.grantReadWriteData(createSupplierFn);
    this.suppliersTable.grantReadData(listSuppliersFn);
    this.suppliersTable.grantReadData(lookupBarcodeFn);
    this.suppliersTable.grantReadData(receiveShipmentFn);
    this.suppliersTable.grantReadData(createPurchaseOrderFn);

    this.purchaseOrdersTable.grantReadWriteData(createPurchaseOrderFn);
    this.purchaseOrdersTable.grantReadData(listPurchaseOrdersFn);
    this.purchaseOrdersTable.grantReadWriteData(receiveShipmentFn);
    this.purchaseOrdersTable.grantReadData(lookupBarcodeFn);

    this.receivingLogsTable.grantReadWriteData(receiveShipmentFn);
    this.receivingLogsTable.grantReadData(listReceivingLogsFn);

    this.inventoryTable.grantReadWriteData(receiveShipmentFn);
    this.inventoryTable.grantReadData(recordWasteFn);

    this.wasteLogsTable.grantReadWriteData(recordWasteFn);
    this.wasteLogsTable.grantReadData(listWasteFn);
    this.wasteLogsTable.grantReadData(getWasteAnalyticsFn);
    this.wasteLogsTable.grantReadData(getDashboardFn);

    this.receivingLogsTable.grantReadData(getWasteAnalyticsFn);

    // Owner dashboard, store comparison, and weekly report need read on all tables
    const multiStoreReadFns = [getOwnerDashboardFn, getStoreComparisonFn, generateWeeklyReportFn];
    for (const fn of multiStoreReadFns) {
      this.storesTable.grantReadData(fn);
      this.inventoryTable.grantReadData(fn);
      this.transactionsTable.grantReadData(fn);
      this.wasteLogsTable.grantReadData(fn);
      this.forecastsTable.grantReadData(fn);
    }

    // Health score needs read on individual store data
    this.storesTable.grantReadData(getHealthScoreFn);
    this.inventoryTable.grantReadData(getHealthScoreFn);
    this.transactionsTable.grantReadData(getHealthScoreFn);
    this.wasteLogsTable.grantReadData(getHealthScoreFn);
    this.forecastsTable.grantReadData(getHealthScoreFn);
    this.receivingLogsTable.grantReadData(getHealthScoreFn);

    // Store comparison also needs waste logs for per-ingredient comparison
    this.wasteLogsTable.grantReadData(getStoreComparisonFn);

    // Camera & Incident permissions
    this.camerasTable.grantReadWriteData(registerCameraFn);
    this.camerasTable.grantReadData(listCamerasFn);
    this.camerasTable.grantReadData(getCameraFootageFn);
    this.camerasTable.grantReadData(createIncidentFn);
    this.incidentsTable.grantReadWriteData(createIncidentFn);
    this.incidentsTable.grantReadData(listIncidentsFn);
    this.transactionsTable.grantReadData(listTransactionsFn);

    // Inventory Counts permissions
    this.inventoryCountsTable.grantReadWriteData(createCountFn);
    this.inventoryCountsTable.grantReadWriteData(saveCountFn);
    this.inventoryCountsTable.grantReadData(listCountsFn);
    this.inventoryCountsTable.grantReadData(getCountVarianceFn);
    this.inventoryTable.grantReadData(createCountFn);

    // Notifications permissions
    this.notificationsTable.grantReadWriteData(registerPushTokenFn);
    this.notificationsTable.grantReadWriteData(updateNotificationPrefsFn);
    this.notificationsTable.grantReadData(getNotificationPrefsFn);
    this.notificationsTable.grantReadData(sendNotificationFn);

    // Schedule permissions
    this.schedulesTable.grantReadWriteData(manageScheduleFn);

    // Kiosk permissions
    this.kioskDevicesTable.grantReadWriteData(kioskRegisterFn);
    this.kioskDevicesTable.grantReadData(kioskLookupFn);
    this.kioskDevicesTable.grantReadData(kioskClockInFn);
    this.kioskDevicesTable.grantReadData(kioskClockOutFn);
    this.kioskDevicesTable.grantReadData(kioskBreakFn);
    this.kioskDevicesTable.grantReadData(kioskActiveFn);

    this.timeClockTable.grantReadWriteData(kioskClockInFn);
    this.timeClockTable.grantReadWriteData(kioskClockOutFn);
    this.timeClockTable.grantReadWriteData(kioskBreakFn);
    this.timeClockTable.grantReadData(kioskLookupFn);
    this.timeClockTable.grantReadData(kioskActiveFn);

    this.staffTable.grantReadData(kioskLookupFn);

    this.auditTrailTable.grantReadWriteData(kioskClockInFn);

    // Timesheet management permissions
    this.timeClockTable.grantReadWriteData(timesheetManagementFn);
    this.auditTrailTable.grantReadWriteData(timesheetManagementFn);
    this.reportsBucket.grantRead(timesheetManagementFn);

    // Staff PIN permissions
    this.staffTable.grantReadWriteData(staffPinFn);

    // Staff permissions
    this.staffTable.grantReadData(listStaffFn);
    this.staffTable.grantReadWriteData(manageStaffFn);

    // Expiration permissions
    this.inventoryTable.grantReadWriteData(setExpirationFn);
    this.inventoryTable.grantReadData(getExpirationAlertsFn);

    // Menu Engineering permissions
    this.transactionsTable.grantReadData(menuEngineeringFn);
    this.recipesTable.grantReadData(menuEngineeringFn);

    // Prep Lists permissions
    this.prepListsTable.grantReadWriteData(prepListsFn);
    this.recipesTable.grantReadData(prepListsFn);
    this.inventoryTable.grantReadData(prepListsFn);

    // Recipe Scaling permissions
    this.recipesTable.grantReadData(recipeScalingFn);
    this.inventoryTable.grantReadData(recipeScalingFn);

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

    // Report permissions
    this.inventoryTable.grantReadData(generateReportFn);
    this.wasteLogsTable.grantReadData(generateReportFn);
    this.transactionsTable.grantReadData(generateReportFn);
    this.purchaseOrdersTable.grantReadData(generateReportFn);

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
      new apigateway.LambdaIntegration(createStoreFn),
      authMethodOptions
    );
    storesResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listStoresFn),
      authMethodOptions
    );

    // /stores/{storeId}
    const singleStoreResource = storesResource.addResource("{storeId}");

    // GET /stores/{storeId}/inventory & POST /stores/{storeId}/inventory
    const inventoryResource = singleStoreResource.addResource("inventory");
    inventoryResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getInventoryFn),
      authMethodOptions
    );
    inventoryResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(updateInventoryFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/transactions
    const transactionsResource = singleStoreResource.addResource("transactions");
    transactionsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(recordTransactionFn),
      authMethodOptions
    );
    transactionsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listTransactionsFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/dashboard
    const dashboardResource = singleStoreResource.addResource("dashboard");
    dashboardResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getDashboardFn),
      authMethodOptions
    );

    // POST /recipes & GET /recipes
    const recipesResource = this.api.root.addResource("recipes");
    recipesResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(createRecipeFn),
      authMethodOptions
    );
    recipesResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listRecipesFn),
      authMethodOptions
    );

    // GET /recipes/{recipeId}
    const singleRecipeResource = recipesResource.addResource("{recipeId}");
    singleRecipeResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getRecipeFn),
      authMethodOptions
    );

    // POST /ingredients
    const ingredientsResource = this.api.root.addResource("ingredients");
    ingredientsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(upsertIngredientFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/menu-engineering
    const menuEngResource = singleStoreResource.addResource("menu-engineering");
    menuEngResource.addMethod("GET", new apigateway.LambdaIntegration(menuEngineeringFn), authMethodOptions);

    // GET/POST /stores/{storeId}/prep-lists
    const prepListsResource = singleStoreResource.addResource("prep-lists");
    prepListsResource.addMethod("GET", new apigateway.LambdaIntegration(prepListsFn), authMethodOptions);
    prepListsResource.addMethod("POST", new apigateway.LambdaIntegration(prepListsFn), authMethodOptions);

    // GET /recipes/{recipeId}/scale
    const scaleResource = singleRecipeResource.addResource("scale");
    scaleResource.addMethod("GET", new apigateway.LambdaIntegration(recipeScalingFn), authMethodOptions);

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
      new apigateway.LambdaIntegration(createSupplierFn),
      authMethodOptions
    );
    suppliersResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listSuppliersFn),
      authMethodOptions
    );

    // POST /purchase-orders
    const purchaseOrdersResource = this.api.root.addResource("purchase-orders");
    purchaseOrdersResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(createPurchaseOrderFn),
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
      new apigateway.LambdaIntegration(listPurchaseOrdersFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/receive
    const receiveResource = singleStoreResource.addResource("receive");
    receiveResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(receiveShipmentFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/receiving-logs
    const receivingLogsResource = singleStoreResource.addResource("receiving-logs");
    receivingLogsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listReceivingLogsFn),
      authMethodOptions
    );

    // GET /barcode/{code}
    const barcodeResource = this.api.root.addResource("barcode");
    const barcodeLookupResource = barcodeResource.addResource("{code}");
    barcodeLookupResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(lookupBarcodeFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/waste & GET /stores/{storeId}/waste
    const wasteResource = singleStoreResource.addResource("waste");
    wasteResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(recordWasteFn),
      authMethodOptions
    );
    wasteResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listWasteFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/waste/analytics
    const wasteAnalyticsResource = wasteResource.addResource("analytics");
    wasteAnalyticsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getWasteAnalyticsFn),
      authMethodOptions
    );

    // GET /dashboard (owner-level all-stores overview)
    const ownerDashboardResource = this.api.root.addResource("dashboard");
    ownerDashboardResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getOwnerDashboardFn),
      authMethodOptions
    );

    // GET /dashboard/comparison
    const comparisonResource = ownerDashboardResource.addResource("comparison");
    comparisonResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getStoreComparisonFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/health-score
    const healthScoreResource = singleStoreResource.addResource("health-score");
    healthScoreResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getHealthScoreFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/cameras & GET /stores/{storeId}/cameras
    const camerasResource = singleStoreResource.addResource("cameras");
    camerasResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(registerCameraFn),
      authMethodOptions
    );
    camerasResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listCamerasFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/cameras/{cameraId}/footage
    const singleCameraResource = camerasResource.addResource("{cameraId}");
    const footageResource = singleCameraResource.addResource("footage");
    footageResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getCameraFootageFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/incidents & GET /stores/{storeId}/incidents
    const incidentsResource = singleStoreResource.addResource("incidents");
    incidentsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(createIncidentFn),
      authMethodOptions
    );
    incidentsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listIncidentsFn),
      authMethodOptions
    );

    // GET/POST /stores/{storeId}/schedule & DELETE /stores/{storeId}/schedule/{shiftId}
    const scheduleResource = singleStoreResource.addResource("schedule");
    scheduleResource.addMethod("GET", new apigateway.LambdaIntegration(manageScheduleFn), authMethodOptions);
    scheduleResource.addMethod("POST", new apigateway.LambdaIntegration(manageScheduleFn), authMethodOptions);
    const singleShiftResource = scheduleResource.addResource("{shiftId}");
    singleShiftResource.addMethod("DELETE", new apigateway.LambdaIntegration(manageScheduleFn), authMethodOptions);

    // --- Kiosk API endpoints (no Cognito auth — use API key) ---
    const kioskResource = this.api.root.addResource("kiosk");

    // POST /kiosk/register (Cognito auth — manager sets up kiosk)
    const kioskRegisterResource = kioskResource.addResource("register");
    kioskRegisterResource.addMethod("POST", new apigateway.LambdaIntegration(kioskRegisterFn), authMethodOptions);

    // POST /kiosk/lookup (no auth — kiosk device uses API key header)
    const kioskLookupResource = kioskResource.addResource("lookup");
    kioskLookupResource.addMethod("POST", new apigateway.LambdaIntegration(kioskLookupFn));

    // POST /kiosk/clockin
    const kioskClockInResource = kioskResource.addResource("clockin");
    kioskClockInResource.addMethod("POST", new apigateway.LambdaIntegration(kioskClockInFn));

    // POST /kiosk/clockout
    const kioskClockOutResource = kioskResource.addResource("clockout");
    kioskClockOutResource.addMethod("POST", new apigateway.LambdaIntegration(kioskClockOutFn));

    // POST /kiosk/break/{action}
    const kioskBreakResource = kioskResource.addResource("break");
    const kioskBreakActionResource = kioskBreakResource.addResource("{action}");
    kioskBreakActionResource.addMethod("POST", new apigateway.LambdaIntegration(kioskBreakFn));

    // GET /kiosk/active?storeId=
    const kioskActiveResource = kioskResource.addResource("active");
    kioskActiveResource.addMethod("GET", new apigateway.LambdaIntegration(kioskActiveFn));

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
      new apigateway.LambdaIntegration(listStaffFn),
      authMethodOptions
    );
    staffResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(manageStaffFn),
      authMethodOptions
    );
    // PUT /stores/{storeId}/staff/{staffId} & DELETE
    const singleStaffResource = staffResource.addResource("{staffId}");
    singleStaffResource.addMethod(
      "PUT",
      new apigateway.LambdaIntegration(manageStaffFn),
      authMethodOptions
    );
    singleStaffResource.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(manageStaffFn),
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
      new apigateway.LambdaIntegration(generateReportFn),
      authMethodOptions
    );

    // POST /notifications/register & GET /notifications/preferences & PUT /notifications/preferences
    const notificationsResource = this.api.root.addResource("notifications");
    const registerResource = notificationsResource.addResource("register");
    registerResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(registerPushTokenFn),
      authMethodOptions
    );
    const prefsResource = notificationsResource.addResource("preferences");
    prefsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getNotificationPrefsFn),
      authMethodOptions
    );
    prefsResource.addMethod(
      "PUT",
      new apigateway.LambdaIntegration(updateNotificationPrefsFn),
      authMethodOptions
    );
    const sendResource = notificationsResource.addResource("send");
    sendResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(sendNotificationFn),
      authMethodOptions
    );

    // POST /stores/{storeId}/counts & GET /stores/{storeId}/counts
    const countsResource = singleStoreResource.addResource("counts");
    countsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(createCountFn),
      authMethodOptions
    );
    countsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listCountsFn),
      authMethodOptions
    );

    // PUT /stores/{storeId}/counts/{countId}
    const singleCountResource = countsResource.addResource("{countId}");
    singleCountResource.addMethod(
      "PUT",
      new apigateway.LambdaIntegration(saveCountFn),
      authMethodOptions
    );

    // GET /stores/{storeId}/counts/{countId}/variance
    const countVarianceResource = singleCountResource.addResource("variance");
    countVarianceResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getCountVarianceFn),
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
