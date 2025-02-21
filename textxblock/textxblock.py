"""TO-DO: Write a description of what this XBlock is."""

from importlib.resources import files

from web_fragments.fragment import Fragment
from xblock.core import XBlock
from xblock.fields import Integer, Scope, String, Boolean
from .tasks import task_method
from datetime import datetime, timezone
from celery.result import AsyncResult

import os
from webob import Response
import json
#import redis
import uuid
#from lms.djangoapps.courseware.models import StudentModule
#from opaque_keys.edx.keys import UsageKey
import traceback
from django.contrib.auth.models import User
import base64

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

    #redis_client = redis.StrictRedis(host='host.docker.internal', port=6379, db=0, decode_responses=True)
    #this will be executed if the user clicks on run button or user submits code
    @XBlock.json_handler
    def handle_task_method(self, data, suffix=''):
        block_location_id = str(self.scope_ids.usage_id) #xblock_instance_data.split("'")[-2]
        student_id = str(self.scope_ids.user_id) 
        user_service = self.runtime.service(self, 'user')
        current_user = user_service.get_current_user()
        student_name = current_user.opt_attrs.get("edx-platform.username", None)

        data_dict = self.get_admin_data()
        data_dict['student_id'] = student_id
        data_dict['student_name'] = student_name
        encoded_code = base64.b64encode(data['user_input'].encode()).decode()
        data_dict['student_code'] = encoded_code
        data_dict['submitted_time'] = datetime.now(timezone.utc).isoformat()
        data_dict['usage_key'] = block_location_id
         
        #for redis and uuids
        submission_id = str(uuid.uuid4())
        self.redis_client.hset(submission_id, mapping={"usage_key": block_location_id, "student_id": student_id})
        self.redis_client.expire(submission_id, 900)# here the time is set to 15 minutes before expiry

        #saving the student input code into the field
        self.student_input_code = data['user_input']
        
        print(self.score, self.message, self.is_correct, "Before saving")
        # resetting previous values of score, message, is_correct
        self.score = 0
        self.message = ""
        self.is_correct = False
        self.save()

        response = task_method(data_dict, submission_id)
        return {"accepted" : response['isAccepted']}

    
    #which will be called with task id to check the status of the celry
    @XBlock.json_handler
    def get_task_result(self, data, suffix=''):
        return self.fetch_task_result()


    #this will be trigered on page initial load to check is there any exsiting data to show the user
    @XBlock.json_handler
    def on_intial_load(self, data, suffix=''): 
        if self.time_stamp is None:
            self.time_stamp = datetime.now(timezone.utc).isoformat()
            self.save()
        try:
            return self.fetch_task_result()
        except Exception as e:
            return {'status': 500, 'error': str(e)}


    #this will check the celery task result
    def fetch_task_result(self):        
        try:
            if self.message == "":
                print("inside if so message is empty", self.message)
                return {"status" : "pending", "user_code" : self.student_input_code}
            else:
                print("inside else so message is not empty", self.message)
                return {"status" : "ready", "score": self.score, "is_correct": self.is_correct, "message": self.message, "user_code" : self.student_input_code}
        except Exception as e:
            return {'status': "error", 'error': str(e)}

        
    #this will be triggered if user clicks on reset button
    @XBlock.json_handler
    def delete_task(self, data, suffix=''):
        self.student_input_code = ""
        self.score = 0
        self.message = ""
        self.is_correct = False
        self.runtime.publish(self, "grade", {"value":self.score, "max_value" : self.marks})
        self.save()
        return {"status" : "success"}

       
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

        
