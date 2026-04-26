"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole, isAssignableRole, type AppRole } from "@/lib/roles";

type CompanyProfile = {
  company_id: string | null;
  role: string;
};

function canCreateRole(creatorRole: string, requestedRole: AppRole): boolean {
  if (isAdminRole(creatorRole)) {
    if (requestedRole === "owner") return creatorRole === "owner";
    return true;
  }
  if (creatorRole === "installator") {
    return requestedRole === "montor";
  }
  return false;
}

export async function createUser(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const requestedRoleRaw = String(formData.get("role") ?? "montor");

  if (!isAssignableRole(requestedRoleRaw)) {
    redirect("/dashboard/settings/users?new=1&error=Ugyldig+rolle");
  }
  const requestedRole = requestedRoleRaw as AppRole;

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

  if (
    !currentProfile?.company_id ||
    (!isAdminRole(currentProfile.role) && currentProfile.role !== "installator")
  ) {
    redirect("/dashboard/settings/users?new=1&error=Du+har+ikke+tilgang");
  }

  if (!canCreateRole(currentProfile.role, requestedRole)) {
    redirect("/dashboard/settings/users?new=1&error=Du+kan+bare+opprette+tillatte+roller");
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
      `/dashboard/settings/users?new=1&error=${encodeURIComponent(
        createError?.message ?? "Klarte ikke opprette bruker",
      )}`,
    );
  }

  const { error: updateProfileError } = await adminClient
    .from("profiles")
    .upsert(
      {
        id: createdUser.user.id,
        company_id: currentProfile.company_id,
        role: requestedRole,
        full_name: fullName,
        phone: phone || null,
      },
      { onConflict: "id" },
    );

  if (updateProfileError) {
    redirect(
      `/dashboard/settings/users?new=1&error=${encodeURIComponent(updateProfileError.message)}`,
    );
  }

  redirect("/dashboard/settings/users?success=bruker-opprettet");
}

export async function setBlueprintAccessForWorkers(formData: FormData) {
  const requestedUserIds = formData
    .getAll("worker_user_id")
    .map((v) => String(v).trim())
    .filter((id) => id.length > 0);
  const requestedProjectIds = formData
    .getAll("project_id")
    .map((v) => String(v).trim())
    .filter((id) => id.length > 0);
  const allProjects = String(formData.get("all_projects") ?? "") === "1";

  const actionClient = await createClient();
  const {
    data: { user: currentUser },
  } = await actionClient.auth.getUser();
  if (!currentUser) redirect("/auth/login");

  const { data: currentProfileData } = await actionClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", currentUser.id)
    .maybeSingle();
  const currentProfile = currentProfileData as CompanyProfile | null;
  if (
    !currentProfile?.company_id ||
    (!isAdminRole(currentProfile.role) && currentProfile.role !== "installator")
  ) {
    redirect("/dashboard/settings/users?error=Du+har+ikke+tilgang");
  }

  if (requestedUserIds.length === 0) {
    redirect("/dashboard/settings/users?error=Velg+minst+en+montør");
  }

  const adminClient = createAdminClient();

  const { data: workerRows, error: workerErr } = await adminClient
    .from("profiles")
    .select("id")
    .eq("company_id", currentProfile.company_id)
    .eq("role", "montor")
    .in("id", Array.from(new Set(requestedUserIds)));
  if (workerErr) {
    redirect(`/dashboard/settings/users?error=${encodeURIComponent(workerErr.message)}`);
  }
  const workerIds = (workerRows ?? []).map((r) => (r as { id: string }).id);
  if (workerIds.length === 0) {
    redirect("/dashboard/settings/users?error=Fant+ingen+gyldige+montører");
  }

  let projectIds: string[] = [];
  if (allProjects) {
    const { data: projectRows, error: projectErr } = await adminClient
      .from("projects")
      .select("id")
      .eq("company_id", currentProfile.company_id);
    if (projectErr) {
      redirect(`/dashboard/settings/users?error=${encodeURIComponent(projectErr.message)}`);
    }
    projectIds = (projectRows ?? []).map((r) => (r as { id: string }).id);
  } else {
    if (requestedProjectIds.length === 0) {
      redirect("/dashboard/settings/users?error=Velg+minst+en+tegning+(prosjekt)+eller+Alle+tegninger");
    }
    const { data: projectRows, error: projectErr } = await adminClient
      .from("projects")
      .select("id")
      .eq("company_id", currentProfile.company_id)
      .in("id", Array.from(new Set(requestedProjectIds)));
    if (projectErr) {
      redirect(`/dashboard/settings/users?error=${encodeURIComponent(projectErr.message)}`);
    }
    projectIds = (projectRows ?? []).map((r) => (r as { id: string }).id);
  }

  if (projectIds.length === 0) {
    redirect("/dashboard/settings/users?error=Ingen+prosjekter+funnet");
  }

  const { error: deleteErr } = await adminClient
    .from("project_blueprint_access")
    .delete()
    .in("project_id", projectIds)
    .in("user_id", workerIds);
  if (deleteErr) {
    redirect(`/dashboard/settings/users?error=${encodeURIComponent(deleteErr.message)}`);
  }

  const rows = projectIds.flatMap((projectId) => workerIds.map((userId) => ({ project_id: projectId, user_id: userId })));
  const { error: insertErr } = await adminClient.from("project_blueprint_access").insert(rows);
  if (insertErr) {
    redirect(`/dashboard/settings/users?error=${encodeURIComponent(insertErr.message)}`);
  }

  redirect("/dashboard/settings/users?success=blueprint-access-updated");
}

