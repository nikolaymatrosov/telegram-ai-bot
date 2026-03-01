output "webhook_function_id" {
  description = "ID of the Telegram webhook Cloud Function"
  value       = yandex_function.webhook.id
}

output "webhook_function_url" {
  description = "HTTPS URL of the Telegram webhook Cloud Function"
  value       = "https://functions.yandexcloud.net/${yandex_function.webhook.id}"
}

output "migrate_function_id" {
  description = "ID of the database migration Cloud Function"
  value       = yandex_function.migrate.id
}

output "ydb_database_id" {
  description = "ID of the YDB serverless database"
  value       = yandex_ydb_database_serverless.bot_db.id
}

output "ydb_endpoint" {
  description = "gRPC endpoint of the YDB database"
  value       = yandex_ydb_database_serverless.bot_db.ydb_full_endpoint
}

output "ydb_database_path" {
  description = "Database path within the YDB endpoint"
  value       = yandex_ydb_database_serverless.bot_db.database_path
}

output "webhook_secret" {
  description = "Auto-generated WEBHOOK_SECRET — pass this when registering the Telegram webhook"
  value       = random_password.webhook_secret.result
  sensitive   = true
}

output "set_webhook_command" {
  description = "One-liner shell command to register the Telegram webhook (pipe to bash)"
  sensitive   = true
  value       = <<-EOT
    BOT_TOKEN="${var.bot_token}" \
    WEBHOOK_URL="https://functions.yandexcloud.net/${yandex_function.webhook.id}" \
    WEBHOOK_SECRET="${random_password.webhook_secret.result}" \
    npx tsx src/webhook/scripts/set-webhook.ts
  EOT
}
