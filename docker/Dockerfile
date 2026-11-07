FROM reactnativecommunity/react-native-android:v22.0

ENV ANDROID_HOME=/opt/android
ENV EXPO_NO_GIT_STATUS=1

RUN yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses > /dev/null || true
RUN sdkmanager --sdk_root=$ANDROID_HOME \
    "platform-tools" \
    "platforms;android-36" \
    "build-tools;36.0.0" \
    "ndk;27.1.12297006" \
    "cmake;3.30.5"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN npx expo prebuild --platform android --clean --no-install

CMD ["sh", "-c", "cd android && ./gradlew assembleDebug --no-daemon && cp app/build/outputs/apk/debug/app-debug.apk /out/app-debug.apk && echo APK_READY"]
