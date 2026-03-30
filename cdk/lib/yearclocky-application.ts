import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { Duration, Tags } from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiHandlerEntry = resolveApiHandlerEntry();

export type YearclockyApplicationProps = {
  httpApi: apigwv2.HttpApi;
  dataTable: dynamodb.ITable;
};

export class YearclockyApplication extends Construct {
  readonly apiHandler: nodejs.NodejsFunction;
  readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: YearclockyApplicationProps) {
    super(scope, id);

    Tags.of(this).add("Application", "yearclocky");
    Tags.of(this).add("ManagedBy", "aws-cdk");

    this.httpApi = props.httpApi;

    this.apiHandler = new nodejs.NodejsFunction(this, "ApiHandler", {
      functionName: "api-handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: apiHandlerEntry,
      handler: "handler",
      timeout: Duration.seconds(10),
      memorySize: 256,
      environment: {
        TABLE_NAME: props.dataTable.tableName,
      },
      bundling: {
        target: "node20",
        format: nodejs.OutputFormat.ESM,
      },
    });

    props.dataTable.grantReadWriteData(this.apiHandler);

    const apiIntegration = new integrations.HttpLambdaIntegration(
      "ApiHandlerIntegration",
      this.apiHandler,
    );

    for (const route of ["/tasks", "/yearclocks", "/users"]) {
      this.httpApi.addRoutes({
        path: route,
        methods: [apigwv2.HttpMethod.ANY],
        integration: apiIntegration,
      });

      this.httpApi.addRoutes({
        path: `${route}/{proxy+}`,
        methods: [apigwv2.HttpMethod.ANY],
        integration: apiIntegration,
      });
    }
  }
}

function resolveApiHandlerEntry(): string {
  const candidates = [
    path.resolve(moduleDirectory, "../lambda/index.ts"),
    path.resolve(moduleDirectory, "../lambda/index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to resolve the packaged api-handler entrypoint.");
}
