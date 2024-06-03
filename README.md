## Deploy CDK

```
yarn launch
```

## Destroy CDK

```
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

We will be using this infrastructure for our EC2 instance, RDS database, and Lambda functions.

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

## EC2 Instance

In order to interact with the PostgreSQL database, we will be creating an EC2 instance that is able to connect to the database.

```typescript
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
        InitCommand.shellCommand('amazon-linux-extras install postgresql15'),
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
```

This instance will be created in the same `PRIVATE_WITH_EGRESS` SubnetType that the AWS Lambda Functions are created in. This will allow us to install the [`psql` client](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ConnectToPostgreSQLInstance.html#USER_ConnectToPostgreSQLInstance.psql) and connect to the database. This instance can be used only as needed and stopped when not needed to reduce EC2 costs.

From the EC2 Console, you can Connect to the instance.

![EC2Instance](/images/blog/RDS-EC2Instance.png)

### Secret Manager

In order to connect to the PostgreSQL database, you will need the `hostname`, `username`, and `password`. These have been automatically generated for you and stored in [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/).

![SecretManger](/images/blog/RDS-SecretManager.png)

Once connected to the the EC2 Instance, using [AWS Session Manger](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html) you can connect to the RDS database using `psql`.

```bash
psql -h host -p 5432 -U postgres postgres
```

In this example, replace `host` with the value from the Secrets.

![Secrets](/images/blog/RDS-Secrets.png)

At the prompt, enter the `password` from the Secrets.

### PostgreSQL Verification

From the prompt, verify that the table has been created:

```sql
\dt+
```

Output:

```
                      List of relations
 Schema |  Name   | Type  |  Owner   |  Size   | Description
--------+---------+-------+----------+---------+-------------
 public | queries | table | postgres | 0 bytes |
```

However, nothing has been created in the table yet:

```sql
SELECT * FROM queries;
```

Output:

```
 id | query_date
----+------------
(0 rows)
```

### Writing Data

To write data to the PostgreSQL database, you can wait for the EventBridge scheduled rule to trigger the AWS Lambda Function, or you can test the function manually. Once run, the AWS Lambda function should write a single record to the file that can be seen by using:

```SQL
SELECT * FROM queries;
```

With expected output similar to:

```
 id | query_date
----+------------
  1 | 2022-11-07
(1 row)
```

## Conclusion

You should now have an Amazon RDS database deployed to an isolated subnet that is able to be used by both an EC2 Instance and AWS Lambda function. This will allow you to update and interact with the PostgreSQL database while ensuring that it is in an isolated subnet. In future posts, we will explore how this database can be used with Amazon Quicksight to create customized reports and dashboards.
