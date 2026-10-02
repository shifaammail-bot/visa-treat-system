import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Country, VisaProduct } from "@/lib/types";

export const getCountries = cache(async (): Promise<Country[]> => {
  const { data } = await createAdminClient()
    .from("countries")
    .select("code, name")
    .eq("active", true)
    .order("name");
  return data ?? [];
});

export const getProducts = cache(async (): Promise<VisaProduct[]> => {
  const { data } = await createAdminClient()
    .from("visa_products")
    .select("*")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  return (data ?? []) as VisaProduct[];
});

/** Used when a product has no terms of its own yet. */
export const PLACEHOLDER_TERMS = [
  "Placeholder terms — destination-specific wording to follow.",
  "Visa fees paid to the embassy or issuing authority are non-refundable.",
  "The service fee covers document review, form filling and appointment booking. It is non-refundable once the application has been submitted.",
  "Visa approval, processing time and validity are decided solely by the embassy or authority. We cannot guarantee an outcome.",
  "The applicant is responsible for the accuracy and authenticity of all documents provided.",
].join("\n");
