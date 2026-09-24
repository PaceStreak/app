import { useCallback } from "react";
import { toast } from "../../components/toast";
import { api, errorText } from "../../lib/api";
import { queryClient } from "../../lib/queries";
import { useSession } from "../../lib/session";
import type { Me, Profile } from "../../lib/types";

/** Save a profile change and update the session copy in place. */
export function useProfilePatch() {
  const { me, setMe } = useSession();
  return useCallback(
    async (patch: Partial<Profile> & { weekly_target?: number }, done?: string) => {
      try {
        const res = await api<{ profile: Profile }>("/me/profile", { method: "PATCH", body: patch });
        if (me) setMe({ ...me, profile: res.profile } as Me);
        if (done) toast.success(done);
        void queryClient.invalidateQueries({ queryKey: ["stats"] });
        return true;
      } catch (err) {
        toast.error(errorText(err));
        return false;
      }
    },
    [me, setMe],
  );
}
