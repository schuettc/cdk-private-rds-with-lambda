import path from 'path';
import { Duration, CustomResource } from 'aws-cdk-lib';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import {
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
  ManagedPolicy,
} from 'aws-cdk-lib/aws-iam';
import { Function, Code, Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { DatabaseInstance } from 'aws-cdk-lib/aws-rds';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface InitializeProps {
  vpc: Vpc;
  securityGroup: SecurityGroup;
  dataBase: DatabaseInstance;
}
export class Initialize extends Construct {
  constructor(scope: Construct, id: string, props: InitializeProps) {
    super(scope, id);

    const initializerLambdaRole = new Role(this, 'initializerLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['secrets']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: [props.dataBase.secret?.secretFullArn!],
              actions: ['secretsmanager:GetSecretValue'],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaVPCAccessExecutionRole',
        ),
      ],
    });

    const initializeLambda = new Function(this, 'InitializeTableLambda', {
      code: Code.fromAsset(
        path.join(__dirname, 'resources/initialize_lambda'),
        {
          bundling: {
            image: Runtime.PYTHON_3_12.bundlingImage,
            command: [
              'bash',
              '-c',
              'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output',
            ],
          },
        },
      ),
      runtime: Runtime.PYTHON_3_12,
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      architecture: Architecture.ARM_64,
      role: initializerLambdaRole,
      handler: 'index.handler',
      timeout: Duration.minutes(5),
      environment: {
        RDS_SECRET_NAME: props.dataBase.secret?.secretName!,
      },
    });

    initializeLambda.connections.allowToDefaultPort(props.dataBase);

    const provider = new Provider(this, 'CustomResourceProvider', {
      onEventHandler: initializeLambda,
      logRetention: RetentionDays.ONE_WEEK,
    });

    new CustomResource(this, 'customResourceResult', {
      serviceToken: provider.serviceToken,
    });
  }
}
