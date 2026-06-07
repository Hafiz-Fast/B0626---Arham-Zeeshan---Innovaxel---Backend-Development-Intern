from django.urls import path
from . import views

urlpatterns = [
    path('', views.ViewEvents, name='view-events'),
    path('create-event/', views.CreateEvent, name='create-event'),
    path('register-event/', views.RegisterEvent, name='register-event'),
    path('registrations/', views.ViewRegistrations, name='view-registrations'),
    path('registrations/<int:id>/', views.CancelRegistration, name='cancel-registration'),
]