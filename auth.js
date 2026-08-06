// Temporärt inaktiverat inloggningssystem.
// Det gamla Supabase-flödet finns kvar som kommentar för enkel återaktivering senare.

/*
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "https://fmbmwbhcngtjkfvtvgcx.supabase.co",
  "sb_publishable_L0aRR9ZevImAgl0moi20MQ_bp80Xf67",
  {
    auth: {
      persistSession: true,
      storage: localStorage
    }
  }
);

export async function checkAuth() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Auth check error:", error);
    return null;
  }

  if (!session) {
    window.location.href = "./login.html";
    return null;
  }

  return session.user;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Logout error:", error);
    alert("Kunde inte logga ut");
    return;
  }

  console.log("Utloggad!");
  window.location.href = "./login.html";
}
*/

export const supabase = null;

export async function checkAuth() {
  console.log("Auth är temporärt inaktiverat.");
  return {
    id: "demo-user",
    email: "demo@matematikbanken.local"
  };
}

export async function logout() {
  console.log("Logout är temporärt inaktiverat.");
  window.location.href = "./index.html";
}
