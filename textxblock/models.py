from django.db import models

class Employee(models.Model):
    sno = models.AutoField(primary_key=True)  # Automatically increments the serial number
    name = models.CharField(max_length=255)   # Field for the name
    role = models.CharField(max_length=255)   # Field for the role
    
    def __str__(self):
        return f'{self.name} ({self.role})'
