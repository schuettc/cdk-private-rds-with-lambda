import { Duration } from 'aws-cdk-lib';
import {
  Vpc,
  SubnetType,
  InstanceType,
  InstanceClass,
  InstanceSize,
  SecurityGroup,
} from 'aws-cdk-lib/aws-ec2';
import { DatabaseInstance, DatabaseInstanceEngine } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

interface RDSProps {
  vpc: Vpc;
  securityGroup: SecurityGroup;
}
export class RDS extends Construct {
  public database: DatabaseInstance;

  constructor(scope: Construct, id: string, props: RDSProps) {
    super(scope, id);

    this.database = new DatabaseInstance(this, 'database', {
      engine: DatabaseInstanceEngine.POSTGRES,
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      instanceType: InstanceType.of(
        InstanceClass.BURSTABLE4_GRAVITON,
        InstanceSize.LARGE,
      ),
      multiAz: false,
      allowMajorVersionUpgrade: true,
      autoMinorVersionUpgrade: true,
      backupRetention: Duration.days(21),
      securityGroups: [props.securityGroup],
    });
  }
}
