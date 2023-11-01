import * as cdk from 'aws-cdk-lib';
import * as path from 'path'
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as cognito_identitypool from '@aws-cdk/aws-cognito-identitypool-alpha';
// import { aws_appsync as appsync } from 'aws-cdk-lib'

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

    const roleLambdaDS = new iam.Role(this, 'AppSyncFuelExecutionRoleWithDBAccess', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        test: new iam.PolicyDocument({
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
    roleLambdaDS.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)

    const funcDS = new lambda.Function(this, 'LambdaDS', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: new lambda.AssetCode('lambda'),
      handler: 'ds.handler',
      memorySize: 128,
      functionName: `${cdk.Stack.of(this).stackName}-DsFunction`,
      timeout: cdk.Duration.seconds(30),
      role: roleLambdaDS,
      logRetention: logs.RetentionDays.THREE_MONTHS,
    })
    funcDS.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)

    const userPool = new cognito.UserPool(this, "DummyUserPool")

    const identityPool = new cognito_identitypool.IdentityPool(this, 'MyNewIdentityPool', {
      authenticationProviders: { userPools: [new cognito_identitypool.UserPoolAuthenticationProvider({
        userPool: userPool,
        userPoolClient: new cognito.UserPoolClient(this, 'NewWebClient', { userPool }),
      })] },
    });

    const api = new AmplifyGraphqlApi(this, `${cdk.Stack.of(this).stackName}-gql`, {
      apiName: `${cdk.Stack.of(this).stackName}-gql`,
      definition: AmplifyGraphqlDefinition.fromFiles(path.join(__dirname, "schema.graphql")),
      authorizationModes: {
        defaultAuthorizationMode: 'API_KEY',
        apiKeyConfig: {
          description: 'default',
          expires: cdk.Duration.days(30)
        },
        iamConfig: {
          identityPoolId: identityPool.identityPoolId,
          authenticatedUserRole: identityPool.authenticatedRole,
          unauthenticatedUserRole: identityPool.unauthenticatedRole
        },
        adminRoles: [
          roleLambdaAdmin
        ]
      },
      functionNameMap: {
        'LambdaData': funcDS
      }
    })

    /**
     * Adds lambda:InvokeFunction to permission to the Authenticated Role so
     * Appsync can invoke the Lambda
     */
    funcDS.grantInvoke(identityPool.authenticatedRole)

    /**
     * These don't work here.  None of the grant functions seem to exist when
     * using api.resources.graphqlApi
     */
    api.resources.graphqlApi.grantQuery(new iam.ServicePrincipal("lambda.amazonaws.com"), 'listLocations')

    api.resources.graphqlApi.grant(new iam.ServicePrincipal("lambda.amazonaws.com"), funcDS.functionArn, 'appsync:graphql')

    // api.resources.graphqlApi.grant(roleLambdaAdmin, appsync.IamResource.custom("types/Mutation/fields/*"), "listUsers")
    // api.resources.graphqlApi.grant_query(roleLambdaAdmin, "listUsers")
    // api.resources.graphqlApi.grant(roleLambdaAdmin, appsync.IamResource.all(), 'appsync:*');


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
