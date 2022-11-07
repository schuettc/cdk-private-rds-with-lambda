import { Duration } from 'aws-cdk-lib';
import {
  SecurityGroup,
  Vpc,
  Peer,
  Port,
  SubnetType,
  InitConfig,
  InitCommand,
  Instance,
  InstanceType,
  InstanceClass,
  InstanceSize,
  CloudFormationInit,
  AmazonLinuxImage,
  AmazonLinuxGeneration,
  AmazonLinuxCpuType,
} from 'aws-cdk-lib/aws-ec2';
import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface EC2Props {
  vpc: Vpc;
  fromRdsSecurityGroup: SecurityGroup;
}
export class EC2 extends Construct {
  constructor(scope: Construct, id: string, props: EC2Props) {
    super(scope, id);

    const sshSecurityGroup = new SecurityGroup(this, 'SSHSecurityGroup', {
      vpc: props.vpc,
      description: 'Security Group for SSH',
      allowAllOutbound: true,
    });
    sshSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(22),
      'Allow SSH Access',
    );

    const ec2Role = new Role(this, 'asteriskEc2Role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    const ami = new AmazonLinuxImage({
      generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
      cpuType: AmazonLinuxCpuType.ARM_64,
    });

    const ec2Instance = new Instance(this, 'Instance', {
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: InstanceType.of(InstanceClass.C6G, InstanceSize.MEDIUM),
      machineImage: ami,
      init: CloudFormationInit.fromConfigSets({
        configSets: {
          default: ['install'],
        },
        configs: {
          install: new InitConfig([
            InitCommand.shellCommand('yum update -y'),
            InitCommand.shellCommand('yum upgrade -y'),
            InitCommand.shellCommand(
              'amazon-linux-extras install postgresql12',
            ),
          ]),
        },
      }),
      initOptions: {
        timeout: Duration.minutes(20),
        includeUrl: true,
        includeRole: true,
        printLog: true,
      },
      role: ec2Role,
    });

    ec2Instance.addSecurityGroup(props.fromRdsSecurityGroup);
    ec2Instance.addSecurityGroup(sshSecurityGroup);
  }
}
