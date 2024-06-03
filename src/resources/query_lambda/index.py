import os
import datetime
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


def write_data():
    print("writing data")
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
