import { site } from "@/config/site";
import type { Design, DesignStatus, DesignerStatus } from "@/lib/types";

export const DESIGN_STATUS_LABEL: Record<DesignStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  live: "Live",
  retired: "Retired",
};

export const DESIGNER_STATUS_LABEL: Record<DesignerStatus, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Not approved",
  suspended: "Suspended",
};

// Who may move a design where: the designer submits, the admin reviews and publishes.
const NEXT: Record<DesignStatus, DesignStatus[]> = {
  draft: ["in_review"],
  in_review: ["approved", "changes_requested", "rejected"],
  changes_requested: ["in_review"],
  approved: ["live", "changes_requested", "rejected"],
  rejected: [],
  live: ["retired"],
  retired: [],
};

export const canMove = (from: DesignStatus, to: DesignStatus) => NEXT[from].includes(to);

// The designer may edit (and delete) only while the design is theirs to work on.
export const designerCanEdit = (status: DesignStatus) => status === "draft" || status === "changes_requested";
export const designerCanDelete = (status: DesignStatus) => status === "draft";

// What's missing before a design can go to review; empty means ready.
export function submitProblems(d: Pick<Design, "title" | "images" | "colorways" | "originality_confirmed_at">): string[] {
  const problems: string[] = [];
  if (d.title.trim().length < 2) problems.push("Give the design a title.");
  if (d.images.length === 0) problems.push("Upload at least one image.");
  if (d.colorways.length === 0) problems.push("Pick at least one garment colour.");
  if (!d.originality_confirmed_at) problems.push("Confirm the design is your own work.");
  return problems;
}

export const MAX_IMAGES = site.maxDesignImages;

// What each status means to the designer, in one line.
export const DESIGN_STATUS_HELP: Record<DesignStatus, string> = {
  draft: "Only you can see this. Add images, then send it for review.",
  in_review: "The team is looking at it. You'll see their reply here.",
  changes_requested: "The team asked for changes. Update the design and send it back.",
  approved: "Approved. The team will put it live in the store soon.",
  rejected: "The team decided not to sell this one.",
  live: "Live in the store.",
  retired: "No longer on sale.",
};
