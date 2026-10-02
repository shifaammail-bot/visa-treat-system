import type { Status } from "@/lib/types";

/**
 * Which status each status may move to by hand. "quoted" is reached by saving
 * a quote; approved, rejected and cancelled are final.
 */
export const NEXT_STATUS: Record<Status, Status[]> = {
  enquiry: ["cancelled"],
  quoted: ["submitted", "cancelled"],
  submitted: ["approved", "rejected", "cancelled"],
  approved: [],
  rejected: [],
  cancelled: [],
};
