import os
import json
import boto3
import psycopg2
from aws_lambda_powertools.utilities import parameters


SECRET = json.loads(parameters.get_secret(os.environ.get("RDS_SECRET_NAME")))

connection = psycopg2.connect(
    database=SECRET.get("engine"),
    user=SECRET.get("username"),
    password=SECRET.get("password"),
    host=SECRET.get("host"),
    port="5432",
)

cursor = connection.cursor()


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
