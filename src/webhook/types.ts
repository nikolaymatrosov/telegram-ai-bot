/** Yandex Cloud Functions HTTP trigger event */
export interface YcfEvent {
  httpMethod: string;
  headers: Record<string, string>;
  body: string | Record<string, unknown>;
  queryStringParameters?: Record<string, string>;
  requestContext?: {
    identity?: {
      sourceIp?: string;
      userAgent?: string;
    };
    httpMethod?: string;
    requestId?: string;
    requestTime?: string;
    requestTimeEpoch?: number;
  };
  isBase64Encoded?: boolean;
}

/** Yandex Cloud Functions invocation context */
export interface YcfContext {
  token?: {
    access_token: string;
    expires_in: number;
    token_type: string;
  };
  functionName: string;
  functionVersion: string;
  memoryLimitInMB: number;
  requestId: string;
  logGroupName: string;
}

/** Yandex Cloud Functions HTTP trigger response */
export interface YcfResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}
