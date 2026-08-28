// You.tsx — the username entry page (design doc: routing section).
// Minimal dark page; validates the username via open search BEFORE
// navigating, so unknown names show an inline error with no navigation.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveUser, UnknownUserError } from "@/lib/arenaFetch";

const mono = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const You = () => {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "unknown" | "failed">("idle");
  const navigate = useNavigate();

  const submit = async () => {
    const slug = value.trim().toLowerCase().replace(/^@/, "").replace(/\/+$/, "").split("/").pop() ?? "";
    if (!slug) return;
    setState("checking");
    try {
      const user = await resolveUser(slug);
      navigate(`/${user.slug}`);
    } catch (e) {
      setState(e instanceof UnknownUserError ? "unknown" : "failed");
    }
  };

  return (
    <div
      className="relative h-screen w-screen overflow-hidden flex flex-col items-center justify-center gap-8"
      style={{ background: "#000004" }}
    >
      <p style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.34em",
        color: "rgba(255,255,255,0.55)", textTransform: "uppercase" }}>
        your galaxy
      </p>
      <p style={{ fontSize: 14, fontWeight: 300, color: "rgba(255,255,255,0.65)", letterSpacing: "0.04em" }}>
        every Are.na collection has a shape — see yours
      </p>

      <div className="w-80">
        <input
          type="text"
          autoFocus
          placeholder="your are.na username…"
          value={value}
          onChange={(e) => { setValue(e.target.value); setState("idle"); }}
          onKeyDown={(e) => e.key === "Enter" && state !== "checking" && submit()}
          className="w-full rounded-full border border-white/[0.14] bg-white/[0.06] py-2.5 px-5 text-[16px] sm:text-[13px] text-white/95 placeholder:text-white/45 backdrop-blur-xl outline-none focus:border-white/30 transition-colors tracking-wide text-center"
        />
        <div style={{ minHeight: 22, marginTop: 10, textAlign: "center" }}>
          {state === "checking" && (
            <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
              looking up…
            </span>
          )}
          {state === "unknown" && (
            <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em",
              textTransform: "uppercase", color: "rgba(255,160,140,0.75)" }}>
              no one here by that name — try your profile url: are.na/username
            </span>
          )}
          {state === "failed" && (
            <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em",
              textTransform: "uppercase", color: "rgba(255,160,140,0.75)" }}>
              are.na isn't answering — try again
            </span>
          )}
        </div>
      </div>

      <p style={{ position: "absolute", bottom: 20, left: 24,
        fontFamily: mono, fontSize: 10, letterSpacing: "0.28em",
        textTransform: "uppercase", color: "rgba(255,255,255,0.30)",
        userSelect: "none", pointerEvents: "none" }}>
        stare.na
      </p>
    </div>
  );
};

export default You;
