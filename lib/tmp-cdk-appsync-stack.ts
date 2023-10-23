import * as cdk from 'aws-cdk-lib';
import * as path from 'path'
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'

import { AmplifyGraphqlApi, AmplifyGraphqlDefinition } from '@aws-amplify/graphql-api-construct'

export class TmpCdkAppsyncStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const roleLambdaAdmin = new iam.Role(this, 'FunctionExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        root: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['arn:aws:logs:*:*:*'],
              effect: iam.Effect.ALLOW
            })
          ],
        })
      },
    })
    roleLambdaAdmin.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)

    const testFunction = new lambda.Function(this, 'testFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: new lambda.AssetCode('lambda'),
      memorySize: 128,
      functionName: `${cdk.Stack.of(this).stackName}-testFunction`,
      handler: 'index.handler',
      role: roleLambdaAdmin,
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.THREE_MONTHS
    })
    testFunction.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)

    const api = new AmplifyGraphqlApi(this, `${cdk.Stack.of(this).stackName}-gql`, {
      apiName: `${cdk.Stack.of(this).stackName}-gql`,
      definition: AmplifyGraphqlDefinition.fromFiles(path.join(__dirname, "schema.graphql")),
      authorizationModes: {
        defaultAuthorizationMode: 'API_KEY',
        apiKeyConfig: {
          description: 'default',
          expires: cdk.Duration.days(30)
        },
        adminRoles: [
          roleLambdaAdmin
        ]
      },
    })

    roleLambdaAdmin.addToPolicy(new iam.PolicyStatement({
      actions: [
        'appsync:*',
      ],
      resources: [
        api.resources.graphqlApi.arn,
        `${api.resources.graphqlApi.arn}/types/*/fields/*`,
        `${api.resources.graphqlApi.arn}/types/*/*/*`,
        `${api.resources.graphqlApi.arn}/types/*`,
        `${api.resources.graphqlApi.arn}/*/*/*/*`,
        `${api.resources.graphqlApi.arn}/*/*/*`,
        `${api.resources.graphqlApi.arn}/*/*`,
        `${api.resources.graphqlApi.arn}/*`
      ],
      effect: iam.Effect.ALLOW
    }))
    testFunction.addEnvironment('GRAPHQL_URL', api.graphqlUrl)



  }
}
