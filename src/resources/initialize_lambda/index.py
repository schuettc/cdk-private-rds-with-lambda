import os
import json
import boto3
import psycopg2


def get_secret(secret_name):
    session = boto3.Session()
    secrets_manager = session.client("secretsmanager")
    try:
        get_secret_value_response = secrets_manager.get_secret_value(
            SecretId=secret_name
        )
    except Exception as e:
        raise e
    else:
        if "SecretString" in get_secret_value_response:
            secret = get_secret_value_response["SecretString"]
            return json.loads(secret)
        else:
            raise ValueError("Unsupported secret type")


SECRET = get_secret(os.environ.get("RDS_SECRET_NAME"))


def create_table():
    connection = None
    try:
        connection = psycopg2.connect(
            database=SECRET.get("engine"),
            user=SECRET.get("username"),
            password=SECRET.get("password"),
            host=SECRET.get("host"),
            port="5432",
        )
        cursor = connection.cursor()

        create_table = """
            CREATE TABLE IF NOT EXISTS queries (
                id SERIAL PRIMARY KEY,
                query_date DATE
            )
        """

        cursor.execute(create_table)
        connection.commit()
        print("Table created successfully")
    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Error creating table: {error}")
    finally:
        if connection is not None:
            cursor.close()
            connection.close()


def on_create(event):
    create_table()
    physical_id = "CreateTable"
    return {"PhysicalResourceId": physical_id}


def on_update(event):
    print("NoOp on Update")


def on_delete(event):
    print("NoOp on Delete")


def handler(event, context):
    print(event)
    request_type = event["RequestType"]
    if request_type == "Create":
        return on_create(event)
    if request_type == "Update":
        return on_update(event)
    if request_type == "Delete":
        return on_delete(event)
    raise Exception(f"Invalid request type: {request_type}")
