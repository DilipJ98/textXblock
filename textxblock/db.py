import sqlite3

db_path = "/openedx/my_database.db" 

connection = sqlite3.connect(db_path)
cursor = connection.cursor()

