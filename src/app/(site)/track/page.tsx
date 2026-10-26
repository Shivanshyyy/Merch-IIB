import { redirect } from "next/navigation";

// The email + order-code lookup is gone: orders now live under the customer's account.
export default function TrackPage() {
  redirect("/orders");
}
