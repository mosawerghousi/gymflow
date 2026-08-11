/**
 * Non-repository service ports.
 *
 * Everything non-deterministic (time, randomness, hashing) enters the
 * application layer through one of these, which is what makes the use cases
 * testable without mocking globals.
 */

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface PasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, hash: string): Promise<boolean>;
}

export interface TokenGenerator {
  /** Returns an opaque, URL-safe secret plus its storable hash. */
  generate(): Promise<{ plaintext: string; hash: string; prefix: string }>;
  hash(plaintext: string): Promise<string>;
}

export interface QrCodeGenerator {
  /** Renders `payload` as a standalone SVG string. */
  toSvg(payload: string, options?: { size?: number; margin?: number }): Promise<string>;
  toDataUrl(payload: string, options?: { size?: number; margin?: number }): Promise<string>;
}

export interface CalendarExporter {
  /** Serializes events to an RFC 5545 iCalendar document. */
  toICal(
    events: readonly CalendarEvent[],
    options: { calendarName: string; timeZone?: string },
  ): string;
}

export interface CalendarEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt: Date;
  createdAt?: Date;
  status?: "CONFIRMED" | "CANCELLED";
}
