# API contract

Recovered from `com.tvsm.connect.latam` versionCode 44 (internal build string
`TVSConnect-8.8.0_latamProdRelease`). Every path and field below was read from the
decompiled sources, not guessed.

## Base URLs

| Purpose | URL | Source |
| --- | --- | --- |
| Main API, EV and ICE | `https://tvsconnectapi.tvsmotor.com/api/` | `com/tvsm/unified/utils/URLUtils.java` (`EV_BASE_URL`, `ICE_BASE_URL`) |
| P360 platform | `https://p360.tvsmotor.com/` (`/gapi`, `/rapi/`, `/subscriptions`) | string table |
| Coupon service | `https://dev-tvsconnectapi.tvsmotor.net/coupon-api/api/` | `U716_BASE` |
| EV content service | `https://dev-tvsconnectevapi.tvsmotor.net/p360-api/api/`, `/tccd-api/api/` | string table |
| CDP GraphQL | `https://cdpcom-dev.tvsmotor.com/graphql` | string table |
| Roadside assist | `https://myassistancenow.com/uat/tvsrsa_live/FetchPolicyData`, `/RegisterToken` | `ROADSIDE_ASSIST_*_API` |
| Service booking SOAP | `http://api.tvsmotor.com/Tvsapi.svc/servicebooking` | string table |
| iQuebe voice data | `https://tvsiqubeapi.tvsmotor.com/domestic-assets/Content/...` | string table |

The dev and uat hosts (`dev-*`, `p360uat.tvsmotor.com`, `uat-tvsconnectevapi.*`) are
still compiled into the release build. The production base URL for the LATAM build is
`tvsconnectapi.tvsmotor.com`.

## Response envelope

Every main API response uses the same shape:

```json
{
  "statusCode": 200,
  "result": "Success",
  "message": "...",
  "data": {},
  "errorMessages": {}
}
```

Read `statusCode` and `result` for the outcome. `errorMessages` carries field level
errors for validation failures.

## Authentication

Login is mobile number plus OTP. The token pair travels in headers, not in a
bearer scheme, so every call has to repeat them.

### 1. Request an OTP

`POST {base}RegisterUser/GenerateOTP`

Headers: `ICEUserId`, `EVUserId`, `countryId`, `Region`, `lang`.

```json
{
  "mobileNumber": "9999999999",
  "platform": "Android",
  "otpLength": 6,
  "email": "",
  "isWhatsAppOTPRequested": false,
  "isContinue": false
}
```

### 2. Log in

`POST {base}v3/UserLogin/Loginv3`

```json
{
  "mobileNumber": "9999999999",
  "email": "",
  "platformType": "Android",
  "otpLength": 6,
  "isSuppressOTP": false,
  "androidToken": "<fcm token>"
}
```

### 3. Verify the OTP

`POST {base}v3/userlogin/verifyloginotp`

```json
{
  "mobilenumber": "9999999999",
  "otp": "123456",
  "email": "",
  "deviceType": "Android",
  "androidToken": "<fcm token>",
  "iosToken": "",
  "publicKey": ""
}
```

The response `data` list carries one `VerifyOtpResponse` per account:

| Field | Meaning |
| --- | --- |
| `UserId` | numeric user id, sent back as the `userid` header |
| `accessToken` | access token, sent as `AccessToken` |
| `refreshToken` | refresh token, sent as `RefreshToken` |
| `Token` | legacy token, sent as `token` |
| `publicKey` | per user public key, sent as `publicKey` |
| `FullName`, `Email`, `MobileNumber` | profile |
| `CityId`, `CityName`, `StateId`, `StateName` | location |
| `IsMarketingConsentAccepted`, `IsPrivacyPolicyAccepted`, `IsTermsOfServiceAccepted` | consent flags |
| `Addedvehiclecount` | number of vehicles already linked |

## Headers used by the API

| Header | Source |
| --- | --- |
| `userid` | `UserId` from the verify response |
| `AccessToken` | `accessToken` |
| `RefreshToken` | `refreshToken` |
| `token` | `Token` |
| `ICEUserId` | internal combustion user id |
| `EVUserId` | electric vehicle user id |
| `countryId`, `Region` / `region`, `lang` | locale context |
| `version` | app version code |
| `TVS-User-Agent` | client user agent string |
| `vehicleTypeId` | vehicle type context |

