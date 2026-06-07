from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Event, User, Register
from .serializers import EventSR, UserSR, RegisterSR
from django.db.models import Count, F
from django.db import transaction
from django.utils import timezone

def index():
    return('Hello From EventAPI')

@api_view(['POST'])
def CreateEvent(requst):
    serializer = EventSR(data=requst.data)

    if serializer.is_valid():
        serializer.save()
        return Response('Event Created Successfuly', status=201)
    
    return Response(serializer.errors, status=400)

@api_view(['POST'])
def RegisterEvent(request):
    user_name = request.data.get('UserName', '').strip()
    event_id = request.data.get('RegisteredEvent')

    with transaction.atomic():
        # Find or Create the user by name
        user, _ = User.objects.get_or_create(Name=user_name)

        try:
            locked_event = Event.objects.select_for_update().get(pk=event_id)
        except Event.DoesNotExist:
            return Response({'RegisteredEvent': ['Event not found.']}, status=404)

        current_registrations = Register.objects.select_for_update().filter(RegisteredEvent=locked_event).count()

        if current_registrations >= locked_event.TotalSeats:
            return Response('Sorry! Seats are full for this event', status=400)

        if Register.objects.filter(
            RegisteredUser=user,
            RegisteredEvent=locked_event
        ).exists():
            return Response('User has already Registered for this Event', status=400)

        Register.objects.create(
            RegisteredUser=user,
            RegisteredEvent=locked_event,
            TimeStamp=timezone.now().time()
        )

    return Response('Event Registration Successful', status=201)

@api_view(['GET'])
def ViewEvents(request):
    Events = Event.objects.annotate(                 # Annotate is clean way of using Database operations through ORM
        RegisteredSeats = Count('register'),         # register points towards Event Entries in Register Table
        AvailableSeats = F('TotalSeats') - Count('register')
    )

    # Filtering Upcoming Events only
    UpcomingFlag = request.GET.get('upcoming')
    if UpcomingFlag and UpcomingFlag.lower() == 'true':
        Events = Events.filter(EventDate__gt=timezone.now())           # EventDate__gt = Greater than timezone
    
    # Sorting by Date
    SortFlag = request.GET.get('sort')
    if SortFlag and SortFlag.lower() == 'true':
        Events = Events.order_by('EventDate')
    
    data = []

    for event in Events:
        data.append({
            'id': event.id,
            'Name': event.Name,
            'EventDate': event.EventDate,
            'TotalSeats': event.TotalSeats,
            'TotalRegistrations': event.RegisteredSeats,
            'AvailableSeats': event.AvailableSeats
        })
    
    if len(data) == 0:
        return Response('No Events Available Right Now', status=404)
    
    return Response(data, status=200)

@api_view(['DELETE'])
def CancelRegistration(request, id):
    try:
        Registered = Register.objects.get(id=id)

        Registered.delete()

        return Response('Registration Cancelled Successfully', status=200)
    
    except Register.DoesNotExist:
        return Response('Deletion unsuccessful as Record not found', status=404)

@api_view(['GET'])
def ViewRegistrations(requset):
    Registrations = Register.objects.all()

    if len(Registrations) == 0:
        return Response('No Active Registrations', status=404)

    data = []
    for reg in Registrations:
        data.append({
            'id': reg.id,
            'RegisteredUser': reg.RegisteredUser.id,
            'UserName': reg.RegisteredUser.Name,
            'RegisteredEvent': reg.RegisteredEvent.id,
            'EventName': reg.RegisteredEvent.Name,
            'EventDate': reg.RegisteredEvent.EventDate,
            'TimeStamp': reg.TimeStamp,
        })

    return Response(data, status=200)
