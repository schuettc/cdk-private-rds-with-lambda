## Architecture

This project sets up a secure PostgreSQL RDS instance inside an isolated VPC subnet. To interact with it without public access or needing an EC2 bastion host, we deploy an AWS Lambda function running in the same VPC that connects using RDS IAM Authentication.

## Deploy CDK

Ensure you are logged into AWS and have the necessary credentials configured. 

Install dependencies:
```bash
yarn install
```

Deploy the stack:
```bash
yarn cdk deploy --require-approval never
```

## Destroy CDK

```bash
yarn cdk destroy
```

## VPC - Virtual Private Cloud

The first Construct built in this CDK is the Amazon Virtual Private Cloud (VPC). This will lay the foundation for future networking and placement of infrastructure.

```typescript
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
```

We will be building a VPC with three SubnetTypes. This Construct will build a complete VPC infrastructure, including:

- Multi-AZ Subnets
- Route Tables
- Security Groups
- Internet Gateway
- NAT Gateway

We will be using this infrastructure for our RDS database and Lambda functions.

## PostgreSQL RDS Database

Once the VPC is created, we will be creating an RDS Database within it. In this example, we will be creating a PostgreSQL database.

```typescript
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
```

Because we use `vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED }` this RDS instance will be created in a [subnet](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SubnetType.html#private_isolated) that does not route traffic to the Internet. To connect to this RDS database, we will have to create resources within the VPC that can connect to it.

## Database Initializer Custom Resource

Once the PostgreSQL database has been created, we need to initialize it. This will be done using a Custom Resource during the deployment of the CDK. This Custom Resource will be an AWS Lambda function that creates a table. This AWS Lambda Function must be created in the same VPC as the RDS database.

```typescript
const initializeLambda = new Function(this, 'InitializeTableLambda', {
  code: Code.fromAsset(path.join(__dirname, 'resources/initialize_lambda'), {
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
  layers: [props.powerToolsLayer],
  role: props.role,
  handler: 'index.handler',
  timeout: Duration.minutes(5),
  environment: {
    RDS_SECRET_NAME: props.dataBase.secret?.secretName!,
  },
});
```

This AWS Lambda Function will be used by the Custom Resource to initialize the PostgreSQL database during the creation of the CDK.

### Database Initializer Function

```python
def create_table():
    create_table = """CREATE TABLE queries(
            id SERIAL PRIMARY KEY,
            query_date DATE
            )
            """
    try:
        cursor.execute(create_table)
        cursor.close()
        connection.commit()
    except (Exception, psycopg2.DatabaseError) as error:
        print(error)
    finally:
        if connection is not None:
            connection.close()
```

When this AWS Lambda Function is called during the deployment of the CDK, we will create a table with two columns: `id` and `query_date`. These columns will be used by the recurring Query function to populate the RDS database.

It is deployed to a private isolated subnet, so it is not accessible from the internet. Access is restricted to resources within the VPC, such as the Lambda functions.

### Secret Manager

### IAM Authentication

The Lambda functions use IAM Database Authentication to connect to RDS. This eliminates the need for hardcoded passwords or retrieving secrets at runtime. The `QueryLambda` generates an IAM auth token using `boto3` and uses it to connect securely.

### Connecting Without EC2

Since there is no public access or EC2 bastion host, all interactions with the database are handled programmatically through Lambda functions within the VPC using IAM authentication.

## Conclusion

You should now have an Amazon RDS database deployed to an isolated subnet that is accessible by AWS Lambda functions using secure IAM Authentication. This architecture avoids the need for public subnets or managing EC2 bastion hosts while remaining highly secure.
