import { Vpc, SubnetType, SecurityGroup, Port } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VPC extends Construct {
  public vpc: Vpc;
  public securityGroup: SecurityGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new Vpc(this, 'VPC', {
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 24,
          name: 'PrivateWithEgress',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: SubnetType.PUBLIC,
        },
      ],
    });

    this.securityGroup = new SecurityGroup(this, 'QuerySecurityGroup', {
      vpc: this.vpc,
      description: 'Security Group for Query',
      allowAllOutbound: true,
    });
    this.securityGroup.connections.allowInternally(Port.tcp(5432));
  }
}
