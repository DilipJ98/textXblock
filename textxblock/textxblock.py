"""TO-DO: Write a description of what this XBlock is."""

from importlib.resources import files

from web_fragments.fragment import Fragment
from xblock.core import XBlock
from xblock.fields import Integer, Scope, String
from .tasks import task_method
import requests
import time
from celery.result import AsyncResult
import sqlite3



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

    score = Integer(
        default = 0,
        scope = Scope.user_state,
        help = " the learner score"
    )

    code_results = String(
        default= None,
        scope= Scope.user_state,
        help= "the code results"
    )

    #using these attributes instead of database
    vertical_block_id = String(
        default= None,
        scope= Scope.settings,
        help= "the id of xblock instance"            
    ) 


    task_Id = String(
        default= None,
        scope= Scope.user_state,
        help= "task id for the user submission"            
    ) 

    input_code = String(
        default= None,
        scope= Scope.user_state,
        help= "Input of the user code"
    )

    status = Integer(
        default= 0,
        scope= Scope.user_state,
        help= "the status code"
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
    def question_data(self, data, suffix=''):
        """Handler to save the question data."""
        self.question = data['question_text']
        self.explanation = data['explanation']
        self.actual_answer = data['ans']
        return {"question": self.question}


    #@XBlock.json_handler
    def verify_answer(self, data):
        self.answer = data['answer_text']
        # matching actual and user input answer
        if self.answer == self.actual_answer:
            #providing values for correct answer
            self.score = 1.0
            status = 200
        else:
            self.score = 0
            status = 400
        self.runtime.publish(self, "grade", {"value":self.score, "max_value" : 1.0})
        self.save()
        return {
            "status": status,
            "score": self.score,
            "explanation": self.explanation,
            "answer": self.actual_answer
        }

        
    @XBlock.json_handler
    def get_question_data(self, data, suffix=''):
        return {"question": self.question, "answer": self.actual_answer, "explanation": self.explanation}



    @XBlock.json_handler
    def handle_task_method(self, data, suffix=''):
        # db_path = "/openedx/my_database.db" 
        # connection = sqlite3.connect(db_path)
        # cursor = connection.cursor()
        xblock_data = str(self.scope_ids)
        block_location_id = xblock_data.split("'")[-2]
        result = task_method.delay(data['user_input'], block_location_id )
        #cursor.execute('select * from user where xblock_id = ?', (block_location_id,))
        #block_id_db_check = cursor.fetchone()
        # if block_id_db_check is None:
        #     cursor.execute('''
        #         INSERT INTO user (xblock_id, task_id, code, code_result)
        #         VALUES (?, ?, ?, ?);
        #     ''', (block_location_id, result.id, data['user_input'], 0))
        # else:
        #     cursor.execute('''UPDATE user SET task_id = ?, code = ?, code_result = ? WHERE xblock_id = ?; ''', (result.id, data['user_input'], 0, block_location_id))
        # connection.commit()
        # connection.close()
        self.vertical_block_id = block_location_id
        self.input_code = data['user_input']
        self.task_Id = result.id
        self.score = 0
        self.code_results = None
        self.status = 0
        self.save()
        return {'taskid' : result.id, "test": block_location_id}    
    

    @XBlock.json_handler
    def get_task_result(self, data, suffix=''):
        # db_path = "/openedx/my_database.db"
        # connection = sqlite3.connect(db_path)
        # cursor = connection.cursor()
        result = AsyncResult(data['id'])
        #xblock_data = str(self.scope_ids)
        #block_location_id = xblock_data.split("'")[-2]
        if result.ready():
            # cursor.execute('select * from user where xblock_id = ?', (block_location_id,))
            # fetched_data = cursor.fetchone()
            if result.get()['isSuccess'] == 200:
                self.score = 1
                self.status = 200
                self.code_results = 'success'
                # if fetched_data is not None:
                #     cursor.execute('''UPDATE user SET code_result = ? WHERE xblock_id = ?; ''', ( 1, block_location_id))
                #     connection.commit()
            elif result.get()['isSuccess'] == 400:
                self.score = 0
                self.status = 400
                self.code_results = 'fail'
            self.runtime.publish(self, "grade", {"value":self.score, "max_value" : 1.0})
            self.save()
            #connection.close()
            return {    
                "status": self.status,
                "score": self.score,
                "explanation": self.explanation,
                "answer": self.actual_answer,
                #"data": fetched_data
                "taskId" : self.task_Id,
                "xblockId" : self.vertical_block_id,
                "code" : self.input_code,
                "codeResults" : self.code_results
            }
        
        else:
            # cursor.execute("select * from user where xblock_id = ?", (block_location_id,))
            # fetched_data = cursor.fetchone()
            # connection.close()
            return{
                'status': 'pending',
                #'data' : fetched_data

            }
    
    @XBlock.json_handler
    def on_page_load_check(self, data, suffix=''):
        xblock_data = str(self.scope_ids)
        block_location_id = xblock_data.split("'")[-2]
        if block_location_id == self.vertical_block_id:

            return {
                "status": self.status,
                "score": self.score,
                "explanation": self.explanation,
                "answer": self.actual_answer,
                #"data": fetched_data
                "taskId" : self.task_Id,
                "xblockId" : self.vertical_block_id,
                "code" : self.input_code,
                "codeResults" : self.code_results
            }
        else:
            return {
                "status": self.status
            }


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

        
