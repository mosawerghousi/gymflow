import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireActor } from "@/composition/auth";
import { container } from "@/composition/container";
import { PageHeader } from "@/presentation/components/layout/page-header";
import { MemberProfile } from "@/presentation/components/members/member-profile";
import { Button } from "@/presentation/components/ui/button";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { memberId } = await params;
  const member = await container.members.findById(memberId);

  return { title: member ? member.fullName : "Member" };
}

export default async function MemberDetailPage({ params }: Params) {
  const actor = await requireActor();
  actor.assertCan("members:read");

  const { memberId } = await params;
  const member = await container.members.findById(memberId);

  if (!member) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={member.fullName}
        description={`Member ${member.code.value}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/members">
              <ArrowLeft /> All members
            </Link>
          </Button>
        }
      />
      <MemberProfile
        memberId={memberId}
        canWrite={actor.can("members:write")}
        canDelete={actor.can("members:delete")}
      />
    </>
  );
}
