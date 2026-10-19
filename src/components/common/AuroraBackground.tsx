/**
 * The subtle animated gradient behind the public and auth layouts. Decorative only:
 * it is never used inside the application shell, where dense data needs flat surfaces.
 * The global reduced-motion rule in base.css stops the drift.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg"
    >
      <div className="absolute -top-1/4 -left-1/4 size-[70vmax] animate-aurora rounded-full bg-[radial-gradient(closest-side,var(--color-aurora-1),transparent)] blur-3xl" />
      <div className="absolute top-1/3 -right-1/4 size-[60vmax] animate-aurora rounded-full bg-[radial-gradient(closest-side,var(--color-aurora-2),transparent)] blur-3xl [animation-delay:-8s] [animation-direction:alternate-reverse]" />
      <div className="absolute -bottom-1/3 left-1/4 size-[55vmax] animate-aurora rounded-full bg-[radial-gradient(closest-side,var(--color-aurora-3),transparent)] blur-3xl [animation-delay:-14s]" />
      {/* A faint grid gives the gradient some structure without competing with content. */}
      <div className="absolute inset-0 bg-[linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.12] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
    </div>
  );
}