Case differs between call sites (`region` vs `Region`, `userid` vs `UserId`), so send
the exact spelling of the endpoint you are calling.

## Vehicle endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `v3/Vehicle/AddVehicle` | link a TVS vehicle by frame or invoice |
| POST | `v2/vehicle/adduservehicle` | add a vehicle to the user profile |
| GET | `vehicle/vehiclelist` | list of linked vehicles |
| GET | `v3/vehicle/vehiclelistbyframeengineno` | lookup by frame and engine number |
| GET | `v3/vehicle/vehiclelistbyframeinvoice` | lookup by frame and invoice |
| POST | `v3/Vehicle/markactivevehicle` | switch the active vehicle |
| POST | `Vehicle/RemoveVehicle` | unlink a vehicle |
| POST | `vehicle/addnontvsvehicle` | add a non TVS vehicle |
| POST | `vehicle/removenontvsVehicle` | remove a non TVS vehicle |
| POST | `Vehicle/UpdatevehicleNickname` | rename a vehicle |
| GET | `Vehicle/getnewcodptoken` | query `userVehicleId`, `appUserId`, `frameNumber` |

## Profile endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `v3/ManageProfile/EditProfile` | update profile |
| POST | `ManageProfile/GetOTPForUpdateMobileNumber` | OTP for a phone change |
| POST | `manageprofile/getupdatemobileotp` | same for EV accounts |
| POST | `ManageProfile/VerifyMobileUpdateOtp` | confirm the phone change |
| POST | `ManageProfile/deleteprofilereason` | reason for account deletion |
| POST | `ManageProfile/getdeleteprofileotp` | OTP for account deletion |
| POST | `ManageProfile/verifydeleteprofileotp` | confirm the deletion |
| POST | `Image/ProfileImage` | multipart upload of the profile picture |
| GET | `UserDashboard/GetDashboardDetail` | dashboard data |
| GET | `RegisterUser/GetCountryList` | country, state and city master data |
| GET | `UserLogin/Logout` | end the session |

## Rewards and referrals

| Method | Path | Notes |
| --- | --- | --- |
| GET | `rewards/getreferraleligibility` | is the user eligible to refer |
| POST | `referral/createreferral` | create a referral |
| POST | `referral/getreferralstatus/mobilenumber` | referral status by phone |
| POST | `referral/getreferralstatus/messageid` | referral status by message id |
| POST | `referral/sendnudge` | nudge a referred contact |
| GET | `v2/rewards/getrewarddetails` | reward details |
| GET | `rewards/getcustomerrewardslist` | reward history |
| GET | `rewards/getifsc` | bank IFSC lookup by prefix |
| POST | `v2/rewards/customerbankdetails` | save bank details |
| POST | `v2/rewards/sendotp`, `v2/rewards/verifyotp` | bank verification OTP |
| GET | `v2/rewards/crypttoken` | token for the reward encryption flow |

## Other services

| Method | Path | Notes |
| --- | --- | --- |
| GET | `v3/userconsent` | consent state |
| POST | `v3/ccpandgoogleconsent` | store CCP and Google consent |
| GET | `GetDeviceDetails?deviceId=` | device information |
| POST | `UserLogin/addpublicchargingtime` | public charging sessions, EV only |
| GET | `vehicle/makemodelmaster` | non TVS make and model master |
| GET | `CityStateListMaster` variant | city and state master |

## Vehicle connectivity

The BLE link to the vehicle is not HTTP. It is the native library
`libBluConnect-Lib.so` in the arm64 split, driven by the Java and Kotlin layer
under `com/tvsm/blu*` and `com/tvsm/connect/**/blu*`. The protocol is proprietary,
so the replacement app needs its own BLE client for the features that read live
vehicle state. The Ghidra project for those libraries is built with
`tools/ghidra-native.sh`.

## Findings that need care

- The release binary contains a hardcoded shared credential pair for the roadside
  assist service, in `com/tvsm/unified/utils/URLUtils.java` (`RSA_TOKEN_USERNAME`,
  `RSA_TOKEN_PASSWORD`). Do not reuse vendor credentials in the replacement app.
  Use the owner account flow instead.
- The dev and uat hosts are compiled into the release. The replacement app must only
  point at the production base URL.
- `TVS-User-Agent`, `version` and the locale headers are part of the contract, the
  backend rejects requests without them.
