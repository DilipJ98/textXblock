"""TO-DO: Write a description of what this XBlock is."""

from importlib.resources import files

from web_fragments.fragment import Fragment
from xblock.core import XBlock
from xblock.fields import Integer, Scope, String
from .tasks import task_method
import requests
import time
from celery.result import AsyncResult


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
        default= "code resulst",
        scope= Scope.user_state,
        help= "the code results"
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
        result = task_method.delay(data['user_input'])
        return {'taskid' : result.id}    
    
    @XBlock.json_handler
    def get_task_result(self, data, suffix=''):
        result = AsyncResult(data['id'])
        if result.ready():
            if result.get()['isSuccess'] == 200:
                self.score = 1
                status = 200
                self.code_results = 'success'
            elif result.get()['isSuccess'] == 400:
                self.score = 0
                status = 400
                self.code_results = 'fail'
            self.runtime.publish(self, "grade", {"value":self.score, "max_value" : 1.0})
            self.save()
            return {
                "status": status,
                "score": self.score,
                "explanation": self.explanation,
                "answer": self.actual_answer
            }
        else:
            return{
                'status': 'pending',
            }
        

    @XBlock.json_handler
    def get_task_details(self, data, suffix=''):
        return {
            'code': self.answer,
            'results': self.code_results,
            'id': self.scope_ids.usage_id
            
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

        
