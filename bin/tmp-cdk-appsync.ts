#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TmpCdkAppsyncStack } from '../lib/tmp-cdk-appsync-stack';

const app = new cdk.App();
new TmpCdkAppsyncStack(app, 'TmpCdkAppsyncStack', {
  stackName: `test-appsync-stack`,
});