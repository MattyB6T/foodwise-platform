import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface FoodwiseSchedulerStackProps extends cdk.NestedStackProps {
  forecastFn: lambda.IFunction;
  generateWeeklyReportFn: lambda.IFunction;
}

export class FoodwiseSchedulerStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: FoodwiseSchedulerStackProps) {
    super(scope, id, props);

    // Nightly forecast at 2 AM UTC
    new events.Rule(this, "NightlyForecastRule", {
      schedule: events.Schedule.cron({ minute: "0", hour: "2" }),
      targets: [new targets.LambdaFunction(props.forecastFn)],
    });

    // Weekly report every Monday at 6 AM UTC
    new events.Rule(this, "WeeklyReportRule", {
      schedule: events.Schedule.cron({ minute: "0", hour: "6", weekDay: "MON" }),
      targets: [new targets.LambdaFunction(props.generateWeeklyReportFn)],
    });
  }
}
