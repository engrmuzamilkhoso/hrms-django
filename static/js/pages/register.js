/**
 * Functional port of saas-hrms-frontend/app/auth/register/page.tsx's two-step
 * flow (org details -> OTP verify) against the preserved /api/v1/auth/*
 * endpoints. Simplified relative to the original (no live countdown ring
 * animation / plan-card grid polish yet) but behaviorally equivalent:
 * same two API calls, same validation rules, same step transition.
 */
(function () {
  const OTP_SECONDS = 120;
  let secondsLeft = OTP_SECONDS;
  let timerHandle = null;
  let registeredEmail = "";

  const stepForm = document.getElementById("step-form");
  const stepOtp = document.getElementById("step-otp");
  const form = document.getElementById("register-form");
  const otpForm = document.getElementById("otp-form");
  const formError = document.getElementById("form-error");
  const otpError = document.getElementById("otp-error");
  const timerLabel = document.getElementById("timer-label");
  const otpEmailLabel = document.getElementById("otp-email-label");

  function validate(data) {
    const errors = {};
    if (!data.organization_name.trim()) errors.organization_name = "Organization name is required.";
    if (!/.+@.+\..+/.test(data.email)) errors.email = "Enter a valid email address.";
    if (!data.password || data.password.length < 8) errors.password = "Min 8 characters.";
    if (data.password !== data.password_confirm) errors.password_confirm = "Passwords do not match.";
    return errors;
  }

  function startTimer() {
    secondsLeft = OTP_SECONDS;
    if (timerHandle) clearInterval(timerHandle);
    updateTimerLabel();
    timerHandle = setInterval(() => {
      secondsLeft -= 1;
      updateTimerLabel();
      if (secondsLeft <= 0) clearInterval(timerHandle);
    }, 1000);
  }

  function updateTimerLabel() {
    const m = String(Math.max(0, Math.floor(secondsLeft / 60))).padStart(2, "0");
    const s = String(Math.max(0, secondsLeft % 60)).padStart(2, "0");
    timerLabel.textContent = secondsLeft > 0 ? `Code expires in ${m}:${s}` : "Code expired — request a new one.";
  }

  document.addEventListener("DOMContentLoaded", () => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      const errors = validate(data);
      if (Object.keys(errors).length) {
        formError.hidden = false;
        formError.textContent = Object.values(errors)[0];
        return;
      }
      formError.hidden = true;

      try {
        const resp = await apiRequest("/auth/register-organization", {
          method: "POST",
          body: JSON.stringify({
            organization_name: data.organization_name,
            email: data.email,
            password: data.password,
            country_code: data.country_code,
            industry: data.industry,
            default_currency: data.default_currency,
            timezone: data.timezone,
            plan_code: data.plan_code,
          }),
        });
        registeredEmail = data.email;
        otpEmailLabel.textContent = registeredEmail;
        stepForm.hidden = true;
        stepOtp.hidden = false;
        startTimer();
      } catch (err) {
        formError.hidden = false;
        formError.textContent = err.message || "Registration failed.";
      }
    });

    otpForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const otp = document.getElementById("otp-code-input").value;
      try {
        await apiRequest("/auth/verify-signup-otp", {
          method: "POST",
          body: JSON.stringify({ email: registeredEmail, otp_code: otp, purpose: "org_signup_verify" }),
        });
        window.location.href = "/auth/login/?verified=1";
      } catch (err) {
        otpError.hidden = false;
        otpError.textContent = err.message || "OTP verification failed.";
      }
    });

    document.getElementById("resend-btn").addEventListener("click", async () => {
      try {
        await apiRequest("/auth/resend-otp", {
          method: "POST",
          body: JSON.stringify({ email: registeredEmail, purpose: "org_signup_verify" }),
        });
        startTimer();
        pushToast("A new code has been sent to your email.", "success");
      } catch (err) {
        pushToast(err.message || "Could not resend code.", "error");
      }
    });

    document.getElementById("back-btn").addEventListener("click", () => {
      stepOtp.hidden = true;
      stepForm.hidden = false;
    });
  });
})();
