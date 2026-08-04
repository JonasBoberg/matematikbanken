import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Supabase klient
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

// Kontrollera auth status
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

// Logga ut
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
