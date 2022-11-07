import path from 'path';
import { Duration, CustomResource } from 'aws-cdk-lib';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Function, Code, Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { DatabaseInstance } from 'aws-cdk-lib/aws-rds';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { LambdaPowertoolsLayer } from 'cdk-lambda-powertools-python-layer';
import { Construct } from 'constructs';

interface InitalizeProps {
  vpc: Vpc;
  securityGroup: SecurityGroup;
  dataBase: DatabaseInstance;
  powerToolsLayer: LambdaPowertoolsLayer;
  role: Role;
}
export class Initialize extends Construct {
  constructor(scope: Construct, id: string, props: InitalizeProps) {
    super(scope, id);

    const initializeLambda = new Function(this, 'InitializeTableLambda', {
      code: Code.fromAsset(
        path.join(__dirname, 'resources/initialize_lambda'),
        {
          bundling: {
            image: Runtime.PYTHON_3_9.bundlingImage,
            command: [
              'bash',
              '-c',
              'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output',
            ],
          },
        },
      ),
      runtime: Runtime.PYTHON_3_9,
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      architecture: Architecture.ARM_64,
      layers: [props.powerToolsLayer],
      role: props.role,
      handler: 'index.handler',
      timeout: Duration.minutes(5),
      environment: {
        RDS_SECRET_NAME: props.dataBase.secret?.secretName!,
      },
    });

    const provider = new Provider(this, 'CustomResourceProvider', {
      onEventHandler: initializeLambda,
      logRetention: RetentionDays.ONE_WEEK,
    });

    new CustomResource(this, 'customResourceResult', {
      serviceToken: provider.serviceToken,
    });
  }
}
