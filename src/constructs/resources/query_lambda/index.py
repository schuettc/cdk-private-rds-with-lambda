import os
import datetime
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


def write_data():
    print("writing data")
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

        postgres_insert_query = """
            INSERT INTO queries (
                query_date
            )
            VALUES (%s)
        """
        print(postgres_insert_query)

        record_to_insert = (datetime.datetime.now(),)
        print(record_to_insert)

        cursor.execute(postgres_insert_query, record_to_insert)
        connection.commit()
        print("Record inserted successfully")
    except (Exception, psycopg2.Error) as error:
        print(f"Failed to insert record into queries table: {error}")
    finally:
        if connection:
            cursor.close()
            connection.close()
            print("PostgreSQL connection is closed")


def handler(event, context):
    print(event)
    try:
        write_data()
        return True
    except Exception as err:
        print(f"Error: {err}")
        return False
