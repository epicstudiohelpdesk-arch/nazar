# Nazar Mobile · Onboarding & First-Run QA Matrix

This document establishes the production Quality Assurance (QA) verification protocol for the Nazar mobile application's authentication, first-run experience, and profile creation journey.

---

## QA Test Scenarios

### 1. New Account Journey (Happy Path)

| Step     | Action                                                                                         | Expected Behavior                                                                                                                                     | Pass / Fail |
| :------- | :--------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| **1.1**  | Cold launch app from fresh install.                                                            | App displays Nazar brand splash briefly, detects unauthenticated state, and navigates to `/(auth)/welcome`.                                           | PASS        |
| **1.2**  | Tap "Get Started".                                                                             | Navigates to `/(auth)/login` with Phone tab selected by default and `+91` pre-filled.                                                                 | PASS        |
| **1.3**  | Enter valid 10-digit Indian phone number (e.g. `9876543210`) and tap "Continue".               | Formats number cleanly; dispatches `POST /v1/auth/otp/request`; transitions to `/(auth)/otp`.                                                         | PASS        |
| **1.4**  | On OTP screen, verify destination display.                                                     | Displays masked number `+91 98765 •••••`. Countdown timer starts at 45 seconds.                                                                       | PASS        |
| **1.5**  | Enter 6-digit verification code.                                                               | Automatically validates; calls `POST /v1/auth/otp/verify`; saves tokens to `ITokenStorage`; routes to `/(onboarding)/intro`.                          | PASS        |
| **1.6**  | On `intro.tsx`, tap "Let's Begin ✨".                                                          | Emits `profile_started` telemetry; transitions to `/(onboarding)/profile-setup`.                                                                      | PASS        |
| **1.7**  | Fill basic details (Name, DOB $\ge 18$, Gender, Intent, City, Bio) and tap "Continue".         | Saves to `PUT /v1/profiles/me`; updates store draft; routes to `/(onboarding)/photos`.                                                                | PASS        |
| **1.8**  | Upload 2+ photos, select primary photo, and tap "Continue".                                    | Media pipeline executes `requestUploadUrl` and `completeUpload`; enables continue when $\ge 2$ photos are ready; routes to `/(onboarding)/interests`. | PASS        |
| **1.9**  | Select 3 to 10 interests from dynamic taxonomy and tap "Continue".                             | Persists to `PUT /v1/profiles/me/interests`; enforces 3–10 selection boundaries; routes to `/(onboarding)/prompts`.                                   | PASS        |
| **1.10** | Pick prompt question, enter response $\le 200$ chars, and tap "Continue".                      | Persists to `PUT /v1/profiles/me/prompts`; displays live character counter; routes to `/(onboarding)/preferences`.                                    | PASS        |
| **1.11** | Adjust discovery preferences (age range, max distance km, gender interest) and tap "Continue". | Persists to `PUT /v1/profiles/me/preferences`; routes to `/(onboarding)/permissions`.                                                                 | PASS        |
| **1.12** | Contextual permissions priming: grant or skip Location & Notifications.                        | Updates permission statuses; non-blocking progression; navigates to `/(onboarding)/preview`.                                                          | PASS        |
| **1.13** | Review profile card preview and tap "Enter Nazar ✨".                                          | Calls `POST /v1/profiles/me/activate`; marks profile active; transitions seamlessly into `/(tabs)/discovery`.                                         | PASS        |

---

### 2. Returning Account Flows

| Step    | Action                                                | Expected Behavior                                                                                                                                                | Pass / Fail |
| :------ | :---------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| **2.1** | Cold launch app with active member tokens in storage. | `SessionService.restoreSession()` queries `GET /v1/profiles/me`; detects `visibility === 'ACTIVE'`; routes directly to `/(tabs)/discovery` bypassing onboarding. | PASS        |
| **2.2** | Cold launch app with paused member tokens in storage. | Detects `visibility === 'PAUSED'`; routes to discovery with unpause option.                                                                                      | PASS        |
| **2.3** | Log in with returning account phone number via OTP.   | On OTP verification, detects existing active profile; navigates immediately to `/(tabs)/discovery`.                                                              | PASS        |

---

### 3. Interrupted Onboarding Flow

| Step    | Action                                                            | Expected Behavior                                                                                                                                                          | Pass / Fail |
| :------ | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| **3.1** | Complete basic details and photos, then terminate the app.        | Media and basic details are persisted on the backend.                                                                                                                      | PASS        |
| **3.2** | Re-launch the app.                                                | `SessionService.restoreSession()` queries `GET /v1/profiles/me`; milestone resolver detects interests missing ($< 3$); automatically resumes at `/(onboarding)/interests`. | PASS        |
| **3.3** | Verify previously uploaded photos and basic details are retained. | Previous photos and profile details are completely preserved and hydrated in memory.                                                                                       | PASS        |

---

### 4. Network Failure & Error Recovery

| Step    | Action                                                              | Expected Behavior                                                                                                                                                        | Pass / Fail |
| :------ | :------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| **4.1** | Disable network connectivity on Login screen and submit.            | Displays inline error banner: "Unable to connect to Nazar servers. Please check your internet connection and try again." Entered phone/email remains preserved in input. | PASS        |
| **4.2** | Disable network connectivity during Profile Setup and tap Continue. | Displays retry banner: "Failed to save profile. Tap Continue to retry." All form inputs (name, bio, DOB, city) strictly preserved in memory.                             | PASS        |
| **4.3** | Re-enable network connectivity and tap Continue.                    | Submission succeeds without the user having to retype any input.                                                                                                         | PASS        |
| **4.4** | Trigger rate limit on OTP verification (429 response).              | Displays rate limit banner with remaining cooldown seconds; disables button until countdown finishes.                                                                    | PASS        |

---

### 5. Contextual Permission Denial

| Step    | Action                                                                      | Expected Behavior                                                                                   | Pass / Fail |
| :------ | :-------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- | :---------- |
| **5.1** | On `permissions.tsx`, do not enable Location and tap "Continue to Preview". | App does not block or trap user; proceeds to `preview.tsx` smoothly.                                | PASS        |
| **5.2** | Tap "Device Settings" action.                                               | Invokes OS native settings link (`Linking.openSettings()`) so user can toggle permissions manually. | PASS        |

---

### 6. Session Expiration Handling

| Step    | Action                                                                      | Expected Behavior                                                                                                                                  | Pass / Fail |
| :------ | :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| **6.1** | Launch app with invalidated/expired access token and expired refresh token. | Backend returns 401 Unauthorized; single-flight refresh fails; `storage.clearTokens()` purges credentials; redirects cleanly to `/(auth)/welcome`. | PASS        |
