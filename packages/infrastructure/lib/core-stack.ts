import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class FoodwiseCoreStack extends cdk.NestedStack {
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
  public readonly posConnectionsTable: dynamodb.Table;
  public readonly posTransactionsRawTable: dynamodb.Table;
  public readonly ingredientMappingsTable: dynamodb.Table;
  public readonly forecastAccuracyTable: dynamodb.Table;
  public readonly securityEventsTable: dynamodb.Table;

  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly reportsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    // --- DynamoDB Tables ---

    this.storesTable = new dynamodb.Table(this, "StoresTable", {
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.inventoryTable = new dynamodb.Table(this, "InventoryTable", {
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "itemId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    this.transactionsTable = new dynamodb.Table(this, "TransactionsTable", {
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "transactionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    this.transactionsTable.addGlobalSecondaryIndex({
      indexName: "timestamp-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.recipesTable = new dynamodb.Table(this, "RecipesTable", {
      partitionKey: { name: "recipeId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.forecastsTable = new dynamodb.Table(this, "ForecastsTable", {
      partitionKey: { name: "forecastId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "storeRecipeKey", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.suppliersTable = new dynamodb.Table(this, "SuppliersTable", {
      partitionKey: { name: "supplierId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.purchaseOrdersTable = new dynamodb.Table(this, "PurchaseOrdersTable", {
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
      partitionKey: { name: "staffId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    this.staffTable.addGlobalSecondaryIndex({
      indexName: "storeId-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.schedulesTable = new dynamodb.Table(this, "SchedulesTable", {
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
      partitionKey: { name: "entryId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    this.timeClockTable.addGlobalSecondaryIndex({
      indexName: "storeId-clockInTime-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "clockInTime", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.kioskDevicesTable = new dynamodb.Table(this, "KioskDevicesTable", {
      partitionKey: { name: "deviceId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.tempLogsTable = new dynamodb.Table(this, "TempLogsTable", {
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

    // --- POS Tables ---

    this.posConnectionsTable = new dynamodb.Table(this, "PosConnectionsTable", {
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.posConnectionsTable.addGlobalSecondaryIndex({
      indexName: "posSystem-status-index",
      partitionKey: { name: "posSystem", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "status", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.posTransactionsRawTable = new dynamodb.Table(this, "PosTransactionsRawTable", {
      partitionKey: { name: "rawTransactionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    this.posTransactionsRawTable.addGlobalSecondaryIndex({
      indexName: "storeId-posTransactionId-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "posTransactionId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.posTransactionsRawTable.addGlobalSecondaryIndex({
      indexName: "storeId-timestamp-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.ingredientMappingsTable = new dynamodb.Table(this, "IngredientMappingsTable", {
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "posItemKey", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.forecastAccuracyTable = new dynamodb.Table(this, "ForecastAccuracyTable", {
      partitionKey: { name: "accuracyId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.forecastAccuracyTable.addGlobalSecondaryIndex({
      indexName: "storeId-weekStart-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "weekStart", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- Security Events Table ---

    this.securityEventsTable = new dynamodb.Table(this, "SecurityEventsTable", {
      partitionKey: { name: "eventId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    this.securityEventsTable.addGlobalSecondaryIndex({
      indexName: "eventType-timestamp-index",
      partitionKey: { name: "eventType", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.securityEventsTable.addGlobalSecondaryIndex({
      indexName: "storeId-timestamp-index",
      partitionKey: { name: "storeId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- Cognito User Pool ---

    this.userPool = new cognito.UserPool(this, "FoodwiseUserPool", {
      userPoolName: "foodwise-users",
      selfSignUpEnabled: false, // Disable self sign-up — admins create users
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });


    this.userPoolClient = this.userPool.addClient("FoodwiseAppClient", {
      userPoolClientName: "foodwise-app-client",
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
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
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      lifecycleRules: [
        {
          id: "clock-in-photos-cleanup",
          prefix: "photos/clockin/",
          expiration: cdk.Duration.days(90),
        },
        {
          id: "temp-uploads-cleanup",
          prefix: "uploads/",
          expiration: cdk.Duration.days(7),
        },
      ],
    });
  }
}
