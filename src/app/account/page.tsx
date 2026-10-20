import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { currentUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { changePasswordAction } from "../actions";

export default async function AccountPage() {
  const u = await currentUser();
  if (!u) redirect("/login");
  const { t } = await getDict();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1>{t.navAccount}</h1>
      {u.mustChangePassword && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t.mustChangePassword}</p>}
      <ActionForm action={changePasswordAction} className="card space-y-4" resetOnSuccess>
        <h2>{t.changePassword}</h2>
        <div>
          <label className="label">{t.currentPassword}</label>
          <input name="current" type="password" className="input" required autoComplete="current-password" />
        </div>
        <div>
          <label className="label">{t.newPassword}</label>
          <input name="next" type="password" className="input" required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <label className="label">{t.confirmPassword}</label>
          <input name="confirm" type="password" className="input" required minLength={8} autoComplete="new-password" />
        </div>
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
    </div>
  );
}
