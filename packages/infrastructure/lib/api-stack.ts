import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as sns from "aws-cdk-lib/aws-sns";
import * as path from "path";
import { Construct } from "constructs";
import { FoodwiseCoreStack } from "./core-stack";

export interface FoodwiseApiStackProps extends cdk.NestedStackProps {
  core: FoodwiseCoreStack;
  toastWebhookFn: lambda.IFunction;
  squarePollerFn: lambda.IFunction;
}

export class FoodwiseApiStack extends cdk.NestedStack {
  public readonly api: apigateway.RestApi;
  public readonly forecastFn: lambda.DockerImageFunction;
  public readonly generateWeeklyReportFn: NodejsFunction;
  public readonly singleStoreResource: apigateway.Resource;

  constructor(scope: Construct, id: string, props: FoodwiseApiStackProps) {
    super(scope, id, props);

    const core = props.core;

    const lambdaEnvironment: Record<string, string> = {
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
      SECURITY_EVENTS_TABLE: core.securityEventsTable.tableName,
    };

    const handlersPath = path.join(__dirname, "../../api/src/handlers");

    const nodejsFnProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: lambdaEnvironment,
      bundling: {
        externalModules: [] as string[],
      },
    };

    // --- Lambda Functions ---

    // Top-level store ops (POST/GET /stores only)
    const storeOpsRouterFn = new NodejsFunction(this, "StoreOpsRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "storeOpsRouter.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    // Mega router for ALL /stores/{storeId}/* sub-routes via {proxy+}
    const storeSubRouterFn = new NodejsFunction(this, "StoreSubRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "storeSubRouter.ts"),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        ...lambdaEnvironment,
        REPORTS_BUCKET: core.reportsBucket.bucketName,
        USER_POOL_ID: core.userPool.userPoolId,
      },
    });

    // Cognito admin permissions for user invitations and role management
    storeSubRouterFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:ListUsers",
        ],
        resources: [core.userPool.userPoolArn],
      })
    );

    const recipeRouterFn = new NodejsFunction(this, "RecipeRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "recipeRouter.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const supplyChainRouterFn = new NodejsFunction(this, "SupplyChainRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "supplyChainRouter.ts"),
      timeout: cdk.Duration.seconds(30),
    });

    const analyticsRouterFn = new NodejsFunction(this, "AnalyticsRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "analyticsRouter.ts"),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    });

    this.generateWeeklyReportFn = new NodejsFunction(this, "GenerateWeeklyReportFn", {
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

    const notificationRouterFn = new NodejsFunction(this, "NotificationRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "notificationRouter.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    const photoUploadFn = new NodejsFunction(this, "PhotoUploadFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "photoUpload.ts"),
      timeout: cdk.Duration.seconds(15),
      environment: {
        ...lambdaEnvironment,
        REPORTS_BUCKET: core.reportsBucket.bucketName,
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

    const vendorPriceHistoryFn = new NodejsFunction(this, "VendorPriceHistoryFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "vendorPriceHistory.ts"),
      timeout: cdk.Duration.seconds(10),
    });

    const kioskRouterFn = new NodejsFunction(this, "KioskRouterFn", {
      ...nodejsFnProps,
      entry: path.join(handlersPath, "kioskRouter.ts"),
      timeout: cdk.Duration.seconds(15),
    });

    // Forecast Lambda (Python, Docker Image)
    const modelsCodePath = path.join(__dirname, "../../models");

    this.forecastFn = new lambda.DockerImageFunction(this, "ForecastFn", {
      code: lambda.DockerImageCode.fromImageAsset(modelsCodePath),
      environment: lambdaEnvironment,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
    });

    // --- IAM Permissions ---

    assistantFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0",
          "arn:aws:bedrock:*::foundation-model/anthropic.*",
          "arn:aws:bedrock:*:*:inference-profile/us.anthropic.*",
        ],
      })
    );
    assistantFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "aws-marketplace:ViewSubscriptions",
          "aws-marketplace:Subscribe",
        ],
        resources: ["*"],
      })
    );

    this.generateWeeklyReportFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      })
    );

    // Store operations router (top-level /stores only)
    core.storesTable.grantReadWriteData(storeOpsRouterFn);
    core.inventoryTable.grantReadWriteData(storeOpsRouterFn);
    core.transactionsTable.grantReadWriteData(storeOpsRouterFn);
    core.recipesTable.grantReadData(storeOpsRouterFn);
    core.wasteLogsTable.grantReadData(storeOpsRouterFn);

    // Store sub-router — needs access to all DynamoDB tables + S3
    // Use a single wildcard policy to stay within IAM policy size limits
    storeSubRouterFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
        ],
        resources: [
          cdk.Arn.format(
            { service: "dynamodb", resource: "table", resourceName: "*" },
            cdk.Stack.of(this)
          ),
          cdk.Arn.format(
            { service: "dynamodb", resource: "table", resourceName: "*/index/*" },
            cdk.Stack.of(this)
          ),
        ],
      })
    );
    core.reportsBucket.grantRead(storeSubRouterFn);

    // Forecast
    core.storesTable.grantReadData(this.forecastFn);
    core.inventoryTable.grantReadData(this.forecastFn);
    core.transactionsTable.grantReadData(this.forecastFn);
    core.recipesTable.grantReadData(this.forecastFn);
    core.forecastsTable.grantReadWriteData(this.forecastFn);

    // Recipe router
    core.recipesTable.grantReadWriteData(recipeRouterFn);
    core.inventoryTable.grantReadData(recipeRouterFn);

    // Supply chain router (top-level routes)
    core.suppliersTable.grantReadWriteData(supplyChainRouterFn);
    core.purchaseOrdersTable.grantReadWriteData(supplyChainRouterFn);
    core.receivingLogsTable.grantReadWriteData(supplyChainRouterFn);
    core.inventoryTable.grantReadWriteData(supplyChainRouterFn);

    // Analytics router (top-level routes)
    core.storesTable.grantReadData(analyticsRouterFn);
    core.inventoryTable.grantReadData(analyticsRouterFn);
    core.transactionsTable.grantReadData(analyticsRouterFn);
    core.wasteLogsTable.grantReadData(analyticsRouterFn);
    core.forecastsTable.grantReadData(analyticsRouterFn);
    core.receivingLogsTable.grantReadData(analyticsRouterFn);
    core.purchaseOrdersTable.grantReadData(analyticsRouterFn);
    core.recipesTable.grantReadData(analyticsRouterFn);
    // Staff, TimeClock, InventoryCounts access for labor/P&L/count-variance reports
    // Using a single managed policy to avoid IAM policy size limits
    analyticsRouterFn.role?.addManagedPolicy(
      new iam.ManagedPolicy(this, "AnalyticsExtraTablesPolicy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["dynamodb:Query", "dynamodb:Scan", "dynamodb:GetItem", "dynamodb:BatchGetItem"],
            resources: [
              core.staffTable.tableArn, core.staffTable.tableArn + "/index/*",
              core.timeClockTable.tableArn, core.timeClockTable.tableArn + "/index/*",
              core.inventoryCountsTable.tableArn, core.inventoryCountsTable.tableArn + "/index/*",
            ],
          }),
        ],
      })
    );

    // Weekly report
    core.storesTable.grantReadData(this.generateWeeklyReportFn);
    core.inventoryTable.grantReadData(this.generateWeeklyReportFn);
    core.transactionsTable.grantReadData(this.generateWeeklyReportFn);
    core.wasteLogsTable.grantReadData(this.generateWeeklyReportFn);
    core.forecastsTable.grantReadData(this.generateWeeklyReportFn);

    // Notifications
    core.notificationsTable.grantReadWriteData(notificationRouterFn);

    // Kiosk
    core.kioskDevicesTable.grantReadWriteData(kioskRouterFn);
    core.timeClockTable.grantReadWriteData(kioskRouterFn);
    core.staffTable.grantReadData(kioskRouterFn);
    core.auditTrailTable.grantReadWriteData(kioskRouterFn);

    // Photo Upload
    core.reportsBucket.grantReadWrite(photoUploadFn);

    // Supplier Portal
    core.suppliersTable.grantReadData(supplierPortalFn);
    core.purchaseOrdersTable.grantReadWriteData(supplierPortalFn);

    // Vendor Communication
    core.purchaseOrdersTable.grantReadData(emailPurchaseOrderFn);
    core.suppliersTable.grantReadData(emailPurchaseOrderFn);

    // Price History
    core.priceHistoryTable.grantReadWriteData(vendorPriceHistoryFn);

    // Assistant
    core.storesTable.grantReadData(assistantFn);
    core.inventoryTable.grantReadData(assistantFn);
    core.transactionsTable.grantReadData(assistantFn);
    core.wasteLogsTable.grantReadData(assistantFn);
    core.forecastsTable.grantReadData(assistantFn);
    core.purchaseOrdersTable.grantReadData(assistantFn);

    // --- API Gateway ---

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "FoodwiseAuthorizer",
      {
        cognitoUserPools: [core.userPool],
        identitySource: "method.request.header.Authorization",
      }
    );

    const authMethodOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // API Gateway access logging
    const apiAccessLogGroup = new logs.LogGroup(this, "ApiAccessLogs", {
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.api = new apigateway.RestApi(this, "FoodwiseApi", {
      restApiName: "foodwise-api",
      description: "FoodWise Platform API",
      deployOptions: {
        stageName: "v1",
        accessLogDestination: new apigateway.LogGroupLogDestination(apiAccessLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Request-Timestamp",
          "X-Api-Key",
          "X-Device-Id",
        ],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // Gateway Response security headers (applied to all responses including errors)
    this.api.addGatewayResponse("Default4xx", {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Strict-Transport-Security": "'max-age=31536000; includeSubDomains'",
        "X-Content-Type-Options": "'nosniff'",
        "X-Frame-Options": "'DENY'",
      },
    });
    this.api.addGatewayResponse("Default5xx", {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Strict-Transport-Security": "'max-age=31536000; includeSubDomains'",
        "X-Content-Type-Options": "'nosniff'",
        "X-Frame-Options": "'DENY'",
      },
    });

    // POST /stores & GET /stores
    const storesResource = this.api.root.addResource("stores");
    storesResource.addMethod("POST", new apigateway.LambdaIntegration(storeOpsRouterFn), authMethodOptions);
    storesResource.addMethod("GET", new apigateway.LambdaIntegration(storeOpsRouterFn), authMethodOptions);

    // /stores/{storeId} — single resource, then {proxy+} catches all sub-routes
    this.singleStoreResource = storesResource.addResource("{storeId}");
    const storeProxyResource = this.singleStoreResource.addResource("{proxy+}");
    storeProxyResource.addMethod(
      "ANY",
      new apigateway.LambdaIntegration(storeSubRouterFn),
      authMethodOptions
    );

    // POST/GET /recipes
    const recipesResource = this.api.root.addResource("recipes");
    recipesResource.addMethod("POST", new apigateway.LambdaIntegration(recipeRouterFn), authMethodOptions);
    recipesResource.addMethod("GET", new apigateway.LambdaIntegration(recipeRouterFn), authMethodOptions);

    // GET /recipes/{recipeId}
    const singleRecipeResource = recipesResource.addResource("{recipeId}");
    singleRecipeResource.addMethod("GET", new apigateway.LambdaIntegration(recipeRouterFn), authMethodOptions);

    // POST /ingredients
    const ingredientsResource = this.api.root.addResource("ingredients");
    ingredientsResource.addMethod("POST", new apigateway.LambdaIntegration(recipeRouterFn), authMethodOptions);

    // GET /recipes/{recipeId}/scale
    const scaleResource = singleRecipeResource.addResource("scale");
    scaleResource.addMethod("GET", new apigateway.LambdaIntegration(recipeRouterFn), authMethodOptions);

    // GET/POST /photos
    const photosResource = this.api.root.addResource("photos");
    photosResource.addMethod("GET", new apigateway.LambdaIntegration(photoUploadFn), authMethodOptions);
    photosResource.addMethod("POST", new apigateway.LambdaIntegration(photoUploadFn), authMethodOptions);

    // Supplier portal routes
    const supplierPortalResource = this.api.root.addResource("supplier-portal");
    const singleSupplierPortalResource = supplierPortalResource.addResource("{supplierId}");
    singleSupplierPortalResource.addMethod("GET", new apigateway.LambdaIntegration(supplierPortalFn), authMethodOptions);
    const supplierOrdersResource = singleSupplierPortalResource.addResource("orders");
    supplierOrdersResource.addMethod("GET", new apigateway.LambdaIntegration(supplierPortalFn), authMethodOptions);
    const supplierSingleOrderResource = supplierOrdersResource.addResource("{orderId}");
    supplierSingleOrderResource.addMethod("PUT", new apigateway.LambdaIntegration(supplierPortalFn), authMethodOptions);

    // POST /forecasts
    const forecastsResource = this.api.root.addResource("forecasts");
    forecastsResource.addMethod("POST", new apigateway.LambdaIntegration(this.forecastFn), authMethodOptions);

    // POST/GET /suppliers
    const suppliersResource = this.api.root.addResource("suppliers");
    suppliersResource.addMethod("POST", new apigateway.LambdaIntegration(supplyChainRouterFn), authMethodOptions);
    suppliersResource.addMethod("GET", new apigateway.LambdaIntegration(supplyChainRouterFn), authMethodOptions);

    // POST /purchase-orders
    const purchaseOrdersResource = this.api.root.addResource("purchase-orders");
    purchaseOrdersResource.addMethod("POST", new apigateway.LambdaIntegration(supplyChainRouterFn), authMethodOptions);

    // POST /purchase-orders/{orderId}/email
    const singlePOResource = purchaseOrdersResource.addResource("{orderId}");
    const emailPOResource = singlePOResource.addResource("email");
    emailPOResource.addMethod("POST", new apigateway.LambdaIntegration(emailPurchaseOrderFn), authMethodOptions);

    // GET/POST /price-history
    const priceHistoryResource = this.api.root.addResource("price-history");
    priceHistoryResource.addMethod("GET", new apigateway.LambdaIntegration(vendorPriceHistoryFn), authMethodOptions);
    priceHistoryResource.addMethod("POST", new apigateway.LambdaIntegration(vendorPriceHistoryFn), authMethodOptions);

    // GET /barcode/{code}
    const barcodeResource = this.api.root.addResource("barcode");
    const barcodeLookupResource = barcodeResource.addResource("{code}");
    barcodeLookupResource.addMethod("GET", new apigateway.LambdaIntegration(supplyChainRouterFn), authMethodOptions);

    // GET /dashboard (owner-level)
    const ownerDashboardResource = this.api.root.addResource("dashboard");
    ownerDashboardResource.addMethod("GET", new apigateway.LambdaIntegration(analyticsRouterFn), authMethodOptions);

    // GET /dashboard/comparison
    const comparisonResource = ownerDashboardResource.addResource("comparison");
    comparisonResource.addMethod("GET", new apigateway.LambdaIntegration(analyticsRouterFn), authMethodOptions);

    // --- Kiosk API endpoints ---
    const kioskResource = this.api.root.addResource("kiosk");

    const kioskRegisterResource = kioskResource.addResource("register");
    kioskRegisterResource.addMethod("POST", new apigateway.LambdaIntegration(kioskRouterFn), authMethodOptions);

    const kioskLookupResource = kioskResource.addResource("lookup");
    kioskLookupResource.addMethod("POST", new apigateway.LambdaIntegration(kioskRouterFn));

    const kioskClockInResource = kioskResource.addResource("clockin");
    kioskClockInResource.addMethod("POST", new apigateway.LambdaIntegration(kioskRouterFn));

    const kioskClockOutResource = kioskResource.addResource("clockout");
    kioskClockOutResource.addMethod("POST", new apigateway.LambdaIntegration(kioskRouterFn));

    const kioskBreakResource = kioskResource.addResource("break");
    const kioskBreakActionResource = kioskBreakResource.addResource("{action}");
    kioskBreakActionResource.addMethod("POST", new apigateway.LambdaIntegration(kioskRouterFn));

    const kioskActiveResource = kioskResource.addResource("active");
    kioskActiveResource.addMethod("GET", new apigateway.LambdaIntegration(kioskRouterFn));

    // POST /reports
    const reportsResource = this.api.root.addResource("reports");
    reportsResource.addMethod("POST", new apigateway.LambdaIntegration(analyticsRouterFn), authMethodOptions);

    // Notifications routes
    const notificationsResource = this.api.root.addResource("notifications");
    const registerResource = notificationsResource.addResource("register");
    registerResource.addMethod("POST", new apigateway.LambdaIntegration(notificationRouterFn), authMethodOptions);
    const prefsResource = notificationsResource.addResource("preferences");
    prefsResource.addMethod("GET", new apigateway.LambdaIntegration(notificationRouterFn), authMethodOptions);
    prefsResource.addMethod("PUT", new apigateway.LambdaIntegration(notificationRouterFn), authMethodOptions);
    const sendResource = notificationsResource.addResource("send");
    sendResource.addMethod("POST", new apigateway.LambdaIntegration(notificationRouterFn), authMethodOptions);

    // POST /assistant
    const assistantResource = this.api.root.addResource("assistant");
    assistantResource.addMethod("POST", new apigateway.LambdaIntegration(assistantFn), authMethodOptions);

    // --- POS Webhook endpoints (public, no Cognito auth) ---

    // POST /webhooks/toast/{storeId}
    const webhooksResource = this.api.root.addResource("webhooks");
    const toastResource = webhooksResource.addResource("toast");
    const toastStoreResource = toastResource.addResource("{storeId}");
    toastStoreResource.addMethod("POST", new apigateway.LambdaIntegration(props.toastWebhookFn));

    // POST /webhooks/toast/{storeId}/import
    const toastImportResource = toastStoreResource.addResource("import");
    toastImportResource.addMethod("POST", new apigateway.LambdaIntegration(props.toastWebhookFn));

    // POST /pos/square/oauth
    const posResource = this.api.root.addResource("pos");
    const squareResource = posResource.addResource("square");
    const oauthResource = squareResource.addResource("oauth");
    oauthResource.addMethod("POST", new apigateway.LambdaIntegration(props.squarePollerFn));

    // --- Webhook rate limiting ---
    const webhookApiKey = this.api.addApiKey("WebhookApiKey", {
      apiKeyName: "foodwise-webhook-key",
      description: "API key for POS webhook endpoints",
    });

    const webhookUsagePlan = this.api.addUsagePlan("WebhookUsagePlan", {
      name: "webhook-rate-limit",
      description: "Rate limit for POS webhook endpoints",
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
      quota: {
        limit: 100000,
        period: apigateway.Period.DAY,
      },
    });

    webhookUsagePlan.addApiKey(webhookApiKey);
    webhookUsagePlan.addApiStage({ stage: this.api.deploymentStage });

    // --- Security Events Table Grants ---
    core.securityEventsTable.grantWriteData(kioskRouterFn);
    core.securityEventsTable.grantWriteData(storeSubRouterFn);
    core.securityEventsTable.grantWriteData(storeOpsRouterFn);
    core.securityEventsTable.grantReadWriteData(analyticsRouterFn);

    // --- CloudWatch Alarms ---

    const securityAlarmTopic = new sns.Topic(this, "SecurityAlarmTopic", {
      topicName: "foodwise-security-alarms",
      displayName: "FoodWise Security Alarms",
    });

    // High 4xx error rate (potential brute force / scanning)
    new cloudwatch.Alarm(this, "High4xxAlarm", {
      metric: this.api.metricClientError({
        period: cdk.Duration.minutes(5),
        statistic: "Sum",
      }),
      threshold: 100,
      evaluationPeriods: 2,
      alarmDescription: "High 4xx error rate — possible brute force or scanning",
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction({ bind: () => ({ alarmActionArn: securityAlarmTopic.topicArn }) });

    // High 5xx error rate (application errors)
    new cloudwatch.Alarm(this, "High5xxAlarm", {
      metric: this.api.metricServerError({
        period: cdk.Duration.minutes(5),
        statistic: "Sum",
      }),
      threshold: 20,
      evaluationPeriods: 2,
      alarmDescription: "High 5xx error rate — application errors",
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction({ bind: () => ({ alarmActionArn: securityAlarmTopic.topicArn }) });

    // Throttling alarm
    new cloudwatch.Alarm(this, "ThrottlingAlarm", {
      metric: this.api.metricCount({
        period: cdk.Duration.minutes(1),
        statistic: "Sum",
      }),
      threshold: 1000,
      evaluationPeriods: 3,
      alarmDescription: "High request volume — potential DoS",
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction({ bind: () => ({ alarmActionArn: securityAlarmTopic.topicArn }) });

    // Lambda error alarms for critical functions
    for (const [name, fn] of [
      ["KioskRouter", kioskRouterFn],
      ["StoreSubRouter", storeSubRouterFn],
      ["Assistant", assistantFn],
    ] as const) {
      new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        metric: (fn as NodejsFunction).metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: "Sum",
        }),
        threshold: 10,
        evaluationPeriods: 2,
        alarmDescription: `High error rate on ${name} Lambda`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }
  }
}
