import { redirect } from "next/navigation";

export default function ChainRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  // Forward any query params (e.g. ?storyline=123)
  void searchParams;
  redirect("/create?tab=chain");
}
