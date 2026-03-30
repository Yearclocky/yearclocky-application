#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import {
  AttributeType,
  BillingMode,
  Table,
} from "aws-cdk-lib/aws-dynamodb";

import { YearclockyApplication } from "../lib/yearclocky-application.js";

const app = new cdk.App();

const stack = new Stack(app, "YearclockyApplicationStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

const httpApi = new HttpApi(stack, "SharedHttpApi", {
  apiName: "yearclocky-api",
});

const dataTable = new Table(stack, "YearclockyTable", {
  partitionKey: {
    name: "pk",
    type: AttributeType.STRING,
  },
  sortKey: {
    name: "sk",
    type: AttributeType.STRING,
  },
  billingMode: BillingMode.PAY_PER_REQUEST,
});

new YearclockyApplication(stack, "YearclockyApplication", {
  httpApi,
  dataTable,
});
