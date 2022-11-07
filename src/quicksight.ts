import { Vpc, SecurityGroup, Peer, Port } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface RDSProps {
  vpc: Vpc;
  securityGroup: SecurityGroup;
}
export class QuickSight extends Construct {
  fromRdsSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: RDSProps) {
    super(scope, id);

    this.fromRdsSecurityGroup = new SecurityGroup(this, 'QuickSightSG', {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    this.fromRdsSecurityGroup.addIngressRule(
      Peer.securityGroupId(props.securityGroup.securityGroupId),
      Port.allTcp(),
    );
  }
}
