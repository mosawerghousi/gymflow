import { ValidationError } from "../errors";

const PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class EmailAddress {
  private constructor(readonly value: string) {}

  static create(raw: string): EmailAddress {
    const normalized = raw.trim().toLowerCase();

    if (!PATTERN.test(normalized)) {
      throw new ValidationError(`"${raw}" is not a valid email address.`, { field: "email" });
    }

    return new EmailAddress(normalized);
  }

  static tryCreate(raw: string): EmailAddress | null {
    try {
      return EmailAddress.create(raw);
    } catch {
      return null;
    }
  }

  get domain(): string {
    return this.value.slice(this.value.indexOf("@") + 1);
  }

  equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
