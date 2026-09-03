"""
Sidebar nav model - direct port of the ADMIN_NAV/MANAGER_NAV/EMPLOYEE_NAV
arrays, ICONS dict, and resolveHome()/getNavByRoles() logic from
saas-hrms-frontend/app/platform/layout.tsx:15-103. Ported to Python so the
Django template shell can build the sidebar server-side from the logged-in
user's actual roles instead of the client-side fetch-then-branch dance the
React layout did on every navigation.
"""

ADMIN_ROLES = ("Org Admin", "HR Manager")
MANAGER_ROLES = ("Team Lead",)

ICONS = {
    "dashboard": "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    "manager": "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    "me": "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    "employees": "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    "designations": "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    "structure": "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    "users": "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    "attendance": "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    "leave": "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    "holidays": "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
    "payroll": "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
    "recruitment": "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    "performance": "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    "onboarding": "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    "assets": "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    "reports": "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    "accounting": "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z",
    "notif": "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    "ai": "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.636 6.364l-.707-.707M12 21v-1M7.05 7.05l-.707-.707M12 12l3-3",
    "superadmin": "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
    "departments": "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    "offices": "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    "shifts": "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    "leavepolicy": "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 17h.01",
    "legacy_admin": "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    "organization": "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5",
    "signout": "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
}

# label, group per item; href is a Django url-name resolved by the template
ADMIN_NAV = [
    {"href": "core:platform_home", "label": "Dashboard", "icon": ICONS["dashboard"], "group": "Dashboards"},
    {"href": "core:manager_home", "label": "Manager View", "icon": ICONS["manager"], "group": "Dashboards"},
    {"href": "core:me_home", "label": "My Self-Service", "icon": ICONS["me"], "group": "Dashboards"},
    {"href": "people:employee_list", "label": "Employees", "icon": ICONS["employees"], "group": "People"},
    {"href": "organization:department_list", "label": "Departments", "icon": ICONS["departments"], "group": "Masters"},
    {"href": "people_designations:designation_list", "label": "Designations", "icon": ICONS["designations"], "group": "Masters"},
    {"href": "organization:office_list", "label": "Offices", "icon": ICONS["offices"], "group": "Masters"},
    {"href": "attendance:holidays_shifts", "label": "Shifts", "icon": ICONS["shifts"], "group": "Masters"},
    {"href": "leave:home", "qs": "tab=policies", "label": "Leave Policies", "icon": ICONS["leavepolicy"], "group": "Masters"},
    {"href": "attendance:home", "label": "Attendance", "icon": ICONS["attendance"], "group": "Operations"},
    {"href": "leave:home", "label": "Leave", "icon": ICONS["leave"], "group": "Operations"},
    {"href": "payroll:home", "label": "Payroll", "icon": ICONS["payroll"], "group": "Operations"},
    {"href": "recruitment:home", "label": "Recruitment", "icon": ICONS["recruitment"], "group": "Talent"},
    {"href": "performance:home", "label": "Performance", "icon": ICONS["performance"], "group": "Talent"},
    {"href": "onboarding:home", "label": "Onboarding & Exit", "icon": ICONS["onboarding"], "group": "Talent"},
    {"href": "company_assets:home", "label": "Assets", "icon": ICONS["assets"], "group": "Talent"},
    {"href": "reports:home", "label": "Reports", "icon": ICONS["reports"], "group": "Insights"},
    {"href": "payroll_accounting:accounting_integration", "label": "Accounting", "icon": ICONS["accounting"], "group": "Insights"},
    {"href": "communication:notifications", "label": "Notifications", "icon": ICONS["notif"], "group": "Insights"},
    {"href": "ai_billing:home", "label": "AI & Credits", "icon": ICONS["ai"], "group": "Insights"},
]

MANAGER_NAV = [
    {"href": "core:manager_home", "label": "My Team", "icon": ICONS["manager"], "group": "Team"},
    {"href": "core:me_home", "label": "Self-Service", "icon": ICONS["me"], "group": "Team"},
    {"href": "core:profile", "label": "My Profile", "icon": ICONS["me"], "group": "Team"},
    {"href": "attendance:home", "label": "Attendance", "icon": ICONS["attendance"], "group": "Team"},
    {"href": "leave:home", "label": "Leave", "icon": ICONS["leave"], "group": "Team"},
    {"href": "communication:notifications", "label": "Notifications", "icon": ICONS["notif"], "group": "Other"},
]

EMPLOYEE_NAV = [
    {"href": "core:me_home", "label": "My Dashboard", "icon": ICONS["me"], "group": "Self-Service"},
    {"href": "core:profile", "label": "My Profile", "icon": ICONS["me"], "group": "Self-Service"},
    {"href": "attendance:home", "label": "My Attendance", "icon": ICONS["attendance"], "group": "Self-Service"},
    {"href": "leave:home", "label": "My Leave", "icon": ICONS["leave"], "group": "Self-Service"},
    {"href": "communication:notifications", "label": "Notifications", "icon": ICONS["notif"], "group": "Self-Service"},
]

SUPER_ADMIN_NAV = [
    {"href": "platform_admin:super_dashboard", "label": "Dashboard", "icon": ICONS["dashboard"]},
    {"href": "platform_admin:organizations", "label": "Organizations", "icon": ICONS["organization"]},
    {"href": "platform_admin:billing", "label": "Billing", "icon": ICONS["accounting"]},
    {"href": "platform_admin:health", "label": "System Health", "icon": ICONS["performance"]},
    {"href": "platform_legacy:legacy_admin", "label": "Legacy Admin", "icon": ICONS["legacy_admin"]},
]

def resolve_home(roles, is_super_admin):
    if is_super_admin:
        return "platform_admin:super_dashboard"
    if any(r in ADMIN_ROLES for r in roles):
        return "core:platform_home"
    if any(r in MANAGER_ROLES for r in roles):
        return "core:manager_home"
    return "core:me_home"


def get_nav_by_roles(roles, is_super_admin=False):
    if any(r in ADMIN_ROLES for r in roles):
        return ADMIN_NAV
    if any(r in MANAGER_ROLES for r in roles):
        return MANAGER_NAV
    return EMPLOYEE_NAV


def is_org_admin(roles):
    return any(r in ADMIN_ROLES for r in roles)


def is_manager(roles):
    return any(r in MANAGER_ROLES for r in roles)
