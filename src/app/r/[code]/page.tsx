import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReviewFlow, type FlowProps } from "@/components/customer/ReviewFlow";
import { LockedReviewPage } from "@/components/customer/LockedReviewPage";
import { sampleSuggestions } from "@/lib/ai/pool";
import { readableBrandColor } from "@/lib/contrast";
import { loadQrContext } from "@/lib/data/customer";
import { env } from "@/lib/env";

export async function generateMetadata(props: PageProps<"/r/[code]">): Promise<Metadata> {
  const { code } = await props.params;
  const ctx = await loadQrContext(code);
  return { title: ctx ? `Rate your visit · ${ctx.business.name}` : "Review page" };
}

export default async function ReviewPage(props: PageProps<"/r/[code]">) {
  await connection();
  const { code } = await props.params;
  const ctx = await loadQrContext(code);
  if (!ctx) notFound();

  const brand = readableBrandColor(ctx.business.brandColor).color;
  const common = {
    businessId: ctx.business.id,
    businessName: ctx.business.name,
    logoVersion: ctx.business.logoVersion,
    branchName: ctx.branch.name,
    cityArea: ctx.branch.cityArea,
    googleUrl: ctx.branch.googleReviewUrl,
    facebookUrl: ctx.branch.facebookReviewUrl,
    brand,
  };
  if (!ctx.serviceable) return <LockedReviewPage {...common} />;

  const langs = ctx.branch.languages;
  const [four, five] = await Promise.all([
    sampleSuggestions(ctx.branch.id, 4, ctx.staffName),
    sampleSuggestions(ctx.branch.id, 5, ctx.staffName),
  ]);
  const onlyEnabled = (list: typeof four) => list.filter((s) => langs.includes(s.language));
  const flow: FlowProps = {
    ...common,
    code: ctx.qr.code,
    tableLabel: ctx.qr.tableLabel,
    staffName: ctx.staffName,
    languages: langs,
    suggestions: { 4: onlyEnabled(four), 5: onlyEnabled(five) },
    turnstileSiteKey: env().TURNSTILE_SITE_KEY ?? null,
  };
  return <ReviewFlow {...flow} />;
}
