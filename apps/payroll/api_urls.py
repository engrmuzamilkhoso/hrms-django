from django.urls import path

from . import api

urlpatterns = [
    path("salary-structures", api.SalaryStructureListCreateAPIView.as_view()),
    path("salary-components", api.SalaryComponentListCreateAPIView.as_view()),
    path("employee-compensations", api.EmployeeCompensationListCreateAPIView.as_view()),
    path("payroll-runs", api.PayrollRunListCreateAPIView.as_view()),
    path("payroll-runs/<int:run_id>/calculate", api.PayrollRunCalculateAPIView.as_view()),
    path("payroll-runs/<int:run_id>/lock", api.PayrollRunLockAPIView.as_view()),
    path("payroll-runs/<int:run_id>/approve", api.PayrollRunApproveAPIView.as_view()),
    path("payroll-runs/<int:run_id>/items/<int:item_id>", api.PayrollRunAdjustItemAPIView.as_view()),
    path("payroll-runs/<int:run_id>/bank-export", api.PayrollRunBankExportAPIView.as_view()),
    path("payroll-runs/<int:run_id>/payslip/<int:employee_id>", api.PayslipAPIView.as_view()),
    path("tax-rules", api.TaxRuleListCreateAPIView.as_view()),
    path("tax-brackets", api.TaxBracketListCreateAPIView.as_view()),
    path("tax-brackets/<int:bracket_id>", api.TaxBracketDetailAPIView.as_view()),
    path("expense-reimbursements", api.ExpenseReimbursementListCreateAPIView.as_view()),
    path("expense-reimbursements/<int:expense_id>/approve", api.ExpenseReimbursementApproveAPIView.as_view()),
    path("expense-reimbursements/<int:expense_id>/reject", api.ExpenseReimbursementRejectAPIView.as_view()),
    path("expense-reimbursements/include-in-payroll", api.ExpenseReimbursementIncludeInPayrollAPIView.as_view()),
]
