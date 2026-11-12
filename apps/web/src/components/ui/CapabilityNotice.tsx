import type { ReactNode } from "react";
export function CapabilityNotice({
  supported,
  title,
  children,
}: {
  supported: boolean;
  title: string;
  children: ReactNode;
}) {
  if (supported) return null;
  return (
    <section className="notice" role="note">
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </section>
  );
}
