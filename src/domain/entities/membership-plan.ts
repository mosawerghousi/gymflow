import { ValidationError } from "../errors";

export interface MembershipPlanProps {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MembershipPlan {
  private props: MembershipPlanProps;

  constructor(props: MembershipPlanProps) {
    MembershipPlan.assertValid(props);
    this.props = { ...props };
  }

  private static assertValid(props: Pick<MembershipPlanProps, "name" | "priceCents" | "durationDays">): void {
    if (!props.name.trim()) {
      throw new ValidationError("A plan needs a name.", { field: "name" });
    }

    if (!Number.isInteger(props.priceCents) || props.priceCents < 0) {
      throw new ValidationError("Price must be a whole number of cents, zero or more.", {
        field: "priceCents",
      });
    }

    if (!Number.isInteger(props.durationDays) || props.durationDays < 1) {
      throw new ValidationError("A plan must last at least one day.", { field: "durationDays" });
    }
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
  }
  get priceCents(): number {
    return this.props.priceCents;
  }
  get durationDays(): number {
    return this.props.durationDays;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }

  /** Monthly-equivalent price, used to compare plans of different lengths in reports. */
  get monthlyEquivalentCents(): number {
    return Math.round((this.props.priceCents / this.props.durationDays) * 30);
  }

  update(changes: Partial<Omit<MembershipPlanProps, "id" | "createdAt">>, now: Date): void {
    const next = { ...this.props, ...changes };
    MembershipPlan.assertValid(next);
    this.props = { ...next, updatedAt: now };
  }

  snapshot(): MembershipPlanProps {
    return { ...this.props };
  }
}
