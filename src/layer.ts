import {
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
  ManagedPolicy,
} from 'aws-cdk-lib/aws-iam';
import { DatabaseInstance } from 'aws-cdk-lib/aws-rds';
import { LambdaPowertoolsLayer } from 'cdk-lambda-powertools-python-layer';
import { Construct } from 'constructs';

interface LayerProps {
  dataBase: DatabaseInstance;
}
export class Layer extends Construct {
  public powerToolsLayer: LambdaPowertoolsLayer;
  public lambdaRole: Role;

  constructor(scope: Construct, id: string, props: LayerProps) {
    super(scope, id);

    this.lambdaRole = new Role(this, 'lambdaRole', {
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

    this.powerToolsLayer = new LambdaPowertoolsLayer(this, 'PowerToolsLayer', {
      version: '1.22.0',
      includeExtras: true,
    });
  }
}
