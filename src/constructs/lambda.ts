import * as path from 'path';
import { Duration } from 'aws-cdk-lib';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Runtime, Architecture, Tracing, Function, Code } from 'aws-cdk-lib/aws-lambda';
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
      tracing: Tracing.ACTIVE,
      environment: {
        RDS_SECRET_NAME: props.dataBase.secret?.secretName!,
        DB_HOST: props.dataBase.dbInstanceEndpointAddress,
        DB_PORT: props.dataBase.dbInstanceEndpointPort,
      },
    });

    props.dataBase.secret?.grantRead(this.queryLambda);
    props.dataBase.grantConnect(this.queryLambda, 'postgres');

    this.queryLambda.connections.allowToDefaultPort(props.dataBase);
  }
}
