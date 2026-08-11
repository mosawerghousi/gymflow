import { ValidationError } from "../errors";

const PREFIX = "GF";
const DIGITS = 6;
const PATTERN = /^GF-\d{6}$/;

/**
 * The short human-typeable identifier printed on a member card and entered at
 * the kiosk. Format: `GF-000123`.
 */
export class MemberCode {
  private constructor(readonly value: string) {}

  static create(raw: string): MemberCode {
    const normalized = MemberCode.normalize(raw);

    if (!PATTERN.test(normalized)) {
      throw new ValidationError(
        `"${raw}" is not a valid member code. Expected the format GF-000123.`,
        { field: "memberCode" },
      );
    }

    return new MemberCode(normalized);
  }

  /** Builds a code from a sequence number, e.g. 123 -> `GF-000123`. */
  static fromSequence(sequence: number): MemberCode {
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999_999) {
      throw new ValidationError(
        `Cannot build a member code from sequence ${sequence}; expected 1–999999.`,
        { field: "sequence" },
      );
    }

    return new MemberCode(`${PREFIX}-${String(sequence).padStart(DIGITS, "0")}`);
  }

  /**
   * Accepts what a human might type at the front desk or kiosk — lower case,
   * missing prefix, spaces, or a plain number — and normalizes it.
   */
  static normalize(raw: string): string {
    const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");

    if (/^\d+$/.test(cleaned) && cleaned.length <= DIGITS) {
      return `${PREFIX}-${cleaned.padStart(DIGITS, "0")}`;
    }

    if (/^GF\d{6}$/.test(cleaned)) {
      return `${PREFIX}-${cleaned.slice(2)}`;
    }

    return cleaned;
  }

  /** Non-throwing variant for search boxes where invalid input is expected. */
  static tryCreate(raw: string): MemberCode | null {
    try {
      return MemberCode.create(raw);
    } catch {
      return null;
    }
  }

  get sequence(): number {
    return Number.parseInt(this.value.slice(3), 10);
  }

  equals(other: MemberCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