export async function updateUser(formData: FormData) {
  const targetId = String(formData.get("user_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const requestedRoleRaw = String(formData.get("role") ?? "").trim();

  if (!targetId) redirect("/dashboard/settings/users?error=Mangler+bruker-ID");
  if (!fullName) redirect("/dashboard/settings/users?error=Navn+er+påkrevd");
  if (!isAssignableRole(requestedRoleRaw)) redirect("/dashboard/settings/users?error=Ugyldig+rolle");
  const requestedRole = requestedRoleRaw as AppRole;

  const actionClient = await createClient();
  const { data: { user: currentUser } } = await actionClient.auth.getUser();
  if (!currentUser) redirect("/auth/login");

  const { data: currentProfileData } = await actionClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", currentUser.id)
    .maybeSingle();
  const currentProfile = currentProfileData as CompanyProfile | null;
  if (!currentProfile?.company_id || !isAdminRole(currentProfile.role))
    redirect("/dashboard/settings/users?error=Du+har+ikke+tilgang");

  const adminClient = createAdminClient();

  const { data: targetData } = await adminClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", targetId)
    .maybeSingle();
  const target = targetData as CompanyProfile | null;
  if (!target || target.company_id !== currentProfile.company_id)
    redirect("/dashboard/settings/users?error=Bruker+ikke+funnet");

  if (requestedRole === "owner" && currentProfile.role !== "owner")
    redirect("/dashboard/settings/users?error=Kun+owner+kan+sette+owner-rolle");
  if (target.role === "owner" && currentProfile.role !== "owner")
    redirect("/dashboard/settings/users?error=Kan+ikke+endre+owner");

  const { error } = await adminClient
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null, role: requestedRole })
    .eq("id", targetId);
  if (error) redirect(`/dashboard/settings/users?error=${encodeURIComponent(error.message)}`);

  redirect("/dashboard/settings/users?success=updated");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function canDeleteUser(deleterRole: string, targetRole: string): boolean {
  const t = targetRole === "worker" ? "montor" : targetRole;
  if (t === "owner") return false;
  if (deleterRole === "owner") return true;
  if (deleterRole === "admin") return t === "montor" || t === "apprentice" || t === "installator";
  return false;
}

export async function deleteUser(formData: FormData) {
  const rawId = String(formData.get("user_id") ?? "").trim();
  if (!rawId || !UUID_RE.test(rawId)) {
    redirect("/dashboard/settings/users?error=Ugyldig+bruker");
  }
  const userIdToDelete = rawId;

  const actionClient = await createClient();
  const {
    data: { user: currentUser },
  } = await actionClient.auth.getUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  if (userIdToDelete === currentUser.id) {
    redirect("/dashboard/settings/users?error=Du+kan+ikke+slette+deg+selv");
  }

  const { data: currentProfileData } = await actionClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", currentUser.id)
    .maybeSingle();
  const currentProfile = currentProfileData as CompanyProfile | null;

  if (!currentProfile?.company_id || !isAdminRole(currentProfile.role)) {
    redirect("/dashboard/settings/users?error=Du+har+ikke+tilgang");
  }

  const adminClient = createAdminClient();

  const { data: targetData, error: targetErr } = await adminClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", userIdToDelete)
    .maybeSingle();

  if (targetErr || !targetData) {
    redirect(
      `/dashboard/settings/users?error=${encodeURIComponent(targetErr?.message ?? "Bruker ikke funnet")}`,
    );
  }

  const target = targetData as CompanyProfile;
  if (target.company_id !== currentProfile.company_id) {
    redirect("/dashboard/settings/users?error=Brukeren+tilhører+ikke+dette+firmaet");
  }

  if (!canDeleteUser(currentProfile.role, target.role)) {
    redirect("/dashboard/settings/users?error=Du+har+ikke+tilgang+til+å+slette+denne+rollen");
  }

  const reassignTo = currentUser.id;

  const { error: p1 } = await adminClient.from("projects").update({ created_by: reassignTo }).eq("created_by", userIdToDelete);
  if (p1) {
    redirect(`/dashboard/settings/users?error=${encodeURIComponent(p1.message)}`);
  }

  const { error: d1 } = await adminClient.from("drawings").update({ uploaded_by: reassignTo }).eq("uploaded_by", userIdToDelete);
  if (d1) {
    redirect(`/dashboard/settings/users?error=${encodeURIComponent(d1.message)}`);
  }

  const { error: pin1 } = await adminClient.from("pins").update({ created_by: reassignTo }).eq("created_by", userIdToDelete);
  if (pin1) {
    redirect(`/dashboard/settings/users?error=${encodeURIComponent(pin1.message)}`);
  }
  const { error: pin2 } = await adminClient.from("pins").update({ updated_by: reassignTo }).eq("updated_by", userIdToDelete);
  if (pin2) {
    redirect(`/dashboard/settings/users?error=${encodeURIComponent(pin2.message)}`);
  }

  const { error: asg } = await adminClient.from("project_assignments").update({ assigned_by: null }).eq("assigned_by", userIdToDelete);
  if (asg) {
    redirect(`/dashboard/settings/users?error=${encodeURIComponent(asg.message)}`);
  }

  const { error: scans } = await adminClient.from("item_scans").update({ scanned_by: reassignTo }).eq("scanned_by", userIdToDelete);
  if (scans) {
    redirect(`/dashboard/settings/users?error=${encodeURIComponent(scans.message)}`);
  }

  const { error: delAuth } = await adminClient.auth.admin.deleteUser(userIdToDelete);
  if (delAuth) {
    redirect(`/dashboard/settings/users?error=${encodeURIComponent(delAuth.message)}`);
  }

  redirect("/dashboard/settings/users?success=deleted");
}
