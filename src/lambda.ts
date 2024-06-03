import path from 'path';
import { Duration } from 'aws-cdk-lib';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import {
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
  ManagedPolicy,
} from 'aws-cdk-lib/aws-iam';
import { Function, Code, Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';
import { DatabaseInstance } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

interface LambdaProps {
  vpc: Vpc;
  securityGroup: SecurityGroup;
  dataBase: DatabaseInstance;
}
export class Lambda extends Construct {
  public queryLambda: Function;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    const queryLambdaRole = new Role(this, 'queryLambdaRole', {
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

    this.queryLambda = new Function(this, 'QueryLambda', {
      code: Code.fromAsset(path.join(__dirname, 'resources/query_lambda'), {
        bundling: {
          image: Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output',
          ],
        },
      }),
      runtime: Runtime.PYTHON_3_12,
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      architecture: Architecture.ARM_64,
      handler: 'index.handler',
      timeout: Duration.minutes(5),
      role: queryLambdaRole,
      environment: {
        RDS_SECRET_NAME: props.dataBase.secret?.secretName!,
      },
    });

    this.queryLambda.connections.allowToDefaultPort(props.dataBase);
  }
}
