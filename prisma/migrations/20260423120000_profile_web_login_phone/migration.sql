-- Optional normalized phone (digits) for /login Telegram OTP when getChat by @username id fails
ALTER TABLE "Profile" ADD COLUMN "webLoginPhoneDigits" TEXT;

CREATE UNIQUE INDEX "Profile_webLoginPhoneDigits_key" ON "Profile"("webLoginPhoneDigits");
