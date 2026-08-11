import { createHash, randomBytes, randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";

import type {
  CalendarEvent,
  CalendarExporter,
  Clock,
  IdGenerator,
  PasswordHasher,
  QrCodeGenerator,
  TokenGenerator,
} from "@/application/ports/services";

/** Concrete adapters for the non-repository ports. */

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds = 10) {}

  async hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, this.rounds);
  }

  async verify(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }
}

/**
 * Kiosk device tokens.
 *
 * These are high-entropy random strings rather than user-chosen secrets, so a
 * plain SHA-256 is the right hash: it is deterministic (needed to look a token
 * up by hash) and there is nothing to brute-force.
 */
export class Sha256TokenGenerator implements TokenGenerator {
  async generate() {
    const plaintext = `gfk_${randomBytes(24).toString("base64url")}`;

    return {
      plaintext,
      hash: await this.hash(plaintext),
      prefix: plaintext.slice(0, 12),
    };
  }

  async hash(plaintext: string): Promise<string> {
    return createHash("sha256").update(plaintext).digest("hex");
  }
}

export class QrCodeService implements QrCodeGenerator {
  async toSvg(payload: string, options?: { size?: number; margin?: number }): Promise<string> {
    return QRCode.toString(payload, {
      type: "svg",
      width: options?.size ?? 240,
      margin: options?.margin ?? 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0F172A", light: "#FFFFFF" },
    });
  }

  async toDataUrl(payload: string, options?: { size?: number; margin?: number }): Promise<string> {
    return QRCode.toDataURL(payload, {
      width: options?.size ?? 240,
      margin: options?.margin ?? 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0F172A", light: "#FFFFFF" },
    });
  }
}

/**
 * A minimal RFC 5545 writer.
 *
 * Hand-rolled rather than pulled from npm: the spec needs exactly one event
 * type, and this keeps the line-folding and escaping rules visible.
 */
export class ICalExporter implements CalendarExporter {
  toICal(
    events: readonly CalendarEvent[],
    options: { calendarName: string; timeZone?: string },
  ): string {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//GymFlow//Schedule//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeText(options.calendarName)}`,
      `X-WR-TIMEZONE:${options.timeZone ?? "UTC"}`,
    ];

    for (const event of events) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${event.uid}`,
        `DTSTAMP:${toICalDate(event.createdAt ?? new Date())}`,
        `DTSTART:${toICalDate(event.startsAt)}`,
        `DTEND:${toICalDate(event.endsAt)}`,
        `SUMMARY:${escapeText(event.title)}`,
        `STATUS:${event.status ?? "CONFIRMED"}`,
      );

      if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
      if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);

      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    return lines.map(foldLine).join("\r\n");
  }
}

function toICalDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** iCalendar lines must not exceed 75 octets; continuations start with a space. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;

  const parts: string[] = [line.slice(0, 75)];

  for (let index = 75; index < line.length; index += 74) {
    parts.push(` ${line.slice(index, index + 74)}`);
  }

  return parts.join("\r\n");
}
