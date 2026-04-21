"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CompanyProfile = {
  company_id: string | null;
  role: "owner" | "admin" | "worker";
};

export async function createUser(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const requestedRole = String(formData.get("role") ?? "worker") as "owner" | "admin" | "worker";

  const actionClient = await createClient();
  const {
    data: { user: currentUser },
  } = await actionClient.auth.getUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  const { data: currentProfileData } = await actionClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", currentUser.id)
    .maybeSingle();
  const currentProfile = currentProfileData as CompanyProfile | null;

  if (!currentProfile?.company_id || !["owner", "admin"].includes(currentProfile.role)) {
    redirect("/dashboard/settings/users?error=Du+har+ikke+tilgang");
  }

  if (requestedRole === "owner" && currentProfile.role !== "owner") {
    redirect("/dashboard/settings/users?error=Kun+owner+kan+opprette+ny+owner");
  }

  const adminClient = createAdminClient();
  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
    },
  });

  if (createError || !createdUser.user) {
    redirect(
      `/dashboard/settings/users?error=${encodeURIComponent(
        createError?.message ?? "Klarte ikke opprette bruker",
      )}`,
    );
  }

  const { error: updateProfileError } = await adminClient
    .from("profiles")
    .update({
      company_id: currentProfile.company_id,
      role: requestedRole,
      full_name: fullName,
      phone: phone || null,
    })
    .eq("id", createdUser.user.id);

  if (updateProfileError) {
    redirect(
      `/dashboard/settings/users?error=${encodeURIComponent(updateProfileError.message)}`,
    );
  }

  redirect("/dashboard/settings/users?success=1");
}
