from rest_framework import serializers
from .models import Event, User, Register
from django.utils import timezone

class EventSR(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = '__all__'

    def validate_TotalSeats(self, value):
        if value <= 0:
            raise serializers.ValidationError('Total Seats must be greater than 0')
        return value
    
    def validate_EventDate(self, value):
        if value.date() <= timezone.now().date():
            raise serializers.ValidationError('Event Date must be in the Future')
        return value

class UserSR(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class RegisterSR(serializers.ModelSerializer):
    class Meta:
        model = Register
        fields = '__all__'

    def validate_RegisteredEvent(self, value):
        RegisteredSeats = value.register_set.count()            # Total entries in Register Table for that Event

        if RegisteredSeats >= value.TotalSeats:
            raise serializers.ValidationError('Sorry! Seats are full for this event')
        return value
        
    def validate(self, data):
        # Prevent Duplicate Registrations
        user = data['RegisteredUser']
        event = data['RegisteredEvent']

        if Register.objects.filter(
            RegisteredUser = user,
            RegisteredEvent = event
        ).exists():
            raise serializers.ValidationError('User has already Registered for this Event')
        return data