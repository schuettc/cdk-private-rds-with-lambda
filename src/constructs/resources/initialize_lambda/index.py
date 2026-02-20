import os
import json
import boto3
import psycopg2



def get_auth_token():
    client = boto3.client("rds")
    return client.generate_db_auth_token(
        DBHostname=os.environ.get("DB_HOST"),
        Port=os.environ.get("DB_PORT"),
        DBUsername="postgres",
    )


def create_table():
    connection = None
    try:
        connection = psycopg2.connect(
            database="postgres",
            user="postgres",
            password=get_auth_token(),
            host=os.environ.get("DB_HOST"),
            port=os.environ.get("DB_PORT"),
            sslmode="require",
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
