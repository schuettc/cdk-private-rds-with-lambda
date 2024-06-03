import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { RDS, Lambda, VPC, Initialize, QuickSight, EC2 } from './index';

export class PrivateRDSWithLambda extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const vpc = new VPC(this, 'vpc');
    const rds = new RDS(this, 'rds', {
      vpc: vpc.vpc,
      securityGroup: vpc.securityGroup,
    });

    new Initialize(this, 'initialize', {
      vpc: vpc.vpc,
      securityGroup: vpc.securityGroup,
      dataBase: rds.database,
    });

    const lambda = new Lambda(this, 'Lambda', {
      vpc: vpc.vpc,
      securityGroup: vpc.securityGroup,
      dataBase: rds.database,
    });

    new Rule(this, 'ScheduleRule', {
      schedule: Schedule.cron({ minute: '0', hour: '4' }),
      targets: [new LambdaFunction(lambda.queryLambda)],
    });

    const quicksight = new QuickSight(this, 'QuickSight', {
      vpc: vpc.vpc,
      securityGroup: vpc.securityGroup,
    });

    new EC2(this, 'EC2Instance', {
      fromRdsSecurityGroup: quicksight.fromRdsSecurityGroup,
      vpc: vpc.vpc,
    });
  }
}

const prodEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new PrivateRDSWithLambda(app, 'private-rds-with-lambda', { env: prodEnv });

app.synth();
