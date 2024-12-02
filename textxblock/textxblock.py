"""TO-DO: Write a description of what this XBlock is."""

from importlib.resources import files

from web_fragments.fragment import Fragment
from xblock.core import XBlock
from xblock.fields import Integer, Scope, String
from .tasks import task_method
import requests
import time
from celery.result import AsyncResult
import psycopg2
import os

class TextXBlock(XBlock):
    """
    TO-DO: document what your XBlock does.
    """
    has_score = True

    # TO-DO: delete count, and define your own fields.
    question = String (
        default = "question",
        scope =  Scope.content,
        help = "The question to be asked"
    )

    answer =    String(
        default= "answer",
        scope= Scope.user_state,
        help= "the answer"
    )

    actual_answer = String(
        default = "",
        scope = Scope.content,
        help = "actual answer"
    )

    explanation = String(
        default = "",
        scope = Scope.content,
        help = "explanation"
    )

    boilerplate_code = String(
        default= "",
        scope= Scope.content,
        help= "monaco editor code snippet"
    )

    marks = Integer(
        default=1,
        scope= Scope.content,
        help= "marks assigned by admin to each question"
    )

    language = String(
        default="java",
        scope= Scope.content,
        help= "language for monaco editor"
    )

    score = Integer(
        default = 0,
        scope = Scope.user_state,
        help = " the learner score"
    )

    code_results = String(
        default= "code resulst",
        scope= Scope.user_state,
        help= "the code results"
    )


    DATABASE = {
        "host": os.getenv("DATABASE_HOST"),
        "port": os.getenv("DATABASE_PORT"),
        "dbname": os.getenv("DATABASE_NAME"),
        "user": os.getenv("DATABASE_USER"),
        "password": os.getenv("DATABASE_PASSWORD"),
    }
        
    def database_connection_fun(self):
        try:
            connection = psycopg2.connect(
                host=self.DATABASE["host"],
                port=self.DATABASE["port"],
                dbname=self.DATABASE["dbname"],
                user=self.DATABASE["user"],
                password=self.DATABASE["password"],
        )
            cursor = connection.cursor()
            return cursor, connection
        except Exception as e:
            return None, None


    def resource_string(self, path):
        """Handy helper for getting resources from our kit."""
        return files(__package__).joinpath(path).read_text(encoding="utf-8")

    
    #TO-DO: change this view to display your data your own way.
    def student_view(self, context=None):
        html = self.resource_string("static/html/textxblock.html")
        frag = Fragment(html.format(self=self))
        frag.add_css(self.resource_string("static/css/textxblock.css"))
        frag.add_javascript(self.resource_string("static/js/src/textxblock.js"))
        frag.initialize_js('TextXBlock')
        return frag
            
    def studio_view(self, context=None):        
        html = self.resource_string("static/html/studio.html")
        frag = Fragment(html.format(self=self))
        frag.add_css(self.resource_string("static/css/studio.css"))
        frag.add_javascript(self.resource_string("static/js/src/studio.js"))
        frag.initialize_js('TextXBlock')
        return frag
    
    @XBlock.json_handler
    def save_admin_input_data(self, data, suffix=''):
        """Handler to save the question data."""
        self.question = data['question_text']
        self.explanation = data['explanation']
        self.actual_answer = data['ans']
        self.boilerplate_code = data['boilerplate']
        self.language = data['language']
        self.marks = data['marks']
        self.save()
        return {
            "question": self.question,
            "answer": self.actual_answer,
            "explanation": self.explanation ,
            'boilerplate' : self.boilerplate_code,
            'language' : self.language,
            'marks' : self.marks
        }

        
    @XBlock.json_handler
    def get_admin_input_data(self, data, suffix=''):
        return {
            "question": self.question,
            "answer": self.actual_answer,
            'boilerplate' : self.boilerplate_code,
            "explanation": self.explanation ,
            'language' : self.language
        }


    @XBlock.json_handler
    def handle_task_method(self, data, suffix=''):
        cursor, connection = self.database_connection_fun()
        xblock_instance_data = str(self.scope_ids)
        block_location_id = xblock_instance_data.split("'")[-2]
        user_id = str(self.scope_ids.user_id)
        result = task_method.delay(data['user_input'], block_location_id )
        if cursor:
            try:
                cursor.execute('select * from xblockdata where xblock_id = %s and user_id = %s', (block_location_id, user_id))
                block_id_db_check = cursor.fetchone()
                if block_id_db_check is None:
                    cursor.execute('''
                        INSERT INTO xblockdata (user_id, xblock_id, task_id, code, code_result)
                        VALUES (%s, %s, %s, %s, %s);
                    ''', (user_id, block_location_id, result.id, data['user_input'], 0))
                else:
                    cursor.execute('''UPDATE xblockdata SET task_id = %s, code = %s, code_result = %s WHERE xblock_id = %s AND user_id = %s; ''', (result.id, data['user_input'], 0, block_location_id, user_id))
                connection.commit()
                connection.close()
                return {'taskid' : result.id, "test": block_location_id}    
            except Exception as e:
                print("error while executing query", e)
            finally:
                connection.close()

    @XBlock.json_handler
    def get_task_result(self, data, suffix=''):
        return self.fetch_task_result(data['id'])



    @XBlock.json_handler
    def on_intial_load(self, data, suffix=''): 
        cursor, connection = self.database_connection_fun()
        xblock_instance_data = str(self.scope_ids)
        block_location_id = xblock_instance_data.split("'")[-2]
        user_id = str(self.scope_ids.user_id)
        if cursor:
            try: 
                cursor.execute('select * from xblockdata where xblock_id = %s and user_id = %s', (block_location_id, user_id))
                fetched_data = cursor.fetchone()
                if fetched_data is not None:
                    task_id = fetched_data[3]
                    return self.fetch_task_result(task_id)
                else:
                    return {'status': 'not found', 'data': None}
            except Exception as e:
                print("error while executing query on initail load", e)
            finally:
                connection.close()

    def fetch_task_result(self, taskId):
        result = AsyncResult(taskId)
        xblock_instance_data = str(self.scope_ids)
        block_location_id = xblock_instance_data.split("'")[-2]
        user_id = str(self.scope_ids.user_id)
        cursor, connection = self.database_connection_fun()
        try:
            if result.ready():
                if cursor:
                    cursor.execute('select * from xblockdata where xblock_id = %s and user_id = %s', (block_location_id, user_id))
                    fetched_data = cursor.fetchone()
                    if result.get()['isSuccess'] == 200:
                        self.score = self.marks
                        status = 200
                        self.code_results = 'success'
                        if fetched_data is not None:
                            cursor.execute('''UPDATE xblockdata SET code_result = %s WHERE xblock_id = %s AND user_id = %s; ''', (self.score, block_location_id, user_id))
                            connection.commit()
                    elif result.get()['isSuccess'] == 400:
                        self.score = 0
                        status = 400
                        self.code_results = 'fail'
                    self.runtime.publish(self, "grade", {"value": self.score, "max_value": self.marks})
                    self.save()
                    return {"status": status, "score": self.score, "explanation": self.explanation, "answer": self.actual_answer, "data": fetched_data}
            else:
                cursor.execute("select * from xblockdata where xblock_id = %s and user_id = %s", (block_location_id, user_id))
                fetched_data = cursor.fetchone()
                return {'status': 'pending', 'data': fetched_data}
        except Exception as e:
            return {"status": "error", "message": "An error occurred while fetching the task result."}
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()
        

    @XBlock.json_handler
    def delete_task(self, data, suffix=''):
        xblock_instance_data = str(self.scope_ids)
        block_location_id = xblock_instance_data.split("'")[-2]
        user_id = str(self.scope_ids.user_id)        
        cursor, connection = self.database_connection_fun()
        if cursor:
            try:
                cursor.execute('select * from xblockdata where xblock_id = %s and user_id = %s', (block_location_id, user_id))
                feteched_data = cursor.fetchone()
                if feteched_data is not None:
                    self.score = 0
                    self.runtime.publish(self, "grade", {"value":self.score, "max_value" : self.marks})
                    self.save()
                    cursor.execute('delete from xblockdata where xblock_id = %s and user_id = %s', (block_location_id, user_id) )
                    connection.commit()
                    return {"status": "success", "message": "task deleted successfully."}
                else:
                    return {"status": "error", "message": "task not found."}
            except Exception as e:
                print("error while executing query in delete task result")
            finally:
                connection.close() 


    # TO-DO: change this to create the scenarios you'd like to see in the
    # workbench while developing your XBlock.
    @staticmethod
    def workbench_scenarios():
        """A canned scenario for display in the workbench."""
        return [
            ("TextXBlock - Student view",
             """<textxblock/>
             """),  
            ("Multiple TextXBlock",
             """<vertical_demo>
                <textxblock/>
                <textxblock/>
                <textxblock/>
                </vertical_demo>
             """),
        ]

        
