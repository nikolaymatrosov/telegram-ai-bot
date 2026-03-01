resource "yandex_ydb_database_serverless" "bot_db" {
  name        = "telegram-ai-bot-db"
  location_id = "ru-central1"

  serverless_database {
    storage_size_limit = 5
  }

  sleep_after = 5
}
