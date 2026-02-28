import { Driver } from "@ydbjs/core";
import { query } from "@ydbjs/query";
import { AnonymousCredentialsProvider } from "@ydbjs/auth/anonymous";
import { MetadataCredentialsProvider } from "@ydbjs/auth/metadata";
import { AccessTokenCredentialsProvider } from "@ydbjs/auth/access-token";
import { config } from "../../config/index.js";

let driver: Driver | null = null;

function getCredentialsProvider() {
  if (process.env.YDB_ACCESS_TOKEN_CREDENTIALS) {
    return new AccessTokenCredentialsProvider({
      token: process.env.YDB_ACCESS_TOKEN_CREDENTIALS,
    });
  }
  if (process.env.YDB_METADATA_CREDENTIALS === "1") {
    return new MetadataCredentialsProvider();
  }
  return new AnonymousCredentialsProvider();
}

export async function getDriver(): Promise<Driver> {
  if (driver) return driver;

  const connectionString = `${config.ydbEndpoint}${config.ydbDatabase}`;
  const isLocal = config.ydbEndpoint.startsWith("grpc://");

  driver = isLocal
    ? new Driver(connectionString)
    : new Driver(connectionString, {
        credentialsProvider: getCredentialsProvider(),
      });

  await driver.ready();
  return driver;
}

export function getQueryClient(d: Driver) {
  return query(d);
}

export async function destroyDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
