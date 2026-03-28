import * as cdk from "aws-cdk-lib";
import { CfnOutput, Stack, StackProps, Tags } from "aws-cdk-lib";
import { Construct } from "constructs";

export class YearclockyApplicationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    Tags.of(this).add("Application", "yearclocky");
    Tags.of(this).add("ManagedBy", "aws-cdk");

    new CfnOutput(this, "ApplicationName", {
      value: "yearclocky-application",
      description: "Logical application name for the Yearclocky workload.",
    });
  }
}
