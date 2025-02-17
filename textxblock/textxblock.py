"""TO-DO: Write a description of what this XBlock is."""

from importlib.resources import files

from web_fragments.fragment import Fragment
from xblock.core import XBlock
from xblock.fields import Integer, Scope, String, Boolean
from .tasks import task_method
from datetime import datetime, timezone
from celery.result import AsyncResult
import psycopg2
import os
from webob import Response
import json
import redis
import uuid
from lms.djangoapps.courseware.models import StudentModule
from lms.djangoapps.courseware.user_state_client import XBlockUserStateClient
from opaque_keys.edx.keys import UsageKey
import traceback
from django.contrib.auth.models import User


@XBlock.needs('user')
class TextXBlock(XBlock):
    """
    TO-DO: document what your XBlock does.
    """
    has_score = True

    # TO-DO: delete count, and define your own fields.
    question = String (
        default = "",
        scope =  Scope.content,
        help = "The question to be asked"
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
        default=0,
        scope= Scope.content,
        help= "marks assigned by admin to each question"
    )

    language = String(
        default="java",
        scope= Scope.content,
        help= "language for monaco editor"
    )


    code_results = String(
        default= "",
        scope= Scope.user_state,
        help= "the code results"
    )

    file_name = String(
        default= "",
        scope= Scope.content,
        help= "file name"
    )

    execution_mode = String(
        default= "",
        scope= Scope.content,
        help= "execution mode"
    )

    expected_output = Integer(
        default= 0,
        scope= Scope.content,
        help= "expected output"
    )

    solution_repo = String(
        default= None,
        scope= Scope.content,
        help= "solution repo"
    )
    
    time_stamp = String(
        default= None,
        scope= Scope.user_state,
        help= "time stamp of the initial load"
    )

    student_input_code = String(
        default= "",
        scope= Scope.user_state,
        help= "student input code"
    )

    score = Integer(
        default = 0,
        scope = Scope.user_state,
        help = " the learner score"
    )

    is_correct = Boolean(
        default= False,
        scope= Scope.user_state,
        help= "is the answer correct or not"
    )

    message = String(
        default= "",
        scope= Scope.user_state,
        help= "message to the user"    
    )


    DATABASE = {
        "host": os.getenv("DATABASE_HOST"),
        "port": os.getenv("DATABASE_PORT"),
        "dbname": os.getenv("DATABASE_NAME"),
        "user": os.getenv("DATABASE_USER"),
        "password": os.getenv("DATABASE_PASSWORD"),
    }
        

    @XBlock.json_handler 
    def get_user_state_details_from_db(self, data, suffix=''):
        xblock_instance_data = str(self.scope_ids)
        # block_location_id = xblock_instance_data.split("'")[-2]
        block_location_id = str(self.scope_ids.usage_id)
        try:
            usage_key = UsageKey.from_string(block_location_id)
            updated_student_module = StudentModule.objects.get(student_id=self.scope_ids.user_id, module_state_key=usage_key)
            updated_state = json.loads(updated_student_module.state)
            
            print(updated_state.get('score'), updated_state.get('is_correct'), updated_state.get('message'), "user details fetched from db#####################")
            #assigning the values to the user state fields from student module    
            self.score = updated_state.get('score')
            self.is_correct = updated_state.get('is_correct')
            self.message = updated_state.get('message')            
            self.save()
            print(self.score, self.is_correct, self.message, "user details fetched and assigned from db#####################")
            #grading based on score
            #self.runtime.publish(self, "grade", {"value": self.score, "max_value": self.marks})
            print("grading based on score")

        except Exception as e:
            print(type(e), e)
            traceback.print_exc()
            return None
        return {"score": self.score, 'is_correct': self.is_correct, 'message': self.message}


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
        self.question = data['questionText']
        self.explanation = data['explanation']
        self.actual_answer = data['ans']
        self.boilerplate_code = data['boilerplate']
        self.language = data['language']
        self.marks = data['marks']
        self.file_name = data['fileName']
        self.execution_mode = data['executionMode']
        self.solution_repo = data['solutionRepo']
        self.expected_output = data['expectedOutput']
        self.save()
        return {
            "question": self.question,
            "answer": self.actual_answer,
            "explanation": self.explanation ,
            'boilerplate' : self.boilerplate_code,
            'language' : self.language,
            'marks' : self.marks,
            'fileName' : self.file_name,
            'executionMode' : self.execution_mode,
            'solutionRepo' : self.solution_repo,
            'expectedOutput' : self.expected_output
        }

        
    @XBlock.json_handler
    def get_admin_input_data(self, data, suffix=''):
        return {
            "question": self.question,
            "answer": self.actual_answer,
            'boilerplate' : self.boilerplate_code,
            "explanation": self.explanation ,
            'language' : self.language,
            'marks' : self.marks,
            'fileName' : self.file_name,
            'executionMode' : self.execution_mode,
            'solutionRepo' : self.solution_repo,
            'expectedOutput' : self.expected_output
        }

    @XBlock.json_handler
    def get_time_stamp(self, data, suffix=''):
        return {"time_stamp": self.time_stamp}
    

    def get_admin_data(self):
        return {
            'programming_language' : self.language,
            'marks' : self.marks,
            'file_name' : self.file_name,
            'execution_mode' : self.execution_mode,
            'solution_repo' : self.solution_repo,
            'expected_output' : self.expected_output
        }

    redis_client = redis.StrictRedis(host='host.docker.internal', port=6379, db=0, decode_responses=True)
    #this will be executed if the user clicks on run button or user submits code
    @XBlock.json_handler
    def handle_task_method(self, data, suffix=''):
        cursor, connection = self.database_connection_fun()
        xblock_instance_data = str(self.scope_ids)
        block_location_id = str(self.scope_ids.usage_id) #xblock_instance_data.split("'")[-2]
        student_id = str(self.scope_ids.user_id) 
        user_service = self.runtime.service(self, 'user')
        current_user = user_service.get_current_user()
        student_name = current_user.opt_attrs.get("edx-platform.username", None)

        data_dict = self.get_admin_data()
        data_dict['student_id'] = student_id
        data_dict['student_name'] = student_name
        data_dict['student_code'] = data['user_input']
        data_dict['submitted_time'] = datetime.now(timezone.utc).isoformat()
        data_dict['usage_key'] = block_location_id
         
        #for redis and uuids
        submission_id = str(uuid.uuid4())
        self.redis_client.hset(submission_id, mapping={"usage_key": block_location_id, "student_id": student_id})
        self.redis_client.expire(submission_id, 900)# here the time is set to 15 minutes before expiry

        #saving the student input code into the field
        self.student_input_code = data['user_input']

        # resetting previous values of score, message, is_correct
        self.score = 0
        self.message = ""
        self.is_correct = False
        self.save()
        print(self.score, self.message, "user details resetted#####################")

        #reassigning grades with initial score
        # usage_key = UsageKey.from_string(block_location_id)
        # student = User.objects.get(id=student_id)
        # student_module, created = StudentModule.objects.update_or_create(
        #     student=student,
        #     module_state_key=usage_key,  
        #     defaults={
        #         "grade": 0,           
        #         "max_grade": 10    
        #     })
        
        #self.runtime.publish(self, "grade", {"value": self.score, "max_value": self.marks})
        print("assigned initial grades#####################")

        celery_task_id = task_method.delay(data_dict, submission_id)
        if cursor:
            try:
                #it checks if there is nay related data to this xblock id and userid
                cursor.execute('select * from xblockdata where xblock_id = %s and user_id = %s', (block_location_id, student_id))
                block_id_db_check = cursor.fetchone()
                #if there is not data available in db it will insert data into databse with input details
                if block_id_db_check is None:
                    cursor.execute('''
                        INSERT INTO xblockdata (user_id, xblock_id, task_id, code, code_result)
                        VALUES (%s, %s, %s, %s, %s);
                    ''', (student_id, block_location_id, celery_task_id.id, data['user_input'], 0))
                else:
                #if the data is already exist related to xblock id and user id it will simply updates the exisint data
                #so that it will always have latest submission code details
                    cursor.execute('''UPDATE xblockdata SET task_id = %s, code = %s, code_result = %s WHERE xblock_id = %s AND user_id = %s; ''', (celery_task_id.id, data['user_input'], 0, block_location_id, student_id))
                connection.commit()
                #returning celery task id to frontend so that it makes polling to check the celery task results
                return {'taskid' : celery_task_id.id, "test": block_location_id}    
            except Exception as e:
                print("error while executing query", e)
                return {'status': 500, 'error': str(e)}
            finally:
                if cursor:
                    cursor.close()
                if connection:
                    connection.close()
    
    #which will be called with task id to check the status of the celry
    @XBlock.json_handler
    def get_task_result(self, data, suffix=''):
        return self.fetch_task_result(data['id'])


    #this will be trigered on page initial load to check is there any exsiting data to show the user
    @XBlock.json_handler
    def on_intial_load(self, data, suffix=''): 
        cursor, connection = self.database_connection_fun()
        #extract xblock id and user id
        xblock_instance_data = str(self.scope_ids)
        block_location_id = str(self.scope_ids.usage_id) #xblock_instance_data.split("'")[-2]
        user_id = str(self.scope_ids.user_id)
        
        if self.time_stamp is None:
            self.time_stamp = datetime.now(timezone.utc).isoformat()
            self.save()

        if cursor:
            try:
                #checks if there is any data matches with the xblock and user id in database 
                cursor.execute('select * from xblockdata where xblock_id = %s and user_id = %s', (block_location_id, user_id))
                fetched_data = cursor.fetchone()
                if fetched_data is not None:
                    task_id = fetched_data[3]
                    return self.fetch_task_result(task_id)
                else:
                    #if there no data found related to xblock id and userid
                    return {'status': 'not found', 'data': None}
            except Exception as e:
                print("error while executing query on initail load", e)
                return {'status': 500, 'error': str(e)}

            finally:
                if cursor:
                    cursor.close()
                if connection:
                    connection.close()

    #this will check the celery task result
    def fetch_task_result(self, taskId):
        result = AsyncResult(taskId)
        xblock_instance_data = str(self.scope_ids)
        block_location_id = str(self.scope_ids.usage_id) #xblock_instance_data.split("'")[-2]
        user_id = str(self.scope_ids.user_id)
        cursor, connection = self.database_connection_fun()
        
        try:
            if result.ready():
                if cursor:
                    cursor.execute('select * from xblockdata where xblock_id = %s and user_id = %s', (block_location_id, user_id))
                    fetched_data = cursor.fetchone()
                    #checks the results
                    if result.get()['isSuccess'] == 200:
                        #self.score = self.marks
                        status = 200
                        #execute this if the xblock and user id already exist in database
                        if fetched_data is not None:
                            cursor.execute('''UPDATE xblockdata SET code_result = %s WHERE xblock_id = %s AND user_id = %s; ''', (self.score, block_location_id, user_id))
                            connection.commit()
                    #if the user code evaluated to false this will execute
                    elif result.get()['isSuccess'] == 400:
                        #update score if the user code evaluated to wrong
                        #set score to Zero
                        #self.score = 0
                        status = 400
                    #self.save()
                    return {"status": status, "score": self.score, "explanation": self.explanation, "answer": self.actual_answer, "data": fetched_data, "studentInputCode": self.student_input_code, "message": self.message, "isCorrect": self.is_correct}
            else:
                cursor.execute("select * from xblockdata where xblock_id = %s and user_id = %s", (block_location_id, user_id))
                fetched_data = cursor.fetchone()
                return {'status': 'pending', 'data': fetched_data}
        except Exception as e:
            return {'status': 500, 'error': str(e)}
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()
        
    #this will be triggered if user clicks on reset button
    @XBlock.json_handler
    def delete_task(self, data, suffix=''):
        xblock_instance_data = str(self.scope_ids)
        block_location_id = self.scope_ids.usage_id #xblock_instance_data.split("'")[-2]
        user_id = str(self.scope_ids.user_id)        
        cursor, connection = self.database_connection_fun()
        print(self.scope_ids.usage_id, "this is the block id@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@")
        #resetting the student input code to empty string
        self.student_input_code = ""
        self.runtime.publish(self, "grade", {"value":self.score, "max_value" : self.marks})
        self.save()
        
        if cursor:
            try:
                #it checks the xblock id and user id exist in databse
                cursor.execute('select * from xblockdata where xblock_id = %s and user_id = %s', (block_location_id, user_id))
                feteched_data = cursor.fetchone()
                #setting marks to zero if the code is resets
                if feteched_data is not None:
                    self.score = 0
                    self.runtime.publish(self, "grade", {"value":self.score, "max_value" : self.marks})
                    self.save()
                    #delete data from database
                    cursor.execute('delete from xblockdata where xblock_id = %s and user_id = %s', (block_location_id, user_id) )
                    connection.commit()
                    return {"status": "success", "message": "task deleted successfully."}
                else:
                    return {"status": "error", "message": "task not found."}
            except Exception as e:
                print("error while executing query in delete task result")
                return {'status': 500, 'error': str(e)}
            finally:
                if cursor:
                    cursor.close()
                if connection:
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

        
