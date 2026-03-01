variable "cloud_id" {
  description = "Yandex Cloud organization ID (find at https://console.yandex.cloud/ → Cloud settings)"
  type        = string
}

variable "folder_id" {
  description = "Yandex Cloud folder ID where all resources will be deployed"
  type        = string
}

variable "zone" {
  description = "Yandex Cloud availability zone for resource placement"
  type        = string
  default     = "ru-central1-a"
}

variable "bot_token" {
  description = "Telegram bot token obtained from @BotFather (https://t.me/BotFather)"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key for GPT access (https://platform.openai.com/api-keys)"
  type        = string
  sensitive   = true
}
