from django.db import models

class Event(models.Model):
    Name = models.CharField(max_length=500, unique=True)
    TotalSeats = models.PositiveIntegerField(default=0)
    EventDate = models.DateTimeField()

class User(models.Model):
    Name = models.CharField(max_length=500)

class Register(models.Model):
    RegisteredUser = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )
    RegisteredEvent = models.ForeignKey(
        Event,
        on_delete=models.CASCADE                    # To make sure when an event is deleted, its registrations are also deleted
    )
    TimeStamp = models.TimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(                # So that a user can register to an event once
                fields=['RegisteredUser', 'RegisteredEvent'],
                name='register_once_constraint'
            )
        ]