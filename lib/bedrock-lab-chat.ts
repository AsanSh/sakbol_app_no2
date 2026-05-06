import "server-only";

import { bedrockConverseText, bedrockLabModelId } from "@/lib/bedrock-converse";

/**
 * Вкладка «ИИ»: текст через Amazon Bedrock Converse.
 *
 * Аутентификация (по приоритету):
 * - AWS_BEARER_TOKEN_BEDROCK — long-term API key из консоли Bedrock (Bearer).
 * - Иначе IAM: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, instance/task role и т.д. (через SDK).
 *
 * Регион: BEDROCK_REGION или AWS_REGION (по умолчанию us-east-1).
 * Модель: BEDROCK_LAB_MODEL_ID (по умолчанию Claude 3.5 Haiku inference profile).
 *
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started-api-keys.html
 */
export async function generateBedrockLabChatAnswer(
  system: string,
  userText: string,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  return bedrockConverseText(system, userText, bedrockLabModelId());
}
