# Nazar Mobile · Onboarding & Auth Error Matrix

This document defines the comprehensive error scenarios, user-facing messaging, recovery behaviors, state preservation guarantees, and analytics telemetry for the Nazar mobile application's first-run, authentication, and onboarding flows.

---

## 1. Authentication & OTP Verification Scenarios

| Scenario | HTTP Status / Error Code | User-Facing Message | Recovery Action | State Preservation | Analytics Telemetry |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Invalid Phone Number** | Client Validation | "Please enter a valid 10-digit mobile number." | Highlight phone input; user corrects digits. | Input preserved in local state. | N/A (client validation) |
| **Invalid Email Address** | Client Validation | "Please enter a valid email address." | Highlight email input; user corrects format. | Input preserved in local state. | N/A (client validation) |
| **Rate Limit Exceeded (OTP Request)** | `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`) | "Too many attempts. Please wait X seconds before requesting a new code." | Countdown timer activated; Continue button disabled for duration of cooldown. | Phone number or email remains typed in input. | `auth_rate_limited` `{ method, retryAfterSeconds }` |
| **Invalid OTP Code** | `400 Bad Request` (`INVALID_OTP_CODE`) | "Invalid verification code. Please check and try again." | Clear OTP input error state; focus returns to first digit; allow re-entry. | Destination phone/email retained; user does not start over. | `auth_failed` `{ method: 'phone_verify', reason: 'INVALID_CODE' }` |
| **Expired OTP Code** | `401 Unauthorized` (`EXPIRED_OTP_CODE`) | "Verification code expired. Please request a new code." | Resend button highlighted; countdown timer reset. | Identifier retained; OTP boxes cleared. | `auth_failed` `{ method: 'phone_verify', reason: 'EXPIRED_CODE' }` |
| **Rate Limit Exceeded (OTP Verify)** | `429 Too Many Requests` | "Too many attempts. Please wait X seconds before trying again." | Verification blocked during cooldown; error banner displayed. | Current entered digits and target identifier preserved. | `auth_rate_limited` `{ method: 'phone_verify', retryAfterSeconds }` |
| **Wrong Destination Entered** | User Action | N/A | Tapping "Wrong number? Change" returns immediately to `/(auth)/login`. | User can edit or re-enter new phone number or email. | N/A |
| **Network Failure During Auth** | `NetworkError` / Fetch Failed | "Unable to connect to Nazar servers. Please check your internet connection and try again." | Inline error banner displayed with retry capability. | All inputs and identifiers remain intact in memory. | `auth_failed` `{ method, reason: 'NETWORK_ERROR' }` |

---

## 2. Profile Creation & Onboarding Scenarios

| Scenario | HTTP Status / Error Code | User-Facing Message | Recovery Action | State Preservation | Analytics Telemetry |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Missing First Name** | Client Validation | "Please enter your first name." | Focus first name field. | All other form fields retained in draft. | N/A |
| **First Name Exceeds Max Length** | Client Validation | "First name cannot exceed 30 characters." | Display character limit error below input. | Input truncated or preserved for editing. | N/A |
| **Underage User (< 18 years)** | Client Validation | "You must be at least 18 years old to join Nazar." | Highlight Date of Birth selector; block navigation. | Date selection retained for user adjustment. | N/A |
| **Missing Current City** | Client Validation | "Please provide your current city." | Highlight city field and popular city pills. | Form draft intact. | N/A |
| **Bio Exceeds 300 Characters** | Client Validation | Live character counter turns red at 300/300. | Input capped at 300 chars automatically. | Form draft intact. | N/A |
| **Network Failure on Profile Save** | Network Error / Server 500 | "Failed to save profile. Tap Continue to retry." | Display persistent retry banner; allow instant resubmission. | All form fields strictly preserved in `useOnboardingStore.draftProfile`. | N/A |
| **Insufficient Photos (< 2)** | Client Validation | "Upload at least 2 photos before continuing." | Display upload progress status; Continue button disabled until 2 slots filled. | Already uploaded photos remain visible and persistent. | N/A |
| **Photo Upload Network Drop** | S3 / Binary Upload Failure | "Photo upload failed. Please try again." | Display failed slot indicator; tap to retry upload. | Other ready photos and primary designation unaffected. | `photo_upload_failed` |
| **Insufficient Interests (< 3)** | Client Validation | "Please select at least 3 interests that represent you." | Continue button shows dynamic count `(X/3 Selected)`. | Selected chips remain toggled on. | N/A |
| **Excess Interests (> 10)** | Client Validation | "You can select a maximum of 10 interests." | Tapping 11th chip shows gentle toast/warning banner; ignores 11th selection. | Existing 10 selections preserved. | N/A |
| **Empty Prompt Response** | Client Validation | "Please write a response to this prompt to spark conversation." | Focus multiline response input. | Chosen question remains selected. | N/A |
| **Prompt Exceeds 200 Characters** | Client Validation | Live counter caps input at 200 chars. | Text automatically bounded at 200 chars. | Answer draft preserved in memory. | N/A |
| **Inverted Age Preference Range** | Client Validation | "Minimum age cannot be greater than maximum age." | Stepper buttons enforce boundary: `minAge <= maxAge`. | Valid range kept. | N/A |
| **Permission Denied (Location/Push)** | OS Native Denial | Contextual fallback banner: "Location Access Needed" with "Device Settings" action. | User can continue flow via "Continue to Preview" without trapping. | Selected settings retained; non-blocking progression. | `permission_denied` `{ type }` |
| **Activation Network Error** | `POST /v1/profiles/me/activate` Failure | "Failed to activate profile. Retrying..." | Retry CTA button displayed; offline fallback to cached view. | All completed milestones and photos remain intact. | N/A |

---

## 3. Session Restoration & Returning User Scenarios

| Scenario | Decision Logic | App Destination | Recovery / User Experience |
| :--- | :--- | :--- | :--- |
| **Fresh App Install** | No stored tokens (`ITokenStorage` empty). | `/(auth)/welcome` | Seamless transition to Welcome hero; zero spinner after bootstrap. |
| **Returning Active Member** | Stored tokens exist; `GET /v1/profiles/me` returns `visibility === 'ACTIVE'`. | `/(tabs)/discovery` | Instant entry into Discovery feed; onboarding bypassed completely. |
| **Interrupted Onboarding** | Stored tokens exist; `GET /v1/profiles/me` returns missing milestones. | Exact missing step (`/(onboarding)/[step]`) | State machine computes exact milestone: `determineNextStepFromProfile(profile)` resumes flow without repeating completed steps. |
| **Paused Member** | Stored tokens exist; `GET /v1/profiles/me` returns `visibility === 'PAUSED'`. | `/(tabs)/discovery` | Guided prompt with option to unpause dating profile. |
| **Expired Session (401)** | Stored tokens exist; `GET /v1/profiles/me` returns 401; single-flight refresh fails. | `/(auth)/welcome` | Secure token purge via `storage.clearTokens()`; user redirected to clean sign-in screen. |
| **Offline App Launch** | Device offline on launch; stored tokens exist. | App Launch screen with "Retry Connection" and "Continue Offline" actions. | Never crashes; shows clean offline banner and retry button. |
