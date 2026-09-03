from django.urls import path

from . import api

urlpatterns = [
    path("auth/register-organization", api.RegisterOrganizationAPIView.as_view()),
    path("auth/verify-signup-otp", api.VerifySignupOtpAPIView.as_view()),
    path("auth/resend-otp", api.ResendOtpAPIView.as_view()),
    path("auth/login", api.LoginAPIView.as_view()),
    path("auth/logout", api.LogoutAPIView.as_view()),
    path("auth/me", api.MeAPIView.as_view()),
    path("users", api.UserListAPIView.as_view()),
    path("users/invite", api.UserInviteAPIView.as_view()),
    path("users/<int:user_id>/activate", api.UserActivateAPIView.as_view()),
    path("users/<int:user_id>/deactivate", api.UserDeactivateAPIView.as_view()),
    path("users/<int:user_id>/reset-password", api.UserResetPasswordAPIView.as_view()),
]
