import { UnauthorizedError } from "../errors";

export interface KioskTokenProps {
  id: string;
  name: string;
  /** Only a hash is ever stored; the plaintext is shown once at creation. */
  tokenHash: string;
  /** First characters of the plaintext, so a device can be identified in the UI. */
  tokenPrefix: string;
  createdByUserId: string | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * A long-lived device credential for the unattended `/kiosk` screen. The kiosk
 * has no user session — it authenticates with this token alone, which is why it
 * can only ever create check-ins.
 */
export class KioskToken {
  private props: KioskTokenProps;

  constructor(props: KioskTokenProps) {
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get tokenHash(): string {
    return this.props.tokenHash;
  }
  get tokenPrefix(): string {
    return this.props.tokenPrefix;
  }
  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }
  get lastUsedAt(): Date | null {
    return this.props.lastUsedAt;
  }
  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }
  get isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  assertUsable(): void {
    if (this.isRevoked) {
      throw new UnauthorizedError("This kiosk device has been revoked.");
    }
  }

  touch(now: Date): void {
    this.props.lastUsedAt = now;
  }

  revoke(now: Date): void {
    if (!this.isRevoked) {
      this.props.revokedAt = now;
    }
  }

  snapshot(): KioskTokenProps {
    return { ...this.props };
  }
}
