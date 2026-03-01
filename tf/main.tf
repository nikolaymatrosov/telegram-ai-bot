# Auto-generate webhook secret (Telegram constraint: [A-Za-z0-9_-], 1-256 chars)
resource "random_password" "webhook_secret" {
  length  = 32
  special = false
}

data "dirhash_sha256" "src" {
  directory = "${path.module}/../src"
}

# Build TypeScript code and assemble staging directory
resource "null_resource" "build_app" {
  triggers = {
    src_hash      = data.dirhash_sha256.src.checksum
    package_hash  = filesha256("${path.module}/../package.json")
    tsconfig_hash = filesha256("${path.module}/../tsconfig.json")
  }

  provisioner "local-exec" {
    working_dir = path.module
    command    = "./build.sh"
  }
}

# Create deployment ZIP from staging directory
data "archive_file" "function_zip" {
  type        = "zip"
  source_dir  = "${path.module}/staging"
  output_path = "${path.module}/function.zip"
  excludes = [
    "*.ts",
    "tsconfig.json",
    ".env",
    ".env.local",
    ".env.example",
  ]

  depends_on = [null_resource.build_app]
}

# Webhook Cloud Function
resource "yandex_function" "webhook" {
  name               = "telegram-bot-webhook"
  description        = "Telegram webhook handler for the AI bot"
  user_hash          = data.archive_file.function_zip.output_sha256
  runtime            = "nodejs22"
  entrypoint         = "handler.handler"
  memory             = 256
  execution_timeout  = "60"
  service_account_id = yandex_iam_service_account.webhook_sa.id

  environment = {
    BOT_TOKEN      = var.bot_token
    OPENAI_API_KEY = var.openai_api_key
    YDB_ENDPOINT   = yandex_ydb_database_serverless.bot_db.ydb_full_endpoint
    YDB_DATABASE   = yandex_ydb_database_serverless.bot_db.database_path
    WEBHOOK_SECRET = random_password.webhook_secret.result
  }

  content {
    zip_filename = data.archive_file.function_zip.output_path
  }

  depends_on = [
    yandex_resourcemanager_folder_iam_member.webhook_roles,
    data.archive_file.function_zip,
  ]
}

# Migration Cloud Function
resource "yandex_function" "migrate" {
  name               = "telegram-bot-migrate"
  description        = "Database schema migration function for the AI bot"
  user_hash          = data.archive_file.function_zip.output_sha256
  runtime            = "nodejs22"
  entrypoint         = "migrate.handler"
  memory             = 256
  execution_timeout  = "120"
  service_account_id = yandex_iam_service_account.migrate_sa.id

  environment = {
    YDB_ENDPOINT = yandex_ydb_database_serverless.bot_db.ydb_full_endpoint
    YDB_DATABASE = yandex_ydb_database_serverless.bot_db.database_path
  }

  content {
    zip_filename = data.archive_file.function_zip.output_path
  }

  depends_on = [
    yandex_resourcemanager_folder_iam_member.migrate_roles,
    data.archive_file.function_zip,
  ]
}

# Allow unauthenticated Telegram calls to the webhook function
resource "yandex_function_iam_binding" "webhook_public" {
  function_id = yandex_function.webhook.id
  role        = "functions.functionInvoker"
  members     = ["system:allUsers"]

  depends_on = [yandex_function.webhook]
}

# Run database migrations after each function deploy
resource "null_resource" "run_migrations" {
  triggers = {
    version = yandex_function.migrate.version
  }

  provisioner "local-exec" {
    command = "yc serverless function invoke --id ${yandex_function.migrate.id} --data '{}' --format json"
  }

  depends_on = [
    yandex_function.migrate,
    yandex_ydb_database_serverless.bot_db,
    yandex_resourcemanager_folder_iam_member.migrate_roles,
  ]
}
