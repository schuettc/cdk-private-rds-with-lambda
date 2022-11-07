import path from 'path';
import { Duration } from 'aws-cdk-lib';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Function, Code, Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';
import { DatabaseInstance } from 'aws-cdk-lib/aws-rds';
import { LambdaPowertoolsLayer } from 'cdk-lambda-powertools-python-layer';
import { Construct } from 'constructs';

interface LambdaProps {
  vpc: Vpc;
  securityGroup: SecurityGroup;
  dataBase: DatabaseInstance;
  powerToolsLayer: LambdaPowertoolsLayer;
  role: Role;
}
export class Lambda extends Construct {
  public queryLambda: Function;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    this.queryLambda = new Function(this, 'QueryLambda', {
      code: Code.fromAsset(path.join(__dirname, 'resources/query_lambda'), {
        bundling: {
          image: Runtime.PYTHON_3_9.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output',
          ],
        },
      }),
      runtime: Runtime.PYTHON_3_9,
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      architecture: Architecture.ARM_64,
      handler: 'index.handler',
      timeout: Duration.minutes(5),
      role: props.role,
      layers: [props.powerToolsLayer],
      environment: {
        RDS_SECRET_NAME: props.dataBase.secret?.secretName!,
      },
    });
  }
}
