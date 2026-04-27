"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function changePassword(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!newPassword || newPassword.length < 8) {
    redirect("/dashboard/settings/profile?pw_error=Nytt+passord+må+være+minst+8+tegn");
  }
  if (newPassword !== confirmPassword) {
    redirect("/dashboard/settings/profile?pw_error=Passordene+stemmer+ikke+overens");
  }

  // Verify current password before allowing the change
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });
  if (signInError) {
    redirect("/dashboard/settings/profile?pw_error=Nåværende+passord+er+feil");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    redirect(`/dashboard/settings/profile?pw_error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard/settings/profile?pw_success=1");
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName) {
    redirect("/dashboard/settings/profile?error=Navn+er+påkrevd");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: phone || null,
    })
    .eq("id", user.id);

  if (error) {
    redirect(`/dashboard/settings/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/profile");
  redirect("/dashboard/settings/profile?success=1");
}
