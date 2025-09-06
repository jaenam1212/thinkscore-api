import { Injectable } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

interface AppleTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  at_hash: string;
  email?: string;
  email_verified?: string;
  auth_time: number;
  nonce_supported?: boolean;
}

@Injectable()
export class AppleService {
  private client = jwksClient({
    jwksUri: "https://appleid.apple.com/auth/keys",
    cache: true,
    cacheMaxAge: 86400000, // 24시간
  });

  async verifyIdToken(
    idToken: string,
    clientId: string
  ): Promise<AppleTokenPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        idToken,
        this.getKey.bind(this) as jwt.Secret,
        {
          audience: clientId,
          issuer: "https://appleid.apple.com",
          algorithms: ["RS256"],
        },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded as AppleTokenPayload);
          }
        }
      );
    });
  }

  private getKey(
    header: jwt.JwtHeader,
    callback: jwt.SigningKeyCallback
  ): void {
    this.client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        callback(err);
      } else {
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
      }
    });
  }
}
