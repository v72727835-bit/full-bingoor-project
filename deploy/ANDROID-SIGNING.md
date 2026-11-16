# Signing the Android apps with a release key

Until these secrets are added, the Build APKs workflow signs the three apps with
the public React Native **debug** key (and prints a warning). Anyone can sign an
APK with that key, so it must not be used for apps given to customers, and Google
Play rejects it.

## One-time setup

1. On any PC with Java installed, create the key (keep the file and both passwords safe
   and backed up: if it is lost, the apps can never be updated in place again):

   ```
   keytool -genkeypair -v -keystore bingoor-release.jks -alias bingoor -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Turn it into one line of text:

   - Git Bash / Linux / macOS: `base64 -w0 bingoor-release.jks > bingoor-release.b64` (macOS: `base64 -i bingoor-release.jks -o bingoor-release.b64`)
   - PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("bingoor-release.jks")) | Out-File bingoor-release.b64`

3. On GitHub: repository **Settings > Secrets and variables > Actions > New repository secret**:

   | Secret | Value |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | the contents of `bingoor-release.b64` |
   | `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
   | `ANDROID_KEY_ALIAS` | `bingoor` |
   | `ANDROID_KEY_PASSWORD` | the key password |

4. Re-run **Actions > Build APKs**. The warning disappears and the APKs are signed with your key.

## Important: one reinstall

Android only updates an app over one signed with the same key. Phones that have
the old (debug-signed) APK must **uninstall it once** and install the new one;
after that every update installs normally. Tell riders and warehouse staff before
you add the secrets.

## Local release builds

Put the same values in `~/.gradle/gradle.properties` (never in the repository):

```
BINGOOR_UPLOAD_STORE_FILE=C:/keys/bingoor-release.jks
BINGOOR_UPLOAD_STORE_PASSWORD=...
BINGOOR_UPLOAD_KEY_ALIAS=bingoor
BINGOOR_UPLOAD_KEY_PASSWORD=...
```
