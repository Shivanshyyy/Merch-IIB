import type { Metadata } from "next";
import { TrackForm } from "@/components/track/TrackForm";

export const metadata: Metadata = { title: "Track your order" };

export default function TrackPage() {
  return (
    <div className="page">
      <div className="shell">
        <p className="label">[ 04 ] — Order status</p>
        <h1 className="t-display t-h1 mt-4">Track</h1>
        <TrackForm />
      </div>
    </div>
  );
}
