# Text XBlock – Dev Setup and Tutor Deployment

## Text XBlock – Dev Setup

### Create a directory for XBlock development

- mkdir xblock_development
- cd xblock_development

### Create and Activate a Virtual Environment

- virtualenv xblock-env
- xblock-env\Scripts\activate

### Clone the XBlock SDK Repository

- git clone https://github.com/openedx/xblock-sdk.git
- cd xblock-sdk

### Create an Empty Folder for Additional Files

- mkdir var

### Install SDK Requirements

- make install

### Create XBlock Skeleton Files

- python xblock-sdk/bin/workbench-make-xblock
- Short name: textxblock
- Class name: TextXBlock

### Install the XBlock

- python xblock-sdk/manage.py migrate

### Run the XBlock SDK Server

- python xblock-sdk/manage.py runserver
- Access the server at: http://localhost:8000

## Text XBlock – Tutor Deployment

### Dependencies

#### XBlock Dependencies

- None

#### Plugin Dependencies

- Redis >= 4.0.0
- Django >= 1.11

### Modify Tutor Configuration Files

#### 1 - lms.env.yml and cms.env.yml

```Change celery broker to rabbitmq in lms.env.yml and cms.env.yml files
Location:
C:\Users\Username\AppData\Local\tutor\tutor\env\apps\openedx\config
CELERY_BROKER_TRANSPORT: "amqp"
CELERY_BROKER_HOSTNAME: "rabbitmq"
CELERY_BROKER_VHOST: "/"
CELERY_BROKER_USER: "guest"
CELERY_BROKER_PASSWORD: "guest"
```

> These Celery broker settings are used for background task handling. The plugin listens for messages from the grader service via RabbitMQ. Once grading is done, it sends a response back, allowing the plugin to update the XBlock accordingly

#### 2 - Install TextXBlock and Plugin in tutor environment

```
XBlock and Plugin installation configuration
To install and enable XBlock and Plugin:
1. Edit C:\Users\Username\AppData\Local\tutor\tutor\config.yml.
2. Add XBlock's Git and Plugin's git repository URL:
OPENEDX_EXTRA_PIP_REQUIREMENTS:
- <XBlock Git Repo URL>
- <Plugin Git Repo URL>
3. Enable the XBlock:
LMS_ADVANCED_COMPONENTS: - textxblock
CMS_ADVANCED_COMPONENTS: - textxblock
4. Rebuild Open edX: tutor images build openedx --no-cache
5. Running the Application: tutor local start
```

> This setup allows you to add a custom XBlock and its plugin to Open edX. By updating the config.yml and enabling the XBlock in LMS and CMS, the platform will load the new components after rebuilding and starting the Tutor instance.
