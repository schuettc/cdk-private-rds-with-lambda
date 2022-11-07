import os
import datetime
import json
import psycopg2
from aws_lambda_powertools.utilities import parameters

SECRET = json.loads(parameters.get_secret(os.environ.get("RDS_SECRET_NAME")))


def write_data():
    print("writing data")
    connection = psycopg2.connect(
        database=SECRET.get("engine"),
        user=SECRET.get("username"),
        password=SECRET.get("password"),
        host=SECRET.get("host"),
        port="5432",
    )

    cursor = connection.cursor()
    try:
        postgres_insert_query = """ INSERT INTO queries (
            query_date
        )
        VALUES (%s)"""
        print(postgres_insert_query)
        record_to_insert = (datetime.datetime.now(),)
        print(record_to_insert)
        cursor.execute(postgres_insert_query, record_to_insert)
        connection.commit()

    except (Exception, psycopg2.Error) as error:
        print("Failed to insert record into mobile table", error)

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
