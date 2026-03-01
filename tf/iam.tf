# Service account for the webhook handler function
resource "yandex_iam_service_account" "webhook_sa" {
  name        = "telegram-bot-webhook-sa"
  description = "Runtime identity for the Telegram webhook handler function"
  folder_id   = var.folder_id
}

# Service account for the database migration function
resource "yandex_iam_service_account" "migrate_sa" {
  name        = "telegram-bot-migrate-sa"
  description = "Runtime identity for the database migration function"
  folder_id   = var.folder_id
}

# IAM role bindings for the webhook function service account
resource "yandex_resourcemanager_folder_iam_member" "webhook_roles" {
  for_each = toset([
    "ydb.viewer",
    "functions.functionInvoker",
  ])

  folder_id = var.folder_id
  role      = each.value
  member    = "serviceAccount:${yandex_iam_service_account.webhook_sa.id}"

  sleep_after = 5
}

# IAM role bindings for the migration function service account
resource "yandex_resourcemanager_folder_iam_member" "migrate_roles" {
  for_each = toset([
    "ydb.editor",
    "functions.functionInvoker",
  ])

  folder_id = var.folder_id
  role      = each.value
  member    = "serviceAccount:${yandex_iam_service_account.migrate_sa.id}"

  sleep_after = 5
}
