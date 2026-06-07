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
        validators = []                            # So that instead of default unique constraint message, my custom message is displayed
        extra_kwargs = {
            'TimeStamp': {'read_only': True},
        }

    def validate(self, data):
        user = data['RegisteredUser']
        event = data['RegisteredEvent']

        if Register.objects.filter(
            RegisteredUser=user,
            RegisteredEvent=event
        ).exists():
            raise serializers.ValidationError(
                'User has already Registered for this Event'
            )

        return data

    def create(self, validated_data):
        validated_data.setdefault('TimeStamp', timezone.now().time())

        event = Event.objects.select_for_update().get(
            pk=validated_data['RegisteredEvent'].pk
        )

        registered_seats = Register.objects.select_for_update().filter(
            RegisteredEvent=event
        ).count()

        if registered_seats >= event.TotalSeats:
            raise serializers.ValidationError(
                'Sorry! Seats are full for this event'
            )

        return Register.objects.create(**validated_data)