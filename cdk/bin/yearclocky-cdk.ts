#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { YearclockyApplicationStack } from "../lib/yearclocky-application-stack.js";

const app = new cdk.App();

new YearclockyApplicationStack(app, "YearclockyApplicationStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
